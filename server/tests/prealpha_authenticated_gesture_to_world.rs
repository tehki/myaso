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
fn malformed_source_and_incompatible_052_do_not_generate_hits() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    let good = edge(GestureSource::Lmb, GestureAction::Press, 1, 1);
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &good[..15])
        .is_none());
    let mut invalid_source = good;
    invalid_source[3] = 9;
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &invalid_source)
        .is_none());
    let mut wrong = good;
    wrong[1] = 0x52;
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &wrong)
        .is_none());
    assert!(
        myaso_server::prealpha_lmb_gesture_proposal::encode_typed_event(TypedGestureEvent {
            source: GestureSource::KeyE,
            event: GestureEvent {
                action: GestureAction::Upgrade,
                sequence: 1,
                gesture_id: 1,
                client_tick: 777
            }
        })
        .is_err()
    );
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
fn independent_keye_hold_ready_and_release_commits_one_original_46hp_hit() {
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
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert!(advance(&mut p, &mut w, 37).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(
        w.fighter(2).unwrap().hp,
        100.0,
        "KeyE held past 320ms must never auto-hit"
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            2,
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
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Duplicate
    );
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
#[test]
fn undercharged_keye_release_and_cancel_never_fabricate_light_or_heavy() {
    for terminal in [GestureAction::Release, GestureAction::Cancel] {
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
            AckStatus::Accepted
        );
        assert!(advance(&mut p, &mut w, 4).is_empty());
        assert_eq!(
            admit(&mut p, &mut w, LEASE, GestureSource::KeyE, terminal, 2, 1),
            AckStatus::Accepted
        );
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
        assert!(advance(&mut p, &mut w, 55).is_empty());
        assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    }
    // A standalone KeyE charge cannot be auto-committed after reaching READY.
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
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 32).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
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
fn cross_source_release_cancel_and_replay_cannot_mutate_other_sources_world() {
    for original in [GestureSource::Lmb, GestureSource::KeyE] {
        let other = if original == GestureSource::Lmb {
            GestureSource::KeyE
        } else {
            GestureSource::Lmb
        };
        let mut w = arena();
        let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
        assert_eq!(
            admit(&mut p, &mut w, LEASE, original, GestureAction::Press, 1, 1),
            AckStatus::Accepted
        );
        let before = w.fighter(1).unwrap().action;
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Release, 2, 1),
            AckStatus::Rejected
        );
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Cancel, 2, 1),
            AckStatus::Rejected
        );
        // A genuine independent source2 gesture with its own monotonic
        // identity cannot make World do a second attack. Its ordered edge is
        // admitted as NO-COMBAT, never as a forged terminal or a HIT.
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Press, 2, 2),
            AckStatus::Accepted
        );
        assert_eq!(w.fighter(1).unwrap().action, before);
        assert_eq!(w.fighter(2).unwrap().hp, 100.0);
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Press, 2, 2),
            AckStatus::Duplicate
        );
        assert_eq!(
            admit(&mut p, &mut w, LEASE, original, GestureAction::Press, 1, 1),
            AckStatus::Duplicate
        );
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Press, 1, 1),
            AckStatus::Rejected,
            "same seq/id with different typed source must not duplicate"
        );
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                original,
                GestureAction::Release,
                3,
                1
            ),
            AckStatus::Accepted,
            "busy source must not strand original attack terminal"
        );
        assert_eq!(
            admit(&mut p, &mut w, LEASE, other, GestureAction::Release, 4, 2),
            AckStatus::Accepted,
            "busy-source terminal is transport-admitted but never World damage"
        );
        assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    }
}
#[test]
fn one_shared_source_sequence_allows_lmb_hit_then_later_independent_keye_hit() {
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
            GestureSource::KeyE,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 36).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(46, 20)]);
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

#[test]
fn future_keye_press_cannot_overtake_lost_lmb_press_across_one_lease_sequence() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // A later valid source1 event arrived first with global seq3.
    // One outbox must retry missing source0 seq1+2 before granting it.
    let future = edge(GestureSource::KeyE, GestureAction::Press, 3, 2);
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &future)
        .is_none());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
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
            GestureSource::KeyE,
            GestureAction::Press,
            3,
            2
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 36).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(46, 20)]);
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}
#[test]
fn future_lmb_press_cannot_overtake_missing_keye_press_or_terminal() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    let future = edge(GestureSource::Lmb, GestureAction::Press, 3, 2);
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &future)
        .is_none());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
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
        AckStatus::Accepted
    );
    assert!(advance(&mut p, &mut w, 36).is_empty());
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(advance(&mut p, &mut w, 55), vec![(46, 54)]);
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
    assert_eq!(advance(&mut p, &mut w, 55), vec![(34, 20)]);
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}

fn assert_fresh_source1_release_only_heavy(world: &mut World, lease: u64) {
    let mut current = SessionGestureWorldPath::from_admitted_world(world, 1, lease, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut current,
            world,
            lease,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    // This is the Main-selected contract, NOT the incompatible auto-KeyE
    // branch: the actual server World advances beyond 320ms with ZERO hits.
    let mut hits = Vec::new();
    for _ in 0..37 {
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
            }
        }
        current.advance_under_world_lock(world, lease, BOOT);
    }
    assert!(hits.is_empty(), "held KeyE must not auto-hit after READY");
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        admit(
            &mut current,
            world,
            lease,
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );

    for _ in 0..55 {
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
            }
        }
        current.advance_under_world_lock(world, lease, BOOT);
    }
    assert_eq!(hits, vec![(46, 54)], "exactly one legitimate release hit");
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn release_only_keye_same_tick_actor_reuse_fences_stale_terminal_and_fresh_hit() {
    let mut world = arena();
    let mut former = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    let initial_incarnation = former.binding().incarnation;
    let initial_world = world.world_instance();
    assert_eq!(
        admit(
            &mut former,
            &mut world,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    // Same tick, same numeric actor, SAME World, but new actor incarnation.
    assert!(world.remove_player(1));
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert_eq!(world.world_instance(), initial_world);
    assert_ne!(
        world.fighter(1).unwrap().world_incarnation(),
        initial_incarnation
    );
    assert_eq!(
        admit(
            &mut former,
            &mut world,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Stale,
        "prior held release cannot strike a replacement actor"
    );
    assert!(former.retired());
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    // Only a new explicitly admitted lease may restart the exact source1
    // gesture ID namespace and obtain the 320ms READY + RELEASE World hit.
    assert_fresh_source1_release_only_heavy(&mut world, LEASE + 1);
    assert!(former.retired(), "old lease cannot resurrect after new hit");
}

#[test]
fn release_only_keye_world_replacement_rejects_matching_ids_ticks_and_old_release() {
    let mut previous = arena();
    let mut stale =
        SessionGestureWorldPath::from_admitted_world(&previous, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut stale,
            &mut previous,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );

    // World owner changes even if all familiar local numbers happen to match.
    let mut replacement = arena();
    assert_ne!(previous.world_instance(), replacement.world_instance());
    assert_eq!(previous.tick, replacement.tick);
    assert_eq!(
        previous.fighter(1).unwrap().world_incarnation(),
        replacement.fighter(1).unwrap().world_incarnation()
    );
    assert_eq!(
        admit(
            &mut stale,
            &mut replacement,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Stale
    );
    assert!(stale.retired());
    assert_eq!(replacement.fighter(2).unwrap().hp, 100.0);
    assert_fresh_source1_release_only_heavy(&mut replacement, LEASE + 1);
}
