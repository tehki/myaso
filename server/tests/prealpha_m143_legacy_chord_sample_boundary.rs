//! M143/M144 server-owned classification of genuinely sampled v1
//! Space + LMB button intents. These are World source-characterization tests:
//! no browser admission, network-loss inference, or protocol v2 activation.
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};
fn world() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn one(w: &mut World, input: InputIntent) {
    assert!(w.set_input(1, input));
    w.step();
}
fn chord() -> InputIntent {
    InputIntent {
        jump: true,
        attack: true,
        heavy_attack: true,
        ..InputIntent::default()
    }
}
fn pointer_first() -> InputIntent {
    InputIntent {
        attack: true,
        heavy_attack: true,
        ..InputIntent::default()
    }
}
#[test]
fn server_sample_containing_real_jump_and_attack_edges_commits_jump_attack() {
    let mut w = world();
    one(&mut w, chord());
    assert_eq!(w.fighter(1).unwrap().action, Action::JumpAttackWindup);
    assert_eq!(w.fighter(1).unwrap().stamina.round() as u8, 74);
}
#[test]
fn independently_sampled_lmb_charge_must_resolve_to_jump_only_after_next_real_input() {
    let mut w = world();
    one(&mut w, pointer_first());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    // The second admitted v1 sample carries both committed light and Space,
    // as the existing browser's immediate commitLight() would if delivered.
    one(
        &mut w,
        InputIntent {
            jump: true,
            attack: true,
            ..InputIntent::default()
        },
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::JumpAttackWindup);
    assert_eq!(w.fighter(1).unwrap().stamina.round() as u8, 74);
}
#[test]
fn unsampled_transient_chord_cannot_be_recovered_from_later_default_v1_sample() {
    let mut w = world();
    one(&mut w, pointer_first());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    // Loss of the SECOND distinct v1 INPUT carrying both jump+attack
    // leaves no event provenance. Later released default cancels the charge.
    one(&mut w, InputIntent::default());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    let mut events = vec![];
    for _ in 0..42 {
        events.extend(w.step());
    }
    assert!(
        events
            .iter()
            .all(|e| !matches!(e, CombatEvent::Hit { attacker: 1, .. })),
        "no client-authenticated attack edge means no invented hit"
    );
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}
#[test]
fn old_v1_missing_all_chord_samples_leaves_actor_idling_at_100_stamina() {
    let mut w = world();
    let mut events = vec![];
    for _ in 0..20 {
        events.extend(w.step());
    }
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(1).unwrap().stamina, 100.0);
    assert!(events.is_empty());
}
