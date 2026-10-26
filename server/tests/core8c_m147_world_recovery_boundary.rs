//! Core8C M147: actual 60Hz Rust World transition/attack ordering at the
//! victim's recovery boundary. No replacement World, synthetic events, or
//! changes to action/reach/damage/phase durations.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};
use std::f32::consts::PI;

#[derive(Debug)]
struct Evidence {
    recovery_enter: u32,
    recovery_exit: u32,
    hit_tick: Option<u32>,
    victim_action_at_hit: Option<Action>,
    hp: f32,
    third_player_hp: f32,
}

fn actual_original_world(punisher_light_input_tick: Option<u32>) -> Evidence {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 300.0, 300.0, PI));
    assert!(world.add_player_at(2, 365.0, 300.0, PI));
    assert!(world.add_player_at(3, 700.0, 500.0, 0.0));
    let mut recovery_enter = None;
    let mut recovery_exit = None;
    let mut hit_tick = None;
    let mut victim_action_at_hit = None;

    for _ in 0..54 {
        let next = world.tick + 1;
        assert!(world.set_input(
            1,
            InputIntent {
                jump: next == 1,
                attack: next == 1,
                facing_radians: PI, // JumpAttack faces AWAY from punisher.
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(
            2,
            InputIntent {
                attack: punisher_light_input_tick == Some(next),
                facing_radians: PI,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(3, InputIntent::default()));
        let prior = world.fighter(1).unwrap().action;
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 2,
                target: 1,
                damage: 34,
                hp: 66,
            } = event
            {
                assert!(
                    hit_tick.replace(world.tick).is_none(),
                    "only one genuine hit"
                );
                victim_action_at_hit = Some(world.fighter(1).unwrap().action);
            }
        }
        let current = world.fighter(1).unwrap().action;
        if prior != Action::JumpAttackRecovery && current == Action::JumpAttackRecovery {
            assert!(recovery_enter.replace(world.tick).is_none());
        }
        if prior == Action::JumpAttackRecovery && current == Action::Idle {
            assert!(recovery_exit.replace(world.tick).is_none());
        }
    }
    Evidence {
        recovery_enter: recovery_enter.expect("actual original jump recovery entry"),
        recovery_exit: recovery_exit.expect("actual original jump recovery exit"),
        hit_tick,
        victim_action_at_hit,
        hp: world.fighter(1).unwrap().hp,
        third_player_hp: world.fighter(3).unwrap().hp,
    }
}

fn actual_punisher_hit_at(target_tick: u32) -> Evidence {
    // Original 135ms LightWindup is nine 60Hz steps (start + eight
    // subsequent steps) before authentic LightActive collision.
    let run = actual_original_world(Some(target_tick - 8));
    assert_eq!(
        run.hit_tick,
        Some(target_tick),
        "actual Rust World contact tick"
    );
    assert_eq!(run.hp, 66.0, "one original 34HP hit");
    assert_eq!(run.third_player_hp, 100.0, "FFA spectator stays unharmed");
    run
}

#[test]
fn m147_owner_approved_jump_recovery_is_450_ms_at_original_60_hz() {
    let baseline = actual_original_world(None);
    assert_eq!(
        baseline.recovery_exit - baseline.recovery_enter,
        27,
        "owner-approved 450ms jump recovery must last 27 ticks at original 60Hz"
    );
}

#[test]
fn m147_authentic_light_hit_one_world_tick_before_recovery_exit_is_in_recovery() {
    let baseline = actual_original_world(None);
    assert_eq!(baseline.hit_tick, None);
    let hit = actual_punisher_hit_at(baseline.recovery_exit - 1);
    assert_eq!(hit.recovery_enter, baseline.recovery_enter);
    assert_eq!(hit.recovery_exit, baseline.recovery_exit);
    assert_eq!(hit.victim_action_at_hit, Some(Action::JumpAttackRecovery));
    assert!(
        hit.recovery_enter <= hit.hit_tick.unwrap() && hit.hit_tick.unwrap() < hit.recovery_exit
    );
}

#[test]
fn m147_same_tick_recovery_exit_then_real_contact_is_not_in_recovery() {
    let baseline = actual_original_world(None);
    let hit = actual_punisher_hit_at(baseline.recovery_exit);
    assert_eq!(hit.victim_action_at_hit, Some(Action::Idle));
    assert_eq!(hit.hit_tick, Some(hit.recovery_exit));
}

#[test]
fn m147_real_hit_one_world_tick_after_exit_is_not_in_recovery() {
    let baseline = actual_original_world(None);
    let hit = actual_punisher_hit_at(baseline.recovery_exit + 1);
    assert_eq!(hit.victim_action_at_hit, Some(Action::Idle));
    assert!(hit.hit_tick.unwrap() > hit.recovery_exit);
}
