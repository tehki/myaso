//! Reproduce genuine pointer-first chord crossing a World admission tick.
//! Stamina is drained by original running, never assigned by the fixture.
use myaso_server::simulation::{Action, InputIntent, World};

#[test]
fn charged_lmb_then_space_preserves_the_original_chord_stamina_fallbacks() {
    for (budget, expected, cost) in [
        (8.0, Action::Idle, 0.0),
        (19.0, Action::Jump, 14.0),
        (40.0, Action::JumpAttackWindup, 26.0),
    ] {
        let mut world = World::new(8192.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        world.set_input(
            1,
            InputIntent {
                move_x: 1.0,
                run: true,
                ..InputIntent::default()
            },
        );
        for _ in 0..400 {
            if world.fighter(1).unwrap().stamina <= budget {
                break;
            }
            world.step();
        }
        assert!(world.fighter(1).unwrap().stamina <= budget);
        world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            },
        );
        world.step();
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        let before = world.fighter(1).unwrap().stamina;
        world.set_input(
            1,
            InputIntent {
                attack: true,
                jump: true,
                ..InputIntent::default()
            },
        );
        world.step();
        let fighter = world.fighter(1).unwrap();
        assert_eq!(
            fighter.action, expected,
            "stamina{before}: charging must match idle-chord arbitration"
        );
        assert!((fighter.stamina - (before - cost)).abs() < 0.01);
        assert_eq!(fighter.hp, 100.0);
        assert_eq!(fighter.guard, 100.0);
    }
}
