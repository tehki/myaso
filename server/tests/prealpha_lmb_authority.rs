//! Pre-Alpha P0: fail-first tests against the actual authoritative World.
//! These exercise genuine InputIntent samples, not HP/test hooks.
use myaso_server::simulation::{Action, InputIntent, World};

fn input(attack: bool, heavy_attack: bool) -> InputIntent {
    InputIntent {
        attack,
        heavy_attack,
        ..InputIntent::default()
    }
}

#[test]
fn early_held_lmb_upgrade_remains_ready_from_the_original_server_press_clock() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    world.set_input(1, input(true, false));
    world.step();
    assert_eq!(
        world.fighter(1).unwrap().action,
        Action::AttackWindup,
        "first accepted attack-only press must begin a genuine light windup"
    );
    for _ in 0..3 {
        world.step();
    }
    let elapsed_press = world.fighter(1).unwrap().action_elapsed_ms;
    assert!(elapsed_press > 45.0 && elapsed_press < 100.0);
    world.set_input(1, input(true, true));
    world.step();
    let fighter = world.fighter(1).unwrap();
    assert_eq!(fighter.action, Action::HeavyAttackWindup);
    assert!(
        fighter.action_elapsed_ms >= elapsed_press,
        "upgrade cannot reset the server-proven charge clock"
    );

    for _ in 0..40 {
        world.step();
        assert_eq!(
            world.fighter(1).unwrap().action,
            Action::HeavyAttackWindup,
            "a long held charge must never auto-hit"
        );
    }
    assert!((world.fighter(1).unwrap().action_elapsed_ms - 320.0).abs() < 0.1);
    world.set_input(1, input(false, true));
    world.step();
    assert_eq!(
        world.fighter(1).unwrap().action,
        Action::HeavyAttackActive,
        "one real release following server READY may strike"
    );
}

#[test]
fn delayed_heavy_edge_cannot_turn_one_already_landed_lmb_light_into_second_heavy() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    world.set_input(1, input(true, false));
    world.step();
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    for _ in 0..55 {
        world.step();
    }
    assert_eq!(
        world.fighter(1).unwrap().action,
        Action::Idle,
        "the original light completed while the same attack button stayed down"
    );
    world.set_input(1, input(true, true));
    world.step();
    assert_eq!(
        world.fighter(1).unwrap().action,
        Action::Idle,
        "late/reordered upgrade must never create a second heavy in one LMB gesture"
    );
}

#[test]
fn standalone_key_e_heavy_from_idle_remains_legal() {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    world.set_input(1, input(false, true));
    world.step();
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
}
