//! Original RMB-run signature must survive selected immediate LMB admission.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, InputIntent, World};

const LEASE: u64 = 31;
const BOOT: u128 = 0x9722_4433_6611;

fn send(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    action: GestureAction,
    sequence: u32,
) -> AckStatus {
    send_id(p, w, action, sequence, 1)
}

fn send_id(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    action: GestureAction,
    sequence: u32,
    id: u32,
) -> AckStatus {
    let bytes = encode_typed_event(TypedGestureEvent {
        source: GestureSource::Lmb,
        event: GestureEvent {
            action,
            sequence,
            gesture_id: id,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    p.accept_under_world_lock(w, LEASE, BOOT, &bytes)
        .expect("genuine sequenced edge receipt")
        .status
}

fn step(p: &mut SessionGestureWorldPath, w: &mut World) {
    w.step();
    p.advance_under_world_lock(w, LEASE, BOOT);
}

#[test]
fn typed_running_tap_starts_original_160ms_30hp_10stamina_strike_on_down() {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert!(w.set_input(
        1,
        InputIntent {
            run: true,
            move_x: 1.0,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::RunningAttackWindup,
        "trusted original RMB-run movement must not become a34HP ordinary Light"
    );
    assert_eq!(w.fighter(1).unwrap().stamina, 90.0);
    assert!(w.set_input(1, InputIntent::default()));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 2),
        AckStatus::Accepted
    );
    for _ in 0..9 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::RunningAttackWindup);
    assert_eq!(
        w.fighter(2).unwrap().hp,
        100.0,
        "running windup remains160ms"
    );
    for _ in 0..50 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        70.0,
        "one original30HP hit, no Light/Heavy double"
    );
    assert!(
        !p.retired(),
        "running lifecycle cannot retire the healthy selected sender"
    );
}

fn running_pair() -> (World, SessionGestureWorldPath) {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert!(w.set_input(
        1,
        InputIntent {
            run: true,
            move_x: 1.0,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::RunningAttackWindup);
    assert_eq!(w.fighter(1).unwrap().stamina, 90.0);
    assert!(w.set_input(1, InputIntent::default()));
    (w, p)
}

#[test]
fn running_upgrade_uses_the_original_unlanded_160ms_deadline_and_one_held_heavy() {
    let (mut w, mut p) = running_pair();
    for _ in 0..9 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::RunningAttackWindup);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::HeavyAttackWindup,
        "a true unlanded running windup at150ms still permits the original R2 upgrade"
    );
    for _ in 0..25 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        100.0,
        "held READY must not auto-land Running/Light/Heavy"
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 3),
        AckStatus::Accepted
    );
    for _ in 0..50 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        54.0,
        "one46HP physical-release Heavy"
    );
    assert!(!p.retired());
}

#[test]
fn early_heavy_up_resumes_the_captured_running_variant_without_recharging_10stamina() {
    let (mut w, mut p) = running_pair();
    for _ in 0..6 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 2),
        AckStatus::Accepted
    );
    for _ in 0..4 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::RunningAttackWindup,
        "neutral movement after DOWN cannot reclassify the admitted running strike"
    );
    assert_eq!(w.fighter(1).unwrap().stamina, 90.0);
    for _ in 0..50 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 70.0);
    assert!(!p.retired());
}

#[test]
fn cancel_at150ms_still_cancels_unlanded_running_and_next_lmb_is_healthy() {
    let (mut w, mut p) = running_pair();
    for _ in 0..9 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Cancel, 2),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, 90.0);
    for _ in 0..45 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        send_id(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send_id(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    for _ in 0..40 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(!p.retired());
}

#[test]
fn exhausted_run_edge_never_falls_back_to_free_light_or_promotes_on_replay() {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 700.0, 500.0, 0.0));
    for _ in 0..300 {
        if w.fighter(1).unwrap().stamina < 3.0 {
            break;
        }
        assert!(w.set_input(
            1,
            InputIntent {
                run: true,
                move_x: -1.0,
                ..InputIntent::default()
            }
        ));
        w.step();
    }
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert!(w.fighter(1).unwrap().stamina < 10.0);
    assert!(w.set_input(
        1,
        InputIntent {
            run: true,
            move_x: 1.0,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 3),
        AckStatus::Accepted
    );
    assert!(w.set_input(1, InputIntent::default()));
    for _ in 0..50 {
        step(&mut p, &mut w);
    }
    let budget = w.fighter(1).unwrap().stamina;
    assert!(budget >= 10.0);
    assert!(w.set_input(
        1,
        InputIntent {
            run: true,
            move_x: 1.0,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, budget);
    assert_eq!(
        send_id(&mut p, &mut w, GestureAction::Press, 4, 2),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::RunningAttackWindup);
    assert!((w.fighter(1).unwrap().stamina - (budget - 10.0)).abs() < 0.001);
    assert_eq!(
        send_id(&mut p, &mut w, GestureAction::Release, 5, 2),
        AckStatus::Accepted
    );
    assert!(!p.retired());
}
