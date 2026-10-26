//! Core 8C M121: native side-sweep staging must qualify original attack ARC,
//! not only nominal reach. Uses the production 60Hz World, actual InputIntent,
//! and real CombatEvent::Hit; no geometry, damage, or World rule changes.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};
use std::f32::consts::PI;

#[derive(Debug)]
struct ResultTrace {
    saw_left_windup: bool,
    saw_left_active: bool,
    hits: usize,
    target_hp: f32,
    attacker_x: f32,
    attacker_y: f32,
}

fn real_original_left_sweep(attacker_y: f32) -> ResultTrace {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 42.0, 42.0, 0.0));
    assert!(world.add_player_at(2, 114.0, attacker_y, PI));

    let mut hits = 0;
    let mut saw_left_windup = false;
    let mut saw_left_active = false;
    for tick in 1..=30 {
        assert!(world.set_input(1, InputIntent::default()));
        // Actual released-Light classification: one initially charging packet
        // followed by an authentic release with a lateral KeyS/MoveY intent.
        // Facing west (PI), +Y strafe produces an AttackLeftWindup.
        assert!(world.set_input(
            2,
            InputIntent {
                attack: tick <= 2,
                heavy_attack: tick == 1,
                move_y: if tick <= 2 { 1.0 } else { 0.0 },
                facing_radians: PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 2,
                target: 1,
                damage: 34,
                hp: 66,
            } = event
            {
                hits += 1;
            }
        }
        let action = world.fighter(2).unwrap().action;
        saw_left_windup |= action == Action::AttackLeftWindup;
        saw_left_active |= action == Action::AttackLeftActive;
    }
    let attacker = world.fighter(2).unwrap();
    ResultTrace {
        saw_left_windup,
        saw_left_active,
        hits,
        target_hp: world.fighter(1).unwrap().hp,
        attacker_x: attacker.x,
        attacker_y: attacker.y,
    }
}

#[test]
fn m121_true_left_sweep_in_original_arc_deals_one_authentic_34hp_hit() {
    let trace = real_original_left_sweep(42.0);
    assert!(trace.saw_left_windup && trace.saw_left_active, "{trace:?}");
    assert_eq!(trace.hits, 1, "{trace:?}");
    assert_eq!(trace.target_hp, 66.0, "{trace:?}");
}

#[test]
fn m121_key_s_displacement_places_target_outside_left_arc_despite_original_reach() {
    // Exact source-vs-native geometry observed on immutable 5c7a M121 run:
    // target (42,42), attacker at (114,86) after genuine physical KeyS.
    // Before the swipe the attack lane was (114,42) and target (42,42).
    // The 84px hypotenuse is < unchanged 76+18px reach, but the left-sweep
    // facing cone is narrower than a radial-only collision check.
    let trace = real_original_left_sweep(86.0);
    assert!(trace.saw_left_windup && trace.saw_left_active, "{trace:?}");
    let radial = (trace.attacker_x - 42.0).hypot(trace.attacker_y - 42.0);
    assert!(radial < 94.0, "must prove an IN-REACH miss: {trace:?}");
    assert_eq!(
        trace.hits, 0,
        "original left arc may correctly MISS: {trace:?}"
    );
    assert_eq!(trace.target_hp, 100.0, "no synthetic World HP debit");
}
