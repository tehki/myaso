//! Component reproduction only, not native/QUIC or independent acceptance.
//! Preserve original World ticks and immutable Parry125/Block240 contracts.
use myaso_server::simulation::{CombatEvent, InputIntent, World};

#[test]
fn light_windup_to_block_admission_offsets_retain_both_early_and_late_failures() {
    for delay in [1, 2, 4, 8, 10] {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 200.0, std::f32::consts::PI));
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            }
        ));
        let mut contacts = Vec::new();
        for tick in 0..20 {
            if tick == delay {
                assert!(world.set_input(
                    2,
                    InputIntent {
                        block: true,
                        facing_radians: std::f32::consts::PI,
                        ..InputIntent::default()
                    }
                ));
            }
            for event in world.step() {
                if matches!(
                    event,
                    CombatEvent::Parry { .. } | CombatEvent::Block { .. } | CombatEvent::Hit { .. }
                ) {
                    println!(
                        "M35_COMPONENT delay={delay} contactTick={} ageMs={} event={event:?}",
                        world.tick,
                        world.fighter(2).unwrap().action_elapsed_ms
                    );
                    contacts.push(event);
                }
            }
        }
        assert_eq!(contacts.len(), 1);
        match delay {
            1 => assert!(matches!(contacts[0], CombatEvent::Block { .. })),
            2 | 4 | 8 => assert!(matches!(contacts[0], CombatEvent::Parry { .. })),
            10 => assert!(matches!(
                contacts[0],
                CombatEvent::Hit {
                    damage: 34,
                    hp: 66,
                    ..
                }
            )),
            _ => unreachable!(),
        }
    }
}
