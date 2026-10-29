//! Preserve the original buffered Space+LMB chord on the selected typed route.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, InputIntent, World};

const LEASE: u64 = 27;
const BOOT: u128 = 0x9011_2233_4455;

fn send(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    action: GestureAction,
    sequence: u32,
    gesture_id: u32,
) -> AckStatus {
    let bytes = encode_typed_event(TypedGestureEvent {
        source: GestureSource::Lmb,
        event: GestureEvent {
            action,
            sequence,
            gesture_id,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    p.accept_under_world_lock(w, LEASE, BOOT, &bytes)
        .unwrap_or_else(|| {
            panic!("missing receipt for {action:?} sequence{sequence} gesture{gesture_id}")
        })
        .status
}

fn step(p: &mut SessionGestureWorldPath, w: &mut World) {
    w.step();
    p.advance_under_world_lock(w, LEASE, BOOT);
}

fn recovering_pair(elapsed: f32) -> (World, SessionGestureWorldPath) {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 292.0, 300.0, std::f32::consts::PI));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    for _ in 0..100 {
        let f = w.fighter(1).unwrap();
        if f.action == Action::AttackRecovery && f.action_elapsed_ms >= elapsed {
            break;
        }
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackRecovery);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    (w, p)
}

#[test]
fn authenticated_space_lmb_in_light_recovery_preserves_the_original_buffered_chord() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 3, 2),
        AckStatus::Accepted,
        "a genuine original recovery-buffer Space+LMB cannot reject/close the healthy typed sender"
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    let mut jump_started = false;
    for _ in 0..70 {
        step(&mut p, &mut w);
        if !jump_started && w.fighter(1).unwrap().action == Action::JumpAttackWindup {
            assert_eq!(
                w.fighter(1).unwrap().stamina,
                74.0,
                "original14+12 stamina debits"
            );
        }
        jump_started |= w.fighter(1).unwrap().action == Action::JumpAttackWindup;
    }
    assert!(
        jump_started,
        "original World must commit the actual buffered Jump before typed JumpAttack"
    );
    assert_eq!(
        w.fighter(2).unwrap().hp,
        24.0,
        "one34HP Light plus one42HP JumpAttack"
    );
    assert!(!p.retired());
}

#[test]
fn later_jump_chord_replaces_a_released_light_slot_without_orphaning_either_owner() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 5, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 6, 3),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    let mut light = false;
    for _ in 0..70 {
        step(&mut p, &mut w);
        light |= w.fighter(1).unwrap().action == Action::AttackWindup;
    }
    assert!(
        !light,
        "the original newer valid Jump owns the single buffer slot"
    );
    assert_eq!(w.fighter(2).unwrap().hp, 24.0);
    assert!(!p.retired());
}

#[test]
fn genuine_sampled_space_may_arrive_after_the_typed_chord_and_early_up() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    for _ in 0..70 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 24.0);
    assert!(!p.retired());
}

#[test]
fn cancelled_buffered_chord_leaves_only_the_original_space_jump_and_fresh_lmb_works() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Cancel, 4, 2),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    for _ in 0..70 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert!(!p.retired());
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 5, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 6, 3),
        AckStatus::Accepted
    );
    for _ in 0..40 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn outside_window_chord_is_admitted_no_combat_and_cannot_adopt_a_later_space_jump() {
    let (mut w, mut p) = recovering_pair(100.0);
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    for _ in 0..10 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    for _ in 0..3 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::Jump,
        "an earlier busy chord must never attack from a different later Space edge"
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 3, 2),
        AckStatus::Duplicate
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Duplicate
    );
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::Jump,
        "replay cannot promote no-combat admission"
    );
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(!p.retired());
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 5, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 6, 3),
        AckStatus::Accepted
    );
    for _ in 0..20 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        24.0,
        "a new real chord still works on the healthy sender"
    );
}

#[test]
fn exhausted_jump_chord_preserves_an_earlier_valid_light_buffer_and_healthy_sender() {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 700.0, 500.0, 0.0));
    let run = InputIntent {
        run: true,
        move_x: -1.0,
        ..InputIntent::default()
    };
    for _ in 0..300 {
        if w.fighter(1).unwrap().stamina < 3.0 {
            break;
        }
        assert!(w.set_input(1, run));
        w.step();
    }
    assert!(w.set_input(1, InputIntent::default()));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    p.enable_jump_review();
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 2, 1),
        AckStatus::Accepted
    );
    for _ in 0..50 {
        let f = w.fighter(1).unwrap();
        if f.action == Action::AttackRecovery && f.action_elapsed_ms >= 180.0 {
            break;
        }
        step(&mut p, &mut w);
    }
    assert!(w.fighter(1).unwrap().stamina < 14.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    assert!(w.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::JumpAttack, 5, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 6, 3),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    for _ in 0..10 {
        if w.fighter(1).unwrap().action != Action::AttackRecovery {
            break;
        }
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::AttackWindup,
        "the original denied low-stamina Jump cannot erase an earlier valid Light buffer"
    );
    assert!(!p.retired());
}
