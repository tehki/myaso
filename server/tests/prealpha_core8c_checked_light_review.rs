use myaso_server::{
    prealpha_core8c_world_lease_review::{
        ReviewActorLease, ReviewEdgeStatus, ReviewLightWorldDispatch, ReviewOwnedWorld,
        ReviewWorldOwnerLease,
    },
    prealpha_lmb_gesture_proposal::{encode_event, GestureAction, GestureEvent},
    simulation::World,
};

fn edge(action: GestureAction, sequence: u32) -> [u8; 16] {
    encode_event(GestureEvent {
        action,
        sequence,
        gesture_id: 7,
        client_tick: u32::MAX,
    })
    .unwrap()
}

#[test]
fn verified_short_tap_changes_only_the_matching_original_world_actor() {
    let mut world = World::new(700.0, 500.0);
    assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
    assert!(world.add_player_at(2, 245.0, 200.0, 0.0));
    let mut owner = ReviewOwnedWorld::review_new(world).unwrap();
    let actor = ReviewActorLease::review_from_server_values(1, 1, 10).unwrap();
    let mut gate = ReviewWorldOwnerLease::review_from_current_owner(&owner, actor).unwrap();
    for (sequence, action) in [(1, GestureAction::Press), (2, GestureAction::Release)] {
        assert_eq!(
            gate.review_ingest(&owner, actor, &edge(action, sequence)),
            ReviewEdgeStatus::Accepted(1)
        );
    }
    assert_eq!(
        owner.review_apply_one_lmb_light(&mut gate, actor),
        ReviewLightWorldDispatch::LightPressStaged { gesture_id: 7 }
    );
    for _ in 0..55 {
        let _ = owner.review_step_events();
    }
    assert_eq!(owner.world().fighter(2).unwrap().hp, 66.0);
    assert_eq!(owner.world().fighter(1).unwrap().hp, 100.0);
}

#[test]
fn stale_ownership_cannot_apply_queued_gesture_to_replacement() {
    let mut world = World::default();
    assert!(world.add_player(1));
    let mut owner = ReviewOwnedWorld::review_new(world).unwrap();
    let actor = ReviewActorLease::review_from_server_values(1, 1, 10).unwrap();
    let mut gate = ReviewWorldOwnerLease::review_from_current_owner(&owner, actor).unwrap();
    assert_eq!(
        gate.review_ingest(&owner, actor, &edge(GestureAction::Press, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    let mut replacement = World::default();
    assert!(replacement.add_player(1));
    assert!(owner.review_replace_world(replacement));
    assert_eq!(
        owner.review_apply_one_lmb_light(&mut gate, actor),
        ReviewLightWorldDispatch::Retired
    );
    assert!(!owner.world().fighter(1).unwrap().input().attack);
}

#[test]
fn canceled_same_tick_gesture_cannot_stage_an_unintended_attack() {
    let mut world = World::default();
    assert!(world.add_player(1));
    assert!(world.add_player(2));
    let mut owner = ReviewOwnedWorld::review_new(world).unwrap();
    let actor = ReviewActorLease::review_from_server_values(1, 2, 99).unwrap();
    let mut gate = ReviewWorldOwnerLease::review_from_current_owner(&owner, actor).unwrap();
    assert_eq!(
        gate.review_ingest(&owner, actor, &edge(GestureAction::Press, 1)),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(
        gate.review_ingest(&owner, actor, &edge(GestureAction::Cancel, 2)),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(
        owner.review_apply_one_lmb_light(&mut gate, actor),
        ReviewLightWorldDispatch::RejectedAndRetired
    );
    assert!(gate.is_retired());
    assert!(owner.review_step_events().is_empty());
    assert_eq!(owner.world().fighter(1).unwrap().hp, 100.0);
    assert!(!owner.world().fighter(1).unwrap().input().attack);
}
