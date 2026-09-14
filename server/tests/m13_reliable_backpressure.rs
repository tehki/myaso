use myaso_server::{
    reliable::try_enqueue_reliable,
    simulation::World,
    snapshot::{ReplicationFrame, SnapshotSession},
};
use std::cell::Cell;
use tokio::sync::mpsc;

const RELIABLE_BYTES: usize = u16::MAX as usize;

#[test]
fn dense_reliable_builder_is_not_run_while_writer_queue_is_full() {
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
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let mut session = SnapshotSession::default();
    let (sender, mut receiver) = mpsc::channel(1);
    sender.try_send(vec![0]).expect("prime writer queue");
    let builds = Cell::new(0_u32);

    let queued = try_enqueue_reliable(&sender, || {
        builds.set(builds.get() + 1);
        session
            .build_from_frame(u16::MAX, 1, &frame, RELIABLE_BYTES)
            .bytes
    })
    .expect("queue remains open");

    assert!(!queued);
    assert_eq!(builds.get(), 0);
    receiver.try_recv().expect("drain primed queue");

    let queued = try_enqueue_reliable(&sender, || {
        builds.set(builds.get() + 1);
        session
            .build_from_frame(u16::MAX, 1, &frame, RELIABLE_BYTES)
            .bytes
    })
    .expect("queue remains open");
    assert!(queued);
    assert_eq!(builds.get(), 1);
    let payload = receiver.try_recv().expect("dense reliable payload");
    assert!(payload.len() > 1100);
    assert!(payload.len() <= RELIABLE_BYTES);
}
