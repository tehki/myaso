//! P7 scheduler acceptance: all sessions/views here model trusted Core input.
//! These are NOT actual browser clients, sockets or authenticated connections.

use crate::elemental_physics::Element;
use crate::magic_fx_delivery::{
    FxDeliverySession, ShardError, ShardedMagicFxHub, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK,
    MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK, MAX_FX_SCHEDULED_SESSIONS,
};
use crate::magic_fx_events::{TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES};
use std::collections::BTreeSet;

fn crowded_hub(zones: u32) -> ShardedMagicFxHub {
    let mut hub = ShardedMagicFxHub::new();
    for zone in 1..=zones {
        hub.register_zone(zone).unwrap();
    }
    for tick in 1..=4u64 {
        hub.advance(tick).unwrap();
        for zone in 1..=zones {
            for local in 0..12u32 {
                hub.admit_trusted(
                    tick,
                    TrustedEffectSpec {
                        zone_id: zone,
                        x: local as f32 * 5.0,
                        y: 20.0,
                        element: Element::Wind,
                        seed: zone * 100 + local,
                        intensity: 180,
                        ttl_ticks: 120,
                    },
                )
                .unwrap();
            }
        }
    }
    hub
}

fn viewers(sessions: &[FxDeliverySession]) -> Vec<ViewerInterest> {
    sessions
        .iter()
        .map(|session| ViewerInterest {
            zone_id: session.zone_id,
            x: 10.0,
            y: 20.0,
            radius: 700.0,
        })
        .collect()
}

fn sessions(count: u32, zones: u32) -> Vec<FxDeliverySession> {
    (1..=count)
        .map(|id| FxDeliverySession::new(id, 1 + (id - 1) % zones).unwrap())
        .collect()
}

#[test]
fn fair_scheduler_saturates_512_viewers_in_four_zones_without_any_starvation() {
    let mut hub = crowded_hub(4);
    let mut sessions = sessions(512, 4);
    let views = viewers(&sessions);
    let report = hub.schedule_fair_tick(4, &mut sessions, &views).unwrap();
    assert_eq!(report.considered_sessions, 512);
    assert_eq!(report.served_sessions, 512);
    assert_eq!(report.payload_bytes, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
    assert_eq!(report.batches.len(), 512);
    assert!(report.batches.iter().all(|batch| batch.packets.len() == 1));

    let mut seen = BTreeSet::new();
    for batch in &report.batches {
        assert!(seen.insert(batch.authenticated_net_id));
        let zone = u32::from_le_bytes(batch.packets[0][4..8].try_into().unwrap());
        assert_eq!(zone, 1 + (batch.authenticated_net_id - 1) % 4);
    }
    for zone in 1..=4 {
        assert_eq!(
            hub.zone_payload_bytes_this_tick(zone),
            Some(MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK)
        );
    }
}

#[test]
fn one_crowded_zone_eventually_gives_all_512_viewers_a_turn() {
    let mut hub = crowded_hub(1);
    let mut sessions = sessions(512, 1);
    let views = viewers(&sessions);
    let mut all_served = BTreeSet::new();
    for tick in 4..=7 {
        if tick > 4 {
            hub.advance(tick).unwrap();
        }
        let report = hub.schedule_fair_tick(tick, &mut sessions, &views).unwrap();
        assert_eq!(report.served_sessions, 128);
        assert_eq!(
            hub.zone_payload_bytes_this_tick(1),
            Some(MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK)
        );
        for batch in report.batches {
            assert!(all_served.insert(batch.authenticated_net_id));
        }
    }
    assert_eq!(all_served.len(), 512);
}

#[test]
fn eight_zone_1024_viewer_global_saturation_rotates_turns() {
    let mut hub = crowded_hub(8);
    let mut sessions = sessions(1_024, 8);
    let views = viewers(&sessions);
    let first = hub.schedule_fair_tick(4, &mut sessions, &views).unwrap();
    assert_eq!(first.served_sessions, 512);
    assert_eq!(first.payload_bytes, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
    let first_ids: BTreeSet<u32> = first
        .batches
        .iter()
        .map(|batch| batch.authenticated_net_id)
        .collect();

    hub.advance(5).unwrap();
    let second = hub.schedule_fair_tick(5, &mut sessions, &views).unwrap();
    assert_eq!(second.served_sessions, 512);
    assert_eq!(second.payload_bytes, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
    let second_ids: BTreeSet<u32> = second
        .batches
        .iter()
        .map(|batch| batch.authenticated_net_id)
        .collect();
    assert!(first_ids.is_disjoint(&second_ids));
    assert_eq!(first_ids.union(&second_ids).count(), 1_024);
}

#[test]
fn fair_scheduling_is_independent_of_input_slice_order() {
    let mut hub_a = crowded_hub(4);
    let mut hub_b = crowded_hub(4);
    let mut ascending = sessions(512, 4);
    let mut descending = ascending.clone();
    descending.reverse();
    let ascending_views = viewers(&ascending);
    let descending_views = viewers(&descending);
    let a = hub_a
        .schedule_fair_tick(4, &mut ascending, &ascending_views)
        .unwrap();
    let b = hub_b
        .schedule_fair_tick(4, &mut descending, &descending_views)
        .unwrap();
    let id_sequence = |report: &crate::magic_fx_delivery::FairFxDispatch| {
        report
            .batches
            .iter()
            .map(|batch| batch.authenticated_net_id)
            .collect::<Vec<_>>()
    };
    assert_eq!(id_sequence(&a), id_sequence(&b));
    assert_eq!(a.payload_bytes, b.payload_bytes);
}

#[test]
fn malformed_batches_fail_without_debiting_any_cosmetic_budget() {
    let mut hub = crowded_hub(4);
    let mut two = sessions(2, 4);
    let views = viewers(&two);

    assert_eq!(
        hub.schedule_fair_tick(4, &mut two, &views[..1]),
        Err(ShardError::InvalidViewerBatch)
    );
    two[1].authenticated_net_id = two[0].authenticated_net_id;
    assert_eq!(
        hub.schedule_fair_tick(4, &mut two, &views),
        Err(ShardError::DuplicateSession)
    );
    two[1].authenticated_net_id = 2;
    let mut forged = views.clone();
    forged[1].zone_id = 1;
    assert_eq!(
        hub.schedule_fair_tick(4, &mut two, &forged),
        Err(ShardError::WrongSessionZone)
    );
    forged = views.clone();
    forged[1].x = f32::NAN;
    assert_eq!(
        hub.schedule_fair_tick(4, &mut two, &forged),
        Err(ShardError::InvalidViewer)
    );
    assert_eq!(hub.stats().global_payload_bytes_this_tick, 0);
    assert_eq!(two[0].last_event_id, 0);
    assert_eq!(two[1].last_event_id, 0);

    let valid = hub.schedule_fair_tick(4, &mut two, &views).unwrap();
    assert_eq!(valid.served_sessions, 2);
    assert_eq!(
        hub.schedule_fair_tick(4, &mut two, &views),
        Err(ShardError::SessionAlreadyPolled)
    );
}

#[test]
fn session_capacity_and_mismatched_tick_fail_closed() {
    let mut hub = crowded_hub(1);
    let mut many = sessions((MAX_FX_SCHEDULED_SESSIONS + 1) as u32, 1);
    let many_views = viewers(&many);
    assert_eq!(
        hub.schedule_fair_tick(4, &mut many, &many_views),
        Err(ShardError::SessionCapacity)
    );
    let mut small = sessions(8, 1);
    let small_views = viewers(&small);
    assert_eq!(
        hub.schedule_fair_tick(3, &mut small, &small_views),
        Err(ShardError::InvalidTick)
    );
    assert_eq!(hub.stats().global_payload_bytes_this_tick, 0);
}

#[test]
fn transparent_cosmetic_drop_can_never_debit_non_fx_gameplay_budget() {
    let mut hub = crowded_hub(1);
    let mut clients = sessions(512, 1);
    let views = viewers(&clients);
    let report = hub.schedule_fair_tick(4, &mut clients, &views).unwrap();
    assert_eq!(report.payload_bytes, 128 * MAGIC_FX_PACKET_BYTES);
    assert_eq!(
        hub.stats().global_payload_bytes_this_tick,
        report.payload_bytes
    );
    // This module has NO movement, combat or snapshot access: even exhausted
    // visual quotas only return fewer optional packets.
    let mut other = FxDeliverySession::new(9999, 1).unwrap();
    let empty = hub.plan_delivery(4, &mut other, views[0]).unwrap();
    assert!(empty.is_empty());
    assert_eq!(
        hub.stats().global_payload_bytes_this_tick,
        report.payload_bytes
    );
}
