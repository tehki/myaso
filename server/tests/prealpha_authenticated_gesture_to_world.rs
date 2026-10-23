//! Exact source integration: admitted server lease -> typed 0x11 -> original
//! 60Hz Rust World, with no client-chosen actor, time or fabricated HIT.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, InputIntent, World};

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

#[test]
fn same_tick_actor_reuse_refuses_retired_release_and_allows_fresh_lease_hit() {
    let mut world = arena();
    let mut retired = SessionGestureWorldPath::from_admitted_world(&world, 2, LEASE, BOOT).unwrap();
    let old_life = retired.binding().incarnation;
    let owner = retired.binding().world_instance;

    assert_eq!(
        admit(
            &mut retired,
            &mut world,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    // Remove and replace the fighter before the next World tick. Numeric ID
    // and World owner are unchanged, but actor authority is not transferable.
    assert!(world.remove_player(2));
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    assert_eq!(world.world_instance(), owner);
    assert_ne!(world.fighter(2).unwrap().world_incarnation(), old_life);
    assert_eq!(
        admit(
            &mut retired,
            &mut world,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Stale
    );
    assert!(retired.retired());
    assert_eq!(world.fighter(1).unwrap().hp, 100.0);
    assert_eq!(world.fighter(2).unwrap().action, Action::Idle);

    // The new server-issued lease gets its own gesture ID/sequence namespace.
    // Old actor retirement must not deny the legitimate replacement.
    let fresh_lease = LEASE + 1;
    let mut fresh =
        SessionGestureWorldPath::from_admitted_world(&world, 2, fresh_lease, BOOT).unwrap();
    // Fighter facing is refreshed from server-held latest input each World tick.
    assert!(world.set_input(
        2,
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        admit(
            &mut fresh,
            &mut world,
            fresh_lease,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut fresh,
            &mut world,
            fresh_lease,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    let mut hits = Vec::new();
    for _ in 0..55 {
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 2,
                target: 1,
                damage,
                hp,
            } = event
            {
                hits.push((damage, hp));
            }
        }
        fresh.advance_under_world_lock(&mut world, fresh_lease, BOOT);
        retired.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(hits, vec![(34, 66)]);
    assert_eq!(world.fighter(1).unwrap().hp, 66.0);
    assert!(retired.retired());
}

#[test]
fn real_world_death_and_respawn_require_fresh_actor_gesture_authority() {
    let mut world = arena();
    let mut attacker =
        SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    let stale_lease = LEASE + 1;
    let mut old_target =
        SessionGestureWorldPath::from_admitted_world(&world, 2, stale_lease, BOOT).unwrap();
    let original_life = old_target.binding().incarnation;

    // A real admitted source0 PRESS/CANCEL proves the old target has a
    // gesture ID to replay, but cancels before contact to avoid fake damage.
    assert_eq!(
        admit(
            &mut old_target,
            &mut world,
            stale_lease,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut old_target,
            &mut world,
            stale_lease,
            GestureSource::Lmb,
            GestureAction::Cancel,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(2).unwrap().action, Action::Idle);

    let mut damage = Vec::new();
    let mut saw_death = false;
    for gesture in 1..=3_u32 {
        if gesture == 3 {
            // Two real contact knockbacks can move a target outside light
            // reach. Close the distance through the ordinary World movement
            // input instead of changing Combat hit range or fabricating HP.
            assert!(world.set_input(
                1,
                InputIntent {
                    move_x: 1.0,
                    ..InputIntent::default()
                }
            ));
            for _ in 0..8 {
                world.step();
                attacker.advance_under_world_lock(&mut world, LEASE, BOOT);
                old_target.advance_under_world_lock(&mut world, stale_lease, BOOT);
            }
            assert!(world.set_input(1, InputIntent::default()));
        }
        assert_eq!(
            admit(
                &mut attacker,
                &mut world,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Press,
                2 * gesture - 1,
                gesture
            ),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(
                &mut attacker,
                &mut world,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Release,
                2 * gesture,
                gesture
            ),
            AckStatus::Accepted
        );
        for _ in 0..55 {
            for event in world.step() {
                match event {
                    CombatEvent::Hit {
                        attacker: 1,
                        target: 2,
                        damage: dealt,
                        hp,
                    } => damage.push((dealt, hp)),
                    CombatEvent::Death { fighter: 2, .. } => saw_death = true,
                    _ => {}
                }
            }
            attacker.advance_under_world_lock(&mut world, LEASE, BOOT);
            old_target.advance_under_world_lock(&mut world, stale_lease, BOOT);
        }
    }
    assert_eq!(damage, vec![(34, 66), (34, 32), (34, 0)]);
    assert!(saw_death, "death must come from original World combat");
    assert_eq!(world.fighter(2).unwrap().action, Action::Dead);
    assert!(old_target.retired(), "death retires old gesture authority");

    let mut saw_respawn = false;
    for _ in 0..90 {
        for event in world.step() {
            if let CombatEvent::Respawn { fighter: 2 } = event {
                saw_respawn = true;
            }
        }
        attacker.advance_under_world_lock(&mut world, LEASE, BOOT);
        old_target.advance_under_world_lock(&mut world, stale_lease, BOOT);
    }
    assert!(saw_respawn, "actual World respawn must occur");
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_ne!(world.fighter(2).unwrap().world_incarnation(), original_life);

    // Never rebind an already retired lease in place: an in-flight RELEASE
    // must not be mistaken for a current actor's release after respawn.
    assert_eq!(
        admit(
            &mut old_target,
            &mut world,
            stale_lease,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Stale
    );
    assert_eq!(world.fighter(1).unwrap().hp, 100.0);
    let fresh_lease = stale_lease + 1;
    let mut fresh =
        SessionGestureWorldPath::from_admitted_world(&world, 2, fresh_lease, BOOT).unwrap();
    // Fighter facing is refreshed from server-held latest input each World tick.
    assert!(world.set_input(
        2,
        InputIntent {
            facing_radians: std::f32::consts::PI,
            ..InputIntent::default()
        }
    ));
    assert_eq!(
        admit(
            &mut fresh,
            &mut world,
            fresh_lease,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut fresh,
            &mut world,
            fresh_lease,
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    let mut fresh_hits = Vec::new();
    for _ in 0..55 {
        for event in world.step() {
            if let CombatEvent::Hit {
                attacker: 2,
                target: 1,
                damage: dealt,
                hp,
            } = event
            {
                fresh_hits.push((dealt, hp));
            }
        }
        fresh.advance_under_world_lock(&mut world, fresh_lease, BOOT);
        old_target.advance_under_world_lock(&mut world, stale_lease, BOOT);
    }
    assert_eq!(fresh_hits, vec![(34, 66)]);
    assert!(old_target.retired());
}

#[test]
fn full_original_ffa_match_reset_invalidates_old_survivor_gesture_lease() {
    let mut world = arena();
    let mut survivor =
        SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    let old_actor_life = survivor.binding().incarnation;
    let old_world_instance = survivor.binding().world_instance;
    let mut hits = 0_u32;
    let mut deaths = 0_u32;
    let mut respawns = 0_u32;
    let mut match_wins = 0_u32;
    let mut gesture = 0_u32;

    // Win the original five-kill FFA through genuine 135ms World contacts.
    // Use World inputs to adjust spacing after knockback; never modify HP,
    // kills, action timers or authoritative fighter position directly.
    while !world.match_over() {
        if world.fighter(2).unwrap().action == Action::Dead {
            for event in world.step() {
                if let CombatEvent::Respawn { fighter: 2 } = event {
                    respawns += 1;
                }
            }
            survivor.advance_under_world_lock(&mut world, LEASE, BOOT);
            continue;
        }
        assert!(gesture < 18, "five genuine Combat kills must finish promptly");
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        // Original 18px knockback per landed light can move the target out
        // of range. Approach via the normal movement input until close.
        for _ in 0..80 {
            let dx = world.fighter(2).unwrap().x - world.fighter(1).unwrap().x;
            if dx.abs() <= 60.0 {
                break;
            }
            assert!(world.set_input(
                1,
                InputIntent {
                    move_x: dx.signum(),
                    facing_radians: if dx >= 0.0 {
                        0.0
                    } else {
                        std::f32::consts::PI
                    },
                    ..InputIntent::default()
                }
            ));
            world.step();
            survivor.advance_under_world_lock(&mut world, LEASE, BOOT);
        }
        let dx = world.fighter(2).unwrap().x - world.fighter(1).unwrap().x;
        assert!(dx.abs() <= 70.0, "actual input must approach Combat reach");
        assert!(world.set_input(
            1,
            InputIntent {
                facing_radians: if dx >= 0.0 {
                    0.0
                } else {
                    std::f32::consts::PI
                },
                ..InputIntent::default()
            }
        ));

        gesture += 1;
        assert_eq!(
            admit(
                &mut survivor,
                &mut world,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Press,
                2 * gesture - 1,
                gesture
            ),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(
                &mut survivor,
                &mut world,
                LEASE,
                GestureSource::Lmb,
                GestureAction::Release,
                2 * gesture,
                gesture
            ),
            AckStatus::Accepted
        );
        let before = hits;
        for _ in 0..55 {
            for event in world.step() {
                match event {
                    CombatEvent::Hit {
                        attacker: 1,
                        target: 2,
                        damage: 34,
                        ..
                    } => hits += 1,
                    CombatEvent::Death { fighter: 2, .. } => deaths += 1,
                    CombatEvent::Respawn { fighter: 2 } => respawns += 1,
                    CombatEvent::MatchWon { winner: 1, .. } => match_wins += 1,
                    _ => {}
                }
            }
            survivor.advance_under_world_lock(&mut world, LEASE, BOOT);
            if world.match_over() {
                break;
            }
        }
        assert_eq!(
            hits,
            before + 1,
            "every admitted light must contact once in original World"
        );
    }

    assert_eq!(deaths, 5);
    assert_eq!(hits, 15);
    assert_eq!(match_wins, 1);
    assert_eq!(respawns, 4);
    assert_eq!(gesture, 15);
    assert!(survivor.retired(), "match winner no longer owns future gestures");
    assert_eq!(world.world_instance(), old_world_instance);
    let mut saw_reset = false;
    for _ in 0..170 {
        if world
            .step()
            .iter()
            .any(|event| matches!(event, CombatEvent::MatchReset))
        {
            saw_reset = true;
            break;
        }
        survivor.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert!(saw_reset, "real FFA match-reset timer must elapse");
    assert_eq!(world.fighter(1).unwrap().hp, 100.0);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_ne!(
        world.fighter(1).unwrap().world_incarnation(),
        old_actor_life,
        "surviving winner must acquire fresh authority after match reset"
    );
    assert_eq!(
        admit(
            &mut survivor,
            &mut world,
            LEASE,
            GestureSource::Lmb,
            GestureAction::Release,
            2 * gesture + 1,
            gesture
        ),
        AckStatus::Stale,
        "old terminal cannot cross the reset while keeping same numerical ID"
    );
    let fresh_lease = LEASE + 1;
    let mut fresh =
        SessionGestureWorldPath::from_admitted_world(&world, 1, fresh_lease, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut fresh,
            &mut world,
            fresh_lease,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted,
        "legitimate new authority must remain able to attack"
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
}
