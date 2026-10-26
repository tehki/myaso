//! M41 original 60Hz Rust World: a fresh genuine Block accepted before
//! the contact step can parry; a Block first admitted AFTER that step cannot
//! retroactively revoke an authentic 34HP HIT. No client, packet or fake event.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

#[derive(Debug)]
struct Contact {
    first_hit: Option<u32>,
    first_parry: Option<u32>,
    first_block_action: Option<u32>,
    defender_hp: f32,
    defender_guard: f32,
    attacker_action_at_contact: Option<Action>,
    defender_action_at_contact: Option<Action>,
}

fn original_world_light(block_from_tick: u32) -> Contact {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 315.0, 300.0, std::f32::consts::PI));

    let mut first_hit = None;
    let mut first_parry = None;
    let mut first_block_action = None;
    let mut attacker_action_at_contact = None;
    let mut defender_action_at_contact = None;

    for _ in 0..32 {
        let next_tick = world.tick + 1;
        assert!(world.set_input(
            1,
            InputIntent {
                attack: next_tick == 1,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        assert!(world.set_input(
            2,
            InputIntent {
                block: next_tick >= block_from_tick,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for event in world.step() {
            match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    hp: 66,
                } => {
                    assert!(first_hit.replace(world.tick).is_none(), "only one true hit");
                    attacker_action_at_contact = Some(world.fighter(1).unwrap().action);
                    defender_action_at_contact = Some(world.fighter(2).unwrap().action);
                }
                CombatEvent::Parry {
                    attacker: 1,
                    target: 2,
                } => {
                    assert!(
                        first_parry.replace(world.tick).is_none(),
                        "only one true parry"
                    );
                    attacker_action_at_contact = Some(world.fighter(1).unwrap().action);
                    defender_action_at_contact = Some(world.fighter(2).unwrap().action);
                }
                _ => {}
            }
        }
        if first_block_action.is_none() && world.fighter(2).unwrap().action == Action::Block {
            first_block_action = Some(world.tick);
        }
    }
    Contact {
        first_hit,
        first_parry,
        first_block_action,
        defender_hp: world.fighter(2).unwrap().hp,
        defender_guard: world.fighter(2).unwrap().guard,
        attacker_action_at_contact,
        defender_action_at_contact,
    }
}

#[test]
fn m41_block_admitted_on_original_hit_tick_parries_before_collision() {
    let baseline = original_world_light(u32::MAX);
    let contact_tick = baseline.first_hit.expect("original Light authentic hit");
    assert!(baseline.first_parry.is_none());
    assert_eq!(baseline.defender_hp, 66.0);
    let timely = original_world_light(contact_tick);
    assert_eq!(timely.first_block_action, Some(contact_tick));
    assert_eq!(
        timely.first_parry,
        Some(contact_tick),
        "same-step Block becomes actual parry"
    );
    assert_eq!(timely.first_hit, None, "timely parry blocks the contact");
    assert_eq!(timely.defender_hp, 100.0);
    assert_eq!(timely.defender_guard, 100.0);
    assert_eq!(timely.attacker_action_at_contact, Some(Action::Stunned));
    assert_eq!(timely.defender_action_at_contact, Some(Action::Block));
}

#[test]
fn m41_block_admitted_one_original_tick_after_hit_cannot_retroactively_parry() {
    let baseline = original_world_light(u32::MAX);
    let contact_tick = baseline.first_hit.expect("original Light authentic hit");
    let late = original_world_light(contact_tick + 1);
    assert_eq!(
        late.first_hit,
        Some(contact_tick),
        "actual original HIT is unchanged"
    );
    assert_eq!(
        late.first_parry, None,
        "late block never rewrites the prior HIT"
    );
    assert_eq!(late.first_block_action, Some(contact_tick + 1));
    assert_eq!(late.defender_hp, 66.0);
    assert_eq!(late.defender_guard, 100.0);
    assert_eq!(late.defender_action_at_contact, Some(Action::Idle));
}
