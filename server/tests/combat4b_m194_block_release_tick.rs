//! Combat4B M194: original 60Hz World/normal InputIntent contact boundary.
//! Releasing a real facing Block on the Light collision tick cannot silently
//! count as a 38-guard Block; continuing it through collision protects 100HP.
//! This is a server mechanics regression, NEVER a substitute for browser W3C QA.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

#[derive(Debug)]
struct Outcome {
    hits: Vec<u32>,
    blocks: Vec<u32>,
    parries: Vec<u32>,
    defender_action_at_contact: Option<Action>,
    defender_action_tick_14: Action,
    hp: f32,
    guard: f32,
}

fn one_original_light(block_last_tick: u32) -> Outcome {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 315.0, 300.0, std::f32::consts::PI));

    let mut hits = Vec::new();
    let mut blocks = Vec::new();
    let mut parries = Vec::new();
    let mut defender_action_at_contact = None;
    let mut defender_action_tick_14 = Action::Idle;

    for step in 1..=24 {
        // One committed original light at tick 7, after a real held Block
        // was already admitted on tick 1. No second writer or artificial HIT.
        assert!(world.set_input(
            1,
            InputIntent {
                attack: step == 7,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(
            2,
            InputIntent {
                block: step <= block_last_tick,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    hp: 66,
                } => {
                    hits.push(world.tick);
                    defender_action_at_contact = Some(world.fighter(2).unwrap().action);
                }
                CombatEvent::Block {
                    attacker: 1,
                    target: 2,
                } => {
                    blocks.push(world.tick);
                    defender_action_at_contact = Some(world.fighter(2).unwrap().action);
                }
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => {
                    parries.push(world.tick);
                    defender_action_at_contact = Some(world.fighter(2).unwrap().action);
                }
                _ => {}
            }
        }
        if step == 14 {
            defender_action_tick_14 = world.fighter(2).unwrap().action;
        }
    }
    let defender = world.fighter(2).unwrap();
    Outcome {
        hits,
        blocks,
        parries,
        defender_action_at_contact,
        defender_action_tick_14,
        hp: defender.hp,
        guard: defender.guard,
    }
}

#[test]
fn m194_real_held_block_through_light_contact_takes_38_guard_and_no_hp() {
    let proof = one_original_light(15);
    assert_eq!(proof.defender_action_tick_14, Action::Block);
    assert_eq!(proof.blocks, vec![15], "one real guarded Light contact");
    assert!(proof.hits.is_empty());
    assert!(proof.parries.is_empty(), "aged Block does not become Parry");
    assert_eq!(proof.defender_action_at_contact, Some(Action::Block));
    assert_eq!(proof.hp, 100.0);
    assert_eq!(proof.guard, 62.0);
}

#[test]
fn m194_original_world_block_released_on_contact_tick_takes_real_34hp_hit() {
    let proof = one_original_light(14);
    assert_eq!(proof.defender_action_tick_14, Action::Block);
    assert_eq!(
        proof.hits,
        vec![15],
        "released Block cannot protect hit tick"
    );
    assert!(proof.blocks.is_empty(), "no forged -38 guard contact");
    assert!(proof.parries.is_empty(), "no retroactive parry");
    assert_eq!(proof.defender_action_at_contact, Some(Action::Idle));
    assert_eq!(proof.hp, 66.0);
    assert_eq!(proof.guard, 100.0);
}
