//! P17: deterministic connection/zone fault injection at the inactive
//! Core-owned writer boundary. No real sockets or live /game mutation.
//!
//! The single-operation enqueue mock simulates a fenced Core critical section:
//! each valid enqueue completes before a server-owned transfer/disconnect can
//! change the connection generation. The next attempt MUST see the new fence.

use std::cell::RefCell;
use std::rc::Rc;

use crate::magic_fx_events::MAGIC_FX_PACKET_BYTES;
use crate::magic_fx_handoff::{FxHandoffPlan, FxRoute, FxRoutedBatch, TrustedFxHandoff};
use crate::magic_fx_shared_transport::{
    plan_shared_dispatch, CoreGameplayDatagram, CoreWriterCapacity,
};
use crate::magic_fx_shared_writer::{
    try_write_core_guarded, CoreAuthenticatedWriter, CoreGuardedEnqueueError, SharedWriteFailure,
};

const CONNECTION: u64 = 42;
const NET_ID: u32 = 7;

#[derive(Clone, Copy)]
enum Fault {
    Transfer {
        after: usize,
        route: FxRoute,
        zone: u32,
    },
    Recycle {
        after: usize,
        route: FxRoute,
        zone: u32,
    },
    Disconnect {
        after: usize,
        route: FxRoute,
    },
}

struct FencedWriter {
    owner: Rc<RefCell<TrustedFxHandoff>>,
    accepted: Vec<(FxRoute, Vec<u8>)>,
    attempted: usize,
    fault: Option<Fault>,
    replacement: Option<FxRoute>,
}

impl FencedWriter {
    fn new(owner: Rc<RefCell<TrustedFxHandoff>>, fault: Option<Fault>) -> Self {
        Self {
            owner,
            accepted: Vec::new(),
            attempted: 0,
            fault,
            replacement: None,
        }
    }
}

impl CoreAuthenticatedWriter for FencedWriter {
    type Error = &'static str;

    fn enqueue_if_current(
        &mut self,
        route: FxRoute,
        bytes: &[u8],
    ) -> Result<(), CoreGuardedEnqueueError<Self::Error>> {
        self.attempted += 1;
        let mut registry = self.owner.borrow_mut();
        if !registry.route_current(route) {
            return Err(CoreGuardedEnqueueError::StaleGeneration);
        }
        self.accepted.push((route, bytes.to_vec()));
        let count = self.accepted.len();
        if let Some(fault) = self.fault.take() {
            match fault {
                Fault::Transfer {
                    after,
                    route: target,
                    zone,
                } if count == after => {
                    self.replacement = Some(
                        registry
                            .transfer_trusted(target, zone)
                            .expect("Core zone migration"),
                    );
                }
                Fault::Recycle {
                    after,
                    route: target,
                    zone,
                } if count == after => {
                    registry
                        .unregister_trusted(target)
                        .expect("Core disconnect");
                    self.replacement = Some(
                        registry
                            .register_trusted(CONNECTION, NET_ID, zone)
                            .expect("Core trusted replacement"),
                    );
                }
                Fault::Disconnect {
                    after,
                    route: target,
                } if count == after => {
                    registry
                        .unregister_trusted(target)
                        .expect("Core disconnect");
                }
                other => self.fault = Some(other),
            }
        }
        Ok(())
    }
}

fn visual(zone: u32) -> [u8; MAGIC_FX_PACKET_BYTES] {
    let mut bytes = [0u8; MAGIC_FX_PACKET_BYTES];
    bytes[..2].copy_from_slice(b"ME");
    bytes[2] = 1;
    bytes[4..8].copy_from_slice(&zone.to_le_bytes());
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
    bytes[29] = 30;
    bytes
}

fn fx(route: FxRoute, zone: u32) -> FxHandoffPlan {
    FxHandoffPlan {
        routes: vec![FxRoutedBatch {
            route,
            packets: vec![visual(zone)],
        }],
        registered: 1,
        eligible: 1,
        suppressed_by_gameplay_or_backpressure: 0,
        cosmetic_payload_bytes: MAGIC_FX_PACKET_BYTES,
    }
}

fn gameplay(route: FxRoute, bytes: &[u8]) -> CoreGameplayDatagram {
    CoreGameplayDatagram {
        route,
        bytes: bytes.to_vec(),
    }
}

fn writer(route: FxRoute, slots: usize) -> CoreWriterCapacity {
    CoreWriterCapacity {
        route,
        available_datagrams: slots,
        gameplay_waiting: false,
        backpressured: false,
    }
}

#[test]
fn p17_zone_transfer_between_two_gameplay_packets_stops_at_exact_unsent_packet() {
    let owner = Rc::new(RefCell::new(TrustedFxHandoff::new()));
    let old = owner
        .borrow_mut()
        .register_trusted(CONNECTION, NET_ID, 1)
        .unwrap();
    let game = [gameplay(old, b"snapshot"), gameplay(old, b"ack")];
    let effects = fx(old, 1);
    let plan = plan_shared_dispatch(&owner.borrow(), &game, &effects, &[writer(old, 3)])
        .expect("trusted P12 plan");
    let mut core = FencedWriter::new(
        Rc::clone(&owner),
        Some(Fault::Transfer {
            after: 1,
            route: old,
            zone: 2,
        }),
    );
    let report = try_write_core_guarded(&plan, &mut core);
    let moved = core.replacement.expect("fenced transfer");
    assert_ne!(old.generation, moved.generation);
    assert_eq!(owner.borrow().authorized_zone(moved), Some(2));
    assert!(!owner.borrow().route_current(old));
    assert_eq!(core.accepted, vec![(old, b"snapshot".to_vec())]);
    assert_eq!(core.attempted, 2);
    assert_eq!(report.gameplay_sent, 1);
    assert_eq!(report.next_unsent_gameplay_index, 1);
    assert_eq!(report.cosmetic_not_sent, 1);
    assert_eq!(
        report.failure,
        Some(SharedWriteFailure::GameplaySendFailed {
            index: 1,
            cause: CoreGuardedEnqueueError::StaleGeneration,
        })
    );
    assert_eq!(game[1].bytes, b"ack");
}

#[test]
fn p17_zone_transfer_after_gameplay_drops_old_fx_without_touching_other_client() {
    let owner = Rc::new(RefCell::new(TrustedFxHandoff::new()));
    let a = owner
        .borrow_mut()
        .register_trusted(CONNECTION, NET_ID, 1)
        .unwrap();
    let b = owner.borrow_mut().register_trusted(43, 8, 2).unwrap();
    let game = [gameplay(a, b"player A"), gameplay(b, b"player B")];
    let effects = FxHandoffPlan {
        routes: vec![
            FxRoutedBatch {
                route: a,
                packets: vec![visual(1)],
            },
            FxRoutedBatch {
                route: b,
                packets: vec![visual(2)],
            },
        ],
        registered: 2,
        eligible: 2,
        suppressed_by_gameplay_or_backpressure: 0,
        cosmetic_payload_bytes: 2 * MAGIC_FX_PACKET_BYTES,
    };
    let plan = plan_shared_dispatch(
        &owner.borrow(),
        &game,
        &effects,
        &[writer(a, 2), writer(b, 2)],
    )
    .unwrap();
    let mut core = FencedWriter::new(
        Rc::clone(&owner),
        Some(Fault::Transfer {
            after: 2,
            route: a,
            zone: 2,
        }),
    );
    let report = try_write_core_guarded(&plan, &mut core);
    assert!(owner.borrow().route_current(b));
    assert!(!owner.borrow().route_current(a));
    assert_eq!(core.accepted.len(), 3);
    assert_eq!(core.accepted[0], (a, b"player A".to_vec()));
    assert_eq!(core.accepted[1], (b, b"player B".to_vec()));
    assert_eq!(core.accepted[2], (b, visual(2).to_vec()));
    assert_eq!(report.gameplay_sent, 2);
    assert_eq!(report.cosmetic_sent, 1);
    assert_eq!(report.stale_cosmetic_skipped, 1);
    assert_eq!(report.cosmetic_send_failed, 0);
    assert_eq!(report.cosmetic_not_sent, 1);
    assert_eq!(report.failure, None);
}

#[test]
fn p17_disconnect_and_recycle_same_connection_and_net_id_never_replays_old_visuals() {
    let owner = Rc::new(RefCell::new(TrustedFxHandoff::new()));
    let old = owner
        .borrow_mut()
        .register_trusted(CONNECTION, NET_ID, 1)
        .unwrap();
    let game = [gameplay(old, b"before reconnect")];
    let effects = fx(old, 1);
    let plan = plan_shared_dispatch(&owner.borrow(), &game, &effects, &[writer(old, 2)]).unwrap();
    let mut core = FencedWriter::new(
        Rc::clone(&owner),
        Some(Fault::Recycle {
            after: 1,
            route: old,
            zone: 2,
        }),
    );
    let report = try_write_core_guarded(&plan, &mut core);
    let fresh = core.replacement.expect("reconnected");
    assert_eq!(fresh.connection_id, old.connection_id);
    assert_ne!(fresh.generation, old.generation);
    assert_eq!(owner.borrow().authorized_zone(fresh), Some(2));
    assert_eq!(report.gameplay_sent, 1);
    assert_eq!(report.cosmetic_sent, 0);
    assert_eq!(report.stale_cosmetic_skipped, 1);
    assert_eq!(core.accepted, vec![(old, b"before reconnect".to_vec())]);

    // A *new* Core game packet must use the new generation and current
    // server-owned zone. The stale visual batch is not rerouted to it.
    let renewed_game = [gameplay(fresh, b"after reconnect")];
    let renewed_visuals = fx(fresh, 2);
    let renewed_plan = plan_shared_dispatch(
        &owner.borrow(),
        &renewed_game,
        &renewed_visuals,
        &[writer(fresh, 2)],
    )
    .unwrap();
    let second = try_write_core_guarded(&renewed_plan, &mut core);
    assert_eq!(second.gameplay_sent, 1);
    assert_eq!(second.cosmetic_sent, 1);
    assert_eq!(second.failure, None);
    assert_eq!(core.accepted[1], (fresh, b"after reconnect".to_vec()));
    assert_eq!(core.accepted[2], (fresh, visual(2).to_vec()));
    assert!(core
        .accepted
        .iter()
        .all(|(r, bytes)| { r.generation == old.generation || bytes.as_slice() != visual(1) }));
}

#[test]
fn p17_disconnect_between_gameplay_packets_preserves_first_unsent_index() {
    let owner = Rc::new(RefCell::new(TrustedFxHandoff::new()));
    let old = owner
        .borrow_mut()
        .register_trusted(CONNECTION, NET_ID, 1)
        .unwrap();
    let game = [gameplay(old, b"first"), gameplay(old, b"second")];
    let effects = fx(old, 1);
    let plan = plan_shared_dispatch(&owner.borrow(), &game, &effects, &[writer(old, 3)]).unwrap();
    let mut core = FencedWriter::new(
        Rc::clone(&owner),
        Some(Fault::Disconnect {
            after: 1,
            route: old,
        }),
    );
    let result = try_write_core_guarded(&plan, &mut core);
    assert_eq!(owner.borrow().registered(), 0);
    assert_eq!(result.gameplay_sent, 1);
    assert_eq!(result.next_unsent_gameplay_index, 1);
    assert_eq!(result.cosmetic_sent, 0);
    assert_eq!(result.cosmetic_not_sent, 1);
    assert_eq!(core.accepted, vec![(old, b"first".to_vec())]);
    assert_eq!(game[1].bytes, b"second");
}

#[test]
fn p17_old_zone_fx_is_discarded_during_transfer_and_replanned_only_in_new_zone() {
    let owner = Rc::new(RefCell::new(TrustedFxHandoff::new()));
    let old = owner
        .borrow_mut()
        .register_trusted(CONNECTION, NET_ID, 1)
        .unwrap();
    let moved = owner.borrow_mut().transfer_trusted(old, 2).unwrap();
    let game = [gameplay(moved, b"new-zone snapshot")];
    let effects = fx(old, 1);
    let planned =
        plan_shared_dispatch(&owner.borrow(), &game, &effects, &[writer(moved, 2)]).unwrap();
    assert_eq!(planned.gameplay_datagrams, 1);
    assert_eq!(planned.cosmetic_datagrams, 0);
    assert_eq!(planned.stale_cosmetic_dropped, 1);
    let mut core = FencedWriter::new(Rc::clone(&owner), None);
    let result = try_write_core_guarded(&planned, &mut core);
    assert_eq!(result.gameplay_sent, 1);
    assert_eq!(result.cosmetic_sent, 0);
    assert_eq!(core.accepted, vec![(moved, b"new-zone snapshot".to_vec())]);
}
