use myaso_server::{
    decode_input_packet,
    projectile::{Event as WeaponEvent, Refusal as WeaponRefusal},
    simulation::{Action, CombatEvent, InputIntent, World},
};

#[test]
fn header_throw_flag_decodes_without_changing_legacy_input_size() {
    let mut bytes = [0_u8; 22];
    bytes[0] = 1;
    bytes[1] = 1;
    bytes[2] = 1;
    bytes[3] = 1;
    bytes[8..12].copy_from_slice(&42_u32.to_le_bytes());
    let packet = decode_input_packet(&bytes).expect("valid header flag");
    assert!(packet.throw_weapon);
    assert_eq!(packet.samples()[0].tick, 42);
    bytes[3] = 0;
    assert!(!decode_input_packet(&bytes).unwrap().throw_weapon);
    bytes[3] = 2;
    assert!(decode_input_packet(&bytes).is_err());
}

#[test]
fn genuine_server_throw_uses_fighter_facing_and_disarms_for_30000ms() {
    let mut world = World::new(100_000.0, 100_000.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert_eq!(
        world.throw_weapon(1),
        Ok(WeaponEvent::Spawn { id: 1, owner: 1 })
    );
    assert_eq!(world.weapon_rearm_remaining_ms(1), 30_000);
    assert_eq!(world.throw_weapon(1), Err(WeaponRefusal::Disarmed));

    world.set_input(
        1,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );
    world.step_by(20.0);
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(world.thrown_weapons().len(), 1);

    world.set_input(1, InputIntent::default());
    for _ in 0..299 {
        world.step_by(100.0);
    }
    assert_eq!(world.weapon_rearm_remaining_ms(1), 80);
    world.step_by(80.0);
    assert_eq!(world.weapon_rearm_remaining_ms(1), 0);
    assert_eq!(
        world.throw_weapon(1),
        Ok(WeaponEvent::Spawn { id: 2, owner: 1 })
    );
}

#[test]
fn server_throw_impacts_fighter_once_and_triggers_34hp_damage() {
    let mut world = World::new(1000.0, 800.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 230.0, 100.0, std::f32::consts::PI));
    world.throw_weapon(1).expect("authenticated fighter");
    let first = world.step_by(100.0);
    assert!(first.is_empty());
    let second = world.step_by(100.0);
    assert!(second.iter().any(|event| {
        matches!(
            event,
            CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage: 34,
                hp: 66,
            }
        )
    }));
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);
    assert!(world.thrown_weapons().is_empty());
}
