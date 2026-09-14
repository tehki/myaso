use myaso_server::{
    simulation::{InputIntent, World},
    snapshot::{ReplicationFrame, SnapshotSession},
};

const REALTIME_BYTES: usize = 1100;
const RELIABLE_BYTES: usize = u16::MAX as usize;

#[test]
fn reliable_snapshot_converges_dense_state_omitted_by_realtime_datagram() {
    let mut world = World::default();
    for net_id in 1..=512_u32 {
        let index = net_id - 1;
        let column = index % 32;
        let row = index / 32;
        assert!(world.add_player_at(
            net_id,
            3200.0 + column as f32 * 42.0,
            3600.0 + row as f32 * 42.0,
            0.0,
        ));
    }
    let mut session = SnapshotSession::default();
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let baseline = session.build_from_frame(u16::MAX, 1, &frame, RELIABLE_BYTES);
    assert!(baseline.full);
    assert_eq!(baseline.omitted_due_to_budget, 0);
    assert!(baseline.bytes.len() > REALTIME_BYTES);

    for net_id in 1..=512_u32 {
        assert!(world.set_input(
            net_id,
            InputIntent {
                facing_radians: net_id as f32 * 0.013,
                block: net_id % 3 == 0,
                ..InputIntent::default()
            },
        ));
    }
    for _ in 0..3 {
        world.step();
    }
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let realtime = session.build_from_frame(baseline.sequence, 1, &frame, REALTIME_BYTES);
    assert!(realtime.omitted_due_to_budget > 0);

    let reliable = session.build_from_frame(baseline.sequence, 1, &frame, RELIABLE_BYTES);
    assert!(!reliable.full);
    assert_eq!(reliable.omitted_due_to_budget, 0);
    assert!(reliable.record_count > realtime.record_count);
    assert!(reliable.bytes.len() > REALTIME_BYTES);
    assert!(reliable.bytes.len() <= RELIABLE_BYTES);
}
