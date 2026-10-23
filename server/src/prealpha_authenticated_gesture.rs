//! Experimental session-bound v2 gesture -> original World admission.
//! OFF by default; never a player-account authentication substitute. The
//! caller alone owns an already admitted WebTransport connection and assigns
//! the actor/lease; packets cannot select either. Every admission runs while
//! holding the live GameState/World mutex, with no await between checks & hit.
use crate::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use crate::prealpha_lmb_gesture_proposal::{
    decode_typed_event, AckStatus, GestureAck, GestureAction, GestureEvent, GestureSource,
    TypedGestureEvent, BYTES, EVENT_TYPE, VERSION,
};
use crate::simulation::{Action, World};
use std::collections::VecDeque;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ServerActorBinding {
    pub player_id: u32,
    /// Unpredictable CSPRNG boot nonce, server side only (never on wire).
    pub boot_nonce: u128,
    pub lease_epoch: u64,
    pub world_instance: u64,
    pub incarnation: u64,
}

pub struct SessionGestureWorldPath {
    binding: ServerActorBinding,
    authority: GestureAuthority,
    retired: bool,
    last_gesture_id: Option<u32>,
    // Shared per-lease sequence and gesture namespace for source0 + source1.
    highest_sequence: u32,
    highest_gesture_id: u32,
    keye_active_id: Option<u32>,
    keye_terminal: bool,
    keye_accepted: VecDeque<GestureEvent>,
    // A physically valid newer gesture may be pressed while original World
    // is busy, including a fresh click of the SAME source during recovery.
    // Consume that one held source as transport-only: never a second attack.
    world_source: Option<GestureSource>,
    // Distinguish a legitimate repeat AFTER original physical key/button UP
    // from a forged second same-source DOWN while the first is still held.
    world_source_terminal: bool,
    busy_source: Option<(GestureSource, u32)>,
    busy_accepted: VecDeque<TypedGestureEvent>,
}

impl SessionGestureWorldPath {
    /// Construct only after trusted server admission with a fresh boot nonce.
    pub fn from_admitted_world(
        world: &World,
        player_id: u32,
        lease_epoch: u64,
        boot_nonce: u128,
    ) -> Option<Self> {
        if boot_nonce == 0 || lease_epoch == 0 || world.match_over() {
            return None;
        }
        let actor = world.fighter(player_id)?;
        if actor.action == Action::Dead || actor.hp <= 0.0 {
            return None;
        }
        Some(Self {
            binding: ServerActorBinding {
                player_id,
                boot_nonce,
                lease_epoch,
                world_instance: world.world_instance(),
                incarnation: actor.world_incarnation(),
            },
            authority: GestureAuthority::new(lease_epoch),
            retired: false,
            last_gesture_id: None,
            highest_sequence: 0,
            highest_gesture_id: 0,
            keye_active_id: None,
            keye_terminal: false,
            keye_accepted: VecDeque::with_capacity(64),
            world_source: None,
            world_source_terminal: false,
            busy_source: None,
            busy_accepted: VecDeque::with_capacity(64),
        })
    }

    pub fn binding(&self) -> ServerActorBinding {
        self.binding
    }
    pub fn retired(&self) -> bool {
        self.retired
    }
    pub fn retire(&mut self) {
        self.retired = true;
    }

    fn current(&self, world: &World, lease_epoch: u64, boot_nonce: u128) -> bool {
        !self.retired
            && boot_nonce != 0
            && boot_nonce == self.binding.boot_nonce
            && lease_epoch == self.binding.lease_epoch
            && world.world_instance() == self.binding.world_instance
            && !world.match_over()
            && world.fighter(self.binding.player_id).is_some_and(|f| {
                f.world_incarnation() == self.binding.incarnation
                    && f.hp > 0.0
                    && f.action != Action::Dead
            })
    }

    fn accept_keye(&mut self, world: &mut World, event: GestureEvent) -> Option<AckStatus> {
        if self.keye_accepted.iter().any(|seen| *seen == event) {
            return Some(AckStatus::Duplicate);
        }
        if event.sequence <= self.highest_sequence {
            return Some(AckStatus::Stale);
        }
        match event.action {
            GestureAction::Press if event.gesture_id > self.highest_gesture_id => {
                if !world.apply_review_only_keye_press(self.binding.player_id) {
                    return Some(AckStatus::Rejected);
                }
                self.world_source = Some(GestureSource::KeyE);
                self.world_source_terminal = false;
                self.keye_active_id = Some(event.gesture_id);
                self.keye_terminal = false;
                self.highest_gesture_id = event.gesture_id;
            }
            GestureAction::Release | GestureAction::Cancel
                if self.keye_active_id == Some(event.gesture_id) && !self.keye_terminal =>
            {
                // KeyE is standalone: heavy starts on PRESS and the original
                // World owns its 320ms windup/hit, not this terminal receipt.
                self.keye_terminal = true;
                self.world_source_terminal = true;
            }
            GestureAction::Release | GestureAction::Cancel
                if event.gesture_id > self.highest_gesture_id =>
            {
                // A legitimate future KeyE PRESS may still be in transit.
                // Never permanently reject its terminal ahead of that PRESS.
                return None;
            }
            _ => return Some(AckStatus::Rejected),
        }
        self.highest_sequence = event.sequence;
        self.keye_accepted.push_back(event);
        if self.keye_accepted.len() > 64 {
            self.keye_accepted.pop_front();
        }
        Some(AckStatus::Accepted)
    }

    /// A distinct monotonic physical gesture may arrive while the original
    /// World is busy, whether from the OTHER source or the SAME source after
    /// an earlier physical release. Accept its contiguous input as *no-combat*
    /// rather than fatally retiring the shared source0+source1 outbox.
    /// The original 0x12 ACCEPTED status confirms input admission only.
    fn admit_busy_source(&mut self, world: &World, typed: TypedGestureEvent) -> Option<AckStatus> {
        let event = typed.event;
        if self.busy_accepted.iter().any(|previous| *previous == typed) {
            return Some(AckStatus::Duplicate);
        }
        if event.sequence <= self.highest_sequence {
            return Some(AckStatus::Stale);
        }
        let busy = self.busy_source;
        let valid = match event.action {
            GestureAction::Press => {
                if busy.is_some()
                    || self.world_source.is_none()
                    || (self.world_source == Some(typed.source) && !self.world_source_terminal)
                    || event.gesture_id <= self.highest_gesture_id
                    || !world
                        .fighter(self.binding.player_id)
                        .is_some_and(|fighter| fighter.action != Action::Idle)
                {
                    return None;
                }
                self.busy_source = Some((typed.source, event.gesture_id));
                self.highest_gesture_id = event.gesture_id;
                true
            }
            GestureAction::Release | GestureAction::Cancel => {
                if busy != Some((typed.source, event.gesture_id)) {
                    return None;
                }
                self.busy_source = None;
                true
            }
            GestureAction::Upgrade => {
                // Real held LMB may UPGRADE while a different KeyE attack
                // owns World. Tombstone this physical edge as no-combat too;
                // REJECTED would fatally retire the one shared outbox.
                busy == Some((GestureSource::Lmb, event.gesture_id))
                    && typed.source == GestureSource::Lmb
            }
        };
        if !valid {
            return None;
        }
        self.highest_sequence = event.sequence;
        self.busy_accepted.push_back(typed);
        if self.busy_accepted.len() > 64 {
            self.busy_accepted.pop_front();
        }
        Some(AckStatus::Accepted)
    }

    /// Called synchronously under original GameState/World mutex, not after
    /// unlocking or by a transport ACK handler. Returns real World tick ACK.
    /// Source0 LMB and source1 KeyE share the same session lease, monotonic
    /// sequence/gesture namespace, server authority, and World mutation lock.
    pub fn accept_under_world_lock(
        &mut self,
        world: &mut World,
        lease_epoch: u64,
        boot_nonce: u128,
        bytes: &[u8],
    ) -> Option<GestureAck> {
        let typed = decode_typed_event(bytes).ok()?;
        let event = typed.event;
        let tick = world.tick;
        let status = if !self.current(world, lease_epoch, boot_nonce) {
            self.retire();
            AckStatus::Stale
        } else if event.sequence > self.highest_sequence.saturating_add(1) {
            // One ordered lease across BOTH source families: if an earlier
            // sequence was dropped/reordered, never admit a later KeyE PRESS
            // (or later LMB event) first and permanently stale the earlier
            // valid gesture. Withhold ACK so the same bounded outbox retries.
            return None;
        } else if let Some(previous) = self
            .busy_accepted
            .iter()
            .find(|previous| previous.event.sequence == event.sequence)
        {
            if *previous == typed {
                AckStatus::Duplicate
            } else {
                AckStatus::Stale
            }
        } else if (self.busy_source == Some((typed.source, event.gesture_id))
            && (matches!(event.action, GestureAction::Release | GestureAction::Cancel)
                || (typed.source == GestureSource::Lmb && event.action == GestureAction::Upgrade)))
            || (event.action == GestureAction::Press
                && self
                    .world_source
                    .is_some_and(|owner| owner != typed.source || self.world_source_terminal)
                && event.gesture_id > self.highest_gesture_id
                && world
                    .fighter(self.binding.player_id)
                    .is_some_and(|f| f.action != Action::Idle))
        {
            self.admit_busy_source(world, typed)?
        } else if typed.source == GestureSource::KeyE {
            // Already validated typed action/source and immutable server lease.
            // No separate source1 QUIC connection, actor or ACK family.
            self.accept_keye(world, event)?
        } else {
            // Previously accepted source1 events also advance this lease's
            // global sequence; never admit a different older source0 event.
            if event.sequence <= self.highest_sequence {
                let prior =
                    self.authority
                        .clone()
                        .process(lease_epoch, event, world.now_ms.round() as u64);
                return Some(GestureAck {
                    status: if prior.disposition == Disposition::Duplicate {
                        AckStatus::Duplicate
                    } else {
                        AckStatus::Stale
                    },
                    sequence: event.sequence,
                    gesture_id: event.gesture_id,
                    server_tick: tick,
                });
            }
            if event.action == GestureAction::Press && event.gesture_id <= self.highest_gesture_id {
                return Some(GestureAck {
                    status: AckStatus::Rejected,
                    sequence: event.sequence,
                    gesture_id: event.gesture_id,
                    server_tick: tick,
                });
            }
            // An earlier one-hit World action must finish before new PRESS.
            // Preserve per-lease monotonic sequence/gesture replay tombstones.
            if event.action == crate::prealpha_lmb_gesture_proposal::GestureAction::Press
                && world
                    .fighter(self.binding.player_id)
                    .is_some_and(|f| f.action == Action::Idle)
            {
                if let Some(previous) = self.last_gesture_id {
                    if event.gesture_id > previous {
                        self.authority.retire(lease_epoch, previous);
                    }
                }
            }
            let mut proposed = self.authority.clone();
            let decision = proposed.process(lease_epoch, event, world.now_ms.round() as u64);
            match decision.disposition {
                Disposition::Accepted => {
                    if decision.command == Command::None
                        || world.apply_review_only_lmb_gesture_command(
                            self.binding.player_id,
                            decision.command,
                        )
                    {
                        if event.action
                            == crate::prealpha_lmb_gesture_proposal::GestureAction::Press
                        {
                            self.last_gesture_id = Some(event.gesture_id);
                        }
                        self.authority = proposed;
                        if event.action == GestureAction::Press {
                            self.world_source = Some(GestureSource::Lmb);
                            self.world_source_terminal = false;
                        } else if matches!(
                            event.action,
                            GestureAction::Release | GestureAction::Cancel
                        ) && self.world_source == Some(GestureSource::Lmb)
                        {
                            self.world_source_terminal = true;
                        }
                        self.highest_sequence = event.sequence;
                        if event.action == GestureAction::Press {
                            self.highest_gesture_id = event.gesture_id;
                        }
                        AckStatus::Accepted
                    } else {
                        // A failed World action is NOT a received Combat hit,
                        // and must never advance authority/replay state.
                        AckStatus::Rejected
                    }
                }
                Disposition::Duplicate => AckStatus::Duplicate,
                Disposition::Stale => AckStatus::Stale,
                Disposition::Rejected => {
                    // If a RELEASE overtakes a lost PRESS, withholding its
                    // receipt lets Core8A's bounded sender retry both edges
                    // in sequence. A REJECTED ACK would permanently retire
                    // the sender lease and turn a 6ms click into no attack.
                    if event.action != crate::prealpha_lmb_gesture_proposal::GestureAction::Press
                        && self
                            .last_gesture_id
                            .is_none_or(|last| event.gesture_id > last)
                        && event.gesture_id > self.highest_gesture_id
                    {
                        // The first PRESS *or any later greater-ID PRESS* may
                        // be missing. A rejected ACK here would incorrectly
                        // retire the bounded outbox before PRESS can retry.
                        // Never infer actor/Combat success from the missing
                        // receipt; original replay/World checks still apply.
                        return None;
                    }
                    AckStatus::Rejected
                }
            }
        };
        Some(GestureAck {
            status,
            sequence: event.sequence,
            gesture_id: event.gesture_id,
            server_tick: tick,
        })
    }

    /// Once each real 60Hz World tick, while caller owns same mutation lock.
    /// World already steps the light/held-heavy action; reducer gets the real
    /// server clock for READY and refusal of late/duplicate attack events.
    pub fn advance_under_world_lock(
        &mut self,
        world: &mut World,
        lease_epoch: u64,
        boot_nonce: u128,
    ) {
        if !self.current(world, lease_epoch, boot_nonce) {
            self.retire();
            return;
        }
        let mut proposed = self.authority.clone();
        if let Some(command) = proposed.advance(lease_epoch, world.now_ms.round() as u64) {
            if !world.apply_review_only_lmb_gesture_command(self.binding.player_id, command) {
                self.retire();
                return;
            }
        }
        self.authority = proposed;
    }
}

/// Untrusted datagrams are always rejected before session negotiation.
pub fn is_v2_event(bytes: &[u8]) -> bool {
    bytes.len() == BYTES && bytes[0] == VERSION && bytes[1] == EVENT_TYPE
}

/// Fresh, non-client-selectable ephemeral server boot identity.
/// No time/PID/connection counters or non-cryptographic hashes permitted.
pub fn new_server_boot_nonce() -> anyhow::Result<u128> {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|error| anyhow::anyhow!("OS CSPRNG failed to issue boot nonce: {error:?}"))?;
    let nonce = u128::from_le_bytes(bytes);
    anyhow::ensure!(nonce != 0, "refusing zero boot nonce");
    Ok(nonce)
}
