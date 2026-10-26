//! Combat4B M111: original 60Hz Heavy/Block exact-contact tick invariants.
//! Genuine original v1 charge (attack+heavy held 20 World steps) then
//! release (heavy alone) produces original Heavy46. No fabricated World events.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

#[derive(Debug)]
struct Contact {
    tick: u32,
    blocks: Vec<u32>,
    hits: Vec<u32>,
    parries: Vec<u32>,
    action_at_contact: Option<Action>,
    guard_at_contact: Option<f32>,
    hp: f32,
    guard: f32,
}

fn original_heavy(block_start: u32, block_last: u32) -> Contact {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 315.0, 300.0, std::f32::consts::PI));
    let mut hits = Vec::new();
    let mut blocks = Vec::new();
    let mut parries = Vec::new();
    let mut contact_tick = None;
    let mut action_at_contact = None;
    let mut guard_at_contact = None;

    for tick in 1..=55u32 {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: tick <= 20,
                heavy_attack: tick <= 21,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(
            2,
            InputIntent {
                block: tick >= block_start && tick <= block_last,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 46,
                    hp: 54,
                } => {
                    hits.push(world.tick);
                    contact_tick = Some(world.tick);
                    action_at_contact = Some(world.fighter(2).unwrap().action);
                    guard_at_contact = Some(world.fighter(2).unwrap().guard);
                }
                CombatEvent::Block {
                    attacker: 1,
                    target: 2,
                } => {
                    blocks.push(world.tick);
                    contact_tick = Some(world.tick);
                    action_at_contact = Some(world.fighter(2).unwrap().action);
                    guard_at_contact = Some(world.fighter(2).unwrap().guard);
                }
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => {
                    parries.push(world.tick);
                }
                _ => {}
            }
        }
    }
    let defender = world.fighter(2).unwrap();
    Contact {
        tick: contact_tick.expect("actual original heavy contact"),
        blocks,
        hits,
        parries,
        action_at_contact,
        guard_at_contact,
        hp: defender.hp,
        guard: defender.guard,
    }
}

#[test]
fn m111_held_short_block_at_heavy_contact_consumes_64_guard_without_hp() {
    let baseline = original_heavy(u32::MAX, 0);
    assert_eq!(baseline.hits, vec![baseline.tick], "{baseline:?}");
    let block_start = baseline.tick - 10;
    let held = original_heavy(block_start, baseline.tick);
    assert_eq!(held.tick, baseline.tick);
    assert_eq!(held.blocks, vec![baseline.tick], "{held:?}");
    assert!(held.hits.is_empty(), "{held:?}");
    assert!(held.parries.is_empty(), "aged Block must not become Parry");
    assert_eq!(held.action_at_contact, Some(Action::Block));
    assert_eq!(held.hp, 100.0);
    assert_eq!(held.guard_at_contact, Some(36.0));
    assert!(held.guard >= 36.0, "legitimate later guard regeneration");
}

#[test]
fn m111_block_released_on_heavy_contact_tick_cannot_erase_actual_46hp_hit() {
    let baseline = original_heavy(u32::MAX, 0);
    let block_start = baseline.tick - 10;
    let released = original_heavy(block_start, baseline.tick - 1);
    assert_eq!(released.tick, baseline.tick);
    assert_eq!(released.hits, vec![baseline.tick], "{released:?}");
    assert!(released.blocks.is_empty(), "{released:?}");
    assert!(released.parries.is_empty());
    assert_eq!(released.action_at_contact, Some(Action::Idle));
    assert_eq!(released.hp, 54.0);
    assert_eq!(released.guard_at_contact, Some(100.0));
    assert_eq!(released.guard, 100.0);
}
