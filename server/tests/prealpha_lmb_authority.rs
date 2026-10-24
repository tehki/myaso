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
fn retired_key_e_heavy_bit_cannot_act_or_block_the_next_genuine_lmb_light() {
    use myaso_server::simulation::CombatEvent;

    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 320.0, 300.0, std::f32::consts::PI));

    // Legacy keyboard-only heavy has no admitted LMB source or READY clock.
    assert!(world.set_input(1, input(false, true)));
    for _ in 0..25 {
        assert!(world.step().is_empty(), "retired E cannot mutate combat");
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    }

    // A rejected E must never steal the next real light press or create
    // an extra 46HP hit from the old heavy bit.
    assert!(world.set_input(1, input(false, false)));
    assert!(world.step().is_empty());
    assert!(world.set_input(1, input(true, false)));
    assert!(world.step().is_empty());
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    let mut hit_count = 0_u32;
    for _ in 0..30 {
        for event in world.step() {
            if let CombatEvent::Hit { attacker, target, damage, hp } = event {
                assert_eq!((attacker, target, damage, hp), (1, 2, 34, 66));
                hit_count += 1;
            }
        }
    }
    assert_eq!(hit_count, 1, "one source0 LMB, at most one original World HIT");
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);
}
