//! Combat4 P0: actual original Rust World contact ordering. No rule/timer changes.
//! Covers valid post-hit Dodge and the authentic short-block parry boundary.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn duel() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 322.0, 300.0, std::f32::consts::PI));
    world
}

fn step(world: &mut World, attack: InputIntent, defend: InputIntent) -> Vec<CombatEvent> {
    assert!(world.set_input(1, attack));
    assert!(world.set_input(2, defend));
    world.step()
}

fn light() -> InputIntent {
    InputIntent { attack: true, ..InputIntent::default() }
}
fn block() -> InputIntent {
    InputIntent { block: true, facing_radians: std::f32::consts::PI, ..InputIntent::default() }
}

#[test]
fn m107_real_heavy_hit_before_dodge_remains_committed_and_never_becomes_evade() {
    let mut world = duel();
    let heavy = InputIntent { heavy_attack: true, ..InputIntent::default() };
    let mut hit_tick = None;
    for _ in 0..36 {
        let events = step(&mut world, heavy, InputIntent::default());
        if events.iter().any(|e| matches!(e, CombatEvent::Hit {
            attacker: 1, target: 2, damage: 46, hp: 54
        })) {
            hit_tick = Some(world.tick);
            break;
        }
    }
    let hit_tick = hit_tick.expect("original World must emit one genuine 46HP Hit");
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    let dodge = InputIntent { dodge: true, ..InputIntent::default() };
    let later = step(&mut world, InputIntent::default(), dodge);
    assert!(world.tick > hit_tick);
    assert_eq!(world.fighter(2).unwrap().action, Action::Dodge);
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    assert!(!later.iter().any(|e| matches!(e, CombatEvent::Evade {
        attacker: 1, target: 2
    })), "post-contact dodge cannot retroactively evade the same heavy");
    for _ in 0..15 {
        let events = step(&mut world, InputIntent::default(), InputIntent::default());
        assert!(!events.iter().any(|e| matches!(e, CombatEvent::Evade {
            attacker: 1, target: 2
        })), "no Evade of a previously committed attack");
        assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    }
}

#[test]
fn m193_fresh_six_tick_block_is_real_parry_not_guard_break() {
    let mut world = duel();
    for _ in 0..3 {
        step(&mut world, light(), InputIntent::default());
    }
    let mut block_tick = None;
    let mut parry_tick = None;
    for _ in 0..20 {
        let events = step(&mut world, light(), block());
        if block_tick.is_none() && world.fighter(2).unwrap().action == Action::Block {
            block_tick = Some(world.tick);
        }
        if events.iter().any(|e| matches!(e, CombatEvent::Parry {
            attacker: 1, target: 2
        })) {
            parry_tick = Some(world.tick);
            break;
        }
    }
    let age = parry_tick.expect("real Block must parry within original 125ms") -
        block_tick.expect("real defender Block transition");
    assert!(age <= 7, "parry must be within the genuine 125ms guard window");
    assert_eq!(world.fighter(1).unwrap().action, Action::Stunned);
    assert_eq!(world.fighter(2).unwrap().guard, 100.0);
}

#[test]
fn m193_aged_held_block_receives_real_guard_pressure_not_parry() {
    let mut world = duel();
    for _ in 0..10 {
        step(&mut world, InputIntent::default(), block());
    }
    assert_eq!(world.fighter(2).unwrap().action, Action::Block);
    let mut saw_block = false;
    for _ in 0..22 {
        let events = step(&mut world, light(), block());
        assert!(!events.iter().any(|e| matches!(e, CombatEvent::Parry {
            attacker: 1, target: 2
        })), "aged held Block cannot reset its parry window");
        saw_block |= events.iter().any(|e| matches!(e, CombatEvent::Block {
            attacker: 1, target: 2
        }));
    }
    assert!(saw_block, "genuine 34HP light must apply the existing 38 guard pressure");
    assert_eq!(world.fighter(2).unwrap().guard, 62.0);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
}
