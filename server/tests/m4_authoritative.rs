use myaso_server::{
    simulation::{Action, CombatEvent, InputIntent, World, FFA_KILL_TARGET, FFA_MATCH_RESET_MS},
    snapshot::{
        apply_records, build_delta, decode_snapshot, encode_snapshot, SnapshotSession, WireEntity,
    },
    CONSERVATIVE_DATAGRAM_BYTES,
};
use std::collections::BTreeMap;

fn duel(distance: f32) -> World {
    let mut world = World::new(600.0, 400.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 200.0 + distance, 200.0, std::f32::consts::PI));
    world
}

fn advance(
    world: &mut World,
    milliseconds: f32,
    first: InputIntent,
    second: InputIntent,
) -> Vec<CombatEvent> {
    let mut elapsed = 0.0_f32;
    let mut events = Vec::new();
    while elapsed < milliseconds {
        let dt = (milliseconds - elapsed).min(5.0);
        world.set_input(1, first);
        world.set_input(2, second);
        events.extend(world.step_by(dt));
        elapsed += dt;
    }
    events
}

fn fresh_attack_when_idle(world: &mut World, attack: InputIntent) -> Vec<CombatEvent> {
    let release = InputIntent {
        facing_radians: attack.facing_radians,
        ..InputIntent::default()
    };
    if world
        .fighter(1)
        .map(|fighter| fighter.action == Action::Idle)
        .unwrap_or(false)
    {
        // M123 makes light attacks edge-triggered so holding LMB cannot auto-chain.
        // Give legacy kill/match loops one explicit release frame before each
        // synthetic click, then deliver a fresh attack edge.
        let mut events = advance(world, 5.0, release, InputIntent::default());
        events.extend(advance(world, 5.0, attack, InputIntent::default()));
        events
    } else {
        advance(world, 5.0, release, InputIntent::default())
    }
}

fn advance_three(
    world: &mut World,
    milliseconds: f32,
    first: InputIntent,
    second: InputIntent,
    third: InputIntent,
) -> Vec<CombatEvent> {
    let mut elapsed = 0.0_f32;
    let mut events = Vec::new();
    while elapsed < milliseconds {
        let dt = (milliseconds - elapsed).min(5.0);
        world.set_input(1, first);
        world.set_input(2, second);
        world.set_input(3, third);
        events.extend(world.step_by(dt));
        elapsed += dt;
    }
    events
}

#[test]
fn rust_snapshot_encoder_matches_the_js_wire_fixture() {
    let state = WireEntity {
        net_id: 1,
        x: 400,
        y: 800,
        facing: 16384,
        hp: 66,
        guard: 75,
        stamina: 100,
        action: 1,
        flags: 2,
    };
    let record = build_delta(state, None).expect("full record");
    let encoded = encode_snapshot(7, 6, 1234, false, &[record], CONSERVATIVE_DATAGRAM_BYTES);
    let expected_hex = include_str!("../../tests/fixtures/m4-snapshot-v1.hex").trim();
    assert_eq!(hex(&encoded), expected_hex);

    let decoded = decode_snapshot(&encoded).expect("decode fixture");
    assert_eq!(decoded.sequence, 7);
    assert_eq!(decoded.baseline_sequence, 6);
    assert_eq!(decoded.server_tick, 1234);
    assert!(!decoded.full);
    assert_eq!(decoded.records.len(), 1);
    assert_eq!(decoded.records[0].net_id, 1);
    assert_eq!(decoded.records[0].x, 400);
    assert_eq!(decoded.records[0].y, 800);
    assert_eq!(decoded.records[0].hp, 66);
    assert_eq!(decoded.records[0].action, 1);
}

#[test]
fn fighter_identity_operations_preserve_sorted_binary_lookup() {
    let mut world = World::new(600.0, 400.0);
    for net_id in [9, 1, 5, 3, 7] {
        assert!(world.add_player_at(net_id, 100.0 + net_id as f32, 100.0, 0.0));
    }

    assert_eq!(
        world
            .fighters()
            .iter()
            .map(|fighter| fighter.net_id)
            .collect::<Vec<_>>(),
        vec![1, 3, 5, 7, 9]
    );
    assert!(!world.add_player_at(5, 200.0, 100.0, 0.0));
    assert!(world.fighter(5).is_some());
    assert!(world.fighter(6).is_none());

    let input = InputIntent {
        move_x: 0.5,
        facing_radians: 1.0,
        ..InputIntent::default()
    };
    assert!(world.set_input(7, input));
    assert_eq!(world.fighter(7).expect("fighter 7").input(), input);
    assert_eq!(
        world.fighter(5).expect("fighter 5").input(),
        InputIntent::default()
    );
    assert!(!world.set_input(6, input));

    assert!(world.remove_player(5));
    assert!(!world.remove_player(5));
    assert_eq!(
        world
            .fighters()
            .iter()
            .map(|fighter| fighter.net_id)
            .collect::<Vec<_>>(),
        vec![1, 3, 7, 9]
    );
    assert!(world.fighter(7).is_some());
}

#[test]
fn reusable_combat_event_buffer_matches_allocating_step_semantics() {
    let mut allocating = duel(72.0);
    let mut reusable = allocating.clone();
    let mut reused_events = Vec::with_capacity(16);
    let allocation = reused_events.as_ptr();
    let capacity = reused_events.capacity();
    let first = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let second = InputIntent::default();

    let mut observed_event = false;
    for _ in 0..60 {
        allocating.set_input(1, first);
        allocating.set_input(2, second);
        reusable.set_input(1, first);
        reusable.set_input(2, second);

        let allocated_events = allocating.step_by(5.0);
        reusable.step_by_into(5.0, &mut reused_events);

        observed_event |= !allocated_events.is_empty();
        assert_eq!(reused_events, allocated_events);
        assert_eq!(reusable.tick, allocating.tick);
        assert_eq!(reusable.now_ms, allocating.now_ms);
        assert_eq!(reusable.match_winner(), allocating.match_winner());
        assert_eq!(reusable.fighters(), allocating.fighters());
        assert_eq!(reused_events.as_ptr(), allocation);
        assert_eq!(reused_events.capacity(), capacity);
    }

    assert!(observed_event, "combat exchange must exercise event writes");
}

#[test]
fn recovered_light_edge_survives_newer_idle_input_before_authoritative_step() {
    let mut world = duel(200.0);
    assert!(world.set_input(
        1,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    ));
    assert!(world.set_input(
        1,
        InputIntent {
            move_x: 0.25,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    ));

    world.step_by(5.0);

    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::AttackWindup);
    assert_eq!(attacker.input().move_x, 0.25);
    assert!(!attacker.input().attack);
}

#[test]
fn recovered_heavy_edge_survives_newer_idle_input_before_authoritative_step() {
    let mut world = duel(200.0);
    assert!(world.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    ));
    assert!(world.set_input(
        1,
        InputIntent {
            move_x: 0.25,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    ));

    world.step_by(5.0);

    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::HeavyAttackWindup);
    assert_eq!(attacker.input().move_x, 0.25);
    assert!(!attacker.input().heavy_attack);
}

#[test]
fn attack_preserves_windup_active_and_recovery_commitment() {
    let mut world = duel(200.0);
    world.set_input(
        1,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );
    world.step_by(5.0);
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );

    advance(
        &mut world,
        135.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackActive
    );

    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );

    advance(
        &mut world,
        255.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
}

#[test]
fn heavy_attack_preserves_long_commitment_and_deals_46_once() {
    let mut commitment = duel(200.0);
    commitment.set_input(
        1,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );
    commitment.step_by(5.0);
    assert_eq!(
        commitment.fighter(1).expect("attacker").action,
        Action::HeavyAttackWindup
    );
    assert_eq!(
        WireEntity::from_fighter(commitment.fighter(1).expect("attacker")).action,
        9
    );

    advance(
        &mut commitment,
        320.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        commitment.fighter(1).expect("attacker").action,
        Action::HeavyAttackActive
    );
    assert_eq!(
        WireEntity::from_fighter(commitment.fighter(1).expect("attacker")).action,
        10
    );
    advance(
        &mut commitment,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        commitment.fighter(1).expect("attacker").action,
        Action::HeavyAttackRecovery
    );
    assert_eq!(
        WireEntity::from_fighter(commitment.fighter(1).expect("attacker")).action,
        11
    );
    advance(
        &mut commitment,
        420.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        commitment.fighter(1).expect("attacker").action,
        Action::Idle
    );

    let mut hit_world = duel(72.0);
    let events = advance(
        &mut hit_world,
        435.0,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, CombatEvent::Hit { .. }))
            .count(),
        1
    );
    assert!(events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            damage: 46,
            hp: 54,
            ..
        }
    )));
    assert_eq!(hit_world.fighter(2).expect("target").hp.round() as u8, 54);
}

#[test]
fn heavy_attack_applies_64_guard_pressure_and_remains_parryable() {
    let mut blocked = duel(72.0);
    advance(
        &mut blocked,
        135.0,
        InputIntent::default(),
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let events = advance(
        &mut blocked,
        435.0,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(blocked.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(blocked.fighter(2).expect("target").guard.round() as u8, 36);
    assert!(events
        .iter()
        .any(|event| matches!(event, CombatEvent::Block { .. })));

    let mut parried = duel(72.0);
    advance(
        &mut parried,
        295.0,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let parry_events = advance(
        &mut parried,
        45.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(parried.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(
        parried.fighter(1).expect("attacker").action,
        Action::Stunned
    );
    assert!(parry_events
        .iter()
        .any(|event| matches!(event, CombatEvent::Parry { .. })));
}

#[test]
fn light_guard_break_holds_zero_guard_for_actionable_650_ms_window() {
    let mut world = duel(72.0);
    let blocking = InputIntent {
        block: true,
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };
    let light = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };

    // Age the held block past the fresh-parry window, then pressure guard with
    // two complete light commitments: 100 -> 62 -> 24.
    advance(&mut world, 135.0, InputIntent::default(), blocking);
    for expected_guard in [62_u8, 24_u8] {
        let events = advance(&mut world, 230.0, light, blocking);
        assert!(events
            .iter()
            .any(|event| matches!(event, CombatEvent::Block { .. })));
        assert_eq!(
            world.fighter(2).expect("target").guard.round() as u8,
            expected_guard
        );
        advance(&mut world, 255.0, InputIntent::default(), blocking);
        assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
        assert_eq!(world.fighter(2).expect("target").action, Action::Block);
    }

    // The third light exhausts guard and starts the authoritative broken state.
    let break_events = advance(&mut world, 230.0, light, blocking);
    assert!(break_events
        .iter()
        .any(|event| matches!(event, CombatEvent::GuardBreak { .. })));
    assert_eq!(world.fighter(2).expect("target").guard.round() as u8, 0);
    assert_eq!(world.fighter(2).expect("target").action, Action::Stunned);

    // Normalize for the stun time already consumed inside the final 230 ms
    // slice, then prove authority still owns the broken state at 600 ms.
    let elapsed = world.fighter(2).expect("target").action_elapsed_ms;
    assert!(elapsed > 0.0 && elapsed < 150.0);
    advance(
        &mut world,
        (600.0 - elapsed).max(0.0),
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Stunned);
    assert_eq!(world.fighter(2).expect("target").guard.round() as u8, 0);

    // Control returns only after crossing the merged M152 650 ms contract.
    advance(
        &mut world,
        60.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Idle);
}

#[test]
fn heavy_guard_break_preserves_a_real_light_punish_window_after_recovery() {
    let mut world = duel(72.0);
    let blocking = InputIntent {
        block: true,
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };
    let heavy = InputIntent {
        heavy_attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };

    // Enter ordinary held Block outside the 115 ms fresh-parry window.
    advance(&mut world, 135.0, InputIntent::default(), blocking);

    let first_events = advance(&mut world, 435.0, heavy, blocking);
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(world.fighter(2).expect("target").guard.round() as u8, 36);
    assert!(first_events
        .iter()
        .any(|event| matches!(event, CombatEvent::Block { .. })));

    // Finish the first heavy commitment while Block remains held.
    advance(&mut world, 405.0, InputIntent::default(), blocking);
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    assert_eq!(world.fighter(2).expect("target").action, Action::Block);

    // The second heavy exhausts guard at the start of its active phase.
    let break_events = advance(&mut world, 325.0, heavy, blocking);
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(world.fighter(2).expect("target").guard.round() as u8, 0);
    assert_eq!(world.fighter(2).expect("target").action, Action::Stunned);
    assert!(break_events
        .iter()
        .any(|event| matches!(event, CombatEvent::GuardBreak { .. })));

    // From this snapshot the attacker has 95 ms active + 420 ms recovery left.
    // When that exact commitment is over, the defender must still be stunned.
    advance(
        &mut world,
        515.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    assert_eq!(world.fighter(2).expect("target").action, Action::Stunned);

    // A normal 135 ms light windup must fit inside that post-recovery opening.
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );
    let punish_events = advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert!(punish_events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            damage: 34,
            hp: 66,
            ..
        }
    )));
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 66);
    assert_eq!(world.fighter(2).expect("target").action, Action::Stunned);
}

#[test]
fn server_owned_attack_changes_authoritative_vitals_once() {
    let mut world = duel(72.0);
    let events = advance(
        &mut world,
        230.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );

    assert_eq!(
        events
            .iter()
            .filter(|event| matches!(event, CombatEvent::Hit { .. }))
            .count(),
        1
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 66);
}

#[test]
fn attack_outside_the_facing_arc_misses() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        230.0,
        InputIntent {
            attack: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
}

#[test]
fn squared_distance_rejection_preserves_collision_and_attack_boundaries() {
    let mut touching = duel(36.0);
    let first_x = touching.fighter(1).expect("first").x;
    let second_x = touching.fighter(2).expect("second").x;
    touching.step_by(5.0);
    assert_eq!(touching.fighter(1).expect("first").x, first_x);
    assert_eq!(touching.fighter(2).expect("second").x, second_x);

    let mut overlapping = duel(35.0);
    overlapping.step_by(5.0);
    let first = overlapping.fighter(1).expect("first");
    let second = overlapping.fighter(2).expect("second");
    assert!((second.x - first.x).hypot(second.y - first.y) >= 36.0 - 1e-6);

    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };

    let mut at_reach = duel(94.0);
    advance(
        &mut at_reach,
        230.0,
        attack,
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(at_reach.fighter(2).expect("target").hp.round() as u8, 66);

    let mut outside_reach = duel(94.25);
    advance(
        &mut outside_reach,
        230.0,
        attack,
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(
        outside_reach.fighter(2).expect("target").hp.round() as u8,
        100
    );
}

#[test]
fn axis_prefilter_preserves_diagonal_collision_and_attack_ranges() {
    let mut separated = World::new(600.0, 400.0);
    assert!(separated.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(separated.add_player_at(2, 230.0, 230.0, 0.0));
    separated.step_by(5.0);
    let first = separated.fighter(1).expect("first");
    let second = separated.fighter(2).expect("second");
    assert_eq!((first.x, first.y), (200.0, 200.0));
    assert_eq!((second.x, second.y), (230.0, 230.0));

    let mut overlapping = World::new(600.0, 400.0);
    assert!(overlapping.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(overlapping.add_player_at(2, 225.0, 225.0, 0.0));
    overlapping.step_by(5.0);
    let first = overlapping.fighter(1).expect("first");
    let second = overlapping.fighter(2).expect("second");
    assert!((second.x - first.x).hypot(second.y - first.y) >= 36.0 - 1e-4);

    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let target_input = InputIntent {
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };

    let mut inside = World::new(600.0, 400.0);
    assert!(inside.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(inside.add_player_at(2, 290.0, 220.0, std::f32::consts::PI));
    advance(&mut inside, 230.0, attack, target_input);
    assert_eq!(inside.fighter(2).expect("target").hp.round() as u8, 66);

    let mut outside = World::new(600.0, 400.0);
    assert!(outside.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(outside.add_player_at(2, 290.0, 230.0, std::f32::consts::PI));
    advance(&mut outside, 230.0, attack, target_input);
    assert_eq!(outside.fighter(2).expect("target").hp.round() as u8, 100);
}

#[test]
fn timed_dodge_iframes_evade_an_otherwise_valid_hit() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        115.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let events = advance(
        &mut world,
        45.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            move_y: 1.0,
            facing_radians: std::f32::consts::PI,
            dodge: true,
            ..InputIntent::default()
        },
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
    assert!(events
        .iter()
        .any(|event| matches!(event, CombatEvent::Evade { .. })));
}

#[test]
fn directional_block_absorbs_health_damage_and_consumes_guard() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        135.0,
        InputIntent::default(),
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let events = advance(
        &mut world,
        230.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.hp.round() as u8, 100);
    assert_eq!(target.guard.round() as u8, 62);
    assert!(events
        .iter()
        .any(|event| matches!(event, CombatEvent::Block { .. })));
}

#[test]
fn fresh_block_parries_and_stuns_the_attacker() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        110.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let events = advance(
        &mut world,
        45.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Stunned);
    assert!(events
        .iter()
        .any(|event| matches!(event, CombatEvent::Parry { .. })));
}

#[test]
fn death_is_temporary_and_respawns_at_the_spawn_point() {
    let mut world = World::new(200.0, 300.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 160.0, 100.0, std::f32::consts::PI));
    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let mut death_seen = false;
    for _ in 0..320 {
        let events = fresh_attack_when_idle(&mut world, attack);
        if events
            .iter()
            .any(|event| matches!(event, CombatEvent::Death { .. }))
        {
            death_seen = true;
            break;
        }
    }
    assert!(
        death_seen,
        "repeated committed attacks should eventually kill the target"
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Dead);
    assert_eq!(world.fighter(1).expect("killer").kills, 1);
    assert_eq!(world.fighter(2).expect("target").kills, 0);
    assert_eq!(
        WireEntity::from_fighter(world.fighter(1).expect("killer")).flags,
        1
    );
    assert_eq!(
        WireEntity::from_fighter(world.fighter(2).expect("target")).flags,
        0
    );

    let events = advance(
        &mut world,
        1260.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.action, Action::Idle);
    assert_eq!(target.hp.round() as u8, 100);
    assert_eq!(target.kills, 0);
    assert_eq!(world.fighter(1).expect("killer").kills, 1);
    assert_eq!(
        WireEntity::from_fighter(world.fighter(1).expect("killer")).flags,
        1
    );
    assert!((target.x - target.spawn_x).abs() < 0.001);
    assert!((target.y - target.spawn_y).abs() < 0.001);
    assert!(events
        .iter()
        .any(|event| matches!(event, CombatEvent::Respawn { .. })));
}

#[test]
fn first_to_kill_target_declares_winner_and_freezes_match_state() {
    let mut world = World::new(200.0, 300.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 160.0, 100.0, std::f32::consts::PI));
    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let mut winning_event = None;
    for _ in 0..4000 {
        let events = fresh_attack_when_idle(&mut world, attack);
        if let Some(event) = events
            .iter()
            .find(|event| matches!(event, CombatEvent::MatchWon { .. }))
        {
            winning_event = Some(event.clone());
            break;
        }
    }

    assert_eq!(FFA_KILL_TARGET, 5);
    assert_eq!(world.match_winner(), Some(1));
    assert!(world.match_over());
    assert_eq!(world.fighter(1).expect("winner").kills, FFA_KILL_TARGET);
    assert_eq!(world.fighter(2).expect("loser").action, Action::Dead);
    assert!(matches!(
        winning_event,
        Some(CombatEvent::MatchWon { winner: 1, kills }) if kills == FFA_KILL_TARGET
    ));

    let winner_before = world.fighter(1).expect("winner").clone();
    let loser_before = world.fighter(2).expect("loser").clone();
    assert!(!world.set_input(1, attack));
    assert!(!world.add_player_at(3, 120.0, 160.0, 0.0));
    let frozen_events = advance(
        &mut world,
        2000.0,
        InputIntent {
            move_x: 1.0,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            move_x: -1.0,
            dodge: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert!(frozen_events.is_empty());
    assert_eq!(world.fighter(1).expect("winner"), &winner_before);
    assert_eq!(world.fighter(2).expect("loser"), &loser_before);
}

#[test]
fn finished_match_resets_atomically_and_reopens_play() {
    let mut world = World::new(200.0, 300.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 160.0, 100.0, std::f32::consts::PI));
    let attack = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };

    for _ in 0..4000 {
        let events = fresh_attack_when_idle(&mut world, attack);
        if events
            .iter()
            .any(|event| matches!(event, CombatEvent::MatchWon { .. }))
        {
            break;
        }
    }
    assert!(world.match_over());
    assert_eq!(world.fighter(1).expect("winner").kills, FFA_KILL_TARGET);

    let mut reset_events = Vec::new();
    let mut elapsed = 0.0_f32;
    while elapsed < FFA_MATCH_RESET_MS + 5.0 {
        let dt = (FFA_MATCH_RESET_MS + 5.0 - elapsed).min(100.0);
        reset_events.extend(world.step_by(dt));
        elapsed += dt;
    }

    assert_eq!(
        reset_events
            .iter()
            .filter(|event| matches!(event, CombatEvent::MatchReset))
            .count(),
        1
    );
    assert_eq!(world.match_winner(), None);
    assert!(!world.match_over());
    for fighter in world.fighters() {
        assert_eq!(fighter.kills, 0);
        assert_eq!(fighter.hp.round() as u8, 100);
        assert_eq!(fighter.guard.round() as u8, 100);
        assert_eq!(fighter.action, Action::Idle);
        assert!((fighter.x - fighter.spawn_x).abs() < 0.001);
        assert!((fighter.y - fighter.spawn_y).abs() < 0.001);
    }
    assert!(world.set_input(
        1,
        InputIntent {
            move_x: 1.0,
            ..InputIntent::default()
        }
    ));
    assert!(world.add_player_at(3, 120.0, 160.0, 0.0));
}

#[test]
fn three_player_ffa_keeps_multi_attacker_damage_targeted() {
    let mut world = World::new(400.0, 300.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 160.0, 100.0, 0.0));
    assert!(world.add_player_at(3, 220.0, 100.0, std::f32::consts::PI));

    let attack_right = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    let face_right = InputIntent {
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance_three(
        &mut world,
        5.0,
        attack_right,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance_three(
        &mut world,
        500.0,
        face_right,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("left attacker").hp.round() as u8,
        100
    );
    assert_eq!(
        world.fighter(2).expect("center target").hp.round() as u8,
        66
    );
    assert_eq!(
        world.fighter(3).expect("right attacker").hp.round() as u8,
        100
    );

    let attack_left = InputIntent {
        attack: true,
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };
    let face_left = InputIntent {
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };
    advance_three(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
        attack_left,
    );
    advance_three(
        &mut world,
        500.0,
        InputIntent::default(),
        InputIntent::default(),
        face_left,
    );
    assert_eq!(
        world.fighter(1).expect("left attacker").hp.round() as u8,
        100
    );
    assert_eq!(
        world.fighter(2).expect("center target").hp.round() as u8,
        32
    );
    assert_eq!(
        world.fighter(3).expect("right attacker").hp.round() as u8,
        100
    );
    assert!(world.fighters().iter().all(|fighter| fighter.kills == 0));
    assert!(!world.match_over());
}

#[test]
fn fighter_bodies_remain_separated_under_movement_pressure() {
    let mut world = duel(40.0);
    advance(
        &mut world,
        300.0,
        InputIntent {
            move_x: 1.0,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            move_x: -1.0,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let first = world.fighter(1).expect("first");
    let second = world.fighter(2).expect("second");
    assert!((second.x - first.x).hypot(second.y - first.y) >= 36.0 - 1e-6);
}

#[test]
fn block_only_protects_the_facing_side() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        135.0,
        InputIntent::default(),
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );
    advance(
        &mut world,
        230.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 66);
}

#[test]
fn acknowledged_baseline_recovers_after_snapshot_loss_and_unknown_ack_forces_full() {
    let mut world = World::new(1000.0, 1000.0);
    world.add_player_at(1, 100.0, 100.0, 0.0);
    world.add_player_at(2, 130.0, 100.0, 0.0);
    let mut session = SnapshotSession::default();
    let mut client_state = BTreeMap::new();

    let first = session.build(
        u16::MAX,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(first.full);
    assert_eq!(first.sequence, 0);
    let decoded_first = decode_snapshot(&first.bytes).expect("first snapshot");
    apply_records(&mut client_state, &decoded_first.records);

    world.set_input(
        1,
        InputIntent {
            move_x: 1.0,
            ..InputIntent::default()
        },
    );
    world.step();
    let dropped = session.build(
        0,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(!dropped.full);
    assert_eq!(dropped.baseline_sequence, 0);

    world.step();
    let recovery = session.build(
        0,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(!recovery.full);
    assert_eq!(
        recovery.baseline_sequence, 0,
        "lost snapshot must not advance the acknowledged baseline"
    );
    let decoded_recovery = decode_snapshot(&recovery.bytes).expect("recovery snapshot");
    apply_records(&mut client_state, &decoded_recovery.records);
    let authoritative = WireEntity::from_fighter(world.fighter(1).expect("viewer"));
    let recovered = *client_state.get(&1).expect("recovered viewer");
    assert!(recovered.x.abs_diff(authoritative.x) <= 4);
    assert!(recovered.y.abs_diff(authoritative.y) <= 4);
    let recovered_without_position = WireEntity {
        x: authoritative.x,
        y: authoritative.y,
        ..recovered
    };
    assert_eq!(recovered_without_position, authoritative);

    let resync = session.build(
        500,
        world.tick,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(
        resync.full,
        "unknown acknowledgement must fail closed into a full resync"
    );
    assert_eq!(resync.baseline_sequence, u16::MAX);
}

#[test]
fn dense_512_player_snapshot_stays_within_one_datagram() {
    let mut world = World::default();
    for net_id in 1..=512 {
        assert!(world.add_player(net_id));
    }
    let mut session = SnapshotSession::default();
    let snapshot = session.build(
        u16::MAX,
        900,
        1,
        world.fighters(),
        CONSERVATIVE_DATAGRAM_BYTES,
    );
    assert!(snapshot.bytes.len() <= CONSERVATIVE_DATAGRAM_BYTES);
    assert!(
        snapshot.omitted_due_to_budget > 0,
        "dense full state should be priority-limited instead of fragmented"
    );
    let decoded = decode_snapshot(&snapshot.bytes).expect("bounded dense snapshot");
    assert!(
        decoded.records.iter().any(|record| record.net_id == 1),
        "owner state must survive pressure"
    );
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push(DIGITS[(byte >> 4) as usize] as char);
        result.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    result
}

#[test]
fn wilds_kick_knocks_down_unblocked_target_without_hp_damage() {
    let mut world = duel(54.0);
    advance(
        &mut world,
        170.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        82
    );
}

#[test]
fn wilds_blocked_kick_becomes_guard_pressure_without_stun() {
    let mut world = duel(54.0);
    let blocking = InputIntent {
        block: true,
        facing_radians: std::f32::consts::PI,
        ..InputIntent::default()
    };
    advance(&mut world, 150.0, InputIntent::default(), blocking);
    advance(
        &mut world,
        170.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        blocking,
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.hp.round() as u8, 100);
    assert_eq!(target.guard.round() as u8, 70);
    assert_eq!(target.action, Action::Block);
}

#[test]
fn wilds_roll_collision_knocks_target_down_and_costs_stamina() {
    let mut world = duel(44.0);
    let events = advance(
        &mut world,
        35.0,
        InputIntent {
            move_x: 1.0,
            facing_radians: 0.0,
            dodge: true,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert!(events
        .iter()
        .all(|event| !matches!(event, CombatEvent::Hit { .. })));
    assert_eq!(world.fighter(1).expect("roller").action, Action::Dodge);
    assert_eq!(world.fighter(1).expect("roller").stamina.round() as u8, 72);
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);
}

#[test]
fn wilds_roll_cannot_refresh_an_existing_knockdown() {
    let mut world = World::new(700.0, 500.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 244.0, 200.0, std::f32::consts::PI));
    assert!(world.add_player_at(3, 278.0, 250.0, -std::f32::consts::FRAC_PI_2));

    advance_three(
        &mut world,
        35.0,
        InputIntent {
            dodge: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);
    let elapsed_before_second_roll = world.fighter(2).expect("target").action_elapsed_ms;

    advance_three(
        &mut world,
        20.0,
        InputIntent::default(),
        InputIntent::default(),
        InputIntent {
            dodge: true,
            facing_radians: -std::f32::consts::FRAC_PI_2,
            ..InputIntent::default()
        },
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.action, Action::Knockdown);
    assert!(target.action_elapsed_ms > elapsed_before_second_roll);

    advance_three(
        &mut world,
        230.0,
        InputIntent::default(),
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Idle);
}

#[test]
fn wilds_kick_cannot_refresh_an_existing_knockdown() {
    let mut world = World::new(700.0, 400.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 254.0, 200.0, std::f32::consts::PI));
    assert!(world.add_player_at(3, 360.0, 200.0, std::f32::consts::PI));

    advance_three(
        &mut world,
        170.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);

    advance_three(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
        InputIntent {
            kick: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);

    advance_three(
        &mut world,
        125.0,
        InputIntent::default(),
        InputIntent::default(),
        InputIntent::default(),
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.action, Action::Idle);
    assert_eq!(target.hp.round() as u8, 100);
}

#[test]
fn wilds_light_punish_still_damages_a_knocked_down_fighter() {
    let mut world = World::new(700.0, 400.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 254.0, 200.0, std::f32::consts::PI));
    assert!(world.add_player_at(3, 360.0, 200.0, std::f32::consts::PI));

    advance_three(
        &mut world,
        170.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").action, Action::Knockdown);

    let events = advance_three(
        &mut world,
        225.0,
        InputIntent::default(),
        InputIntent::default(),
        InputIntent {
            attack: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let target = world.fighter(2).expect("target");
    assert_eq!(target.hp.round() as u8, 66);
    assert_eq!(target.action, Action::Knockdown);
    assert!(events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            attacker: 3,
            target: 2,
            damage: 34,
            ..
        }
    )));
}

#[test]
fn wilds_roll_direction_follows_pointer_facing_not_movement_input() {
    let mut world = World::new(800.0, 500.0);
    assert!(world.add_player_at(1, 300.0, 200.0, 0.0));
    let start = world.fighter(1).expect("roller").clone();
    advance(
        &mut world,
        50.0,
        InputIntent {
            move_x: -1.0,
            facing_radians: std::f32::consts::FRAC_PI_2,
            dodge: true,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let roller = world.fighter(1).expect("roller");
    assert!(roller.y > start.y);
    assert!((roller.x - start.x).abs() < 2.0);
}

#[test]
fn wilds_run_is_faster_and_drains_authoritative_stamina() {
    let mut world = World::new(800.0, 400.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    advance(
        &mut world,
        200.0,
        InputIntent {
            move_x: 1.0,
            run: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let runner = world.fighter(1).expect("runner");
    assert!(runner.x > 100.0 + 215.0 * 0.2);
    assert!(runner.stamina < 100.0);
}

#[test]
fn wilds_jump_converts_into_authoritative_jumping_attack() {
    let mut world = duel(60.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            jump: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Jump);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::JumpAttackWindup
    );
    let events = advance(
        &mut world,
        220.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert!(events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            damage: 42,
            hp: 58,
            ..
        }
    )));
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 58);
}

#[test]
fn simultaneous_jump_and_attack_edge_starts_authoritative_jump_attack() {
    let mut world = duel(60.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            jump: true,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::JumpAttackWindup
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        74
    );
}

#[test]
fn wilds_jump_attack_has_a_narrow_short_range_cone() {
    let mut far_world = duel(70.0);
    advance(
        &mut far_world,
        5.0,
        InputIntent {
            jump: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut far_world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut far_world,
        220.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        far_world.fighter(2).expect("far target").hp.round() as u8,
        100
    );

    let mut angled = World::new(600.0, 400.0);
    assert!(angled.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(angled.add_player_at(
        2,
        200.0 + (std::f32::consts::PI / 6.0).cos() * 60.0,
        200.0 + (std::f32::consts::PI / 6.0).sin() * 60.0,
        std::f32::consts::PI,
    ));
    advance(
        &mut angled,
        5.0,
        InputIntent {
            jump: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut angled,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut angled,
        220.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        angled.fighter(2).expect("angled target").hp.round() as u8,
        100
    );
}

#[test]
fn early_wheel_back_feints_light_into_authoritative_recovery() {
    let mut world = duel(60.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        40.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );

    advance(
        &mut world,
        5.0,
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::FeintRecovery);
    assert_eq!(attacker.stamina.round() as u8, 88);
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 100);

    advance(
        &mut world,
        290.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
}

#[test]
fn late_wheel_back_cannot_cancel_committed_heavy() {
    let mut world = duel(60.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            heavy_attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        185.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::HeavyAttackWindup
    );

    advance(
        &mut world,
        5.0,
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::HeavyAttackWindup);
    assert_eq!(attacker.stamina.round() as u8, 100);
}

#[test]
fn exhausted_attacker_cannot_feint() {
    let mut world = duel(60.0);
    advance(
        &mut world,
        3700.0,
        InputIntent {
            move_x: -1.0,
            run: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert!(world.fighter(1).expect("attacker").stamina < 12.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::AttackWindup);
    assert!(attacker.stamina < 12.0);
}

#[test]
fn wilds_parry_stun_preserves_a_comfortable_light_punish_window() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        110.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let parry = advance(
        &mut world,
        45.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert!(parry
        .iter()
        .any(|event| matches!(event, CombatEvent::Parry { .. })));
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Stunned);

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent {
            attack: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    let punish = advance(
        &mut world,
        220.0,
        InputIntent::default(),
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert!(punish.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            attacker: 2,
            target: 1,
            damage: 34,
            ..
        }
    )));
    assert_eq!(world.fighter(1).expect("attacker").hp.round() as u8, 66);
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Stunned);
}

#[test]
fn wilds_knockdown_is_distinct_from_parry_and_guard_break_stun() {
    let mut kick_world = duel(54.0);
    advance(
        &mut kick_world,
        170.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        kick_world.fighter(2).expect("kick target").action,
        Action::Knockdown
    );

    let mut parry_world = duel(72.0);
    advance(
        &mut parry_world,
        110.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut parry_world,
        45.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent {
            block: true,
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        },
    );
    assert_eq!(
        parry_world.fighter(1).expect("parried attacker").action,
        Action::Stunned
    );
}

#[test]
fn running_attack_converts_sprint_momentum_into_authoritative_pressure() {
    let mut world = duel(120.0);
    let events = advance(
        &mut world,
        270.0,
        InputIntent {
            move_x: 1.0,
            attack: true,
            run: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    let attacker = world.fighter(1).expect("attacker");
    let target = world.fighter(2).expect("target");
    assert!(attacker.x > 200.0);
    assert_eq!(attacker.stamina.round() as u8, 90);
    assert_eq!(target.hp.round() as u8, 70);
    assert!(events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            attacker: 1,
            target: 2,
            damage: 30,
            hp: 70,
        }
    )));
}

#[test]
fn running_attack_requires_meaningful_movement_and_uses_distinct_wire_states() {
    let mut world = duel(72.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            run: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );
    assert_eq!(Action::RunningAttackWindup.wire_code(), 21);
    assert_eq!(Action::RunningAttackActive.wire_code(), 22);
    assert_eq!(Action::RunningAttackRecovery.wire_code(), 23);
}

#[test]
fn directional_left_light_uses_shifted_authoritative_lane_without_damage_upgrade() {
    let angle = (-80.0_f32).to_radians();
    let mut world = World::new(600.0, 400.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(
        2,
        200.0 + angle.cos() * 70.0,
        200.0 + angle.sin() * 70.0,
        std::f32::consts::PI,
    ));

    advance(
        &mut world,
        5.0,
        InputIntent {
            move_y: -1.0,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackLeftWindup
    );

    let events = advance(
        &mut world,
        225.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 66);
    assert!(events.iter().any(|event| matches!(
        event,
        CombatEvent::Hit {
            attacker: 1,
            target: 2,
            damage: 34,
            hp: 66,
        }
    )));

    let mut neutral = World::new(600.0, 400.0);
    assert!(neutral.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(neutral.add_player_at(
        2,
        200.0 + angle.cos() * 70.0,
        200.0 + angle.sin() * 70.0,
        std::f32::consts::PI,
    ));
    advance(
        &mut neutral,
        230.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        neutral.fighter(2).expect("neutral target").hp.round() as u8,
        100
    );
}

#[test]
fn opposite_strafe_selects_right_directional_light_and_wire_states_are_distinct() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            move_y: 1.0,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRightWindup
    );
    assert_eq!(Action::AttackLeftWindup.wire_code(), 24);
    assert_eq!(Action::AttackLeftActive.wire_code(), 25);
    assert_eq!(Action::AttackLeftRecovery.wire_code(), 26);
    assert_eq!(Action::AttackRightWindup.wire_code(), 27);
    assert_eq!(Action::AttackRightActive.wire_code(), 28);
    assert_eq!(Action::AttackRightRecovery.wire_code(), 29);
}

#[test]
fn directional_light_uses_the_existing_early_feint_contract() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            move_y: -1.0,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackLeftWindup
    );
    advance(
        &mut world,
        30.0,
        InputIntent {
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            block: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::FeintRecovery
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        88
    );
}

#[test]
fn late_light_tap_buffers_through_full_authoritative_recovery() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );

    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );
}

#[test]
fn early_recovery_light_tap_is_not_buffered_authoritatively() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        150.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
}

#[test]
fn buffered_light_preserves_authoritative_directional_lane() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            move_y: -1.0,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackLeftWindup
    );
}

#[test]
fn late_fresh_block_buffers_through_authoritative_light_recovery() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let held_block = InputIntent {
        block: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_block, InputIntent::default());
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    advance(&mut world, 80.0, held_block, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Block);
}

#[test]
fn early_held_block_is_not_promoted_into_authoritative_recovery_parry() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let held_block = InputIntent {
        block: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_block, InputIntent::default());
    advance(&mut world, 150.0, held_block, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
}

#[test]
fn later_authoritative_block_overrides_buffered_light() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    let held_block = InputIntent {
        block: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_block, InputIntent::default());
    advance(&mut world, 70.0, held_block, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Block);
}

#[test]
fn late_authoritative_roll_buffers_through_recovery_and_preserves_direction() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let queued_roll = InputIntent {
        dodge: true,
        facing_radians: std::f32::consts::FRAC_PI_2,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, queued_roll, InputIntent::default());
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    let release = InputIntent {
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, release, InputIntent::default());
    advance(&mut world, 75.0, release, InputIntent::default());
    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::Dodge);
    assert_eq!(attacker.stamina.round() as u8, 72);
    let before_x = attacker.x;
    let before_y = attacker.y;

    advance(&mut world, 20.0, release, InputIntent::default());
    let attacker = world.fighter(1).expect("attacker");
    assert!((attacker.x - before_x).abs() < 0.01);
    assert!(attacker.y > before_y + 5.0);
}

#[test]
fn early_held_authoritative_roll_is_not_promoted_after_recovery() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let held_roll = InputIntent {
        dodge: true,
        facing_radians: std::f32::consts::FRAC_PI_2,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_roll, InputIntent::default());
    advance(&mut world, 150.0, held_roll, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(&mut world, 5.0, held_roll, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(&mut world, 5.0, held_roll, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Dodge);
}

#[test]
fn later_authoritative_roll_overrides_buffered_light() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            dodge: true,
            facing_radians: std::f32::consts::FRAC_PI_2,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        70.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Dodge);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        72
    );
}

#[test]
fn late_authoritative_jump_buffers_through_recovery_and_charges_on_execution() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    advance(
        &mut world,
        5.0,
        InputIntent {
            jump: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        75.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Jump);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        86
    );
}

#[test]
fn late_authoritative_jump_attack_chord_buffers_through_full_light_recovery() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    advance(
        &mut world,
        5.0,
        InputIntent {
            jump: true,
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        75.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::JumpAttackWindup
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        74
    );
}

#[test]
fn early_held_authoritative_jump_is_not_promoted_or_auto_repeated() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let held_jump = InputIntent {
        jump: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_jump, InputIntent::default());
    advance(&mut world, 150.0, held_jump, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(&mut world, 5.0, held_jump, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(&mut world, 5.0, held_jump, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Jump);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        86
    );
}

#[test]
fn later_authoritative_jump_overrides_buffered_light() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            jump: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        70.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Jump);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        86
    );
}

#[test]
fn late_authoritative_kick_buffers_through_recovery_and_charges_on_execution() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    advance(
        &mut world,
        5.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackRecovery
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        75.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::KickWindup
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        82
    );
}

#[test]
fn early_held_authoritative_kick_is_not_promoted_or_auto_repeated() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        100.0,
        InputIntent::default(),
        InputIntent::default(),
    );

    let held_kick = InputIntent {
        kick: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held_kick, InputIntent::default());
    advance(&mut world, 150.0, held_kick, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        100
    );

    advance(&mut world, 5.0, held_kick, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(&mut world, 5.0, held_kick, InputIntent::default());
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::KickWindup
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        82
    );
}

#[test]
fn later_authoritative_kick_overrides_buffered_light() {
    let mut world = duel(200.0);
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        130.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        80.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        170.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(
        &mut world,
        5.0,
        InputIntent {
            kick: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
        InputIntent::default(),
    );
    advance(
        &mut world,
        70.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::KickWindup
    );
    assert_eq!(
        world.fighter(1).expect("attacker").stamina.round() as u8,
        82
    );
}

#[test]
fn held_light_does_not_auto_chain_authoritatively() {
    let mut world = duel(200.0);
    let held = InputIntent {
        attack: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, held, InputIntent::default());
    advance(&mut world, 465.0, held, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);

    advance(&mut world, 5.0, held, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    advance(&mut world, 5.0, held, InputIntent::default());
    assert_eq!(
        world.fighter(1).expect("attacker").action,
        Action::AttackWindup
    );
}

#[test]
fn exhausted_dodge_edge_is_rejected_and_does_not_auto_fire_after_regeneration() {
    let mut world = duel(200.0);
    let run = InputIntent {
        move_x: -1.0,
        run: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 3100.0, run, InputIntent::default());
    assert!(world.fighter(1).expect("attacker").stamina < 28.0);

    let dodge = InputIntent {
        dodge: true,
        facing_radians: 0.0,
        ..InputIntent::default()
    };
    advance(&mut world, 5.0, dodge, InputIntent::default());
    assert_eq!(world.fighter(1).expect("attacker").action, Action::Idle);
    let rejected_at = world.fighter(1).expect("attacker").stamina;

    advance(&mut world, 1000.0, dodge, InputIntent::default());
    let regenerated = world.fighter(1).expect("attacker");
    assert_eq!(regenerated.action, Action::Idle);
    assert!(regenerated.stamina > 28.0);
    assert!(regenerated.stamina > rejected_at);

    advance(
        &mut world,
        5.0,
        InputIntent::default(),
        InputIntent::default(),
    );
    let before_retry = world.fighter(1).expect("attacker").stamina;
    advance(&mut world, 5.0, dodge, InputIntent::default());
    let attacker = world.fighter(1).expect("attacker");
    assert_eq!(attacker.action, Action::Dodge);
    assert!((attacker.stamina - (before_retry - 28.0)).abs() < 1.0);
}
