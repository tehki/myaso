use myaso_server::{
    prealpha_core8c_world_lease_review::{
        ReviewActorLease, ReviewEdgeStatus, ReviewLightWorldDispatch, ReviewOwnedWorld,
        ReviewWorldOwnerLease,
    },
    prealpha_lmb_gesture_proposal::{encode_event, GestureAction, GestureEvent},
    simulation::{Action, World},
};

#[test]
fn four_independent_world_slots_reuse_identical_gesture_ids_without_crossing_actors() {
    let mut world = World::default();
    for id in 1..=4 {
        assert!(world.add_player(id));
    }
    let mut owner = ReviewOwnedWorld::review_new(world).unwrap();
    let mut gates = (1..=4)
        .map(|id| {
            let actor =
                ReviewActorLease::review_from_server_values(id, 1, u64::from(id) + 100).unwrap();
            let gate = ReviewWorldOwnerLease::review_from_current_owner(&owner, actor).unwrap();
            (actor, gate)
        })
        .collect::<Vec<_>>();
    for (actor, gate) in &mut gates {
        for (sequence, action) in [(1, GestureAction::Press), (2, GestureAction::Release)] {
            let packet = encode_event(GestureEvent {
                action,
                sequence,
                gesture_id: 1,
                client_tick: 999,
            })
            .unwrap();
            assert_eq!(
                gate.review_ingest(&owner, *actor, &packet),
                ReviewEdgeStatus::Accepted(1)
            );
        }
    }
    for (actor, gate) in &mut gates {
        assert_eq!(
            owner.review_apply_one_lmb_light(gate, *actor),
            ReviewLightWorldDispatch::LightPressStaged { gesture_id: 1 }
        );
    }
    assert!(owner.review_step_events().is_empty());
    for id in 1..=4 {
        assert_eq!(
            owner.world().fighter(id).unwrap().action,
            Action::AttackWindup
        );
    }
}
