//! Core 8C dormant actor-generation/tick-fence acceptance using the real
//! original Rust World and the original Core8A/Combat4 0x11 EVENT codec.
//! No production server route, HP writer, transport ACK sender or feature flag.
use myaso_server::{
    prealpha_core8c_world_lease_review::{ReviewActorLease, ReviewEdgeStatus, ReviewWorldLease},
    prealpha_lmb_gesture_proposal::{encode_event, GestureAction, GestureEvent, BYTES},
    simulation::{Action, CombatEvent, InputIntent, World},
};

fn lease(actor: u32, generation: u64, nonce: u64) -> ReviewActorLease {
    ReviewActorLease::review_from_server_values(actor, generation, nonce)
        .expect("valid nonzero fixture")
}

fn wire(action: GestureAction, sequence: u32, gesture_id: u32) -> [u8; BYTES] {
    encode_event(GestureEvent {
        action,
        sequence,
        gesture_id,
        client_tick: 42,
    })
    .expect("real original Combat-owned v2 event codec")
}

fn world_with_players(count: u32) -> World {
    let mut world = World::default();
    for actor in 1..=count {
        assert!(world.add_player(actor));
    }
    world
}

#[test]
fn same_tick_short_tap_preserves_two_intents_and_duplicate_never_dispatches_twice() {
    let world = world_with_players(2);
    let owner = lease(1, 10, 100);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    let press = wire(GestureAction::Press, 1, 77);
    let release = wire(GestureAction::Release, 2, 77);
    assert_eq!(
        adapter.review_ingest(&world, owner, &press),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(
        adapter.review_ingest(&world, owner, &release),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(
        adapter.review_ingest(&world, owner, &release),
        ReviewEdgeStatus::Duplicate
    );
    let applied = adapter.review_drain_for_world(&world, owner);
    assert_eq!(applied.len(), 2);
    assert_eq!(applied[0].action, GestureAction::Press);
    assert_eq!(applied[1].action, GestureAction::Release);
    assert_eq!(applied[0].gesture_id, applied[1].gesture_id);
    assert_eq!(adapter.pending_count(), 0);
    // These are intent edges only: original real World has no imaginary hit.
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn missing_prefix_buffers_release_but_never_dispatches_or_claims_accepted() {
    let world = world_with_players(2);
    let owner = lease(1, 2, 100);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Release, 2, 7)),
        ReviewEdgeStatus::Deferred
    );
    assert!(adapter.review_drain_for_world(&world, owner).is_empty());
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Press, 1, 7)),
        ReviewEdgeStatus::Accepted(2)
    );
    let restored = adapter.review_drain_for_world(&world, owner);
    assert_eq!(restored.len(), 2);
    assert_eq!(restored[0].sequence, 1);
    assert_eq!(restored[1].sequence, 2);
}

#[test]
fn foreign_connection_and_actor_generation_cannot_retarget_existing_world_fighter() {
    let world = world_with_players(2);
    let owner = lease(1, 5, 44);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    for attacker in [lease(2, 5, 44), lease(1, 6, 44), lease(1, 5, 45)] {
        assert_eq!(
            adapter.review_ingest(&world, attacker, &wire(GestureAction::Press, 1, 1)),
            ReviewEdgeStatus::Stale
        );
        assert!(adapter.review_drain_for_world(&world, attacker).is_empty());
    }
    assert_eq!(adapter.pending_count(), 0);
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(adapter.review_drain_for_world(&world, owner).len(), 1);
}

#[test]
fn server_disconnect_retirement_clears_pending_and_reused_actor_id_stays_fenced() {
    let mut world = world_with_players(2);
    let original = lease(1, 3, 321);
    let mut old = ReviewWorldLease::review_from_admitted_world(&world, original).unwrap();
    assert_eq!(
        old.review_ingest(&world, original, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    old.retire();
    assert!(world.remove_player(1));
    assert!(world.add_player(1));
    assert_eq!(
        old.review_ingest(&world, original, &wire(GestureAction::Release, 2, 1)),
        ReviewEdgeStatus::Retired
    );
    assert!(old.review_drain_for_world(&world, original).is_empty());
    let rejoined = lease(1, 4, 322);
    let mut new = ReviewWorldLease::review_from_admitted_world(&world, rejoined).unwrap();
    assert_eq!(
        new.review_ingest(&world, rejoined, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(new.review_drain_for_world(&world, rejoined).len(), 1);
}

#[test]
fn missed_disconnect_cleanup_is_observed_from_real_world_membership() {
    let mut world = world_with_players(2);
    let owner = lease(2, 3, 98);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    assert!(world.remove_player(2));
    assert!(!adapter.observe_world_tick(&world));
    assert!(adapter.is_retired());
    assert_eq!(adapter.pending_count(), 0);
    assert!(world.add_player(2));
    assert!(adapter.review_drain_for_world(&world, owner).is_empty());
}

#[test]
fn skipped_world_tick_must_retire_instead_of_missing_death_respawn() {
    let mut world = world_with_players(1);
    let owner = lease(1, 7, 2);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    world.step();
    world.step();
    assert!(!adapter.observe_world_tick(&world));
    assert!(adapter.is_retired());
    assert!(adapter.review_drain_for_world(&world, owner).is_empty());
}

#[test]
fn four_real_world_actor_ids_remain_independently_bound_across_one_simulation_tick() {
    let mut world = world_with_players(4);
    let mut adapters = (1..=4)
        .map(|actor| {
            let l = lease(actor, 1, actor as u64 + 100);
            (
                l,
                ReviewWorldLease::review_from_admitted_world(&world, l).unwrap(),
            )
        })
        .collect::<Vec<_>>();
    let distinct_spawns = world.fighters().iter().map(|f| f.x).collect::<Vec<_>>();
    assert!(distinct_spawns.windows(2).all(|pair| pair[0] != pair[1]));
    world.step();
    for (owner, gate) in &mut adapters {
        assert!(gate.observe_world_tick(&world));
        assert_eq!(
            gate.review_ingest(&world, *owner, &wire(GestureAction::Press, 1, 1)),
            ReviewEdgeStatus::Accepted(1)
        );
        let edges = gate.review_drain_for_world(&world, *owner);
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].action, GestureAction::Press);
    }
    assert_eq!(world.fighters().len(), 4);
}

#[test]
fn bounded_unconsumed_world_queue_retires_and_drops_all_intents() {
    let world = world_with_players(1);
    let owner = lease(1, 1, 1);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
    for gesture_id in 1..=8_u32 {
        let seq = gesture_id * 2 - 1;
        assert_eq!(
            adapter.review_ingest(&world, owner, &wire(GestureAction::Press, seq, gesture_id)),
            ReviewEdgeStatus::Accepted(1)
        );
        assert_eq!(
            adapter.review_ingest(
                &world,
                owner,
                &wire(GestureAction::Release, seq + 1, gesture_id)
            ),
            ReviewEdgeStatus::Accepted(1)
        );
    }
    assert_eq!(adapter.pending_count(), 16);
    assert_eq!(
        adapter.review_ingest(&world, owner, &wire(GestureAction::Press, 17, 9)),
        ReviewEdgeStatus::Retired
    );
    assert!(adapter.is_retired());
    assert_eq!(adapter.pending_count(), 0);
}

#[test]
fn incompatible_core8c_old_packet_type_and_v1_are_rejected_not_routed() {
    let world = world_with_players(1);
    let owner = lease(1, 9, 9);
    for version_or_type in [(1_u8, 0x11_u8), (2_u8, 0x52_u8)] {
        let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, owner).unwrap();
        let mut bytes = wire(GestureAction::Press, 1, 1);
        bytes[0] = version_or_type.0;
        bytes[1] = version_or_type.1;
        assert_eq!(
            adapter.review_ingest(&world, owner, &bytes),
            ReviewEdgeStatus::Rejected
        );
        assert!(adapter.review_drain_for_world(&world, owner).is_empty());
        assert!(adapter.is_retired());
    }
}

#[test]
fn server_world_death_event_retires_victims_gesture_before_followup_release() {
    let mut world = World::new(700.0, 500.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 240.0, 200.0, 0.0));
    let victim = lease(2, 1, 222);
    let mut adapter = ReviewWorldLease::review_from_admitted_world(&world, victim).unwrap();
    assert_eq!(
        adapter.review_ingest(&world, victim, &wire(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    let mut death_seen = false;
    for _ in 0..4 {
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                ..InputIntent::default()
            }
        ));
        for _ in 0..36 {
            let events = world.step();
            adapter.observe_world_tick(&world);
            if events.iter().any(|event| {
                matches!(
                    event,
                    CombatEvent::Death {
                        fighter: 2,
                        killer: 1
                    }
                )
            }) {
                death_seen = true;
                break;
            }
        }
        if death_seen {
            break;
        }
        assert!(world.set_input(1, InputIntent::default()));
        world.step();
        adapter.observe_world_tick(&world);
    }
    assert!(
        death_seen,
        "real combat must defeat the actual World fighter"
    );
    assert_eq!(world.fighter(2).unwrap().action, Action::Dead);
    assert!(adapter.is_retired());
    assert_eq!(adapter.pending_count(), 0);
    assert_eq!(
        adapter.review_ingest(&world, victim, &wire(GestureAction::Release, 2, 1)),
        ReviewEdgeStatus::Retired
    );
}
