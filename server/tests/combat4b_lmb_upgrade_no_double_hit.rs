//! Combat 4B regression: original 60Hz Rust World owns every Light/Heavy HIT.
//! The legacy v1 bits must not retroactively upgrade a landed Light, and
//! an authentic pre-contact upgrade must deliver one Heavy only.
//! This is World mechanics evidence, NOT a browser/QUIC/source0 release gate.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn world() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    world
}

fn input(attack: bool, heavy_attack: bool) -> InputIntent {
    InputIntent {
        attack,
        heavy_attack,
        facing_radians: 0.0,
        ..InputIntent::default()
    }
}

fn hits(world: &mut World, recorded: &mut Vec<(u32, u8, u8)>) {
    for event in world.step() {
        if let CombatEvent::Hit {
            attacker: 1,
            target: 2,
            damage,
            hp,
        } = event
        {
            recorded.push((world.tick, damage, hp));
        }
    }
}

#[test]
fn late_heavy_upgrade_after_real_light_hit_cannot_double_hit_even_after_recovery() {
    let mut world = world();
    let mut recorded = Vec::new();

    // Original attack initiates one legitimate 135ms Light windup.
    assert!(world.set_input(1, input(true, false)));
    hits(&mut world, &mut recorded);
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    for _ in 2..=10 {
        assert!(world.set_input(1, input(false, false)));
        hits(&mut world, &mut recorded);
    }
    assert_eq!(recorded.len(), 1, "the original authoritative Light landed");
    assert_eq!(recorded[0].1, 34);
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);

    // A delayed/replayed Heavy rising edge arrives after real contact.
    // Keeping both bits high beyond Light recovery must not start a Heavy.
    for _ in 11..=52 {
        assert!(world.set_input(1, input(true, true)));
        hits(&mut world, &mut recorded);
        assert!(!matches!(
            world.fighter(1).unwrap().action,
            Action::HeavyAttackWindup | Action::HeavyAttackActive | Action::HeavyAttackRecovery
        ));
    }
    // Even a later heavy-only release cannot resurrect the spent gesture.
    assert!(world.set_input(1, input(false, true)));
    hits(&mut world, &mut recorded);
    for _ in 54..=96 {
        assert!(world.set_input(1, input(false, false)));
        hits(&mut world, &mut recorded);
    }
    assert_eq!(
        recorded.len(),
        1,
        "one gesture must never emit Light+Heavy HIT"
    );
    assert_eq!(recorded[0].1, 34);
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
}

#[test]
fn early_server_admitted_light_to_heavy_upgrade_waits_for_release_and_hits_once() {
    let mut world = world();
    let mut recorded = Vec::new();

    assert!(world.set_input(1, input(true, false)));
    hits(&mut world, &mut recorded);
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    assert!(world.set_input(1, input(true, true)));
    hits(&mut world, &mut recorded);
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    // The original World reaches READY but cannot auto-strike during hold.
    for _ in 3..=48 {
        assert!(world.set_input(1, input(true, true)));
        hits(&mut world, &mut recorded);
        assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    }
    assert!(
        recorded.is_empty(),
        "READY cannot emit a held Heavy or Light HIT"
    );

    // Release produces one genuine server-owned Heavy contact.
    assert!(world.set_input(1, input(false, true)));
    hits(&mut world, &mut recorded);
    for _ in 50..=105 {
        assert!(world.set_input(1, input(false, false)));
        hits(&mut world, &mut recorded);
    }
    assert_eq!(recorded.len(), 1, "exactly one original World Heavy HIT");
    assert_eq!(recorded[0].1, 46);
    assert_eq!(recorded[0].2, 54);
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
}
