//! DORMANT cross-owner Core8C lease -> Combat4 authority -> genuine World hits.
use myaso_server::{
    prealpha_core8c_world_lease_review::{ReviewActorLease, ReviewEdgeStatus, ReviewWorldLease},
    prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority},
    prealpha_lmb_gesture_proposal::{encode_event, GestureAction, GestureEvent},
    simulation::{Action, CombatEvent, World},
};
const AUTH_EPOCH: u64 = 7822;
fn actor(gen: u64) -> ReviewActorLease {
    ReviewActorLease::review_from_server_values(1, gen, 912 + gen).unwrap()
}
fn event(kind: GestureAction, sequence: u32, id: u32) -> [u8; 16] {
    encode_event(GestureEvent {
        action: kind,
        sequence,
        gesture_id: id,
        client_tick: u32::MAX,
    })
    .unwrap()
}
struct Lab {
    world: World,
    identity: ReviewActorLease,
    lease: ReviewWorldLease,
    reducer: GestureAuthority,
    hits: Vec<u8>,
}
impl Lab {
    fn new() -> Self {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
        let identity = actor(1);
        let lease = ReviewWorldLease::review_from_admitted_world(&world, identity).unwrap();
        Self {
            world,
            identity,
            lease,
            reducer: GestureAuthority::new(AUTH_EPOCH),
            hits: vec![],
        }
    }
    fn admit(&mut self, kind: GestureAction, seq: u32) -> ReviewEdgeStatus {
        self.lease
            .review_ingest(&self.world, self.identity, &event(kind, seq, 1))
    }
    fn dispatch(&mut self) -> usize {
        let edges = self
            .lease
            .review_drain_for_world(&self.world, self.identity);
        let count = edges.len();
        for e in edges {
            let decision = self
                .reducer
                .process(AUTH_EPOCH, e, self.world.now_ms.round() as u64);
            assert_eq!(decision.disposition, Disposition::Accepted);
            if decision.command != Command::None {
                assert!(self
                    .world
                    .apply_review_only_lmb_gesture_command(1, decision.command));
            }
        }
        count
    }
    fn tick(&mut self) {
        for e in self.world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                ..
            } = e
            {
                self.hits.push(damage);
            }
        }
        if self.lease.observe_world_tick(&self.world) {
            if let Some(cmd) = self
                .reducer
                .advance(AUTH_EPOCH, self.world.now_ms.round() as u64)
            {
                assert!(self.world.apply_review_only_lmb_gesture_command(1, cmd));
            }
        }
    }
    fn ticks(&mut self, n: usize) {
        for _ in 0..n {
            self.tick();
        }
    }
}

#[test]
fn lease_accepted_instant_down_up_creates_one_authoritative_world_light() {
    let mut l = Lab::new();
    assert_eq!(
        l.admit(GestureAction::Press, 1),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(
        l.admit(GestureAction::Release, 2),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 2);
    assert_eq!(l.world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(l.world.fighter(2).unwrap().hp, 100.0);
    l.ticks(46);
    assert_eq!(l.hits, vec![34]);
    assert_eq!(l.world.fighter(2).unwrap().hp, 66.0);
    assert_eq!(
        l.admit(GestureAction::Release, 2),
        ReviewEdgeStatus::Duplicate
    );
    assert_eq!(l.dispatch(), 0);
}
#[test]
fn lease_accepted_held_upgrade_waits_ready_until_release_for_one_real_heavy() {
    let mut l = Lab::new();
    assert_eq!(
        l.admit(GestureAction::Press, 1),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 1);
    l.ticks(4);
    assert_eq!(
        l.admit(GestureAction::Upgrade, 2),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 1);
    l.ticks(31);
    assert!(l.hits.is_empty());
    assert_eq!(
        l.world.fighter(1).unwrap().action,
        Action::HeavyAttackWindup
    );
    assert_eq!(l.world.fighter(1).unwrap().action_elapsed_ms, 320.0);
    assert_eq!(
        l.admit(GestureAction::Release, 3),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 1);
    l.ticks(50);
    assert_eq!(l.hits, vec![46]);
    assert_eq!(l.world.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn removed_and_rejoined_actor_old_queued_release_cannot_strike() {
    let mut l = Lab::new();
    assert_eq!(
        l.admit(GestureAction::Press, 1),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 1);
    l.ticks(4);
    assert_eq!(
        l.admit(GestureAction::Upgrade, 2),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.dispatch(), 1);
    l.ticks(30);
    assert!(l.hits.is_empty());
    // Core8C must be informed of the replacement under authoritative lock.
    l.lease.retire();
    assert!(l.world.remove_player(1));
    assert!(l.world.add_player_at(1, 250.0, 300.0, 0.0));
    assert_eq!(
        l.admit(GestureAction::Release, 3),
        ReviewEdgeStatus::Retired
    );
    assert_eq!(l.dispatch(), 0);
    assert_eq!(l.world.fighter(1).unwrap().action, Action::Idle);
    assert!(!l
        .world
        .apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    l.ticks(40);
    assert!(l.hits.is_empty());
    assert_eq!(l.world.fighter(2).unwrap().hp, 100.0);
}
#[test]
fn skipped_world_tick_retires_queued_press_without_forging_light() {
    let mut l = Lab::new();
    assert_eq!(
        l.admit(GestureAction::Press, 1),
        ReviewEdgeStatus::Accepted(1)
    );
    assert_eq!(l.lease.pending_count(), 1);
    l.world.step();
    l.world.step();
    assert!(!l.lease.observe_world_tick(&l.world));
    assert!(l.lease.is_retired());
    assert_eq!(l.dispatch(), 0);
    assert_eq!(l.lease.pending_count(), 0);
    assert_eq!(l.world.fighter(1).unwrap().action, Action::Idle);
    l.ticks(40);
    assert!(l.hits.is_empty());
}
#[test]
fn wrong_actor_generation_cannot_drive_review_world_or_damage() {
    let mut l = Lab::new();
    assert_eq!(
        l.lease
            .review_ingest(&l.world, actor(2), &event(GestureAction::Press, 1, 1)),
        ReviewEdgeStatus::Stale
    );
    assert!(l
        .lease
        .review_drain_for_world(&l.world, actor(2))
        .is_empty());
    assert_eq!(l.dispatch(), 0);
    l.ticks(40);
    assert!(l.hits.is_empty());
    assert_eq!(l.world.fighter(2).unwrap().hp, 100.0);
}
