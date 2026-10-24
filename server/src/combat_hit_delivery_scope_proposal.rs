//! DORMANT Core8B M147 recipient-incarnation HIT delivery projection.
//!
//! Offline review helper ONLY: not registered in PACKET_TYPE, WebTransport,
//! gameplay, or a live ACK reader. Caller MUST hold the original World lock,
//! supply only the committed CombatEvent batch, and compare the accepted QUIC
//! connection binding against the authoritative current actor/session owner.
//! A numeric player ID or a global HIT journal cursor is NEVER an ACK scope.
use std::collections::VecDeque;

use crate::combat_hit_control_proposal::MAX_PROPOSED_PENDING_HITS;
use crate::combat_hit_receipt::{HitReceipt, HitReceiptError};
use crate::prealpha_authenticated_gesture::ServerActorBinding;
use crate::simulation::CombatEvent;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopedHitError {
    InvalidScope,
    RetiredOrForeignScope,
    NonMonotonicWorldTick,
    InvalidWorldHit(HitReceiptError),
    SequenceExhausted,
    InvalidProcessedCursor,
    ExplicitGap,
}

/// A server-side per-recipient stream, not a client-claimed grant.
///
/// The 28-byte proposed HIT does not carry generation/lease fields. Those
/// fields are server-only and checked before every enqueue/read/ACK. This
/// fixture does NOT authenticate the transport object or mint a GRANT token.
#[derive(Debug)]
pub struct ProposedRecipientHitStream {
    owner: ServerActorBinding,
    pending: VecDeque<HitReceipt>,
    capacity: usize,
    next_sequence: u32,
    acknowledged_next: u32,
    last_world_tick: Option<u32>,
    retired: bool,
    gapped: bool,
}

impl ProposedRecipientHitStream {
    pub fn from_admitted_binding(
        owner: ServerActorBinding,
        capacity: usize,
    ) -> Result<Self, ScopedHitError> {
        if owner.player_id == 0
            || owner.boot_nonce == 0
            || owner.lease_epoch == 0
            || owner.world_instance == 0
            || owner.incarnation == 0
            || !(1..=MAX_PROPOSED_PENDING_HITS as usize).contains(&capacity)
        {
            return Err(ScopedHitError::InvalidScope);
        }
        Ok(Self {
            owner,
            pending: VecDeque::with_capacity(capacity),
            capacity,
            next_sequence: 0,
            acknowledged_next: 0,
            last_world_tick: None,
            retired: false,
            gapped: false,
        })
    }

    pub fn owner(&self) -> ServerActorBinding {
        self.owner
    }

    pub fn retire(&mut self) {
        self.retired = true;
        self.pending.clear();
    }

    pub fn is_gapped(&self) -> bool {
        self.gapped
    }

    pub fn acknowledged_next(&self) -> u32 {
        self.acknowledged_next
    }

    pub fn next_sequence(&self) -> u32 {
        self.next_sequence
    }

    fn check_owner(&self, current: ServerActorBinding) -> Result<(), ScopedHitError> {
        if self.retired || current != self.owner {
            return Err(ScopedHitError::RetiredOrForeignScope);
        }
        if self.gapped {
            return Err(ScopedHitError::ExplicitGap);
        }
        Ok(())
    }

    /// Called once for a completed World tick under the server's World lock.
    ///
    /// Projection is atomic. Hits not involving THIS recipient do not consume
    /// its sequence numbers. Equal ticks and u32 tick wrap fail closed rather
    /// than double-credit or silently treating another World as this one.
    /// Capacity loss is an EXPLICIT GAP: never evict and falsely advance ACK.
    pub fn project_committed_world_tick(
        &mut self,
        current: ServerActorBinding,
        server_tick: u32,
        events: &[CombatEvent],
    ) -> Result<usize, ScopedHitError> {
        self.check_owner(current)?;
        if self.last_world_tick.is_some_and(|last| server_tick <= last) {
            return Err(ScopedHitError::NonMonotonicWorldTick);
        }
        let mut proposed = Vec::new();
        for event in events {
            let validated = HitReceipt::from_combat_event(0, server_tick, event)
                .map_err(ScopedHitError::InvalidWorldHit)?;
            if let Some(receipt) = validated {
                if receipt.attacker != self.owner.player_id
                    && receipt.target != self.owner.player_id
                {
                    continue;
                }
                let ordinal =
                    u32::try_from(proposed.len()).map_err(|_| ScopedHitError::SequenceExhausted)?;
                let sequence = self
                    .next_sequence
                    .checked_add(ordinal)
                    .and_then(|value| value.checked_add(1))
                    .ok_or(ScopedHitError::SequenceExhausted)?;
                proposed.push(HitReceipt {
                    sequence: sequence - 1,
                    ..receipt
                });
            }
        }
        if proposed.len() > self.capacity - self.pending.len() {
            self.gapped = true;
            return Err(ScopedHitError::ExplicitGap);
        }
        let count = proposed.len();
        if let Some(last) = proposed.last() {
            self.next_sequence = last.sequence + 1;
        }
        self.pending.extend(proposed);
        self.last_world_tick = Some(server_tick);
        Ok(count)
    }

    /// Read-only retransmission candidate. Returning it is NOT server write
    /// confirmation or app-level client processing. Transport must validate
    /// the current accepted QUIC connection again immediately before writing.
    pub fn pending_for_current(
        &self,
        current: ServerActorBinding,
    ) -> Result<Vec<HitReceipt>, ScopedHitError> {
        self.check_owner(current)?;
        Ok(self.pending.iter().copied().collect())
    }

    /// Accept a purported next-*processed* cursor only from the currently
    /// authenticated recipient connection's validated HIT_CONTROL ACK. This
    /// pure helper cannot itself authenticate that external connection.
    pub fn ack_processed(
        &mut self,
        current: ServerActorBinding,
        next_processed: u32,
    ) -> Result<(), ScopedHitError> {
        self.check_owner(current)?;
        if next_processed < self.acknowledged_next || next_processed > self.next_sequence {
            return Err(ScopedHitError::InvalidProcessedCursor);
        }
        while self
            .pending
            .front()
            .is_some_and(|hit| hit.sequence < next_processed)
        {
            self.pending.pop_front();
        }
        self.acknowledged_next = next_processed;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn binding() -> ServerActorBinding {
        ServerActorBinding {
            player_id: 2,
            boot_nonce: 0x1234_5678,
            lease_epoch: 17,
            world_instance: 42,
            incarnation: 7,
        }
    }
    fn hit(attacker: u32, target: u32, damage: u8, hp: u8) -> CombatEvent {
        CombatEvent::Hit {
            attacker,
            target,
            damage,
            hp,
        }
    }
    fn current(cap: usize) -> ProposedRecipientHitStream {
        ProposedRecipientHitStream::from_admitted_binding(binding(), cap).unwrap()
    }

    #[test]
    fn irrelevant_global_hits_never_create_phantom_per_recipient_ack_gaps() {
        let mut stream = current(8);
        assert_eq!(
            stream.project_committed_world_tick(
                binding(),
                100,
                &[
                    hit(3, 4, 34, 66),
                    hit(2, 1, 34, 66),
                    hit(4, 5, 46, 54),
                    hit(1, 2, 34, 66)
                ],
            ),
            Ok(2)
        );
        let actual = stream.pending_for_current(binding()).unwrap();
        assert_eq!(actual.len(), 2);
        assert_eq!(
            (actual[0].sequence, actual[0].attacker, actual[0].target),
            (0, 2, 1)
        );
        assert_eq!(
            (actual[1].sequence, actual[1].attacker, actual[1].target),
            (1, 1, 2)
        );
        assert_eq!(stream.ack_processed(binding(), 1), Ok(()));
        assert_eq!(
            stream.pending_for_current(binding()).unwrap()[0].sequence,
            1
        );
        assert_eq!(stream.ack_processed(binding(), 2), Ok(()));
        assert!(stream.pending_for_current(binding()).unwrap().is_empty());
        assert_eq!(stream.next_sequence(), 2);
    }

    #[test]
    fn two_recipients_get_independent_contiguous_scopes_for_same_world_batch() {
        let second = ServerActorBinding {
            player_id: 1,
            lease_epoch: 18,
            ..binding()
        };
        let mut one = current(8);
        let mut other = ProposedRecipientHitStream::from_admitted_binding(second, 8).unwrap();
        let batch = [hit(3, 4, 34, 66), hit(2, 1, 34, 66), hit(3, 2, 46, 54)];
        assert_eq!(
            one.project_committed_world_tick(binding(), 88, &batch),
            Ok(2)
        );
        assert_eq!(
            other.project_committed_world_tick(second, 88, &batch),
            Ok(1)
        );
        assert_eq!(
            one.pending_for_current(binding())
                .unwrap()
                .iter()
                .map(|r| r.sequence)
                .collect::<Vec<_>>(),
            vec![0, 1]
        );
        assert_eq!(other.pending_for_current(second).unwrap()[0].sequence, 0);
        assert_eq!(
            other.ack_processed(binding(), 1),
            Err(ScopedHitError::RetiredOrForeignScope)
        );
    }

    #[test]
    fn previous_boot_lease_world_and_actor_incarnation_cannot_deliver_or_ack() {
        let mut stream = current(8);
        stream
            .project_committed_world_tick(binding(), 60, &[hit(2, 1, 34, 66)])
            .unwrap();
        let foreign = [
            ServerActorBinding {
                boot_nonce: 0x8888,
                ..binding()
            },
            ServerActorBinding {
                lease_epoch: 18,
                ..binding()
            },
            ServerActorBinding {
                world_instance: 43,
                ..binding()
            },
            ServerActorBinding {
                incarnation: 8,
                ..binding()
            },
            ServerActorBinding {
                player_id: 3,
                ..binding()
            },
        ];
        for stale in foreign {
            assert_eq!(
                stream.pending_for_current(stale),
                Err(ScopedHitError::RetiredOrForeignScope)
            );
            assert_eq!(
                stream.ack_processed(stale, 1),
                Err(ScopedHitError::RetiredOrForeignScope)
            );
            assert_eq!(
                stream.project_committed_world_tick(stale, 61, &[hit(2, 1, 34, 66)]),
                Err(ScopedHitError::RetiredOrForeignScope)
            );
        }
        assert_eq!(stream.pending_for_current(binding()).unwrap().len(), 1);
        stream.retire();
        assert_eq!(
            stream.ack_processed(binding(), 1),
            Err(ScopedHitError::RetiredOrForeignScope)
        );
        assert_eq!(
            stream.pending_for_current(binding()),
            Err(ScopedHitError::RetiredOrForeignScope)
        );
        let newborn = ServerActorBinding {
            incarnation: 8,
            ..binding()
        };
        let replacement = ProposedRecipientHitStream::from_admitted_binding(newborn, 8).unwrap();
        assert_eq!(replacement.next_sequence(), 0);
        assert!(replacement.pending_for_current(newborn).unwrap().is_empty());
    }

    #[test]
    fn repeated_world_tick_invalid_hit_and_future_ack_cannot_credit_twice() {
        let mut stream = current(8);
        stream
            .project_committed_world_tick(binding(), 99, &[hit(2, 1, 34, 66)])
            .unwrap();
        assert_eq!(
            stream.ack_processed(binding(), 2),
            Err(ScopedHitError::InvalidProcessedCursor)
        );
        assert_eq!(stream.ack_processed(binding(), 1), Ok(()));
        assert_eq!(stream.ack_processed(binding(), 1), Ok(())); // authentic duplicate ACK is idempotent
        assert_eq!(
            stream.ack_processed(binding(), 0),
            Err(ScopedHitError::InvalidProcessedCursor)
        );
        assert_eq!(
            stream.project_committed_world_tick(binding(), 99, &[hit(2, 1, 34, 66)]),
            Err(ScopedHitError::NonMonotonicWorldTick)
        );
        assert_eq!(
            stream.project_committed_world_tick(binding(), 98, &[hit(2, 1, 34, 66)]),
            Err(ScopedHitError::NonMonotonicWorldTick)
        );
        assert_eq!(stream.next_sequence(), 1);
        assert_eq!(
            stream.project_committed_world_tick(binding(), 100, &[hit(0, 1, 34, 66)]),
            Err(ScopedHitError::InvalidWorldHit(
                HitReceiptError::InvalidActors
            ))
        );
        assert_eq!(
            stream.project_committed_world_tick(binding(), 100, &[hit(2, 1, 34, 66)]),
            Ok(1)
        );
        assert_eq!(stream.next_sequence(), 2);
    }

    #[test]
    fn pending_capacity_loss_is_explicit_gap_never_dropped_credit_or_fake_ack() {
        let mut stream = current(2);
        assert_eq!(
            stream.project_committed_world_tick(
                binding(),
                1,
                &[hit(2, 1, 34, 66), hit(2, 3, 34, 66)]
            ),
            Ok(2)
        );
        assert_eq!(
            stream.project_committed_world_tick(binding(), 2, &[hit(2, 4, 34, 66)]),
            Err(ScopedHitError::ExplicitGap)
        );
        assert!(stream.is_gapped());
        assert_eq!(stream.next_sequence(), 2);
        assert_eq!(stream.acknowledged_next(), 0);
        assert_eq!(
            stream.ack_processed(binding(), 2),
            Err(ScopedHitError::ExplicitGap)
        );
        assert_eq!(
            stream.pending_for_current(binding()),
            Err(ScopedHitError::ExplicitGap)
        );
    }

    #[test]
    fn a_scope_cannot_be_granted_without_real_nonzero_server_owned_identity() {
        for bad in [
            ServerActorBinding {
                player_id: 0,
                ..binding()
            },
            ServerActorBinding {
                boot_nonce: 0,
                ..binding()
            },
            ServerActorBinding {
                lease_epoch: 0,
                ..binding()
            },
            ServerActorBinding {
                world_instance: 0,
                ..binding()
            },
            ServerActorBinding {
                incarnation: 0,
                ..binding()
            },
        ] {
            assert!(matches!(
                ProposedRecipientHitStream::from_admitted_binding(bad, 2),
                Err(ScopedHitError::InvalidScope)
            ));
        }
        assert!(matches!(
            ProposedRecipientHitStream::from_admitted_binding(binding(), 0),
            Err(ScopedHitError::InvalidScope)
        ));
        assert!(matches!(
            ProposedRecipientHitStream::from_admitted_binding(binding(), 65),
            Err(ScopedHitError::InvalidScope)
        ));
    }
}
