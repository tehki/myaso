//! Experimental session-bound v2 gesture -> original World admission.
//! OFF by default; never a player-account authentication substitute. The
//! caller alone owns an already admitted WebTransport connection and assigns
//! the actor/lease; packets cannot select either. Every admission runs while
//! holding the live GameState/World mutex, with no await between checks & hit.
use crate::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use crate::prealpha_lmb_gesture_proposal::{
    decode_typed_event, AckStatus, GestureAck, GestureSource, BYTES, EVENT_TYPE, VERSION,
};
use crate::simulation::{Action, World};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ServerActorBinding {
    pub player_id: u32,
    pub lease_epoch: u64,
    pub world_instance: u64,
    pub incarnation: u64,
}

pub struct SessionGestureWorldPath {
    binding: ServerActorBinding,
    authority: GestureAuthority,
    retired: bool,
    last_gesture_id: Option<u32>,
}

impl SessionGestureWorldPath {
    /// Construct only after real server admission, never from client bytes.
    pub fn from_admitted_world(world: &World, player_id: u32, lease_epoch: u64) -> Option<Self> {
        if lease_epoch == 0 || world.match_over() {
            return None;
        }
        let actor = world.fighter(player_id)?;
        if actor.action == Action::Dead || actor.hp <= 0.0 {
            return None;
        }
        Some(Self {
            binding: ServerActorBinding {
                player_id,
                lease_epoch,
                world_instance: world.world_instance(),
                incarnation: actor.world_incarnation(),
            },
            authority: GestureAuthority::new(lease_epoch),
            retired: false,
            last_gesture_id: None,
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

    fn current(&self, world: &World, lease_epoch: u64) -> bool {
        !self.retired
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
    /// Only source0 LMB is presently supported as a live experimental path;
    /// typed KeyE source1 fails closed until Combat source-arbitration joins it.
    pub fn accept_under_world_lock(
        &mut self,
        world: &mut World,
        lease_epoch: u64,
        bytes: &[u8],
    ) -> Option<GestureAck> {
        let typed = decode_typed_event(bytes).ok()?;
        let event = typed.event;
        let tick = world.tick;
        let status = if !self.current(world, lease_epoch) {
            self.retire();
            AckStatus::Stale
        } else if typed.source != GestureSource::Lmb {
            AckStatus::Rejected
        } else {
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
                    if self.last_gesture_id.is_none()
                        && event.action
                            != crate::prealpha_lmb_gesture_proposal::GestureAction::Press
                    {
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
    pub fn advance_under_world_lock(&mut self, world: &mut World, lease_epoch: u64) {
        if !self.current(world, lease_epoch) {
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
