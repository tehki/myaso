//! Draft-only P0 JumpAttack world authority. No wire producer or public v2.
use myaso_server::prealpha_lmb_gesture_authority::Command;
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn arena() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 300.0, 300.0, std::f32::consts::PI));
    world
}

#[test]
fn world_jump_attack_requires_real_world_jump_and_stamina_not_client_flags() {
    let mut world = arena();
    let action = Command::BeginJumpAttack;
    let initial = world.fighter(1).unwrap().stamina;
    assert!(!world.apply_review_only_lmb_gesture_command(1, action));
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(world.fighter(1).unwrap().stamina, initial);

    // An unprocessed client-authored jump bit is not a server World Jump.
    world.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        },
    );
    assert!(!world.apply_review_only_lmb_gesture_command(1, action));
    assert_eq!(world.fighter(1).unwrap().stamina, initial);
    world.step();
    assert_eq!(world.fighter(1).unwrap().action, Action::Jump);
    let after_jump = world.fighter(1).unwrap().stamina;
    assert!((after_jump - (initial - 14.0)).abs() < 0.01);
    assert!(world.apply_review_only_lmb_gesture_command(1, action));
    assert_eq!(world.fighter(1).unwrap().action, Action::JumpAttackWindup);
    assert!((world.fighter(1).unwrap().stamina - (after_jump - 12.0)).abs() < 0.01);
    assert!(
        !world.apply_review_only_lmb_gesture_command(1, action),
        "same jump cannot start another typed combat action"
    );
    let mut hits = Vec::new();
    for _ in 0..70 {
        for e in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = e
            {
                hits.push((damage, hp));
            }
        }
    }
    assert_eq!(
        hits,
        vec![(42, 58)],
        "only the original World attack-active phase can land one 42 HP jump hit"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 58.0);
}

#[test]
fn no_actor_or_world_jump_no_jump_attack_grant() {
    let mut world = arena();
    assert!(!world.apply_review_only_lmb_gesture_command(999, Command::BeginJumpAttack));
    assert!(!world.apply_review_only_lmb_gesture_command(2, Command::BeginJumpAttack));
    assert!(world.set_input(
        1,
        InputIntent {
            jump: true,
            ..InputIntent::default()
        }
    ));
    world.step();
    assert_eq!(world.fighter(1).unwrap().action, Action::Jump);
    // Live jump can convert only once and only via World-authoritative spend.
    assert!(world.apply_review_only_lmb_gesture_command(1, Command::BeginJumpAttack));
    assert!(!world.apply_review_only_lmb_gesture_command(1, Command::BeginJumpAttack));
}
