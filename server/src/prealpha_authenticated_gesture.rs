//! Experimental session-bound v2 gesture -> original World admission.
//! OFF by default; never a player-account authentication substitute. The
//! caller alone owns an already admitted WebTransport connection and assigns
//! the actor/lease; packets cannot select either. Every admission runs while
//! holding the live GameState/World mutex, with no await between checks & hit.
use crate::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use crate::prealpha_lmb_gesture_proposal::{
    decode_typed_event, AckStatus, GestureAck, GestureAction, GestureSource, BYTES, EVENT_TYPE,
    VERSION,
};
use crate::simulation::{Action, World};

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
    // Physical per-source DOWN survives World Idle or another source's
    // new combat ownership; no action phase may impersonate physical UP.
    held_source_id: [Option<u32>; 2],
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
            held_source_id: [None, None],
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

    /// Called synchronously under original GameState/World mutex, not after
    /// unlocking or by a transport ACK handler. Returns real World tick ACK.
    /// Both LMB0 and independent KeyE1 share the SAME lease monotonic
    /// sequence, gesture ID fence, replay journal, and World action ownership.
    /// Only an already-negotiated, server-owned current QUIC actor can enter.
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
        let source_index = match typed.source {
            GestureSource::Lmb => 0,
            GestureSource::KeyE => 1,
        };
        let status = if !self.current(world, lease_epoch, boot_nonce) {
            self.retire();
            AckStatus::Stale
        } else {
            // Even if each event has a valid source and lease, a newer
            // KeyE/LMB PRESS can overtake an older source's lost PRESS.
            // Without a single shared consecutive sequence fence, the new
            // event would permanently stale that legitimate older action.
            // Withhold its receipt so the ONE bounded Core8A sender can
            // retransmit the earlier edge. Never grant World authority here.
            if event.sequence > self.authority.highest_accepted_sequence().saturating_add(1) {
                return None;
            }
            // Reject a fabricated second physical DOWN for the same source,
            // without consuming the valid matching old RELEASE sequence.
            // Unknown/old replay remains governed by the original reducer.
            if event.action == GestureAction::Press
                && event.sequence > self.authority.highest_accepted_sequence()
                && self.held_source_id[source_index].is_some()
                && self.held_source_id[source_index] != Some(event.gesture_id)
            {
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
            let decision = proposed.process_typed(
                lease_epoch,
                typed.source,
                event,
                world.now_ms.round() as u64,
            );
            match decision.disposition {
                Disposition::Accepted => {
                    if decision.command == Command::None
                        || world.apply_review_only_lmb_gesture_command(
                            self.binding.player_id,
                            decision.command,
                        )
                    {
                        // A physically real but World-busy second source is
                        // ACKed as transport-admitted no-combat. It must NOT
                        // replace the last actual World attack ID: that ID
                        // remains necessary to retire the reducer only after
                        // the authoritative fighter returns to Idle.
                        if event.action
                            == crate::prealpha_lmb_gesture_proposal::GestureAction::Press
                            && matches!(
                                decision.command,
                                Command::BeginLightWindup | Command::BeginKeyEHeavy
                            )
                        {
                            self.last_gesture_id = Some(event.gesture_id);
                        }
                        self.authority = proposed;
                        match event.action {
                            GestureAction::Press => {
                                self.held_source_id[source_index] = Some(event.gesture_id);
                            }
                            GestureAction::Release | GestureAction::Cancel
                                if self.held_source_id[source_index] == Some(event.gesture_id) =>
                            {
                                self.held_source_id[source_index] = None;
                            }
                            GestureAction::Upgrade
                            | GestureAction::Release
                            | GestureAction::Cancel => {}
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
