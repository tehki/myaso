use myaso_server::{
    simulation::{InputIntent, World},
    snapshot::{decode_snapshot, ReplicationFrame, SnapshotSession, COMBAT_FRESHNESS_BUDGET_TICKS},
};
use std::collections::BTreeSet;

#[test]
fn acknowledged_delta_history_materializes_state_without_full_map_history() {
    let mut world = World::new(5000.0, 5000.0);
    assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
    assert!(world.add_player_at(2, 1200.0, 1000.0, 0.0));
    assert!(world.add_player_at(3, 1400.0, 1000.0, 0.0));
    let mut session = SnapshotSession::default();

    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let first = session.build_from_frame(u16::MAX, 1, &frame, 1100);
    assert!(first.full);
    assert_eq!(session.history_depth(), 1);
    assert_eq!(session.acknowledged_entity_count(), 0);

    assert!(world.set_input(
        2,
        InputIntent {
            facing_radians: 1.0,
            ..InputIntent::default()
        },
    ));
    for _ in 0..3 {
        world.step();
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let second = session.build_from_frame(first.sequence, 1, &frame, 1100);
    assert!(!second.full);
    assert_eq!(second.baseline_sequence, first.sequence);
    assert_eq!(session.acknowledged_entity_count(), 3);
    assert_eq!(session.history_depth(), 1);
    assert!(session.has_sequence(first.sequence));
    assert!(session.has_sequence(second.sequence));

    for _ in 0..3 {
        world.step();
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let third = session.build_from_frame(second.sequence, 1, &frame, 1100);
    assert!(!third.full);
    assert_eq!(third.baseline_sequence, second.sequence);
    assert_eq!(session.history_depth(), 1);
    assert!(!session.has_sequence(first.sequence));
    assert!(session.has_sequence(second.sequence));
}

#[test]
fn dense_remote_urgency_cannot_crowd_out_local_combat_freshness() {
    let mut world = World::new(6000.0, 6000.0);
    assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));

    let x_offsets = [-240.0, -144.0, -48.0, 48.0, 144.0, 240.0];
    let y_offsets = [-192.0, -96.0, 0.0, 96.0, 192.0];
    let mut net_id = 2_u32;
    for y in y_offsets {
        for x in x_offsets {
            assert!(world.add_player_at(net_id, 1000.0 + x, 1000.0 + y, 0.0));
            net_id += 1;
        }
    }
    assert_eq!(net_id, 32);

    for row in 0..10_u32 {
        for column in 0..10_u32 {
            let id = 32 + row * 10 + column;
            assert!(world.add_player_at(
                id,
                2200.0 + column as f32 * 70.0,
                500.0 + row as f32 * 70.0,
                0.0,
            ));
        }
    }

    let mut session = SnapshotSession::default();
    let initial = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let first = session.build_from_frame(u16::MAX, 1, &initial, 4096);
    assert!(first.full);
    let mut ack = first.sequence;

    for cycle in 1..=8_u32 {
        for id in 1..=31_u32 {
            assert!(world.set_input(
                id,
                InputIntent {
                    facing_radians: cycle as f32 * 0.21 + id as f32 * 0.003,
                    ..InputIntent::default()
                },
            ));
        }
        for id in 32..=131_u32 {
            assert!(world.set_input(
                id,
                InputIntent {
                    facing_radians: cycle as f32 * 0.17 + id as f32 * 0.002,
                    block: true,
                    ..InputIntent::default()
                },
            ));
        }
        for _ in 0..3 {
            world.step();
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let build = session.build_from_frame(ack, 1, &frame, 260);
        let decoded = decode_snapshot(&build.bytes).expect("decode constrained combat snapshot");
        let ids: BTreeSet<_> = decoded.records.iter().map(|record| record.net_id).collect();
        let missing: Vec<_> = (1_u32..=31).filter(|id| !ids.contains(id)).collect();
        assert!(
            missing.is_empty(),
            "local combat records were crowded out: {missing:?}"
        );
        assert_eq!(build.freshness.combat.omitted, 0);
        assert_eq!(build.freshness.combat.over_budget_due, 0);
        assert!(
            build.freshness.combat.max_due_age_ticks <= COMBAT_FRESHNESS_BUDGET_TICKS,
            "combat freshness exceeded budget: {} ticks",
            build.freshness.combat.max_due_age_ticks
        );
        ack = build.sequence;
    }
}
