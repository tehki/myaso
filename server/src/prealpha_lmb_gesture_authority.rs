//! DORMANT Pre-Alpha Combat P0 authoritative LMB gesture decision reducer.
//!
//! Developer-approved design/test only: no QUIC ingress or simulation callers,
//! no runtime v2 enablement. Callers must bind the lease to an authenticated
//! connection, use real monotonic server time, and apply commands ONLY after
//! validating actual World action/tick ownership (especially active hit).
//! This reducer never accepts a client timestamp for attack authorization.

use std::collections::VecDeque;

use crate::prealpha_lmb_gesture_proposal::{GestureAction, GestureEvent};

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
pub struct GestureAuthority {
    lease_epoch: u64,
    last_server_ms: u64,
    phase: Phase,
    active_id: Option<u32>,
    highest_gesture_id: u32,
    highest_sequence: u32,
    press_ms: u64,
    released: bool,
    accepted: VecDeque<GestureEvent>,
}

impl GestureAuthority {
    pub fn new(lease_epoch: u64) -> Self {
        Self {
            lease_epoch,
            last_server_ms: 0,
            phase: Phase::Idle,
            active_id: None,
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

    pub fn process(&mut self, lease: u64, event: GestureEvent, server_ms: u64) -> Decision {
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
            .find(|previous| previous.sequence == event.sequence)
        {
            return if *previous == event {
                Decision::new(Disposition::Duplicate, Command::None)
            } else {
                Decision::rejected()
            };
        }
        if event.sequence <= self.highest_sequence {
            return Decision::new(Disposition::Stale, Command::None);
        }

        let elapsed = server_ms.saturating_sub(self.press_ms);
        let command = match event.action {
            GestureAction::Press
                if self.phase == Phase::Idle && event.gesture_id > self.highest_gesture_id =>
            {
                self.active_id = Some(event.gesture_id);
                self.highest_gesture_id = event.gesture_id;
                self.press_ms = server_ms;
                self.phase = Phase::LightWindup;
                self.released = false;
                Command::BeginLightWindup
            }
            GestureAction::Upgrade
                if self.active_id == Some(event.gesture_id)
                    && self.phase == Phase::LightWindup
                    && !self.released
                    && elapsed < LIGHT_WINDUP_MS =>
            {
                self.phase = Phase::HeavyCharging;
                Command::UpgradeHeldHeavy {
                    server_elapsed_ms: elapsed,
                }
            }
            GestureAction::Release
                if self.active_id == Some(event.gesture_id) && !self.released =>
            {
                match self.phase {
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
        self.accepted.push_back(event);
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

    /// Integration must call this only after World confirms a full action/recovery lifecycle.
    /// The last monotonic gesture ID and accepted sequence remain fenced after retirement.
    pub fn retire(&mut self, lease: u64, gesture_id: u32) -> bool {
        if lease == 0 || lease != self.lease_epoch || self.active_id != Some(gesture_id) {
            return false;
        }
        self.active_id = None;
        self.phase = Phase::Idle;
        self.released = false;
        true
    }
}
