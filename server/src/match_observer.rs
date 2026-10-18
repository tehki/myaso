//! Optional, default-off MatchWon observation at the real Rust simulation boundary.
//!
//! Research-only: fighter IDs are match-local, not authenticated users.
//! No wallet, account, identity, consent, signing, persistence, network or MOON
//! issuance. Even a successful enqueue is NOT evidence of durable delivery.
//! sync_channel::try_send is nonblocking on queue *capacity* but it may
//! acquire an internal mutex; do not claim hard-real-time guarantees.

use crate::simulation::CombatEvent;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    mpsc::{self, Receiver, SyncSender, TrySendError},
};

/// Deliberately contains only the existing, authoritative simulation fields
/// and source tick. Not a signed, replay-safe, or durable protocol envelope.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MatchWinObservation {
    pub source_tick: u32,
    pub winner_net_id: u32,
    pub kills: u16,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ObserverCounters {
    pub accepted: u64,
    pub full: u64,
    pub disconnected: u64,
}

/// No background worker is started by this observer.
pub struct MatchWinObserver {
    sender: Option<SyncSender<MatchWinObservation>>,
    accepted: AtomicU64,
    full: AtomicU64,
    disconnected: AtomicU64,
}

impl Default for MatchWinObserver {
    fn default() -> Self {
        Self::disabled()
    }
}

impl MatchWinObserver {
    /// The actual authoritative server uses this path unconditionally.
    #[must_use]
    pub fn disabled() -> Self {
        Self {
            sender: None,
            accepted: AtomicU64::new(0),
            full: AtomicU64::new(0),
            disconnected: AtomicU64::new(0),
        }
    }

    /// In-process test/research hook only, never wired to production config.
    ///
    /// Receiver ownership, draining, shutdown and any future loss recovery are
    /// explicit responsibilities of a separately reviewed integration.
    #[must_use]
    pub fn research_channel(capacity: usize) -> (Self, Receiver<MatchWinObservation>) {
        assert!((1..=1024).contains(&capacity), "bounded research capacity");
        let (sender, receiver) = mpsc::sync_channel(capacity);
        (
            Self {
                sender: Some(sender),
                accepted: AtomicU64::new(0),
                full: AtomicU64::new(0),
                disconnected: AtomicU64::new(0),
            },
            receiver,
        )
    }

    /// Called after a simulation tick with an already-collected event slice.
    /// Does not wait for channel capacity, do I/O, or allocate in the disabled
    /// path. Full/closed queues are counted and dropped: NOT lossless.
    pub fn observe(&self, source_tick: u32, events: &[CombatEvent]) {
        let Some(sender) = &self.sender else {
            return;
        };
        for event in events {
            let CombatEvent::MatchWon { winner, kills } = event else {
                continue;
            };
            let observation = MatchWinObservation {
                source_tick,
                winner_net_id: *winner,
                kills: *kills,
            };
            match sender.try_send(observation) {
                Ok(()) => {
                    self.accepted.fetch_add(1, Ordering::Relaxed);
                }
                Err(TrySendError::Full(_)) => {
                    self.full.fetch_add(1, Ordering::Relaxed);
                }
                Err(TrySendError::Disconnected(_)) => {
                    self.disconnected.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    }

    #[must_use]
    pub fn counters(&self) -> ObserverCounters {
        ObserverCounters {
            accepted: self.accepted.load(Ordering::Relaxed),
            full: self.full.load(Ordering::Relaxed),
            disconnected: self.disconnected.load(Ordering::Relaxed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WIN: CombatEvent = CombatEvent::MatchWon {
        winner: 7,
        kills: 5,
    };

    #[test]
    fn disabled_observer_is_inert_and_never_requires_a_receiver() {
        let observer = MatchWinObserver::disabled();
        for tick in 0..100 {
            observer.observe(tick, std::slice::from_ref(&WIN));
        }
        assert_eq!(observer.counters(), ObserverCounters::default());
    }

    #[test]
    fn only_authoritative_match_wins_are_collected() {
        let (observer, receiver) = MatchWinObserver::research_channel(2);
        observer.observe(
            42,
            &[
                CombatEvent::Death {
                    fighter: 8,
                    killer: 7,
                },
                WIN,
                CombatEvent::MatchReset,
            ],
        );
        assert_eq!(
            receiver.try_recv().unwrap(),
            MatchWinObservation {
                source_tick: 42,
                winner_net_id: 7,
                kills: 5,
            }
        );
        assert_eq!(observer.counters().accepted, 1);
        assert!(receiver.try_recv().is_err());
    }

    #[test]
    fn bounded_queue_full_drops_instead_of_waiting_for_reader() {
        let (observer, receiver) = MatchWinObserver::research_channel(1);
        observer.observe(10, std::slice::from_ref(&WIN));
        observer.observe(11, std::slice::from_ref(&WIN));
        assert_eq!(observer.counters().accepted, 1);
        assert_eq!(observer.counters().full, 1);
        assert_eq!(receiver.try_recv().unwrap().source_tick, 10);
        assert!(receiver.try_recv().is_err());
        observer.observe(12, std::slice::from_ref(&WIN));
        assert_eq!(receiver.try_recv().unwrap().source_tick, 12);
        assert_eq!(observer.counters().accepted, 2);
    }

    #[test]
    fn disconnected_receiver_is_counted_not_retried_or_acked() {
        let (observer, receiver) = MatchWinObserver::research_channel(1);
        drop(receiver);
        observer.observe(91, std::slice::from_ref(&WIN));
        assert_eq!(observer.counters().disconnected, 1);
        assert_eq!(observer.counters().accepted, 0);
    }

    #[test]
    fn observer_restart_is_not_durable_and_counters_do_not_imply_ack() {
        let (first, old_receiver) = MatchWinObserver::research_channel(1);
        first.observe(1, std::slice::from_ref(&WIN));
        assert_eq!(first.counters().accepted, 1);
        drop(first);
        drop(old_receiver);
        let (second, fresh_receiver) = MatchWinObserver::research_channel(1);
        assert_eq!(second.counters(), ObserverCounters::default());
        assert!(fresh_receiver.try_recv().is_err());
    }

    #[test]
    fn research_capacity_is_not_unbounded() {
        assert!(std::panic::catch_unwind(|| MatchWinObserver::research_channel(0)).is_err());
        assert!(std::panic::catch_unwind(|| MatchWinObserver::research_channel(1025)).is_err());
    }

    #[test]
    fn preserves_fifo_with_multiple_winners_and_ticks() {
        let (observer, receiver) = MatchWinObserver::research_channel(3);
        for i in 1..=3 {
            observer.observe(
                i,
                &[CombatEvent::MatchWon {
                    winner: i,
                    kills: 5,
                }],
            );
        }
        for i in 1..=3 {
            let next = receiver.try_recv().unwrap();
            assert_eq!(next.source_tick, i);
            assert_eq!(next.winner_net_id, i);
        }
        assert_eq!(observer.counters().accepted, 3);
    }
}
