//! DORMANT Pre-Alpha Combat P0 authoritative LMB gesture decision reducer.
//!
//! Developer-approved design/test only: no QUIC ingress or simulation callers,
//! no runtime v2 enablement. Callers must bind the lease to an authenticated
//! connection, use real monotonic server time, and apply commands ONLY after
//! validating actual World action/tick ownership (especially active hit).
//! This reducer never accepts a client timestamp for attack authorization.

use std::collections::VecDeque;

use crate::prealpha_lmb_gesture_proposal::{
    GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};

const LIGHT_WINDUP_MS: u64 = 135;
const HEAVY_READY_MS: u64 = 320;
const MAX_REPLAY_JOURNAL: usize = 64;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Phase {
    Idle,
    LightWindup,
    LightActive,
    HeavyCharging,
    HeavyReady,
    HeavyActive,
    JumpPending,
    Cancelled,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Disposition {
    Accepted,
    Duplicate,
    Stale,
    Rejected,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Command {
    None,
    BeginLightWindup,
    // Review-only World gate. No typed wire event may produce this command
    // until Main 0 approves a single authenticated Space+LMB ingress route.
    BeginJumpAttack,
    ActivateLight,
    UpgradeHeldHeavy { server_elapsed_ms: u64 },
    HeavyReady,
    ResumeLight { server_elapsed_ms: u64 },
    ReleaseHeavy,
    CancelUnlandedLight,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Decision {
    pub disposition: Disposition,
    pub command: Command,
}

impl Decision {
    const fn new(disposition: Disposition, command: Command) -> Self {
        Self {
            disposition,
            command,
        }
    }

    const fn rejected() -> Self {
        Self::new(Disposition::Rejected, Command::None)
    }
}

/// One authenticated connection's unactivated LMB intent.
#[derive(Clone)]
pub struct GestureAuthority {
    lease_epoch: u64,
    last_server_ms: u64,
    phase: Phase,
    active_id: Option<u32>,
    active_source: Option<GestureSource>,
    // One distinct physically held source can arrive while World is already
    // executing the other. Admit and tombstone its edges without World damage.
    // This is NOT another active combat action or an actor authorization.
    busy_source: Option<(GestureSource, u32)>,
    // World may retire an un-released previous owner before it physically
    // lifts the key; that one authentic old terminal is no-combat.
    displaced_held_source: Option<(GestureSource, u32)>,
    highest_gesture_id: u32,
    highest_sequence: u32,
    press_ms: u64,
    released: bool,
    accepted: VecDeque<TypedGestureEvent>,
}

impl GestureAuthority {
    pub fn new(lease_epoch: u64) -> Self {
        Self {
            lease_epoch,
            last_server_ms: 0,
            phase: Phase::Idle,
            active_id: None,
            active_source: None,
            busy_source: None,
            displaced_held_source: None,
            highest_gesture_id: 0,
            highest_sequence: 0,
            press_ms: 0,
            released: false,
            accepted: VecDeque::with_capacity(MAX_REPLAY_JOURNAL),
        }
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    /// One global monotonic accepted sequence across both typed sources.
    /// The ingress uses this only while it owns the original World lock.
    pub fn highest_accepted_sequence(&self) -> u32 {
        self.highest_sequence
    }

    pub fn process(&mut self, lease: u64, event: GestureEvent, server_ms: u64) -> Decision {
        self.process_typed(lease, GestureSource::Lmb, event, server_ms)
    }

    /// One monotonic accepted sequence/replay journal for both typed sources.
    /// Source ownership is attached to the active gesture; KeyE cannot
    /// release/upgrade/cancel an LMB gesture with identical numbers.
    pub fn process_typed(
        &mut self,
        lease: u64,
        source: GestureSource,
        event: GestureEvent,
        server_ms: u64,
    ) -> Decision {
        self.process_world_typed(lease, source, event, server_ms, true)
    }

    pub(crate) fn owns_pending_jump(&self, id: u32) -> bool {
        self.phase == Phase::JumpPending && self.active_id == Some(id)
    }

    pub(crate) fn process_world_typed(
        &mut self,
        lease: u64,
        source: GestureSource,
        event: GestureEvent,
        server_ms: u64,
        jump_allowed: bool,
    ) -> Decision {
        // E is reserved for future Use. Never admit its legacy Combat source.
        if source == GestureSource::KeyE {
            return Decision::rejected();
        }
        if lease != self.lease_epoch
            || lease == 0
            || server_ms < self.last_server_ms
            || event.sequence == 0
            || event.gesture_id == 0
        {
            return Decision::rejected();
        }

        if let Some(previous) = self
            .accepted
            .iter()
            .find(|previous| previous.event.sequence == event.sequence)
        {
            return if *previous == (TypedGestureEvent { source, event }) {
                Decision::new(Disposition::Duplicate, Command::None)
            } else {
                Decision::rejected()
            };
        }
        if event.sequence <= self.highest_sequence {
            return Decision::new(Disposition::Stale, Command::None);
        }

        let elapsed = server_ms.saturating_sub(self.press_ms);
        if event.action != GestureAction::Press
            && self.active_id == Some(event.gesture_id)
            && self.active_source != Some(source)
        {
            return Decision::rejected();
        }
        let command = match event.action {
            // One globally sequenced, independently identified source can be
            // physically pressed while the other source owns the combat action.
            // Its PRESSED/terminal edges are still real transport inputs and
            // must not fatally retire the shared Core8A outbox. Retire them as
            // no-combat events, not as a second attack or a fabricated hit.
            GestureAction::Press | GestureAction::JumpAttack
                if ((self.active_id.is_some()
                    && (self.active_source != Some(source) || self.released))
                    || (event.action == GestureAction::JumpAttack
                        && !jump_allowed
                        && self.active_id.is_none()))
                    && self.busy_source.is_none()
                    && event.gesture_id > self.highest_gesture_id =>
            {
                self.busy_source = Some((source, event.gesture_id));
                self.highest_gesture_id = event.gesture_id;
                Command::None
            }
            // A real held LMB may UPGRADE while the independent KeyE is the
            // only World attack. ACK this ordered input without changing the
            // KeyE-owned World or upgrading it to an accidental second heavy.
            // UI10 shares ONE fatal-on-REJECTED outbox for both sources.
            GestureAction::Upgrade
                if source == GestureSource::Lmb
                    && self.busy_source == Some((source, event.gesture_id)) =>
            {
                Command::None
            }
            GestureAction::Release | GestureAction::Cancel
                if self.busy_source == Some((source, event.gesture_id)) =>
            {
                self.busy_source = None;
                Command::None
            }
            GestureAction::Release | GestureAction::Cancel
                if self.displaced_held_source == Some((source, event.gesture_id)) =>
            {
                // Accepted into existing bounded transport journal; no hit,
                // no release/upgrade of the CURRENT source1/0 World owner.
                self.displaced_held_source = None;
                Command::None
            }
            // One authenticated source0 physical Space+LMB DOWN. It is an
            // admitted *intent*, not an attack or a client-authorized Jump.
            // Session World adapter waits for an actual 60Hz World Jump.
            GestureAction::JumpAttack
                if source == GestureSource::Lmb
                    && self.phase == Phase::Idle
                    && event.gesture_id > self.highest_gesture_id =>
            {
                self.active_id = Some(event.gesture_id);
                self.active_source = Some(source);
                self.highest_gesture_id = event.gesture_id;
                self.press_ms = server_ms;
                self.phase = Phase::JumpPending;
                self.released = false;
                Command::None
            }
            GestureAction::Press
                if self.phase == Phase::Idle && event.gesture_id > self.highest_gesture_id =>
            {
                self.active_id = Some(event.gesture_id);
                self.active_source = Some(source);
                self.highest_gesture_id = event.gesture_id;
                self.press_ms = server_ms;
                self.phase = Phase::LightWindup;
                self.released = false;
                Command::BeginLightWindup
            }
            GestureAction::Upgrade
                if self.active_id == Some(event.gesture_id)
                    && self.phase == Phase::LightWindup
                    && source == GestureSource::Lmb
                    && !self.released
                    && elapsed < LIGHT_WINDUP_MS =>
            {
                self.phase = Phase::HeavyCharging;
                Command::UpgradeHeldHeavy {
                    server_elapsed_ms: elapsed,
                }
            }
            // A genuine same-lease UPGRADE may arrive after original Light
            // has already activated (e.g. a busy browser or delayed QUIC).
            // It is an admitted physical edge but is forever NO-COMBAT:
            // the authoritative World has already committed to Light.
            // REJECTED would unnecessarily retire the otherwise healthy
            // shared browser outbox before its matching physical RELEASE.
            GestureAction::Upgrade
                if self.active_id == Some(event.gesture_id)
                    && source == GestureSource::Lmb
                    && !self.released
                    && (self.phase == Phase::LightActive
                        || (self.phase == Phase::LightWindup && elapsed >= LIGHT_WINDUP_MS)) =>
            {
                Command::None
            }
            GestureAction::Release
                if self.active_id == Some(event.gesture_id) && !self.released =>
            {
                match self.phase {
                    Phase::JumpPending => {
                        self.released = true;
                        Command::None
                    }
                    Phase::HeavyReady => {
                        self.phase = Phase::HeavyActive;
                        self.released = true;
                        Command::ReleaseHeavy
                    }
                    Phase::HeavyCharging if elapsed >= HEAVY_READY_MS => {
                        self.phase = Phase::HeavyActive;
                        self.released = true;
                        Command::ReleaseHeavy
                    }
                    Phase::HeavyCharging => {
                        self.phase = if elapsed >= LIGHT_WINDUP_MS {
                            Phase::LightActive
                        } else {
                            Phase::LightWindup
                        };
                        self.released = true;
                        Command::ResumeLight {
                            server_elapsed_ms: elapsed,
                        }
                    }
                    Phase::LightWindup => {
                        self.released = true;
                        if elapsed >= LIGHT_WINDUP_MS {
                            self.phase = Phase::LightActive;
                            Command::ActivateLight
                        } else {
                            Command::None
                        }
                    }
                    Phase::LightActive => {
                        self.released = true;
                        Command::None
                    }
                    Phase::Idle | Phase::HeavyActive | Phase::Cancelled => {
                        return Decision::rejected()
                    }
                }
            }
            GestureAction::Cancel if self.active_id == Some(event.gesture_id) && !self.released => {
                self.released = true;
                match self.phase {
                    Phase::JumpPending => {
                        self.phase = Phase::Cancelled;
                        Command::None
                    }
                    Phase::HeavyCharging | Phase::HeavyReady => {
                        self.phase = Phase::Cancelled;
                        Command::CancelUnlandedLight
                    }
                    Phase::LightWindup if elapsed < LIGHT_WINDUP_MS => {
                        self.phase = Phase::Cancelled;
                        Command::CancelUnlandedLight
                    }
                    Phase::LightWindup | Phase::LightActive => {
                        // If original server light already reached active,
                        // cancellation cannot retroactively undo damage.
                        self.phase = Phase::LightActive;
                        Command::None
                    }
                    Phase::Idle | Phase::HeavyActive | Phase::Cancelled => {
                        return Decision::rejected()
                    }
                }
            }
            _ => return Decision::rejected(),
        };

        self.last_server_ms = server_ms;
        self.highest_sequence = event.sequence;
        self.accepted.push_back(TypedGestureEvent { source, event });
        if self.accepted.len() > MAX_REPLAY_JOURNAL {
            self.accepted.pop_front();
        }
        Decision::new(Disposition::Accepted, command)
    }

    /// Advance only from a live authoritative server tick, never an event's clientTick.
    pub fn advance(&mut self, lease: u64, server_ms: u64) -> Option<Command> {
        if lease == 0 || lease != self.lease_epoch || server_ms < self.last_server_ms {
            return None;
        }
        self.last_server_ms = server_ms;
        let elapsed = server_ms.saturating_sub(self.press_ms);
        match self.phase {
            Phase::LightWindup if elapsed >= LIGHT_WINDUP_MS => {
                self.phase = Phase::LightActive;
                Some(Command::ActivateLight)
            }
            Phase::HeavyCharging if elapsed >= HEAVY_READY_MS => {
                self.phase = Phase::HeavyReady;
                Some(Command::HeavyReady)
            }
            _ => None,
        }
    }

    // A queued intent has no attack clock until the original World starts it.
    pub(crate) fn start_queued_light(
        &mut self,
        lease: u64,
        id: u32,
        server_ms: u64,
    ) -> Option<Command> {
        if lease == 0
            || lease != self.lease_epoch
            || self.active_id != Some(id)
            || self.active_source != Some(GestureSource::Lmb)
            || server_ms < self.last_server_ms
        {
            return None;
        }
        let command = match self.phase {
            Phase::LightWindup => Command::None,
            Phase::HeavyCharging => Command::UpgradeHeldHeavy {
                server_elapsed_ms: 0,
            },
            _ => return None,
        };
        self.press_ms = server_ms;
        self.last_server_ms = server_ms;
        Some(command)
    }

    // Keep the real physical/replay fences after a higher-priority World input
    // wins. Its remaining edges are admitted no-combat, never a new attack.
    pub(crate) fn abandon_queued_light(&mut self, lease: u64, id: u32, server_ms: u64) -> bool {
        if lease == 0
            || lease != self.lease_epoch
            || self.active_id != Some(id)
            || server_ms < self.last_server_ms
            || !matches!(self.phase, Phase::LightWindup | Phase::HeavyCharging)
        {
            return false;
        }
        self.phase = Phase::LightActive;
        self.last_server_ms = server_ms;
        true
    }

    /// Integration must call this only after World confirms a full action/recovery lifecycle.
    /// The last monotonic gesture ID and accepted sequence remain fenced after retirement.
    pub fn retire(&mut self, lease: u64, gesture_id: u32) -> bool {
        if lease == 0 || lease != self.lease_epoch || self.active_id != Some(gesture_id) {
            return false;
        }
        if !self.released {
            self.displaced_held_source = self.active_source.zip(self.active_id);
        }
        self.active_id = None;
        self.active_source = None;
        self.phase = Phase::Idle;
        self.released = false;
        true
    }
}

#[cfg(test)]
mod key_e_reserved_for_use_tests {
    use super::*;
    use crate::prealpha_lmb_gesture_proposal::{GestureAction, GestureEvent};

    #[test]
    fn retired_key_e_source_cannot_open_heavy_or_advance_combat_sequence() {
        let mut authority = GestureAuthority::new(9);
        let press = GestureEvent {
            action: GestureAction::Press,
            sequence: 1,
            gesture_id: 1,
            client_tick: 0,
        };
        let rejected = authority.process_typed(9, GestureSource::KeyE, press, 0);
        assert_eq!(rejected.disposition, Disposition::Rejected);
        assert_eq!(rejected.command, Command::None);
        assert_eq!(authority.highest_accepted_sequence(), 0);
        assert_eq!(authority.phase(), Phase::Idle);
        let lmb = authority.process_typed(9, GestureSource::Lmb, press, 0);
        assert_eq!(lmb.disposition, Disposition::Accepted);
        assert_eq!(lmb.command, Command::BeginLightWindup);
    }
}
