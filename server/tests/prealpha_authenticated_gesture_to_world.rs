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
fn original_world_death_respawn_stales_old_held_lmb_lease() {
    // Use one real Rust World and its committed HIT/Death/Respawn events;
    // never forge HP, a World incarnation, or a replacement actor identity.
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, 0.0));
    assert!(w.add_player_at(3, 700.0, 500.0, 0.0));
    let mut attacker = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    let mut old = SessionGestureWorldPath::from_admitted_world(&w, 2, LEASE + 1, BOOT).unwrap();
    let original = old.binding();

    // Two real physical source0 gestures, each one genuine 34 HP World hit.
    for (gesture, expected_hp) in [(1, 66), (2, 32)] {
        assert_eq!(
            admit(
                &mut attacker,
                &mut w,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Press,
                2 * gesture - 1,
                gesture,
            ),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(
                &mut attacker,
                &mut w,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Release,
                2 * gesture,
                gesture,
            ),
            AckStatus::Accepted
        );
        let mut hit_count = 0;
        for _ in 0..55 {
            for event in w.step() {
                if let CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    hp,
                } = event
                {
                    assert_eq!(hp, expected_hp);
                    hit_count += 1;
                }
            }
            attacker.advance_under_world_lock(&mut w, LEASE, BOOT);
            old.advance_under_world_lock(&mut w, LEASE + 1, BOOT);
        }
        assert_eq!(hit_count, 1);
        assert_eq!(w.fighter(2).unwrap().hp, f32::from(expected_hp));
    }

    // The victim's physical LMB is held at the instant the original third
    // attack commits real death. This in-flight gesture must lose authority.
    assert_eq!(
        admit(
            &mut old,
            &mut w,
            LEASE + 1,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            7,
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut attacker,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            5,
            3,
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut attacker,
            &mut w,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            6,
            3,
        ),
        AckStatus::Accepted
    );
    let (mut fatal_hits, mut deaths) = (0, 0);
    for _ in 0..55 {
        for event in w.step() {
            match event {
                CombatEvent::Hit {
                    attacker: 1,
                    target: 2,
                    damage: 34,
                    hp: 0,
                } => fatal_hits += 1,
                CombatEvent::Death {
                    fighter: 2,
                    killer: 1,
                } => deaths += 1,
                _ => {}
            }
        }
        attacker.advance_under_world_lock(&mut w, LEASE, BOOT);
        old.advance_under_world_lock(&mut w, LEASE + 1, BOOT);
        if deaths != 0 {
            break;
        }
    }
    assert_eq!((fatal_hits, deaths), (1, 1));
    assert_eq!(w.fighter(2).unwrap().action, Action::Dead);
    assert!(old.retired());
    assert_eq!(
        admit(
            &mut old,
            &mut w,
            LEASE + 1,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            7,
        ),
        AckStatus::Stale
    );

    // Original World respawn increments the incarnation; it is not a
    // client-supplied reset or a fabricated fresh actor.
    let mut respawns = 0;
    for _ in 0..110 {
        for event in w.step() {
            if matches!(event, CombatEvent::Respawn { fighter: 2 }) {
                respawns += 1;
            }
        }
        attacker.advance_under_world_lock(&mut w, LEASE, BOOT);
        if respawns != 0 {
            break;
        }
    }
    assert_eq!(respawns, 1);
    let mut fresh = SessionGestureWorldPath::from_admitted_world(&w, 2, LEASE + 2, BOOT).unwrap();
    assert_eq!(fresh.binding().player_id, original.player_id);
    assert_ne!(fresh.binding().incarnation, original.incarnation);
    assert_ne!(fresh.binding().lease_epoch, original.lease_epoch);

    for action in [GestureAction::Release, GestureAction::Cancel] {
        let old_lmb = edge(GestureSource::Lmb, action, 2, 7);
        assert_eq!(
            old.accept_under_world_lock(&mut w, LEASE + 1, BOOT, &old_lmb)
                .unwrap()
                .status,
            AckStatus::Stale
        );
        let old_keye = edge(GestureSource::KeyE, action, 1, 7);
        assert_eq!(
            fresh
                .accept_under_world_lock(&mut w, LEASE + 2, BOOT, &old_keye)
                .unwrap()
                .status,
            AckStatus::Rejected
        );
    }
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert_eq!(w.fighter(2).unwrap().action, Action::Idle);
    // The current admitted incarnation gets its OWN source0 sequence 1/2.
    assert_eq!(
        admit(
            &mut fresh,
            &mut w,
            LEASE + 2,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1,
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut fresh,
            &mut w,
            LEASE + 2,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1,
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut fresh,
            &mut w,
            LEASE + 2,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1,
        ),
        AckStatus::Duplicate
    );
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
fn retired_keye_hold_and_release_cannot_commit_heavy_but_real_lmb_ready_can() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // Obsolete E cannot charge heavy, however long it is held.
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
    assert!(advance(&mut p, &mut w, 37).is_empty());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
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
        AckStatus::Rejected
    );

    // Genuine source0 LMB remains the ONLY 320ms READY / 46HP heavy.
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
    // A forged E terminal with the next sequence cannot finish the LMB hold.
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            LEASE,
            GestureSource::KeyE,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Rejected
    );
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
fn retired_keye_short_and_long_terminals_never_spend_lmb_cursor_or_hit() {
    for terminal in [GestureAction::Release, GestureAction::Cancel] {
        for hold_ticks in [4, 37] {
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
            assert!(advance(&mut p, &mut w, hold_ticks).is_empty());
            assert_eq!(
                admit(&mut p, &mut w, LEASE, GestureSource::KeyE, terminal, 2, 1),
                AckStatus::Rejected
            );
            assert!(advance(&mut p, &mut w, 55).is_empty());
            assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
            assert_eq!(w.fighter(2).unwrap().hp, 100.0);

            // The same numeric sequence still belongs to the valid LMB,
            // regardless of the rejected E hold duration or cancellation.
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
            assert_eq!(w.fighter(2).unwrap().hp, 66.0);
        }
    }
}

#[test]
fn retired_keye_cross_source_terminal_and_replay_cannot_steal_lmb() {
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
    let before = w.fighter(1).unwrap().action;
    for (action, gesture) in [
        (GestureAction::Release, 1),
        (GestureAction::Cancel, 1),
        (GestureAction::Press, 2),
        (GestureAction::Press, 2),
        (GestureAction::Release, 2),
    ] {
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                GestureSource::KeyE,
                action,
                2,
                gesture
            ),
            AckStatus::Rejected
        );
        assert_eq!(w.fighter(1).unwrap().action, before);
    }
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
        AckStatus::Duplicate
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
fn one_source0_sequence_allows_two_lmb_hits_but_no_interleaved_keye_hit() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    for (gesture, press_seq, release_seq, hp) in [(1, 1, 2, 66), (2, 3, 4, 32)] {
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                GestureSource::KeyE,
                GestureAction::Press,
                press_seq,
                gesture
            ),
            AckStatus::Rejected
        );
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Press,
                press_seq,
                gesture
            ),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                GestureSource::KeyE,
                GestureAction::Release,
                release_seq,
                gesture
            ),
            AckStatus::Rejected
        );
        assert_eq!(
            admit(
                &mut p,
                &mut w,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Release,
                release_seq,
                gesture
            ),
            AckStatus::Accepted
        );
        assert_eq!(advance(&mut p, &mut w, 55), vec![(34, hp)]);
        assert_eq!(w.fighter(2).unwrap().hp, f32::from(hp));
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    }
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
fn retired_keye_cannot_overtake_missing_lmb_or_spend_lease_sequence() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // A legacy Key E packet with a FAR-FUTURE sequence is always denied
    // immediately, before it can claim the monotonic LMB sequence fence.
    let old_e = edge(GestureSource::KeyE, GestureAction::Press, 3, 2);
    let denied = p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &old_e)
        .unwrap();
    assert_eq!(denied.status, AckStatus::Rejected);
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

    // Replayed invalid source1 cannot revive a key-driven heavy or steal
    // sequences3/4 from the legitimate next source0 LMB gesture.
    for (action, seq) in [(GestureAction::Press, 3), (GestureAction::Release, 4)] {
        assert_eq!(
            admit(&mut p, &mut w, LEASE, GestureSource::KeyE, action, seq, 2),
            AckStatus::Rejected
        );
    }
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
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn future_lmb_press_waits_for_missing_lmb_terminal_not_retired_keye() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    // Valid future LMB seq3 cannot leapfrog lost LMB seq1/seq2.
    let future = edge(GestureSource::Lmb, GestureAction::Press, 3, 2);
    assert!(p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &future)
        .is_none());
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // Retired E may not fill the missing sequence gap or cause 46HP.
    for (action, seq) in [(GestureAction::Press, 1), (GestureAction::Release, 2)] {
        assert_eq!(
            admit(&mut p, &mut w, LEASE, GestureSource::KeyE, action, seq, 1),
            AckStatus::Rejected
        );
    }
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
    assert_eq!(w.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn same_world_tick_press_and_upgrade_preserve_real_intermediate_windup_without_auto_hit() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    let original_tick = w.tick;
    let original_ms = w.now_ms;
    let press = edge(GestureSource::Lmb, GestureAction::Press, 1, 1);
    let press_ack = p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &press)
        .unwrap();
    assert_eq!(press_ack.status, AckStatus::Accepted);
    assert_eq!(press_ack.sequence, 1);
    assert_eq!(press_ack.gesture_id, 1);
    assert_eq!(press_ack.server_tick, original_tick);
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    assert_eq!(w.tick, original_tick);
    assert_eq!(w.now_ms, original_ms);

    // Real QUIC edges can be admitted between the same two World ticks.
    // Do not step or inject an action to make the intermediate state visible.
    let upgrade = edge(GestureSource::Lmb, GestureAction::Upgrade, 2, 1);
    let upgrade_ack = p
        .accept_under_world_lock(&mut w, LEASE, BOOT, &upgrade)
        .unwrap();
    assert_eq!(upgrade_ack.status, AckStatus::Accepted);
    assert_eq!(upgrade_ack.sequence, 2);
    assert_eq!(upgrade_ack.gesture_id, press_ack.gesture_id);
    assert_eq!(upgrade_ack.server_tick, press_ack.server_tick);
    assert_eq!(w.tick, original_tick);
    assert_eq!(w.now_ms, original_ms);
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(w.fighter(2).unwrap().hp, 100.0);

    // Past genuine server READY320, both Active phases remain forbidden
    // while this same authenticated physical gesture is still held.
    for _ in 0..40 {
        assert!(advance(&mut p, &mut w, 1).is_empty());
        assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);
        assert_eq!(w.fighter(2).unwrap().hp, 100.0);
    }
    assert!(w.now_ms - original_ms > 320.0);
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
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackActive);
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
    assert!(advance(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 54.0);
}
