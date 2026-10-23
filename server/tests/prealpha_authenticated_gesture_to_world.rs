//! Exact source integration: admitted server lease -> typed 0x11 -> original
//! 60Hz Rust World, with no client-chosen actor, time or fabricated HIT.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4455;
const BOOT: u128 = 0x1122_3344_7788_99aa;
fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}
fn edge(source: GestureSource, action: GestureAction, seq: u32, gesture: u32) -> [u8; 16] {
    encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence: seq,
            gesture_id: gesture,
            client_tick: 777,
        },
    })
    .unwrap()
}
fn admit(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    lease: u64,
    source: GestureSource,
    action: GestureAction,
    seq: u32,
    gesture: u32,
) -> AckStatus {
    let packet = edge(source, action, seq, gesture);
    let ack = p.accept_under_world_lock(w, lease, BOOT, &packet).unwrap();
    assert_eq!(ack.sequence, seq);
    assert_eq!(ack.gesture_id, gesture);
    assert_eq!(ack.server_tick, w.tick);
    ack.status
}
fn advance(p: &mut SessionGestureWorldPath, w: &mut World, count: usize) -> Vec<(u8, u8)> {
    let mut hits = vec![];
    for _ in 0..count {
        for e in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = e
            {
                hits.push((damage, hp));
            }
        }
        p.advance_under_world_lock(w, LEASE, BOOT);
    }
    hits
}
#[test]
fn sub_30hz_press_release_same_tick_reaches_real_34hp_hit_exactly_once() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0); // WINDUP not immediate HIT
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}
#[test]
fn server_320ms_ready_waits_for_matching_release_real_46hp_only() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 4).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 33).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(46, 54)]);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn failed_new_actor_ownership_cannot_steal_prior_press_or_release() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            7
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE + 1,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            7
        ),
        AckStatus::Stale
    );
    assert!(p.retired());
    // New actor at the same numeric ID in the same tick has different life.
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            7
        ),
        AckStatus::Accepted
    );
    let life = p.binding().incarnation;
    assert!(w.remove_player(1));
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert_ne!(life, w.fighter(1).unwrap().world_incarnation());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            7
        ),
        AckStatus::Stale
    );
    assert!(p.retired());
}
#[test]
fn different_world_with_same_actor_ids_and_local_tick_cannot_replay() {
    let w1 = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w1, 1, LEASE, BOOT).unwrap();
    let mut w2 = arena();
    assert_eq!(w1.tick, w2.tick);
    assert_eq!(
        w1.fighter(1).unwrap().world_incarnation(),
        w2.fighter(1).unwrap().world_incarnation()
    );
    assert_ne!(w1.world_instance(), w2.world_instance());
    assert_eq!(
        admit(
            &mut p,
            &mut w2,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Stale
    );
    assert!(p.retired());
    assert_eq!(w2.fighter(2).unwrap().hp, 100.0);
}
#[test]
fn malformed_unnegotiated_keye_and_incompatible_052_do_not_generate_hits() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Rejected
    );
    let good = edge(GestureSource::Lmb, GestureAction::Press, 1, 1);
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &good[..15])
        .is_none());
    let mut wrong = good;
    wrong[1] = 0x52;
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &wrong)
        .is_none());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}
#[test]
fn first_press_loss_and_early_release_retransmit_still_hits_once() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // Actual sent PRESS #1 lost. Out-of-order RELEASE #2 cannot start a hit.
    assert!(
        p.accept_under_world_lock(
            &mut w,
            LEASE,
            BOOT,
            &edge(GestureSource::Lmb, GestureAction::Release, 2, 1),
        )
        .is_none(),
        "out-of-order release is unACKed until original press is retried"
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
}

#[test]
fn early_upgraded_release_returns_to_original_light_without_double_hit() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 4).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 7).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn late_upgrade_cannot_change_already_committed_light_or_authorize_heavy() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 9), vec![(34, 66)]);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Upgrade,
            2,
            1
        ),
        AckStatus::Rejected
    );
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(advance(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
}

#[test]
fn cancel_unlanded_press_causes_no_phantom_combat_hit() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Cancel,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn cloning_world_does_not_retain_old_owner_authorization() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    let mut cloned = w.clone();
    assert_ne!(cloned.world_instance(), w.world_instance());
    assert_eq!(
        admit(
            &mut p,
            &mut cloned,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Stale
    );
}

#[test]
fn completed_one_hit_gesture_retires_before_next_unique_press() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 32)]);
}

#[test]
fn second_gesture_release_overtakes_lost_press_without_retiring_sender_or_extra_hit() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();

    // The first fully completed legitimate light stays authoritative.
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // A new gesture #2 is allocated on the *same* admitted lease. PRESS
    // seq3 is lost/reordered; its 6ms RELEASE seq4 reaches the real World
    // first. A REJECTED ACK would retire Core8A's entire bounded sender.
    // Withhold that receipt until the genuine PRESS is replayed in order.
    assert!(
        p.accept_under_world_lock(
            &mut w,
            LEASE,
            BOOT,
            &edge(GestureSource::Lmb, GestureAction::Release, 4, 2),
        )
        .is_none(),
        "future gesture terminal must not receive a permanent rejected ACK before its PRESS"
    );
    assert!(!p.retired());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);

    // Once the first missing edge is genuinely readmitted, seq3 and seq4
    // produce the *second* original World light at normal server timing.
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 32)]);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Duplicate
    );
    assert!(advance(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn old_gesture_unrelated_terminal_is_rejected_without_resurrecting_completed_damage() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 66)]);
    // An unrecognized terminal against a *completed* ID is not an unseen
    // greater-ID PRESS awaiting recovery. Never restart the old light.
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Cancel,
            3,
            1
        ),
        AckStatus::Rejected
    );
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert!(advance(&mut p, &mut w, 55).is_empty());
}
