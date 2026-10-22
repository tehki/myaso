//! DORMANT Cross-owner v2 review: exact Core8A ingress source ordering ->
//! Combat4 server-time reducer -> actual original World HP/HIT. No QUIC
//! authentication or production runtime attachment. Test lease is local ONLY.
use myaso_server::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority};
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_ack, encode_event, AckStatus, GestureAction, GestureEvent,
};
use myaso_server::prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey};
use myaso_server::simulation::{Action, CombatEvent, World};

const EPOCH: u64 = 0x0102_3344;
fn admitted(actor: u32, generation: u64, nonce: u64) -> TrustedLeaseKey {
    TrustedLeaseKey::review_from_admission(actor, generation, nonce).expect("nonzero fixture lease")
}
fn wire(action: GestureAction, sequence: u32, gesture_id: u32, tick: u32) -> [u8; 16] {
    encode_event(GestureEvent {
        action,
        sequence,
        gesture_id,
        client_tick: tick,
    })
    .expect("original Combat owned v2 event bytes")
}
struct Lab {
    world: World,
    ingress: ReviewLmbIngress,
    reducer: GestureAuthority,
    lease: TrustedLeaseKey,
    hits: Vec<(u8, u8)>,
    acked: Vec<[u8; 16]>,
}
impl Lab {
    fn new() -> Self {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
        let lease = admitted(1, 42, 77);
        Self {
            world,
            lease,
            ingress: ReviewLmbIngress::new_from_trusted_admission(lease),
            reducer: GestureAuthority::new(EPOCH),
            hits: vec![],
            acked: vec![],
        }
    }
    fn submit(&mut self, bytes: &[u8]) -> IngressResult {
        let server_tick = self.world.tick;
        let decision = self.ingress.review_ingest(self.lease, bytes, server_tick);
        if let IngressResult::Accepted(edges) = &decision {
            for edge in edges {
                // Receipt correlates to the authenticated-test lease and
                // original exact bytes; ACK alone is never an attack hit.
                assert_eq!(edge.ack.status, AckStatus::Accepted);
                let receipt = encode_ack(edge.ack).unwrap();
                assert_eq!(&receipt[0..2], &[2, 0x12]);
                self.acked.push(receipt);
                let applied =
                    self.reducer
                        .process(EPOCH, edge.event, self.world.now_ms.round() as u64);
                assert_eq!(applied.disposition, Disposition::Accepted);
                if !matches!(applied.command, Command::None) {
                    assert!(
                        self.world
                            .apply_review_only_lmb_gesture_command(1, applied.command),
                        "real World rejected authoritative {:?} at {}ms",
                        applied.command,
                        self.world.now_ms
                    );
                }
            }
        }
        decision
    }
    fn tick(&mut self) {
        for event in self.world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                self.hits.push((damage, hp));
            }
        }
        if let Some(cmd) = self
            .reducer
            .advance(EPOCH, self.world.now_ms.round() as u64)
        {
            assert!(self.world.apply_review_only_lmb_gesture_command(1, cmd));
        }
    }
    fn advance(&mut self, ticks: usize) {
        for _ in 0..ticks {
            self.tick();
        }
    }
}

#[test]
fn genuine_core8a_missing_prefix_defers_without_ack_then_dispatches_quick_tap_one_light() {
    let mut lab = Lab::new();
    // Real stream can reorder: downstream never invents a PRESS from RELEASE.
    assert_eq!(
        lab.submit(&wire(GestureAction::Release, 2, 1, 42)),
        IngressResult::Deferred
    );
    assert!(lab.acked.is_empty());
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::Idle);
    assert!(matches!(
        lab.submit(&wire(GestureAction::Press,1,1,42)),
        IngressResult::Accepted(e) if e.len()==2 &&
            e[0].event.action==GestureAction::Press &&
            e[1].event.action==GestureAction::Release
    ));
    assert_eq!(lab.acked.len(), 2);
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(
        lab.world.fighter(2).unwrap().hp,
        100.0,
        "transport ACK is never a HIT"
    );
    lab.advance(45);
    assert_eq!(lab.hits, vec![(34, 66)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn exact_320ms_held_upgrade_enters_real_ready_no_early_hp_then_one_heavy() {
    let mut lab = Lab::new();
    assert!(matches!(
        lab.submit(&wire(GestureAction::Press, 1, 1, 42)),
        IngressResult::Accepted(_)
    ));
    lab.advance(5); // ~83 original World ms before 135ms light commitment
    assert!(matches!(
        lab.submit(&wire(GestureAction::Upgrade, 2, 1, 43)),
        IngressResult::Accepted(_)
    ));
    lab.advance(30); // beyond 320 READY, not auto-hit
    assert!(lab.hits.is_empty());
    assert_eq!(
        lab.world.fighter(1).unwrap().action,
        Action::HeavyAttackWindup
    );
    assert_eq!(lab.world.fighter(1).unwrap().action_elapsed_ms, 320.0);
    assert!(matches!(
        lab.submit(&wire(GestureAction::Release, 3, 1, 63)),
        IngressResult::Accepted(_)
    ));
    assert_eq!(lab.acked.len(), 3);
    assert_eq!(
        lab.world.fighter(2).unwrap().hp,
        100.0,
        "ACK never grants damage"
    );
    lab.advance(50);
    assert_eq!(lab.hits, vec![(46, 54)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 54.0);
    assert!(matches!(
        lab.submit(&wire(GestureAction::Release,3,1,63)),
        IngressResult::Duplicate(a) if a.status==AckStatus::Duplicate
    ));
    lab.advance(20);
    assert_eq!(lab.hits.len(), 1);
}

#[test]
fn all_heavy_events_arriving_as_delayed_contiguous_batch_cannot_fake_320ms_charge() {
    let mut lab = Lab::new();
    assert_eq!(
        lab.submit(&wire(GestureAction::Upgrade, 2, 1, 43)),
        IngressResult::Deferred
    );
    assert_eq!(
        lab.submit(&wire(GestureAction::Release, 3, 1, u32::MAX)),
        IngressResult::Deferred
    );
    assert_eq!(lab.acked.len(), 0);
    assert!(matches!(lab.submit(&wire(GestureAction::Press,1,1,42)),
        IngressResult::Accepted(e) if e.len()==3));
    assert_eq!(lab.acked.len(), 3);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
    lab.advance(42);
    assert_eq!(
        lab.hits,
        vec![(34, 66)],
        "late complete batch resolves original single light, NEVER claimed heavy"
    );
}

#[test]
fn wrong_lease_and_incompatible_wire_cannot_drive_original_world() {
    let mut lab = Lab::new();
    let old = admitted(1, 41, 76);
    assert!(matches!(
        lab.ingress.review_ingest(old,&wire(GestureAction::Press,1,1,0),0),
        IngressResult::Stale(a) if a.status==AckStatus::Stale
    ));
    let core8c_tentative = [2, 0x52, 2, 0, 8, 7, 6, 5, 4, 3, 2, 1, 9, 0, 0, 0];
    assert!(matches!(
        lab.submit(&core8c_tentative),
        IngressResult::Rejected(None)
    ));
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
    assert!(lab.ingress.is_closed());
}

#[test]
fn duplicate_ack_is_not_a_second_hit_and_mutated_replay_closes_before_world_dispatch() {
    let mut lab = Lab::new();
    let press = wire(GestureAction::Press, 1, 1, 42);
    assert!(matches!(lab.submit(&press), IngressResult::Accepted(_)));
    assert!(matches!(lab.submit(&press),IngressResult::Duplicate(a)
        if a.status==AckStatus::Duplicate));
    let mutated = wire(GestureAction::Press, 1, 1, 999);
    assert!(
        matches!(lab.submit(&mutated),IngressResult::Rejected(Some(a))
        if a.status==AckStatus::Rejected)
    );
    assert!(lab.ingress.is_closed());
    lab.advance(55);
    assert_eq!(lab.hits, vec![(34, 66)]);
    assert_eq!(lab.world.fighter(2).unwrap().hp, 66.0);
}
#[test]
fn generation_change_prevents_held_heavy_release_after_actor_rejoin() {
    let mut lab = Lab::new();
    assert!(matches!(
        lab.submit(&wire(GestureAction::Press, 1, 1, 0)),
        IngressResult::Accepted(_)
    ));
    lab.advance(5);
    assert!(matches!(
        lab.submit(&wire(GestureAction::Upgrade, 2, 1, 0)),
        IngressResult::Accepted(_)
    ));
    lab.advance(30);
    assert!(lab.world.remove_player(1));
    assert!(lab.world.add_player_at(1, 250.0, 300.0, 0.0));
    let old = lab.lease;
    lab.lease = admitted(1, 43, 78);
    assert!(matches!(lab.submit(&wire(GestureAction::Release,3,1,999)),
        IngressResult::Stale(a) if a.status==AckStatus::Stale));
    assert_eq!(lab.acked.len(), 2);
    assert!(!lab
        .world
        .apply_review_only_lmb_gesture_command(1, Command::ReleaseHeavy));
    assert_eq!(lab.world.fighter(1).unwrap().action, Action::Idle);
    assert_ne!(old, lab.lease);
    lab.advance(50);
    assert!(lab.hits.is_empty());
    assert_eq!(lab.world.fighter(2).unwrap().hp, 100.0);
}
