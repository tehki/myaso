//! Combat 4C original-World LMB-only source ownership and replay regressions.
//! E is reserved for future Use: retired source1 always rejects before Combat.
//! Server tick, 34/46 HP and exactly-once authentic LMB HIT stay authoritative.
//! Nonrelease review, no public v2, no new Combat authority.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4c_0c;
const BOOT: u128 = 0x1234_aabb_ccdd_9988;

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}

fn ack(
    path: &mut SessionGestureWorldPath,
    world: &mut World,
    source: GestureSource,
    action: GestureAction,
    sequence: u32,
    id: u32,
) -> AckStatus {
    let packet = encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence,
            gesture_id: id,
            client_tick: u32::MAX, // Diagnostic, never original World authority.
        },
    })
    .unwrap();
    let reply = path
        .accept_under_world_lock(world, LEASE, BOOT, &packet)
        .expect("same-lease contiguous physical gesture deserves actual World ACK");
    assert_eq!(reply.sequence, sequence);
    assert_eq!(reply.gesture_id, id);
    assert_eq!(reply.server_tick, world.tick);
    reply.status
}

fn hits(path: &mut SessionGestureWorldPath, world: &mut World, ticks: usize) -> Vec<(u8, u8)> {
    let mut result = Vec::new();
    for _ in 0..ticks {
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                result.push((damage, hp));
            }
        }
        path.advance_under_world_lock(world, LEASE, BOOT);
    }
    result
}

#[test]
fn release_only_lmb_real_second_click_during_recovery_is_no_combat_not_fatal() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 10), vec![(34, 66)]);
    assert_ne!(w.fighter(1).unwrap().action, Action::Idle);

    // Released real LMB #1; physical press #2 is valid during first strike's
    // remaining World recovery but must NOT produce a second 34HP hit.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert!(hits(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            5,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            6,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 32)]);
}

#[test]
fn held_lmb_after_original_world_recovery_must_not_be_ghost_repressed() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    // World Idle is NOT a physical source0 UP, even if first hit committed.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Rejected
    );
    // The rejected forged DOWN did not consume original seq2.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
}

#[test]
fn retired_keye_during_lmb_light_recovery_cannot_strand_the_next_real_attack() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 10), vec![(34, 66)]);
    assert_ne!(w.fighter(1).unwrap().action, Action::Idle);

    // Historical source1 does NOT admit a separate recovery action and cannot
    // take source0's subsequent physical sequence numbers.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Rejected
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            3,
            2
        ),
        AckStatus::Rejected
    );
    assert!(hits(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 32)]);
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn original_held_lmb_is_not_released_or_replaced_by_retired_keye_packets() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    // World idle after a landed light does not fabricate a physical source0 UP.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Rejected
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            2,
            3
        ),
        AckStatus::Rejected
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Cancel,
            2,
            2
        ),
        AckStatus::Rejected
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );

    // Genuine later source0 gesture still owns its own sequence and one HIT.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 32)]);
}

#[test]
fn late_old_lmb_release_after_retired_keye_does_not_poison_new_lmb_heavy() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();

    // The original light landed, but its physical left button stays held
    // through World recovery. A stale Key E may not claim the next source0 UP.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Rejected
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Duplicate
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            3,
            2
        ),
        AckStatus::Rejected
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);

    // A DIFFERENT source0 gesture starts its own legitimate 320ms charge.
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            3
        ),
        AckStatus::Accepted
    );
    assert!(hits(&mut p, &mut w, 4).is_empty());
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            4,
            3
        ),
        AckStatus::Accepted
    );
    assert!(hits(&mut p, &mut w, 35).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Cancel,
            5,
            4
        ),
        AckStatus::Rejected
    );
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            5,
            3
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(46, 20)]);
    assert_eq!(
        ack(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            5,
            3
        ),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}
