//! Original World + selected session/codec integration; no client clock authority.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World, SERVER_DT_MS};

const LEASE: u64 = 19;
const BOOT: u128 = 0x9040_1133_5577;

fn packet(action: GestureAction, sequence: u32, gesture_id: u32) -> [u8; 16] {
    encode_typed_event(TypedGestureEvent {
        source: GestureSource::Lmb,
        event: GestureEvent {
            action,
            sequence,
            gesture_id,
            client_tick: u32::MAX,
        },
    })
    .unwrap()
}

fn send(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    action: GestureAction,
    seq: u32,
    id: u32,
) -> AckStatus {
    let ack = p
        .accept_under_world_lock(w, LEASE, BOOT, &packet(action, seq, id))
        .unwrap();
    assert_eq!(ack.server_tick, w.tick);
    ack.status
}

fn step(p: &mut SessionGestureWorldPath, w: &mut World) -> Vec<CombatEvent> {
    let events = w.step();
    p.advance_under_world_lock(w, LEASE, BOOT);
    events
}

fn recovering_pair(elapsed: f32) -> (World, SessionGestureWorldPath) {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
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
            assert_eq!(w.fighter(2).unwrap().hp, 66.0);
            return (w, p);
        }
        step(&mut p, &mut w);
    }
    panic!("original first Light did not reach its unchanged recovery");
}

#[test]
fn accepted_short_tap_in_original_last90ms_recovery_starts_one_light_after_full_recovery() {
    let (mut w, mut p) = recovering_pair(180.0);
    let tick = w.tick;
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        w.tick, tick,
        "input admission cannot step or shorten recovery"
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackRecovery);
    for _ in 0..10 {
        step(&mut p, &mut w);
        if w.fighter(1).unwrap().action != Action::AttackRecovery {
            break;
        }
    }
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::AttackWindup,
        "a transport-accepted genuine buffered tap must not disappear at recovery exit"
    );
    assert!(w.fighter(1).unwrap().action_elapsed_ms <= SERVER_DT_MS);
    let mut hits = Vec::new();
    for _ in 0..40 {
        for event in step(&mut p, &mut w) {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
            }
        }
    }
    assert_eq!(hits, vec![(34, 32)]);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Duplicate
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Duplicate
    );
    for _ in 0..35 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        32.0,
        "replay cannot create a second hit"
    );
}

fn exit_recovery(w: &mut World, p: &mut SessionGestureWorldPath) {
    let before = w.fighter(1).unwrap().action_elapsed_ms;
    let mut ticks = 0;
    while w.fighter(1).unwrap().action == Action::AttackRecovery {
        step(p, w);
        ticks += 1;
        assert!(ticks < 20);
    }
    assert!(
        before + ticks as f32 * SERVER_DT_MS >= 255.0,
        "the full original 255ms recovery must finish before queued action"
    );
}

#[test]
fn queued_held_upgrade_gets_a_fresh_world_clock_and_only_one_46hp_release() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 4, 2),
        AckStatus::Accepted
    );
    exit_recovery(&mut w, &mut p);
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(1).unwrap().action_elapsed_ms, 0.0);
    for _ in 0..19 {
        step(&mut p, &mut w);
    }
    assert!(w.fighter(1).unwrap().action_elapsed_ms < 320.0);
    assert_eq!(
        w.fighter(2).unwrap().hp,
        66.0,
        "held Heavy cannot land before physical UP"
    );
    for _ in 0..8 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 5, 2),
        AckStatus::Accepted
    );
    for _ in 0..60 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
    assert!(!p.retired());
}

#[test]
fn queued_upgrade_with_early_up_resumes_one_fresh_light() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 4, 2),
        AckStatus::Accepted
    );
    step(&mut p, &mut w);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 5, 2),
        AckStatus::Accepted
    );
    exit_recovery(&mut w, &mut p);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    for _ in 0..55 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
    assert!(!p.retired());
}

#[test]
fn upgrade_uses_actual_new_light_age_instead_of_recovery_receipt_age() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    exit_recovery(&mut w, &mut p);
    for _ in 0..5 {
        step(&mut p, &mut w);
    }
    assert!(w.fighter(1).unwrap().action_elapsed_ms < 135.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 4, 2),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Cancel, 5, 2),
        AckStatus::Accepted
    );
    for _ in 0..40 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn cancel_or_session_retirement_cannot_leave_a_world_owned_phantom_buffer() {
    for retire in [false, true] {
        let (mut w, mut p) = recovering_pair(180.0);
        assert_eq!(
            send(&mut p, &mut w, GestureAction::Press, 3, 2),
            AckStatus::Accepted
        );
        if retire {
            p.retire();
        } else {
            assert_eq!(
                send(&mut p, &mut w, GestureAction::Cancel, 4, 2),
                AckStatus::Accepted
            );
        }
        assert_eq!(w.fighter(1).unwrap().action, Action::AttackRecovery);
        for _ in 0..60 {
            step(&mut p, &mut w);
        }
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    }
}

#[test]
fn later_original_block_supersedes_queued_light_without_breaking_its_terminal() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert!(w.set_input(
        1,
        InputIntent {
            block: true,
            ..InputIntent::default()
        }
    ));
    step(&mut p, &mut w);
    assert!(w.set_input(1, InputIntent::default()));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 4, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 5, 2),
        AckStatus::Accepted
    );
    for _ in 0..60 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(!p.retired());
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 6, 3),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 7, 3),
        AckStatus::Accepted
    );
    for _ in 0..40 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn forged_greater_id_with_stale_sequence_cannot_retire_valid_queued_tap() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    assert_ne!(
        send(&mut p, &mut w, GestureAction::Press, 1, 99),
        AckStatus::Accepted
    );
    exit_recovery(&mut w, &mut p);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    for _ in 0..40 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
    assert!(!p.retired());
}

#[test]
fn only_latest_released_tap_occupies_the_original_single_buffer_slot() {
    let (mut w, mut p) = recovering_pair(180.0);
    for (seq, id) in [(3, 2), (5, 3), (7, 4)] {
        assert_eq!(
            send(&mut p, &mut w, GestureAction::Press, seq, id),
            AckStatus::Accepted
        );
        assert_eq!(
            send(&mut p, &mut w, GestureAction::Release, seq + 1, id),
            AckStatus::Accepted
        );
    }
    for _ in 0..65 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        w.fighter(2).unwrap().hp,
        32.0,
        "one bounded slot cannot turn into three attacks"
    );
}

#[test]
fn press_outside_original_90ms_window_stays_no_combat() {
    let (mut w, mut p) = recovering_pair(100.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    for _ in 0..65 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
}

#[test]
fn clone_rejoin_and_expiry_cannot_adopt_a_retired_actors_intent() {
    for mode in 0..3 {
        let (mut w, mut p) = recovering_pair(180.0);
        assert_eq!(
            send(&mut p, &mut w, GestureAction::Press, 3, 2),
            AckStatus::Accepted
        );
        assert_eq!(
            send(&mut p, &mut w, GestureAction::Release, 4, 2),
            AckStatus::Accepted
        );
        if mode == 0 {
            w = w.clone();
        }
        if mode == 1 {
            assert!(w.remove_player(1));
            assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
        }
        if mode == 2 {
            // A caller missing the bounded original tick window cannot fire late.
            for _ in 0..20 {
                w.step();
            }
        }
        for _ in 0..60 {
            step(&mut p, &mut w);
        }
        assert_eq!(w.fighter(2).unwrap().hp, 66.0);
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    }
}

#[test]
fn queued_direction_comes_from_captured_server_input_not_a_later_neutral_frame() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert!(w.set_input(
        1,
        InputIntent {
            move_y: 1.0,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert!(w.set_input(1, InputIntent::default()));
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    exit_recovery(&mut w, &mut p);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackRightWindup);
    for _ in 0..50 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn dropping_session_before_recovery_exit_cannot_autofire() {
    let (mut w, mut p) = recovering_pair(180.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 3, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 4, 2),
        AckStatus::Accepted
    );
    drop(p);
    for _ in 0..70 {
        w.step();
    }
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
}

#[test]
fn this_fix_does_not_add_a_new_heavy_recovery_buffer() {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Upgrade, 2, 1),
        AckStatus::Accepted
    );
    for _ in 0..25 {
        step(&mut p, &mut w);
    }
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 3, 1),
        AckStatus::Accepted
    );
    for _ in 0..60 {
        let f = w.fighter(1).unwrap();
        if f.action == Action::HeavyAttackRecovery && f.action_elapsed_ms >= 350.0 {
            break;
        }
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackRecovery);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Press, 4, 2),
        AckStatus::Accepted
    );
    assert_eq!(
        send(&mut p, &mut w, GestureAction::Release, 5, 2),
        AckStatus::Accepted
    );
    for _ in 0..65 {
        step(&mut p, &mut w);
    }
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
    assert!(!p.retired());
}
