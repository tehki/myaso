//! Fail-first reproduction of native M121: legacy v1 sampled
//! LMB combo begins charged windup during a sideways strafe, then short
//! release can arrive after neutral movement sample. Original strafe
//! direction must belong to the original press, not the later neutral.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn hold(w: &mut World, move_y: f32) {
    assert!(w.set_input(
        1,
        InputIntent {
            attack: true,
            heavy_attack: true,
            move_y,
            ..InputIntent::default()
        }
    ));
    w.step();
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    for _ in 0..3 {
        w.step();
    }
}
fn release_as_light(w: &mut World, move_y: f32) {
    assert!(w.set_input(
        1,
        InputIntent {
            attack: true,
            move_y,
            ..InputIntent::default()
        }
    ));
    w.step();
}
#[test]
fn left_strafe_original_press_retains_left_sweep_even_when_release_input_is_neutral() {
    let mut w = arena();
    hold(&mut w, -1.0);
    release_as_light(&mut w, 0.0);
    assert_eq!(
        w.fighter(1).unwrap().action,
        Action::AttackLeftWindup,
        "M121 left sweep committed at press must not flatten into generic light on release"
    );
}
#[test]
fn right_strafe_original_press_retains_right_sweep_when_release_input_is_neutral() {
    let mut w = arena();
    hold(&mut w, 1.0);
    release_as_light(&mut w, 0.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackRightWindup);
}
#[test]
fn neutral_press_does_not_invent_later_direction_from_release_strafe() {
    let mut w = arena();
    hold(&mut w, 0.0);
    release_as_light(&mut w, -1.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
}
#[test]
fn left_short_charge_produces_one_actual_server_34hp_hit_and_no_duplicate() {
    let mut w = arena();
    hold(&mut w, -1.0);
    release_as_light(&mut w, 0.0);
    let mut hits = vec![];
    for _ in 0..60 {
        for event in w.step() {
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
    assert_eq!(hits, vec![(34, 66)]);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}
#[test]
fn legacy_cancelled_charge_cannot_synthesize_a_sweep_without_release() {
    let mut w = arena();
    hold(&mut w, -1.0);
    assert!(w.set_input(1, InputIntent::default()));
    w.step();
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    for _ in 0..40 {
        w.step();
    }
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn m121_genuine_left_sweep_tracks_server_windup_active_and_sweep_recovery() {
    let mut w = arena();
    hold(&mut w, -1.0);
    release_as_light(&mut w, 0.0);
    let mut phases = vec![w.fighter(1).unwrap().action];
    let mut damages = vec![];
    for _ in 0..65 {
        for event in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                damages.push((damage, hp));
            }
        }
        let action = w.fighter(1).unwrap().action;
        if phases.last() != Some(&action) {
            phases.push(action);
        }
    }
    assert!(phases.starts_with(&[
        Action::AttackLeftWindup,
        Action::AttackLeftActive,
        Action::AttackLeftRecovery,
    ]),"original authoritative states must advertise left sweep and punishable recovery: {phases:?}");
    assert_eq!(damages, vec![(34, 66)]);
}
#[test]
fn fully_charged_right_sweep_hold_does_not_emit_light_and_releases_one_heavy() {
    let mut w = arena();
    hold(&mut w, 1.0);
    for _ in 0..27 {
        w.step();
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert!(w.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    let mut hit = vec![];
    for _ in 0..65 {
        for event in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hit.push((damage, hp));
            }
        }
    }
    assert_eq!(
        hit,
        vec![(46, 54)],
        "READY should still authorize just one release heavy"
    );
}

#[test]
fn a_legitimate_upgrade_of_already_started_left_light_preserves_original_side() {
    let mut w = arena();
    assert!(w.set_input(
        1,
        InputIntent {
            attack: true,
            move_y: -1.0,
            ..InputIntent::default()
        }
    ));
    w.step();
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackLeftWindup);
    assert!(w.set_input(
        1,
        InputIntent {
            attack: true,
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    w.step();
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(w.set_input(
        1,
        InputIntent {
            attack: true,
            ..InputIntent::default()
        }
    ));
    w.step();
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackLeftWindup);
}
