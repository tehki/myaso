//! Combat 4C fail-first: genuine rapid repeat of the SAME physical source
//! during original World windup/recovery must NOT fatally close Core8A's one
//! shared source0+source1 typed outbox. This is only a NONRELEASE test.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4c44;
const BOOT: u128 = 0x9876_5432_1234_abcd;

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}

fn admit(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    source: GestureSource,
    action: GestureAction,
    seq: u32,
    id: u32,
) -> AckStatus {
    let bytes = encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence: seq,
            gesture_id: id,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    let ack = p.accept_under_world_lock(w, LEASE, BOOT, &bytes).unwrap();
    assert_eq!(ack.sequence, seq);
    assert_eq!(ack.gesture_id, id);
    assert_eq!(ack.server_tick, w.tick);
    ack.status
}

fn hits(p: &mut SessionGestureWorldPath, w: &mut World, ticks: usize) -> Vec<(u8, u8)> {
    let mut result = vec![];
    for _ in 0..ticks {
        for e in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = e
            {
                result.push((damage, hp));
            }
        }
        p.advance_under_world_lock(w, LEASE, BOOT);
    }
    result
}

#[test]
fn genuine_second_lmb_click_during_light_recovery_must_not_kill_shared_outbox() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 10), vec![(34, 66)]);
    assert_ne!(w.fighter(1).unwrap().action, Action::Idle);

    // Human rapid clicking can produce another real DOWN/UP even though World
    // is still executing the first committed strike. This second gesture is
    // physically valid but must be NO-COMBAT, not a fatal shared-lease reject.
    let second = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Press, 3, 2);
    assert_eq!(
        second,
        AckStatus::Accepted,
        "benign same-source busy PRESS must not retire shared source0/source1 outbox"
    );
    let terminal = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Release, 4, 2);
    assert_eq!(terminal, AckStatus::Accepted);
    let duplicate = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Release, 4, 2);
    assert_eq!(duplicate, AckStatus::Duplicate);
    assert!(hits(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // The no-op receipt must not poison the next real World 34HP light.
    let next = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Press, 5, 3);
    assert_eq!(next, AckStatus::Accepted);
    let release = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Release, 6, 3);
    assert_eq!(release, AckStatus::Accepted);
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 32)]);
}

#[test]
fn genuine_second_keye_click_during_autoheavy_must_not_kill_shared_outbox() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(&mut p, &mut w, GestureSource::KeyE, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(&mut p, &mut w, GestureSource::KeyE, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    // Second distinct, monotonic, genuinely released KeyE keypress, while
    // first World autoheavy is still charging: transport only, no new 46HP.
    let second = admit(&mut p, &mut w, GestureSource::KeyE, GestureAction::Press, 3, 2);
    assert_eq!(second, AckStatus::Accepted);
    let release = admit(&mut p, &mut w, GestureSource::KeyE, GestureAction::Release, 4, 2);
    assert_eq!(release, AckStatus::Accepted);
    assert_eq!(
        admit(&mut p, &mut w, GestureSource::KeyE, GestureAction::Release, 4, 2),
        AckStatus::Duplicate
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(46, 54)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // A later physically valid source0 light must not be lost when the
    // autoheavy ends. This is NOT a request to change standalone KeyE policy.
    let next = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Press, 5, 3);
    assert_eq!(next, AckStatus::Accepted);
    let terminal = admit(&mut p, &mut w, GestureSource::Lmb, GestureAction::Release, 6, 3);
    assert_eq!(terminal, AckStatus::Accepted);
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 20)]);
}
