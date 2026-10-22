//! Combat4 acceptance matrix for Main #723 source=0 LMB vs source=1 KEY_E.
//! Original *World* rules only; proposed v2 source byte is not wired to QUIC.
//! Use legacy trusted InputIntent::heavy_attack for original standalone KeyE
//! behavior and existing dormant review-only LMB bridge for source=0.
//! Never treat this as proof of physical keyboard/source authentication.
use myaso_server::prealpha_lmb_gesture_authority::Command;
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn input(w: &mut World, heavy: bool) {
    assert!(w.set_input(
        1,
        InputIntent {
            heavy_attack: heavy,
            ..InputIntent::default()
        }
    ));
}
fn tick(w: &mut World, n: usize) -> Vec<(u8, u8)> {
    let mut result = vec![];
    for _ in 0..n {
        for event in w.step() {
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
    }
    result
}
#[test]
fn keye_press_then_early_keyup_autofires_one_46hp_heavy_and_no_second_edge() {
    let mut w = arena();
    input(&mut w, true);
    assert!(tick(&mut w, 1).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    input(&mut w, false); // KEY_E keyup is NOT a heavy activation command.
    assert_eq!(tick(&mut w, 90), vec![(46, 54)]);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
    assert!(tick(&mut w, 80).is_empty());
}
#[test]
fn held_keye_does_not_repeat_press_or_synthesize_second_heavy() {
    let mut w = arena();
    input(&mut w, true);
    assert_eq!(
        tick(&mut w, 170),
        vec![(46, 54)],
        "repeated v1 held boolean cannot start one heavy per server tick"
    );
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn keye_press_during_lmb_light_recovery_does_not_queue_late_heavy() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    let early = tick(&mut w, 10);
    assert_eq!(early, vec![(34, 66)]);
    assert!(matches!(
        w.fighter(1).unwrap().action,
        Action::AttackRecovery | Action::AttackActive
    ));
    input(&mut w, true);
    assert!(tick(&mut w, 1).is_empty());
    input(&mut w, false);
    assert!(tick(&mut w, 95).is_empty());
    assert_eq!(
        w.fighter(2).unwrap().hp,
        66.0,
        "source1 edge during source0 recovery cannot be buffered into 46HP"
    );
}
#[test]
fn lmb_press_during_standalone_e_heavy_never_queues_light_after_heavy() {
    let mut w = arena();
    input(&mut w, true);
    assert!(tick(&mut w, 1).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(
        !w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup),
        "LMB press during existing KeyE-owned heavy is an incompatible action"
    );
    input(&mut w, false);
    assert_eq!(tick(&mut w, 120), vec![(46, 54)]);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn lmb_320ms_ready_is_not_prematurely_released_by_independent_keye_cycle() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    assert!(tick(&mut w, 4).is_empty());
    let elapsed = w.fighter(1).unwrap().action_elapsed_ms as u64;
    assert!(w.apply_review_only_lmb_gesture_command(
        1,
        Command::UpgradeHeldHeavy {
            server_elapsed_ms: elapsed
        }
    ));
    assert!(tick(&mut w, 45).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(1).unwrap().action_elapsed_ms, 320.0);
    input(&mut w, true); // Source1 KEY_E pressed while source0 READY.
    assert!(tick(&mut w, 4).is_empty());
    input(&mut w, false); // Source1 KEY_E released; no strike authorized.
    assert!(tick(&mut w, 5).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    assert_eq!(tick(&mut w, 65), vec![(46, 54)]);
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn lmb_light_cannot_be_upgraded_by_a_late_separate_keye_press() {
    let mut w = arena();
    assert!(w.apply_review_only_lmb_gesture_command(1, Command::BeginLightWindup));
    assert!(tick(&mut w, 3).is_empty());
    input(&mut w, true); // Standalone E is NOT legitimate source0 UPGRADE.
    assert!(tick(&mut w, 1).is_empty());
    assert!(matches!(w.fighter(1).unwrap().action, Action::AttackWindup));
    input(&mut w, false);
    assert_eq!(tick(&mut w, 70), vec![(34, 66)]);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}
