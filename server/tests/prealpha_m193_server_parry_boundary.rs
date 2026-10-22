//! Real server tick proof for strict native M193/M205 guard vs parry.
//! Tests use original World inputs, actions and authentic CombatEvents.
//! No synthetic cue or modified production combat rule.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};
fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn attack(on: bool) -> InputIntent {
    InputIntent {
        attack: on,
        ..InputIntent::default()
    }
}
fn defense(on: bool) -> InputIntent {
    InputIntent {
        block: on,
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    }
}
fn trial(block_start_tick: u32) -> (u32, u32, Vec<CombatEvent>, World) {
    let mut w = arena();
    let mut action_start = 0;
    let mut block_start = 0;
    let mut out = vec![];
    for tick in 1..=38 {
        assert!(w.set_input(1, attack(tick == 1)));
        assert!(w.set_input(2, defense(tick >= block_start_tick)));
        let events = w.step();
        if action_start == 0 && w.fighter(1).unwrap().action == Action::AttackWindup {
            action_start = w.tick;
        }
        if block_start == 0 && w.fighter(2).unwrap().action == Action::Block {
            block_start = w.tick;
        }
        if !events.is_empty() {
            out.extend(events);
        }
    }
    (action_start, block_start, out, w)
}
#[test]
fn genuine_six_tick_block_contact_is_a_parry_not_guard_damage() {
    let (attack_tick, block_tick, events, w) = trial(3);
    assert_eq!(attack_tick, 1);
    assert_eq!(block_tick, 3);
    assert!(events.iter().any(|e| matches!(
        e,
        CombatEvent::Parry {
            attacker: 1,
            target: 2
        }
    )));
    assert!(!events
        .iter()
        .any(|e| matches!(e, CombatEvent::Block { .. })));
    assert_eq!(w.fighter(2).unwrap().guard, 100.0);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}
#[test]
fn genuine_eight_tick_block_contact_is_38_guard_and_never_parry() {
    let (attack_tick, block_tick, events, w) = trial(1);
    assert_eq!(attack_tick, 1);
    assert_eq!(block_tick, 1);
    assert!(events.iter().any(|e| matches!(
        e,
        CombatEvent::Block {
            attacker: 1,
            target: 2
        }
    )));
    assert!(!events
        .iter()
        .any(|e| matches!(e, CombatEvent::Parry { .. })));
    assert_eq!(w.fighter(2).unwrap().guard, 62.0);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn three_genuine_eight_tick_original_blocks_reduce_guard_100_to_62_to_24_to_zero() {
    let mut w = arena();
    for (round, expected_guard) in [62.0, 24.0, 0.0].into_iter().enumerate() {
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(w.fighter(2).unwrap().action, Action::Idle);
        assert!(w.set_input(1, attack(true)));
        assert!(w.set_input(2, defense(true)));
        w.step();
        assert_eq!(w.fighter(2).unwrap().action, Action::Block);
        assert!(w.set_input(1, attack(false)));
        let mut outcomes = vec![];
        for _ in 0..45 {
            outcomes.extend(w.step());
            if w.fighter(1).unwrap().action == Action::Idle {
                break;
            }
        }
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
        assert!(
            !outcomes
                .iter()
                .any(|e| matches!(e, CombatEvent::Parry { .. })),
            "round {} must never be a legal parry for an eight-tick block",
            round + 1
        );
        if round == 2 {
            assert!(outcomes.iter().any(|e| matches!(
                e,
                CombatEvent::GuardBreak {
                    attacker: 1,
                    target: 2
                }
            )));
        } else {
            assert!(outcomes.iter().any(|e| matches!(
                e,
                CombatEvent::Block {
                    attacker: 1,
                    target: 2
                }
            )));
        }
        assert_eq!(w.fighter(2).unwrap().guard, expected_guard);
        assert_eq!(w.fighter(2).unwrap().hp, 100.0);
        if round != 2 {
            assert!(w.set_input(2, defense(false)));
            w.step();
            assert_eq!(w.fighter(2).unwrap().action, Action::Idle);
        }
    }
}
