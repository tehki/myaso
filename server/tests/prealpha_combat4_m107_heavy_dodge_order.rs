//! Combat 4 / M107: server-tick truth when a heavy lands before a late dodge.
//! These are genuine World steps and CombatEvents, NOT live browser or QUIC input.
//! Preserve the original 46 HP heavy, 125ms i-frame and existing damage rules.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

fn arena() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    // Perpendicular defender facing keeps roll clear of both player bodies.
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::FRAC_PI_2));
    world
}

fn begin_standalone_heavy(world: &mut World) {
    assert!(world.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            ..InputIntent::default()
        }
    ));
    assert!(world.step().is_empty());
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(world.set_input(1, InputIntent::default())); // KeyE keyup is not a release-to-hit.
}

fn heavy_hit(events: &[CombatEvent]) -> bool {
    events.iter().any(|event| {
        matches!(
            event,
            CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 46,
                hp: 54
            }
        )
    })
}

#[test]
fn m107_heavy_hit_before_defender_dodge_is_not_retroactively_evaded() {
    let mut world = arena();
    begin_standalone_heavy(&mut world);
    let mut contact_tick = None;
    for tick in 2..=65 {
        let events = world.step();
        if heavy_hit(&events) {
            assert_eq!(world.fighter(2).unwrap().hp, 54.0);
            contact_tick = Some(tick);
            break;
        }
    }
    let contact_tick = contact_tick.expect("real 46HP World hit must resolve");
    assert!(contact_tick > 1);
    // Deliberately issue the genuine input edge only AFTER the completed hit tick.
    assert!(world.set_input(
        2,
        InputIntent {
            dodge: true,
            ..InputIntent::default()
        }
    ));
    let later = world.step();
    assert_eq!(world.fighter(2).unwrap().action, Action::Dodge);
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    assert!(!later
        .iter()
        .any(|event| matches!(event, CombatEvent::Evade { .. })));
    let mut extra_hits = 0;
    for _ in 0..40 {
        extra_hits += world
            .step()
            .iter()
            .filter(|e| matches!(e, CombatEvent::Hit { .. }))
            .count();
    }
    assert_eq!(
        extra_hits, 0,
        "late dodge never triggers a second heavy hit"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn m107_dodge_admitted_before_heavy_contact_keeps_hp_and_emits_real_evade() {
    let mut world = arena();
    begin_standalone_heavy(&mut world);
    let mut setup_ticks = 0;
    while world.fighter(1).unwrap().action == Action::HeavyAttackWindup
        && world.fighter(1).unwrap().action_elapsed_ms < 285.0
    {
        assert!(world.step().is_empty());
        setup_ticks += 1;
        assert!(setup_ticks < 22);
    }
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(world.set_input(
        2,
        InputIntent {
            dodge: true,
            ..InputIntent::default()
        }
    ));
    let mut dodge_started_before_contact = false;
    let mut evade_count = 0;
    let mut hit_count = 0;
    for _ in 0..40 {
        let events = world.step();
        dodge_started_before_contact |= world.fighter(2).unwrap().action == Action::Dodge;
        evade_count += events
            .iter()
            .filter(|e| {
                matches!(
                    e,
                    CombatEvent::Evade {
                        attacker: 1,
                        target: 2
                    }
                )
            })
            .count();
        hit_count += events
            .iter()
            .filter(|e| matches!(e, CombatEvent::Hit { .. }))
            .count();
    }
    assert!(
        dodge_started_before_contact,
        "server must admit dodge before contact"
    );
    assert_eq!(
        hit_count, 0,
        "invulnerable dodge cannot absorb a 46HP heavy"
    );
    assert_eq!(evade_count, 1, "one true World evade per committed strike");
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
}
