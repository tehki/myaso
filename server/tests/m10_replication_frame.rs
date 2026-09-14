use myaso_server::{
    simulation::{InputIntent, World},
    snapshot::{
        ReplicationFrame, SnapshotSession, INTEREST_FAR_RADIUS, WORLD_COORDINATE_SCALE,
    },
    CONSERVATIVE_DATAGRAM_BYTES,
};
use std::collections::BTreeSet;

#[test]
fn spatial_frame_query_matches_naive_visibility_for_512_players() {
    let mut world = World::default();
    for net_id in 1..=512 {
        assert!(world.add_player(net_id));
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    assert_eq!(frame.len(), 512);

    for viewer_net_id in [1_u32, 128, 256, 512] {
        let query = frame.query_interest(viewer_net_id).expect("viewer exists");
        let actual: BTreeSet<_> = query.states.iter().map(|state| state.net_id).collect();
        let viewer = frame.get(viewer_net_id).expect("viewer state");
        let expected: BTreeSet<_> = (1_u32..=512)
            .filter(|net_id| {
                let state = frame.get(*net_id).expect("candidate state");
                let dx = (state.x as f32 - viewer.x as f32) / WORLD_COORDINATE_SCALE;
                let dy = (state.y as f32 - viewer.y as f32) / WORLD_COORDINATE_SCALE;
                dx * dx + dy * dy <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
            })
            .collect();
        assert_eq!(actual, expected);
        assert!(query.candidates_checked < frame.len());
        assert!(query.cells_visited > 0);
    }
}

#[test]
fn shared_replication_frame_preserves_snapshot_wire_semantics() {
    let mut world = World::new(5000.0, 5000.0);
    assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
    assert!(world.add_player_at(2, 1450.0, 1000.0, 0.0));
    assert!(world.add_player_at(3, 2100.0, 1000.0, 0.0));
    assert!(world.add_player_at(4, 3600.0, 1000.0, 0.0));

    let mut legacy = SnapshotSession::default();
    let mut shared = SnapshotSession::default();
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let legacy_first = legacy.build(
        u16::MAX,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    let shared_first = shared.build_from_frame(
        u16::MAX,
        1,
        &frame,
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert_eq!(legacy_first.bytes, shared_first.bytes);

    assert!(world.set_input(
        2,
        InputIntent {
            move_y: 1.0,
            ..InputIntent::default()
        },
    ));
    for _ in 0..3 {
        world.step();
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let legacy_next = legacy.build(
        legacy_first.sequence,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    let shared_next = shared.build_from_frame(
        shared_first.sequence,
        1,
        &frame,
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert_eq!(legacy_next.bytes, shared_next.bytes);
}

#[test]
fn planner_reports_distance_tier_freshness() {
    let mut world = World::new(5000.0, 5000.0);
    assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
    assert!(world.add_player_at(2, 1500.0, 1000.0, 0.0));
    assert!(world.add_player_at(3, 2000.0, 1000.0, 0.0));
    assert!(world.add_player_at(4, 3000.0, 1000.0, 0.0));
    let mut session = SnapshotSession::default();
    let first_frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let first = session.build_from_frame(
        u16::MAX,
        1,
        &first_frame,
        CONSERVATIVE_DATAGRAM_BYTES,
    );

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
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let near = session.build_from_frame(
        first.sequence,
        1,
        &frame,
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(near.freshness.near.due >= 1);
    assert_eq!(near.freshness.near.due, near.freshness.near.sent);
    assert!(near.freshness.near.max_due_age_ticks >= 3);
    assert_eq!(near.freshness.mid.due, 0);
    assert_eq!(near.freshness.far.due, 0);

    for _ in 0..3 {
        world.step();
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let mid = session.build_from_frame(
        near.sequence,
        1,
        &frame,
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(mid.freshness.mid.due >= 1);
    assert_eq!(mid.freshness.mid.due, mid.freshness.mid.sent);
    assert!(mid.freshness.mid.max_due_age_ticks >= 6);
}
