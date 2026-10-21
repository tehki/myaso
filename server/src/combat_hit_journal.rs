//! Dormant M147 reliable HIT receipt history for Core 8A review.
//!
//! Records come ONLY from the trusted World tick's CombatEvent::Hit list.
//! This module neither accepts client events nor wires a WebTransport stream.
//! Core must bind each cursor and fighter ID to the exact authenticated
//! connection incarnation before calling read_for_actor; numeric IDs can be
//! reused, so this journal alone cannot authorize or activate delivery.
//!
//! Explicit Gap is intentional: an evicted combat receipt cannot be silently
//! promoted to an ACK/confirmation for a new connection.
use std::collections::VecDeque;

use crate::combat_hit_receipt::{HitReceipt, HitReceiptError};
use crate::simulation::CombatEvent;

pub const MAX_HIT_HISTORY: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HitJournalError {
    InvalidCapacity,
    InvalidActor,
    FutureCursor,
    NonMonotonicTick { last_tick: u32, attempted_tick: u32 },
    InvalidEvent(HitReceiptError),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HitJournalRead {
    Delivered {
        receipt: HitReceipt,
        next_cursor: u32,
    },
    CaughtUp {
        next_cursor: u32,
    },
    Gap {
        oldest_available: u32,
    },
}

/// Bounded read-only fan-out source, staged for Core's reliable connection
/// queues; does NOT mean the client has ACKed or seen a hit notification.
#[derive(Debug)]
pub struct HitReceiptJournal {
    receipts: VecDeque<HitReceipt>,
    next_sequence: u32,
    last_server_tick: Option<u32>,
    limit: usize,
}

impl HitReceiptJournal {
    pub fn new(limit: usize) -> Result<Self, HitJournalError> {
        if !(1..=MAX_HIT_HISTORY).contains(&limit) {
            return Err(HitJournalError::InvalidCapacity);
        }
        Ok(Self {
            receipts: VecDeque::with_capacity(limit),
            next_sequence: 0,
            last_server_tick: None,
            limit,
        })
    }

    pub fn next_cursor(&self) -> u32 {
        self.next_sequence
    }

    pub fn len(&self) -> usize {
        self.receipts.len()
    }

    pub fn is_empty(&self) -> bool {
        self.receipts.is_empty()
    }

    /// Called exactly once for one completed authoritative World tick while
    /// holding the exclusive World/Combat mutation fence. Validation precedes
    /// all writes, so even an invalid later hit cannot publish partial claims.
    pub fn record_tick(
        &mut self,
        server_tick: u32,
        events: &[CombatEvent],
    ) -> Result<usize, HitJournalError> {
        // A server tick may be published once, including an empty event batch.
        // Replaying an already published tick could otherwise duplicate a HIT
        // receipt and send a second attacker's hit-confirm on reconnect.
        // Gaps in tick numbers are valid; modulo ordering permits u32 wrap.
        if let Some(last_tick) = self.last_server_tick {
            if !newer32(server_tick, last_tick) {
                return Err(HitJournalError::NonMonotonicTick {
                    last_tick,
                    attempted_tick: server_tick,
                });
            }
        }
        let mut count = 0;
        for event in events {
            if HitReceipt::from_combat_event(0, server_tick, event)
                .map_err(HitJournalError::InvalidEvent)?
                .is_some()
            {
                count += 1;
            }
        }
        for event in events {
            if let Some(receipt) =
                HitReceipt::from_combat_event(self.next_sequence, server_tick, event)
                    .map_err(HitJournalError::InvalidEvent)?
            {
                self.next_sequence = self.next_sequence.wrapping_add(1);
                if self.receipts.len() == self.limit {
                    self.receipts.pop_front();
                }
                self.receipts.push_back(receipt);
            }
        }
        // Publish this fence only after the entire tick was validated and
        // every server-authored HIT receipt was safely journaled.
        self.last_server_tick = Some(server_tick);
        Ok(count)
    }

    /// Caller MUST authorize actor from its verified server-owned lease.
    /// A delivery result means "attempt to enqueue", NOT "client ACK".
    /// On Gap, transport must use an explicit recovery policy, not silently
    /// advance the cursor or assume the missing hit was confirmed.
    pub fn read_for_actor(
        &self,
        actor: u32,
        cursor: u32,
    ) -> Result<HitJournalRead, HitJournalError> {
        if actor == 0 {
            return Err(HitJournalError::InvalidActor);
        }
        if cursor == self.next_sequence {
            return Ok(HitJournalRead::CaughtUp {
                next_cursor: self.next_sequence,
            });
        }
        if newer32(cursor, self.next_sequence) {
            return Err(HitJournalError::FutureCursor);
        }
        if let Some(first) = self.receipts.front() {
            if newer32(first.sequence, cursor) {
                return Ok(HitJournalRead::Gap {
                    oldest_available: first.sequence,
                });
            }
        } else {
            return Ok(HitJournalRead::Gap {
                oldest_available: self.next_sequence,
            });
        }

        for receipt in &self.receipts {
            if receipt.sequence != cursor && !newer32(receipt.sequence, cursor) {
                continue;
            }
            if receipt.attacker == actor || receipt.target == actor {
                return Ok(HitJournalRead::Delivered {
                    receipt: *receipt,
                    next_cursor: receipt.sequence.wrapping_add(1),
                });
            }
        }
        // Skipping unrelated fighter hits is safe: it grants NO attribution.
        Ok(HitJournalRead::CaughtUp {
            next_cursor: self.next_sequence,
        })
    }
}

fn newer32(candidate: u32, reference: u32) -> bool {
    candidate != reference && candidate.wrapping_sub(reference) < 0x8000_0000
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(attacker: u32, target: u32, damage: u8, hp: u8) -> CombatEvent {
        CombatEvent::Hit {
            attacker,
            target,
            damage,
            hp,
        }
    }

    #[test]
    fn duplicate_or_stale_world_tick_cannot_publish_duplicate_hit_receipts() {
        let mut journal = HitReceiptJournal::new(4).unwrap();
        assert_eq!(journal.record_tick(41, &[hit(2, 1, 34, 66)]), Ok(1));
        let cursor_after = journal.next_cursor();
        assert_eq!(
            journal.record_tick(41, &[hit(2, 1, 34, 66)]),
            Err(HitJournalError::NonMonotonicTick {
                last_tick: 41,
                attempted_tick: 41,
            })
        );
        assert_eq!(
            journal.record_tick(40, &[hit(2, 1, 34, 66)]),
            Err(HitJournalError::NonMonotonicTick {
                last_tick: 41,
                attempted_tick: 40,
            })
        );
        assert_eq!(journal.len(), 1);
        assert_eq!(journal.next_cursor(), cursor_after);
        assert_eq!(
            journal.read_for_actor(2, cursor_after),
            Ok(HitJournalRead::CaughtUp {
                next_cursor: cursor_after
            })
        );
        // Even an empty server tick consumes the one-publication tick fence.
        assert_eq!(journal.record_tick(42, &[]), Ok(0));
        assert_eq!(
            journal.record_tick(42, &[hit(2, 1, 34, 66)]),
            Err(HitJournalError::NonMonotonicTick {
                last_tick: 42,
                attempted_tick: 42,
            })
        );
        assert_eq!(journal.len(), 1);
        assert_eq!(journal.next_cursor(), cursor_after);
    }

    #[test]
    fn tick_fence_wraps_forward_and_invalid_tick_does_not_advance_it() {
        let mut journal = HitReceiptJournal::new(4).unwrap();
        assert_eq!(journal.record_tick(u32::MAX, &[hit(2, 1, 34, 66)]), Ok(1));
        assert_eq!(
            journal.record_tick(0, &[hit(2, 2, 34, 66)]),
            Err(HitJournalError::InvalidEvent(
                HitReceiptError::InvalidActors
            ))
        );
        // The invalid tick did not advance the fence, so its corrected batch
        // can publish once and only once after the previous wrapped tick.
        assert_eq!(journal.record_tick(0, &[hit(2, 1, 34, 32)]), Ok(1));
        assert_eq!(
            journal.record_tick(u32::MAX, &[]),
            Err(HitJournalError::NonMonotonicTick {
                last_tick: 0,
                attempted_tick: u32::MAX,
            })
        );
        assert_eq!(journal.next_cursor(), 2);
        assert_eq!(journal.len(), 2);
    }

    #[test]
    fn real_three_actor_hit_is_visible_to_attacker_and_victim_but_not_spectator() {
        let mut journal = HitReceiptJournal::new(4).unwrap();
        let start = journal.next_cursor();
        assert_eq!(journal.record_tick(375, &[hit(2, 1, 34, 66)]), Ok(1));
        let attacker = journal.read_for_actor(2, start).unwrap();
        let victim = journal.read_for_actor(1, start).unwrap();
        let spectator = journal.read_for_actor(3, start).unwrap();
        let HitJournalRead::Delivered {
            receipt,
            next_cursor,
        } = attacker
        else {
            panic!("attacker must see the committed server hit");
        };
        assert_eq!(receipt.attacker, 2);
        assert_eq!(receipt.target, 1);
        assert_eq!(receipt.damage, 34.0);
        assert_eq!(receipt.target_hp, 66.0);
        assert_eq!(receipt.server_tick, 375);
        assert_eq!(
            victim,
            HitJournalRead::Delivered {
                receipt,
                next_cursor,
            }
        );
        assert_eq!(
            spectator,
            HitJournalRead::CaughtUp {
                next_cursor: journal.next_cursor(),
            }
        );
        assert_eq!(
            journal.read_for_actor(2, next_cursor),
            Ok(HitJournalRead::CaughtUp { next_cursor })
        );
    }

    #[test]
    fn unrelated_hits_are_filtered_without_reordering_authorized_attacks() {
        let mut journal = HitReceiptJournal::new(8).unwrap();
        let first = journal.next_cursor();
        journal
            .record_tick(
                300,
                &[
                    hit(4, 5, 34, 66),
                    hit(2, 1, 34, 66),
                    CombatEvent::Block {
                        attacker: 2,
                        target: 4,
                    },
                    hit(2, 5, 34, 32),
                ],
            )
            .unwrap();
        let HitJournalRead::Delivered {
            receipt: a,
            next_cursor,
        } = journal.read_for_actor(2, first).unwrap()
        else {
            panic!("missing first authorized hit");
        };
        assert_eq!(a.sequence, 1);
        let HitJournalRead::Delivered { receipt: b, .. } =
            journal.read_for_actor(2, next_cursor).unwrap()
        else {
            panic!("missing second authorized hit");
        };
        assert_eq!(b.sequence, 2);
        assert_eq!(journal.len(), 3);
    }

    #[test]
    fn overflow_returns_gap_instead_of_unearned_hit_ack() {
        let mut journal = HitReceiptJournal::new(2).unwrap();
        let initial = journal.next_cursor();
        journal
            .record_tick(
                5,
                &[hit(2, 1, 34, 66), hit(2, 3, 34, 66), hit(2, 4, 34, 66)],
            )
            .unwrap();
        assert_eq!(journal.len(), 2);
        assert_eq!(
            journal.read_for_actor(2, initial),
            Ok(HitJournalRead::Gap {
                oldest_available: 1
            })
        );
        assert_eq!(
            journal.read_for_actor(0, journal.next_cursor()),
            Err(HitJournalError::InvalidActor)
        );
        assert_eq!(
            journal.read_for_actor(2, journal.next_cursor().wrapping_add(1)),
            Err(HitJournalError::FutureCursor)
        );
    }

    #[test]
    fn sequence_wrap_preserves_delivery_and_dedup_cursor() {
        let mut journal = HitReceiptJournal::new(4).unwrap();
        journal.next_sequence = u32::MAX - 1;
        let cursor = journal.next_cursor();
        journal
            .record_tick(
                21,
                &[hit(2, 1, 34, 66), hit(3, 1, 34, 32), hit(2, 1, 32, 0)],
            )
            .unwrap();
        let HitJournalRead::Delivered {
            receipt: first,
            next_cursor,
        } = journal.read_for_actor(2, cursor).unwrap()
        else {
            panic!("pre-wrap hit missing");
        };
        assert_eq!(first.sequence, u32::MAX - 1);
        let HitJournalRead::Delivered {
            receipt: last,
            next_cursor: end,
        } = journal.read_for_actor(2, next_cursor).unwrap()
        else {
            panic!("post-wrap hit missing");
        };
        assert_eq!(last.sequence, 0);
        assert_eq!(end, 1);
        assert_eq!(
            journal.read_for_actor(2, end),
            Ok(HitJournalRead::CaughtUp { next_cursor: end })
        );
    }

    #[test]
    fn invalid_late_hit_fails_atomically_without_writing_earlier_hit() {
        let mut journal = HitReceiptJournal::new(8).unwrap();
        let next = journal.next_cursor();
        assert_eq!(
            journal.record_tick(9, &[hit(2, 1, 34, 66), hit(3, 3, 34, 66)]),
            Err(HitJournalError::InvalidEvent(
                HitReceiptError::InvalidActors
            ))
        );
        assert_eq!(journal.next_cursor(), next);
        assert!(journal.is_empty());
        assert_eq!(
            journal.read_for_actor(2, next),
            Ok(HitJournalRead::CaughtUp { next_cursor: next })
        );
        assert_eq!(
            HitReceiptJournal::new(0).err(),
            Some(HitJournalError::InvalidCapacity)
        );
        assert_eq!(
            HitReceiptJournal::new(MAX_HIT_HISTORY + 1).err(),
            Some(HitJournalError::InvalidCapacity)
        );
    }
}
