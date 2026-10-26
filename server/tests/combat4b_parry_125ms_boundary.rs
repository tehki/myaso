//! Combat 4B exact original-World 60Hz Parry→Block contact boundary.
//! 125ms is 7.5 server ticks: seven admitted Block ticks can Parry,
//! eight admitted ticks are ordinary Block. Never backdate physical input.
//! Native W3C/QUIC arrival qualification belongs to 4A/4C/8A/4D.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContactKind {
    Hit,
    Parry,
    Block,
}

#[derive(Debug)]
struct Contact {
    tick: u32,
    kind: ContactKind,
    defender_action: Action,
    defender_elapsed_ms: f32,
    defender_hp: f32,
    defender_guard: f32,
}

fn original_light(block_start_tick: u32) -> Contact {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 315.0, 300.0, std::f32::consts::PI));
    let mut contact = None;
    for tick in 1..=32 {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: tick == 1,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(
            2,
            InputIntent {
                block: tick >= block_start_tick,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            let kind = match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    ..
                } => Some(ContactKind::Hit),
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => Some(ContactKind::Parry),
                CombatEvent::Block {
                    attacker: 1,
                    target: 2,
                } => Some(ContactKind::Block),
                _ => None,
            };
            if let Some(kind) = kind {
                let defender = world.fighter(2).unwrap();
                assert!(
                    contact
                        .replace(Contact {
                            tick: world.tick,
                            kind,
                            defender_action: defender.action,
                            defender_elapsed_ms: defender.action_elapsed_ms,
                            defender_hp: defender.hp,
                            defender_guard: defender.guard,
                        })
                        .is_none(),
                    "one original Light contact per gesture"
                );
            }
        }
    }
    contact.expect("original World emitted one contact")
}

#[test]
fn m41_seven_ticks_parry_eight_ticks_ordinary_block_without_damage() {
    let unguarded = original_light(u32::MAX);
    assert_eq!(unguarded.kind, ContactKind::Hit);
    assert_eq!(unguarded.defender_hp, 66.0);
    assert_eq!(unguarded.defender_guard, 100.0);
    assert!(unguarded.tick >= 9, "original Light retains 135ms windup");

    // 7 * 16.667ms = 116.667ms, safely inside the approved 125ms.
    let seven = original_light(unguarded.tick - 6);
    assert_eq!(seven.tick, unguarded.tick);
    assert_eq!(seven.kind, ContactKind::Parry, "{seven:?}");
    assert_eq!(seven.defender_action, Action::Block);
    assert!(seven.defender_elapsed_ms <= 125.0);
    assert_eq!(seven.defender_hp, 100.0);
    assert_eq!(seven.defender_guard, 100.0);

    // 8 * 16.667ms = 133.333ms, outside Parry but still held Block.
    let eight = original_light(unguarded.tick - 7);
    assert_eq!(eight.tick, unguarded.tick);
    assert_eq!(eight.kind, ContactKind::Block, "{eight:?}");
    assert_eq!(eight.defender_action, Action::Block);
    assert!(eight.defender_elapsed_ms > 125.0);
    assert_eq!(eight.defender_hp, 100.0);
    assert_eq!(eight.defender_guard, 62.0, "one Light costs 38 guard");
}

fn original_heavy(block_start_tick: u32) -> Contact {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 315.0, 300.0, std::f32::consts::PI));
    let mut contact = None;
    for tick in 1..=55 {
        // The original v1 bits charge for 20 World ticks, then release
        // the server-approved READY Heavy on tick 21.
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
                block: tick >= block_start_tick,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            let kind = match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 46,
                    ..
                } => Some(ContactKind::Hit),
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => Some(ContactKind::Parry),
                CombatEvent::Block {
                    attacker: 1,
                    target: 2,
                } => Some(ContactKind::Block),
                _ => None,
            };
            if let Some(kind) = kind {
                let defender = world.fighter(2).unwrap();
                assert!(
                    contact
                        .replace(Contact {
                            tick: world.tick,
                            kind,
                            defender_action: defender.action,
                            defender_elapsed_ms: defender.action_elapsed_ms,
                            defender_hp: defender.hp,
                            defender_guard: defender.guard,
                        })
                        .is_none(),
                    "one original Heavy contact per gesture"
                );
            }
        }
    }
    contact.expect("original World emitted Heavy contact")
}

#[test]
fn m111_seven_ticks_parry_eight_ticks_ordinary_heavy_block_without_hp_damage() {
    let unguarded = original_heavy(u32::MAX);
    assert_eq!(unguarded.kind, ContactKind::Hit, "{unguarded:?}");
    assert_eq!(unguarded.defender_hp, 54.0);
    assert_eq!(unguarded.defender_guard, 100.0);

    let seven = original_heavy(unguarded.tick - 6);
    assert_eq!(seven.tick, unguarded.tick);
    assert_eq!(seven.kind, ContactKind::Parry, "{seven:?}");
    assert_eq!(seven.defender_action, Action::Block);
    assert!(seven.defender_elapsed_ms <= 125.0);
    assert_eq!(seven.defender_hp, 100.0);
    assert_eq!(seven.defender_guard, 100.0);

    let eight = original_heavy(unguarded.tick - 7);
    assert_eq!(eight.tick, unguarded.tick);
    assert_eq!(eight.kind, ContactKind::Block, "{eight:?}");
    assert_eq!(eight.defender_action, Action::Block);
    assert!(eight.defender_elapsed_ms > 125.0);
    assert_eq!(eight.defender_hp, 100.0);
    assert_eq!(eight.defender_guard, 36.0, "one Heavy costs 64 guard");
}

#[test]
fn m111_heavy_block_first_admitted_after_hit_cannot_undo_real_damage() {
    let unguarded = original_heavy(u32::MAX);
    let late = original_heavy(unguarded.tick + 1);
    assert_eq!(late.tick, unguarded.tick);
    assert_eq!(late.kind, ContactKind::Hit, "{late:?}");
    assert_eq!(late.defender_action, Action::Idle);
    assert_eq!(late.defender_hp, 54.0);
    assert_eq!(late.defender_guard, 100.0);
}
