//! M27 Combat 4B: server-owned 60Hz World must distinguish a held
//! forward-facing Block from a backward-facing Block.
//! Deterministic production InputIntent test, not native browser qualification.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn original_light_against_held_block(defender_facing: f32) -> (World, usize, usize) {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 312.0, 300.0, defender_facing));

    let held_block = InputIntent {
        block: true,
        facing_radians: defender_facing,
        ..InputIntent::default()
    };
    assert!(world.set_input(2, held_block));
    world.step();
    assert_eq!(world.fighter(2).unwrap().action, Action::Block);

    let mut hit_count = 0;
    let mut block_count = 0;
    // A single original World input pulse, followed by neutral attack input.
    for step in 0..24 {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: step == 0,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(2, held_block));
        for event in world.step() {
            match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    hp: 66,
                } => {
                    hit_count += 1;
                    assert_eq!(
                        world.fighter(2).unwrap().action,
                        Action::Block,
                        "back-facing Block remains held at true World contact"
                    );
                }
                CombatEvent::Block {
                    attacker: 1,
                    target: 2,
                } => block_count += 1,
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => {
                    panic!("already-established block must not become a parry");
                }
                _ => {}
            }
        }
    }
    (world, hit_count, block_count)
}

#[test]
fn m27_back_facing_held_block_takes_exactly_one_real_34hp_hit_without_guard_cost() {
    let (world, hits, blocks) = original_light_against_held_block(0.0);
    let defender = world.fighter(2).unwrap();
    assert_eq!(hits, 1, "reverse-facing Block does not block the Light");
    assert_eq!(blocks, 0);
    assert_eq!(defender.hp, 66.0);
    assert_eq!(defender.guard, 100.0);
    assert_eq!(defender.action, Action::Block, "input remained held");
}

#[test]
fn m27_front_facing_held_block_consumes_guard_without_any_hp_hit() {
    let (world, hits, blocks) = original_light_against_held_block(std::f32::consts::PI);
    let defender = world.fighter(2).unwrap();
    assert_eq!(hits, 0, "forward-facing Block must protect HP");
    assert_eq!(blocks, 1, "one actual authoritative Block contact");
    assert_eq!(defender.hp, 100.0);
    assert_eq!(defender.guard, 62.0, "unchanged 38 guard damage");
    assert_eq!(defender.action, Action::Block);
}
