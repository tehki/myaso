//! P12: inactive Core-facing gameplay-first shared-datagram dispatch contract.
//!
//! This is an ownership-preserving ordering and capacity *plan* only. It
//! NEVER sends to WebTransport, authenticates a browser, parses commands,
//! mutates gameplay or changes the active protocol. Core must provide only
//! server-owned datagrams, verified connection generations and writer state.
//! No FX packet is allowed to consume capacity reserved for real gameplay.

use std::collections::BTreeMap;

use crate::magic_fx_delivery::{
    MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK, MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK,
    MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK,
};
use crate::magic_fx_events::MAGIC_FX_PACKET_BYTES;
use crate::magic_fx_handoff::{FxHandoffPlan, FxRoute, TrustedFxHandoff};
use crate::CONSERVATIVE_DATAGRAM_BYTES;

pub const MAX_CORE_GAMEPLAY_BATCH_DATAGRAMS: usize = 1_024;
pub const MAX_SHARED_WRITERS: usize = 1_024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CoreWriterCapacity {
    /// Must refer to an already authenticated Core connection generation.
    pub route: FxRoute,
    /// Slots available for the ENTIRE dispatch (gameplay gets first claim).
    pub available_datagrams: usize,
    /// Existing gameplay backlog elsewhere in the Core transport.
    pub gameplay_waiting: bool,
    pub backpressured: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreGameplayDatagram {
    /// Existing Core session identity, never a supplied FX or client ID.
    pub route: FxRoute,
    /// Already encoded authoritative snapshot, ACK or other gameplay bytes.
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SharedPriority {
    Gameplay,
    Cosmetic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SharedDispatchDatagram<'a> {
    pub route: FxRoute,
    pub priority: SharedPriority,
    /// Borrow only: Core retains payload ownership and socket send authority.
    pub bytes: &'a [u8],
}

#[derive(Debug, PartialEq, Eq)]
pub struct SharedDispatchPlan<'a> {
    /// All gameplay messages appear before any optional visual events.
    pub ordered: Vec<SharedDispatchDatagram<'a>>,
    pub gameplay_datagrams: usize,
    pub gameplay_payload_bytes: usize,
    pub cosmetic_datagrams: usize,
    pub cosmetic_payload_bytes: usize,
    pub cosmetic_dropped: usize,
    pub stale_cosmetic_dropped: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SharedDispatchError {
    DuplicateWriter,
    TooManyWriters,
    TooMuchGameplay,
    InvalidGameplayDatagram,
    StaleGameplayRoute,
    MissingGameplayWriter,
    InsufficientGameplayCapacity,
}

/// An **inactive**, no-network planner. All-or-nothing validation for
/// gameplay means the caller retains unsent gameplay on error. FX overload
/// is optional and may be dropped. The real QUIC writer must check the route
/// again just before enqueue and must retain gameplay on transport errors.
///
/// NOTE: P8's FX cursor may already advance when its optional batches are
/// planned; discarded FX are NOT retransmitted. This is deliberate for
/// cosmetic-only events and MUST NOT be used for actual hit telegraphs.
pub fn plan_shared_dispatch<'a>(
    registry: &TrustedFxHandoff,
    gameplay: &'a [CoreGameplayDatagram],
    cosmetics: &'a FxHandoffPlan,
    writers: &[CoreWriterCapacity],
) -> Result<SharedDispatchPlan<'a>, SharedDispatchError> {
    if writers.len() > MAX_SHARED_WRITERS {
        return Err(SharedDispatchError::TooManyWriters);
    }
    if gameplay.len() > MAX_CORE_GAMEPLAY_BATCH_DATAGRAMS {
        return Err(SharedDispatchError::TooMuchGameplay);
    }
    let mut writer_by_route = BTreeMap::<FxRoute, CoreWriterCapacity>::new();
    for writer in writers {
        if writer_by_route.insert(writer.route, *writer).is_some() {
            return Err(SharedDispatchError::DuplicateWriter);
        }
    }

    // FIRST preflight every actual game datagram and reserve its socket
    // capacity. No gameplay packet is ever silently shortened or dropped,
    // regardless of how much optional FX is pending.
    let mut remaining = writer_by_route
        .iter()
        .map(|(route, writer)| (*route, writer.available_datagrams))
        .collect::<BTreeMap<_, _>>();
    let mut gameplay_bytes = 0usize;
    for item in gameplay {
        if item.bytes.is_empty() || item.bytes.len() > CONSERVATIVE_DATAGRAM_BYTES {
            return Err(SharedDispatchError::InvalidGameplayDatagram);
        }
        if !registry.route_current(item.route) {
            return Err(SharedDispatchError::StaleGameplayRoute);
        }
        let writer = writer_by_route
            .get(&item.route)
            .ok_or(SharedDispatchError::MissingGameplayWriter)?;
        if writer.backpressured {
            return Err(SharedDispatchError::InsufficientGameplayCapacity);
        }
        let slots = remaining
            .get_mut(&item.route)
            .expect("preflight writer exists");
        if *slots == 0 {
            return Err(SharedDispatchError::InsufficientGameplayCapacity);
        }
        *slots -= 1;
        gameplay_bytes += item.bytes.len();
    }

    let mut ordered = Vec::with_capacity(gameplay.len() + MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK
        / MAGIC_FX_PACKET_BYTES);
    for item in gameplay {
        ordered.push(SharedDispatchDatagram {
            route: item.route,
            priority: SharedPriority::Gameplay,
            bytes: &item.bytes,
        });
    }

    let mut global_cosmetic_bytes = 0usize;
    let mut zone_cosmetic_bytes = BTreeMap::<u32, usize>::new();
    let mut viewer_cosmetic_bytes = BTreeMap::<FxRoute, usize>::new();
    let mut dropped = 0usize;
    let mut stale = 0usize;
    for batch in &cosmetics.routes {
        for packet in &batch.packets {
            let Some(zone_id) = registry.authorized_zone(batch.route) else {
                stale += 1;
                continue;
            };
            // The exact 32-byte ME envelope and zone are server-originated,
            // but are rechecked at the Core/FX boundary as defense in depth.
            let packet_zone = u32::from_le_bytes(packet[4..8].try_into().expect("fixed 32-byte FX"));
            if packet[..2] != *b"ME" || packet[2] != 1 || packet_zone != zone_id {
                dropped += 1;
                continue;
            }
            let Some(writer) = writer_by_route.get(&batch.route) else {
                dropped += 1;
                continue;
            };
            let slots = remaining.get_mut(&batch.route).expect("writer exists");
            // "gameplay_waiting" covers already-queued traffic that is not
            // included in the current gameplay slice; do not steal its slots.
            if writer.gameplay_waiting || writer.backpressured || *slots == 0 {
                dropped += 1;
                continue;
            }
            let zone_bytes = zone_cosmetic_bytes.entry(zone_id).or_default();
            let viewer_bytes = viewer_cosmetic_bytes.entry(batch.route).or_default();
            if global_cosmetic_bytes + MAGIC_FX_PACKET_BYTES > MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK
                || *zone_bytes + MAGIC_FX_PACKET_BYTES > MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK
                || *viewer_bytes + MAGIC_FX_PACKET_BYTES > MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK
            {
                dropped += 1;
                continue;
            }
            *slots -= 1;
            *zone_bytes += MAGIC_FX_PACKET_BYTES;
            *viewer_bytes += MAGIC_FX_PACKET_BYTES;
            global_cosmetic_bytes += MAGIC_FX_PACKET_BYTES;
            ordered.push(SharedDispatchDatagram {
                route: batch.route,
                priority: SharedPriority::Cosmetic,
                bytes: packet,
            });
        }
    }

    Ok(SharedDispatchPlan {
        ordered,
        gameplay_datagrams: gameplay.len(),
        gameplay_payload_bytes: gameplay_bytes,
        cosmetic_datagrams: global_cosmetic_bytes / MAGIC_FX_PACKET_BYTES,
        cosmetic_payload_bytes: global_cosmetic_bytes,
        cosmetic_dropped: dropped,
        stale_cosmetic_dropped: stale,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::magic_fx_handoff::FxRoutedBatch;

    fn fx(zone: u32) -> [u8; MAGIC_FX_PACKET_BYTES] {
        let mut p = [0u8; MAGIC_FX_PACKET_BYTES];
        p[..2].copy_from_slice(b"ME");
        p[2] = 1;
        p[4..8].copy_from_slice(&zone.to_le_bytes());
        p
    }

    fn handoff(routes: Vec<FxRoutedBatch>) -> FxHandoffPlan {
        FxHandoffPlan {
            routes,
            registered: 1,
            eligible: 1,
            suppressed_by_gameplay_or_backpressure: 0,
            cosmetic_payload_bytes: 0,
        }
    }

    fn writer(route: FxRoute, available_datagrams: usize) -> CoreWriterCapacity {
        CoreWriterCapacity {
            route,
            available_datagrams,
            gameplay_waiting: false,
            backpressured: false,
        }
    }

    #[test]
    fn game_first_preserves_exact_authoritative_payload_and_reserves_writer_slots() {
        let mut registry = TrustedFxHandoff::new();
        let r = registry.register_trusted(42, 17, 2).unwrap();
        let game = vec![
            CoreGameplayDatagram { route: r, bytes: b"snapshot".to_vec() },
            CoreGameplayDatagram { route: r, bytes: b"processed-ACK".to_vec() },
        ];
        let visuals = handoff(vec![FxRoutedBatch { route: r, packets: vec![fx(2), fx(2)] }]);
        let planned = plan_shared_dispatch(&registry, &game, &visuals, &[writer(r, 3)]).unwrap();
        assert_eq!(planned.gameplay_datagrams, 2);
        assert_eq!(planned.cosmetic_datagrams, 1);
        assert_eq!(planned.cosmetic_dropped, 1);
        assert_eq!(planned.ordered.len(), 3);
        assert_eq!(planned.ordered[0].bytes, b"snapshot");
        assert_eq!(planned.ordered[1].bytes, b"processed-ACK");
        assert_eq!(planned.ordered[2].bytes, fx(2));
        assert_eq!(
            planned.ordered.iter().map(|item| item.priority).collect::<Vec<_>>(),
            [SharedPriority::Gameplay, SharedPriority::Gameplay, SharedPriority::Cosmetic]
        );
        assert_eq!(game[0].bytes, b"snapshot");
        assert_eq!(game[1].bytes, b"processed-ACK");
    }

    #[test]
    fn gameplay_backpressure_is_fail_closed_and_never_returns_partial_gameplay() {
        let mut registry = TrustedFxHandoff::new();
        let r = registry.register_trusted(1, 1, 1).unwrap();
        let game = vec![
            CoreGameplayDatagram { route: r, bytes: vec![1] },
            CoreGameplayDatagram { route: r, bytes: vec![2] },
        ];
        let visuals = handoff(vec![FxRoutedBatch { route: r, packets: vec![fx(1)] }]);
        assert_eq!(
            plan_shared_dispatch(&registry, &game, &visuals, &[writer(r, 1)]),
            Err(SharedDispatchError::InsufficientGameplayCapacity)
        );
        assert_eq!(game.len(), 2);
        assert_eq!(game[0].bytes, [1]);
        assert_eq!(game[1].bytes, [2]);
    }

    #[test]
    fn independent_gameplay_backlog_or_writer_pressure_suppresses_only_fx() {
        let mut registry = TrustedFxHandoff::new();
        let r = registry.register_trusted(3, 3, 1).unwrap();
        let visuals = handoff(vec![FxRoutedBatch { route: r, packets: vec![fx(1)] }]);
        let mut w = writer(r, 2);
        w.gameplay_waiting = true;
        let out = plan_shared_dispatch(&registry, &[], &visuals, &[w]).unwrap();
        assert_eq!(out.cosmetic_datagrams, 0);
        assert_eq!(out.cosmetic_dropped, 1);
        w.gameplay_waiting = false;
        w.backpressured = true;
        let out = plan_shared_dispatch(&registry, &[], &visuals, &[w]).unwrap();
        assert_eq!(out.cosmetic_datagrams, 0);
        assert_eq!(out.cosmetic_dropped, 1);
    }

    #[test]
    fn trusted_zone_transfer_or_recycled_socket_cannot_leak_old_effects() {
        let mut registry = TrustedFxHandoff::new();
        let old = registry.register_trusted(5, 5, 1).unwrap();
        let visuals = handoff(vec![FxRoutedBatch { route: old, packets: vec![fx(1)] }]);
        let moved = registry.transfer_trusted(old, 2).unwrap();
        let result = plan_shared_dispatch(&registry, &[], &visuals, &[writer(old, 1)]).unwrap();
        assert_eq!(result.stale_cosmetic_dropped, 1);
        assert!(result.ordered.is_empty());
        registry.unregister_trusted(moved).unwrap();
        let recycled = registry.register_trusted(5, 5, 1).unwrap();
        assert_ne!(old.generation, recycled.generation);
        let result = plan_shared_dispatch(&registry, &[], &visuals, &[writer(recycled, 1)]).unwrap();
        assert_eq!(result.stale_cosmetic_dropped, 1);
    }

    #[test]
    fn packet_zone_is_not_authority_and_bad_magic_is_silently_cosmetic_only() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(9, 9, 2).unwrap();
        let mut malformed = fx(2);
        malformed[0] = b'X';
        let visuals = handoff(vec![FxRoutedBatch {
            route, packets: vec![fx(1), malformed, fx(2)],
        }]);
        let out = plan_shared_dispatch(&registry, &[], &visuals, &[writer(route, 3)]).unwrap();
        assert_eq!(out.cosmetic_datagrams, 1);
        assert_eq!(out.cosmetic_dropped, 2);
        assert_eq!(out.ordered[0].bytes, fx(2));
    }

    #[test]
    fn game_payload_or_auth_failure_never_downgrades_to_fx_only() {
        let mut registry = TrustedFxHandoff::new();
        let route = registry.register_trusted(2, 2, 1).unwrap();
        let visuals = handoff(vec![FxRoutedBatch { route, packets: vec![fx(1)] }]);
        for invalid in [vec![], vec![0; CONSERVATIVE_DATAGRAM_BYTES + 1]] {
            let game = [CoreGameplayDatagram { route, bytes: invalid }];
            assert_eq!(
                plan_shared_dispatch(&registry, &game, &visuals, &[writer(route, 2)]),
                Err(SharedDispatchError::InvalidGameplayDatagram)
            );
        }
        let game = [CoreGameplayDatagram { route, bytes: vec![7] }];
        assert_eq!(
            plan_shared_dispatch(&registry, &game, &visuals, &[]),
            Err(SharedDispatchError::MissingGameplayWriter)
        );
        registry.unregister_trusted(route).unwrap();
        assert_eq!(
            plan_shared_dispatch(&registry, &game, &visuals, &[writer(route, 2)]),
            Err(SharedDispatchError::StaleGameplayRoute)
        );
    }

    #[test]
    fn thousand_viewers_cannot_overflow_global_zone_or_viewer_fx_limits() {
        let mut registry = TrustedFxHandoff::new();
        let mut batches = Vec::new();
        let mut writers = Vec::new();
        for id in 1..=1_024 {
            let zone = (id - 1) % 4 + 1;
            let route = registry.register_trusted(id as u64, id, zone).unwrap();
            batches.push(FxRoutedBatch { route, packets: vec![fx(zone)] });
            writers.push(writer(route, 1));
        }
        let fx_plan = handoff(batches);
        let out = plan_shared_dispatch(&registry, &[], &fx_plan, &writers).unwrap();
        assert_eq!(out.cosmetic_datagrams, 512);
        assert_eq!(out.cosmetic_payload_bytes, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
        assert_eq!(out.cosmetic_dropped, 512);
        assert!(out.ordered.iter().all(|msg| msg.priority == SharedPriority::Cosmetic));
    }

    #[test]
    fn every_actual_gameplay_packet_is_emitted_before_all_optional_visual_packets() {
        let mut registry = TrustedFxHandoff::new();
        let a = registry.register_trusted(1, 1, 1).unwrap();
        let b = registry.register_trusted(2, 2, 2).unwrap();
        let game = vec![
            CoreGameplayDatagram { route: b, bytes: vec![8, 8] },
            CoreGameplayDatagram { route: a, bytes: vec![1, 1] },
        ];
        let visuals = handoff(vec![
            FxRoutedBatch { route: a, packets: vec![fx(1)] },
            FxRoutedBatch { route: b, packets: vec![fx(2)] },
        ]);
        let out = plan_shared_dispatch(
            &registry, &game, &visuals, &[writer(a, 2), writer(b, 2)]
        ).unwrap();
        assert_eq!(out.gameplay_datagrams, 2);
        assert_eq!(out.cosmetic_datagrams, 2);
        assert_eq!(out.cosmetic_dropped, 0);
        assert_eq!(out.ordered[0].bytes, [8, 8]);
        assert_eq!(out.ordered[1].bytes, [1, 1]);
        assert_eq!(out.ordered[2].priority, SharedPriority::Cosmetic);
        assert_eq!(out.ordered[3].priority, SharedPriority::Cosmetic);
    }
}
