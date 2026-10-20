//! P14: inert gameplay-first WebTransport writer handoff.
//!
//! Converts an already validated P12 dispatch plan into sequential *attempts*
//! through a Core-supplied callback. Neither this module nor its unit tests
//! opens a socket, negotiates player identity, or activates live magic.
//!
//! Core MUST retain original gameplay buffers until its own transport accepts
//! them. QUIC datagram send acceptance is not reliable remote delivery.

use crate::magic_fx_events::MAGIC_FX_PACKET_BYTES;
use crate::magic_fx_handoff::FxRoute;
use crate::magic_fx_shared_transport::{
    SharedDispatchPlan, SharedPriority,
};
use crate::CONSERVATIVE_DATAGRAM_BYTES;

#[derive(Debug, PartialEq, Eq)]
pub enum SharedWriteFailure<E> {
    /// The proposed plan was malformed; no callback was invoked.
    InvalidPlan,
    /// This gameplay packet belongs to an expired/disconnected generation.
    StaleGameplayRoute { index: usize },
    /// Core's transport could not accept this gameplay datagram.
    GameplaySendFailed { index: usize, cause: E },
}

#[derive(Debug, PartialEq, Eq)]
pub struct SharedWriteReport<E> {
    /// These gameplay datagrams were accepted by the caller's send callback;
    /// this does not guarantee client receipt.
    pub gameplay_sent: usize,
    /// Index into the original gameplay slice for the first still-unsent
    /// gameplay packet. Do NOT replay the preceding packets automatically.
    pub next_unsent_gameplay_index: usize,
    pub cosmetic_sent: usize,
    /// Planned FX that the writer did not accept for any reason.
    pub cosmetic_not_sent: usize,
    pub stale_cosmetic_skipped: usize,
    pub cosmetic_send_failed: usize,
    pub failure: Option<SharedWriteFailure<E>>,
}

/// All gameplay is attempted in original order, before any cosmetics.
/// Every single packet's route generation is checked immediately before
/// Core's enqueue callback. A gameplay failure stops ALL later writes and
/// returns its exact unsent index for the caller's reliable owner. A cosmetic
/// failure is best-effort only: the writer may continue to other FX.
///
/// This is a SYNCHRONOUS, inactive seam, not a real congestion controller:
/// a closure successful return only means local acceptance. Core needs to
/// serialize its real writer's generation checks with connection teardown.
pub fn try_write_shared<E>(
    plan: &SharedDispatchPlan<'_>,
    mut route_current: impl FnMut(FxRoute) -> bool,
    mut send: impl FnMut(FxRoute, &[u8]) -> Result<(), E>,
) -> SharedWriteReport<E> {
    let mut gameplay_count = 0usize;
    let mut cosmetics_count = 0usize;
    let mut gameplay_bytes = 0usize;
    let mut cosmetic_bytes = 0usize;
    let mut seen_cosmetic = false;
    let mut valid = true;

    // A public plan may be fabricated by a future caller. Reject malformed
    // order/count/length claims BEFORE sending any authoritative packet.
    for item in &plan.ordered {
        match item.priority {
            SharedPriority::Gameplay if !seen_cosmetic => {
                gameplay_count += 1;
                valid &= !item.bytes.is_empty() && item.bytes.len() <= CONSERVATIVE_DATAGRAM_BYTES;
                if let Some(next) = gameplay_bytes.checked_add(item.bytes.len()) {
                    gameplay_bytes = next;
                } else {
                    valid = false;
                }
            }
            SharedPriority::Gameplay => valid = false,
            SharedPriority::Cosmetic => {
                seen_cosmetic = true;
                cosmetics_count += 1;
                valid &= item.bytes.len() == MAGIC_FX_PACKET_BYTES;
                if let Some(next) = cosmetic_bytes.checked_add(item.bytes.len()) {
                    cosmetic_bytes = next;
                } else {
                    valid = false;
                }
            }
        }
    }
    valid &= gameplay_count == plan.gameplay_datagrams
        && cosmetics_count == plan.cosmetic_datagrams
        && gameplay_bytes == plan.gameplay_payload_bytes
        && cosmetic_bytes == plan.cosmetic_payload_bytes;

    if !valid {
        return SharedWriteReport {
            gameplay_sent: 0,
            next_unsent_gameplay_index: 0,
            cosmetic_sent: 0,
            cosmetic_not_sent: plan.cosmetic_datagrams,
            stale_cosmetic_skipped: 0,
            cosmetic_send_failed: 0,
            failure: Some(SharedWriteFailure::InvalidPlan),
        };
    }

    let mut report = SharedWriteReport {
        gameplay_sent: 0,
        next_unsent_gameplay_index: 0,
        cosmetic_sent: 0,
        cosmetic_not_sent: plan.cosmetic_datagrams,
        stale_cosmetic_skipped: 0,
        cosmetic_send_failed: 0,
        failure: None,
    };

    // P12 guarantees prefix ordering. This stage must NOT reorder gameplay
    // by connection or silently discard any datagram under backpressure.
    for (index, item) in plan.ordered[..gameplay_count].iter().enumerate() {
        if !route_current(item.route) {
            report.failure = Some(SharedWriteFailure::StaleGameplayRoute { index });
            return report;
        }
        if let Err(cause) = send(item.route, item.bytes) {
            report.failure = Some(SharedWriteFailure::GameplaySendFailed { index, cause });
            return report;
        }
        report.gameplay_sent += 1;
        report.next_unsent_gameplay_index = index + 1;
    }

    // Best-effort cosmetic datagrams can be dropped, without rollback of
    // accepted gameplay or false claims that an effect reached its browser.
    for item in &plan.ordered[gameplay_count..] {
        if !route_current(item.route) {
            report.stale_cosmetic_skipped += 1;
            continue;
        }
        if send(item.route, item.bytes).is_err() {
            report.cosmetic_send_failed += 1;
            continue;
        }
        report.cosmetic_sent += 1;
    }
    report.cosmetic_not_sent -= report.cosmetic_sent;
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::magic_fx_handoff::{FxHandoffPlan, FxRoutedBatch, TrustedFxHandoff};
    use crate::magic_fx_shared_transport::{
        plan_shared_dispatch, CoreGameplayDatagram, CoreWriterCapacity,
        SharedDispatchDatagram, SharedDispatchPlan,
    };
    use std::cell::Cell;

    fn effect(zone: u32) -> [u8; MAGIC_FX_PACKET_BYTES] {
        let mut result = [0u8; MAGIC_FX_PACKET_BYTES];
        result[..2].copy_from_slice(b"ME");
        result[2] = 1;
        result[4..8].copy_from_slice(&zone.to_le_bytes());
        result
    }

    fn composed(
        registry: &TrustedFxHandoff,
        route: FxRoute,
        gameplay: &[CoreGameplayDatagram],
        fx: &FxHandoffPlan,
        slots: usize,
    ) -> SharedDispatchPlan<'_> {
        plan_shared_dispatch(
            registry,
            gameplay,
            fx,
            &[CoreWriterCapacity {
                route,
                available_datagrams: slots,
                gameplay_waiting: false,
                backpressured: false,
            }],
        )
        .unwrap()
    }

    fn fx_plan(route: FxRoute, count: usize) -> FxHandoffPlan {
        FxHandoffPlan {
            routes: vec![FxRoutedBatch {
                route,
                packets: vec![effect(7); count],
            }],
            registered: 1,
            eligible: 1,
            suppressed_by_gameplay_or_backpressure: 0,
            cosmetic_payload_bytes: count * MAGIC_FX_PACKET_BYTES,
        }
    }

    #[test]
    fn accepts_original_gameplay_before_fx_in_same_session_order() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(7, 7, 7).unwrap();
        let gameplay = vec![
            CoreGameplayDatagram { route, bytes: vec![1, 2] },
            CoreGameplayDatagram { route, bytes: vec![3, 4] },
        ];
        let fx = fx_plan(route, 2);
        let plan = composed(&registry, route, &gameplay, &fx, 4);
        let mut sent = Vec::new();
        let output = try_write_shared(&plan, |r| registry.route_current(r), |_, bytes| {
            sent.push(bytes.to_vec());
            Ok::<_, ()>(())
        });
        assert_eq!(sent, vec![vec![1, 2], vec![3, 4], effect(7), effect(7)]);
        assert_eq!(output.gameplay_sent, 2);
        assert_eq!(output.next_unsent_gameplay_index, 2);
        assert_eq!(output.cosmetic_sent, 2);
        assert_eq!(output.cosmetic_not_sent, 0);
        assert_eq!(output.failure, None);
    }

    #[test]
    fn failed_second_gameplay_send_returns_exact_unsent_index_and_skips_all_fx() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(7, 7, 7).unwrap();
        let gameplay = vec![
            CoreGameplayDatagram { route, bytes: vec![1] },
            CoreGameplayDatagram { route, bytes: vec![2] },
            CoreGameplayDatagram { route, bytes: vec![3] },
        ];
        let fx = fx_plan(route, 1);
        let plan = composed(&registry, route, &gameplay, &fx, 4);
        let mut accepted = Vec::new();
        let output = try_write_shared(&plan, |r| registry.route_current(r), |_, bytes| {
            if bytes == [2] {
                return Err("full");
            }
            accepted.push(bytes.to_vec());
            Ok(())
        });
        assert_eq!(accepted, vec![vec![1]]);
        assert_eq!(output.gameplay_sent, 1);
        assert_eq!(output.next_unsent_gameplay_index, 1);
        assert_eq!(output.cosmetic_sent, 0);
        assert_eq!(output.cosmetic_not_sent, 1);
        assert_eq!(
            output.failure,
            Some(SharedWriteFailure::GameplaySendFailed {
                index: 1,
                cause: "full",
            })
        );
    }

    #[test]
    fn reconnect_after_gameplay_prevents_later_fx_from_crossing_generations() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(7, 7, 7).unwrap();
        let gameplay = vec![CoreGameplayDatagram { route, bytes: vec![1] }];
        let fx = fx_plan(route, 1);
        let plan = composed(&registry, route, &gameplay, &fx, 2);
        let checks = Cell::new(0);
        let mut sent = Vec::new();
        let output = try_write_shared(&plan, |_| {
            checks.set(checks.get() + 1);
            checks.get() == 1
        }, |_, bytes| {
            sent.push(bytes.to_vec());
            Ok::<_, ()>(())
        });
        assert_eq!(sent, vec![vec![1]]);
        assert_eq!(output.gameplay_sent, 1);
        assert_eq!(output.stale_cosmetic_skipped, 1);
        assert_eq!(output.cosmetic_not_sent, 1);
        assert_eq!(output.failure, None);
    }

    #[test]
    fn stale_first_gameplay_route_fails_closed_before_socket_enqueue() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(7, 7, 7).unwrap();
        let gameplay = vec![CoreGameplayDatagram { route, bytes: vec![1] }];
        let fx = fx_plan(route, 1);
        let plan = composed(&registry, route, &gameplay, &fx, 2);
        let called = Cell::new(0);
        let output = try_write_shared(&plan, |_| false, |_, _| {
            called.set(called.get() + 1);
            Ok::<_, ()>(())
        });
        assert_eq!(called.get(), 0);
        assert_eq!(output.next_unsent_gameplay_index, 0);
        assert_eq!(output.cosmetic_not_sent, 1);
        assert_eq!(
            output.failure,
            Some(SharedWriteFailure::StaleGameplayRoute { index: 0 })
        );
    }

    #[test]
    fn cosmetic_failure_drops_only_visual_traffic_and_continues() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(7, 7, 7).unwrap();
        let gameplay = vec![CoreGameplayDatagram { route, bytes: vec![1] }];
        let fx = fx_plan(route, 2);
        let plan = composed(&registry, route, &gameplay, &fx, 3);
        let attempts = Cell::new(0);
        let output = try_write_shared(&plan, |_| true, |_, bytes| {
            if bytes.len() == MAGIC_FX_PACKET_BYTES {
                attempts.set(attempts.get() + 1);
                if attempts.get() == 1 {
                    return Err("cosmetic pressure");
                }
            }
            Ok(())
        });
        assert_eq!(output.gameplay_sent, 1);
        assert_eq!(output.cosmetic_sent, 1);
        assert_eq!(output.cosmetic_send_failed, 1);
        assert_eq!(output.cosmetic_not_sent, 1);
        assert_eq!(output.failure, None);
    }

    #[test]
    fn malformed_public_plan_is_rejected_before_any_socket_writes() {
        let route = FxRoute { connection_id: 7, generation: 2 };
        let snapshot = [1u8, 2];
        let cosmetic = effect(7);
        let plan = SharedDispatchPlan {
            ordered: vec![
                SharedDispatchDatagram { route, priority: SharedPriority::Cosmetic, bytes: &cosmetic },
                SharedDispatchDatagram { route, priority: SharedPriority::Gameplay, bytes: &snapshot },
            ],
            gameplay_datagrams: 1,
            gameplay_payload_bytes: 2,
            cosmetic_datagrams: 1,
            cosmetic_payload_bytes: 32,
            cosmetic_dropped: 0,
            stale_cosmetic_dropped: 0,
        };
        let sends = Cell::new(0);
        let report = try_write_shared(&plan, |_| true, |_, _| {
            sends.set(sends.get() + 1);
            Ok::<_, ()>(())
        });
        assert_eq!(sends.get(), 0);
        assert_eq!(report.gameplay_sent, 0);
        assert_eq!(report.next_unsent_gameplay_index, 0);
        assert_eq!(report.failure, Some(SharedWriteFailure::InvalidPlan));
    }
}
