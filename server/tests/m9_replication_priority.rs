use myaso_server::{
    simulation::{InputIntent, World},
    snapshot::{apply_records, decode_snapshot, SnapshotSession},
    CONSERVATIVE_DATAGRAM_BYTES,
};
use std::collections::BTreeMap;

#[test]
fn distance_cadence_keeps_near_updates_hot_and_defers_background() {
    let mut world = World::new(5000.0, 5000.0);
    assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
    assert!(world.add_player_at(2, 1500.0, 1000.0, 0.0));
    assert!(world.add_player_at(3, 2000.0, 1000.0, 0.0));
    assert!(world.add_player_at(4, 3000.0, 1000.0, 0.0));

    let mut session = SnapshotSession::default();
    let first = session.build(
        u16::MAX,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(first.full);

    for net_id in 2..=4 {
        assert!(world.set_input(
            net_id,
            InputIntent {
                move_y: 1.0,
                ..InputIntent::default()
            },
        ));
    }

    for _ in 0..3 {
        world.step();
    }
    let near_tick = session.build(
        first.sequence,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    let near_ids = record_ids(&near_tick.bytes);
    assert!(near_ids.contains(&2), "near state should update every snapshot");
    assert!(!near_ids.contains(&3), "mid state should wait for its 6-tick cadence");
    assert!(!near_ids.contains(&4), "far state should wait for its 30-tick cadence");

    for _ in 0..3 {
        world.step();
    }
    let mid_tick = session.build(
        near_tick.sequence,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    let mid_ids = record_ids(&mid_tick.bytes);
    assert!(mid_ids.contains(&2));
    assert!(mid_ids.contains(&3), "mid state should become due at six ticks");
    assert!(!mid_ids.contains(&4));

    let mut ack = mid_tick.sequence;
    let mut far_seen = false;
    while world.tick < 30 {
        for _ in 0..3 {
            world.step();
        }
        let build = session.build(
            ack,
            world.tick,
            1,
            world.fighters(),
            CONSERVATIVE_DATAGRAM_BYTES,
        );
        far_seen |= record_ids(&build.bytes).contains(&4);
        ack = build.sequence;
    }
    assert!(far_seen, "far state must not starve beyond its 30-tick cadence");
}

#[test]
fn dense_fresh_session_resync_is_staged_and_near_first() {
    let mut world = World::new(6000.0, 6000.0);
    assert!(world.add_player_at(1, 2500.0, 2500.0, 0.0));
    for net_id in 2..=31 {
        let x = 2580.0 + (net_id - 2) as f32 * 8.0;
        assert!(world.add_player_at(net_id, x, 2500.0, 0.0));
    }
    for net_id in 32..=61 {
        let x = 4300.0 + (net_id - 32) as f32 * 4.0;
        assert!(world.add_player_at(net_id, x, 2500.0, 0.0));
    }

    let mut session = SnapshotSession::default();
    let max_bytes = 170;
    let first = session.build(u16::MAX, 0, 1, world.fighters(), max_bytes);
    let first_decoded = decode_snapshot(&first.bytes).expect("decode first resync stage");
    assert!(first.full);
    assert!(first.omitted_due_to_budget > 0);
    assert!(first_decoded.records.iter().any(|record| record.net_id == 1));
    assert!(
        first_decoded
            .records
            .iter()
            .filter(|record| record.net_id != 1)
            .all(|record| record.net_id <= 31),
        "near entities must fill the first constrained resync stage before far background state"
    );

    let mut client_state = BTreeMap::new();
    apply_records(&mut client_state, &first_decoded.records);
    let mut ack = first.sequence;
    let mut stages = 1;

    while client_state.len() < 61 && stages < 12 {
        let server_tick = stages as u32 * 3;
        let build = session.build(ack, server_tick, 1, world.fighters(), max_bytes);
        let decoded = decode_snapshot(&build.bytes).expect("decode staged resync");
        apply_records(&mut client_state, &decoded.records);
        ack = build.sequence;
        stages += 1;
    }

    assert_eq!(
        client_state.len(),
        61,
        "every visible entity should converge through bounded staged snapshots"
    );
    assert!(
        stages <= 8,
        "dense resync should converge promptly, got {stages} stages"
    );
}

fn record_ids(bytes: &[u8]) -> Vec<u32> {
    decode_snapshot(bytes)
        .expect("decode snapshot")
        .records
        .into_iter()
        .map(|record| record.net_id)
        .collect()
}
