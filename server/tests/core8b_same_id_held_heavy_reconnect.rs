//! Core 8B P0: a held LMB from a retired incarnation must never commit a HIT
//! against a same-numeric-ID replacement or steal its valid RELEASE sequence.
//! This is a deterministic original-World authority test, NOT a second-socket
//! QUIC or account-persistence qualification.
use myaso_server::prealpha_authenticated_gesture::{
    new_server_boot_nonce, SessionGestureWorldPath,
};
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{CombatEvent, World};

fn event(action: GestureAction, sequence: u32, gesture_id: u32) -> [u8; 16] {
    encode_typed_event(TypedGestureEvent {
        source: GestureSource::Lmb,
        event: GestureEvent {
            action,
            sequence,
            gesture_id,
            // Untrusted client time must not control the World clock.
            client_tick: u32::MAX,
        },
    })
    .expect("valid original-shaped source0 event")
}

fn admit(
    session: &mut SessionGestureWorldPath,
    world: &mut World,
    lease: u64,
    boot: u128,
    action: GestureAction,
    sequence: u32,
    gesture_id: u32,
) -> AckStatus {
    session
        .accept_under_world_lock(world, lease, boot, &event(action, sequence, gesture_id))
        .expect("admitted event has authoritative ACK")
        .status
}

fn advance(
    session: &mut SessionGestureWorldPath,
    world: &mut World,
    lease: u64,
    boot: u128,
    ticks: usize,
) -> Vec<(u8, u8)> {
    let mut hits = Vec::new();
    for _ in 0..ticks {
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
        session.advance_under_world_lock(world, lease, boot);
    }
    hits
}

#[test]
fn held_heavy_ready_reconnect_same_numeric_actor_fences_old_terminal_but_fresh_release_hits_once() {
    let boot = new_server_boot_nonce().expect("fresh CSPRNG server boot");
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let old_lease = 41;
    let new_lease = 42;
    let mut old = SessionGestureWorldPath::from_admitted_world(&world, 1, old_lease, boot)
        .expect("first admitted server actor");
    let old_binding = old.binding();

    assert_eq!(
        admit(
            &mut old,
            &mut world,
            old_lease,
            boot,
            GestureAction::Press,
            1,
            7
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut world, old_lease, boot, 4).is_empty());
    assert_eq!(
        admit(
            &mut old,
            &mut world,
            old_lease,
            boot,
            GestureAction::Upgrade,
            2,
            7
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut world, old_lease, boot, 33).is_empty());
    assert_eq!(
        world.fighter(2).unwrap().hp,
        100.0,
        "old held READY must not auto-commit 46HP"
    );

    // Actual original-World actor retirement and numeric-slot reuse, not a
    // fabricated incarnation bump or a new World implementation.
    assert!(world.remove_player(1));
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    let mut current = SessionGestureWorldPath::from_admitted_world(&world, 1, new_lease, boot)
        .expect("replacement admitted World incarnation");
    assert_eq!(current.binding().player_id, old_binding.player_id);
    assert_ne!(current.binding().incarnation, old_binding.incarnation);
    assert_ne!(current.binding().lease_epoch, old_binding.lease_epoch);

    assert_eq!(
        admit(
            &mut current,
            &mut world,
            new_lease,
            boot,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut current, &mut world, new_lease, boot, 4).is_empty());
    assert_eq!(
        admit(
            &mut current,
            &mut world,
            new_lease,
            boot,
            GestureAction::Upgrade,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut current, &mut world, new_lease, boot, 33).is_empty());
    assert_eq!(
        world.fighter(2).unwrap().hp,
        100.0,
        "new heavy must also wait for deliberate release"
    );

    // Real old-session bytes cannot release the new actor's READY gesture.
    assert_eq!(
        admit(
            &mut old,
            &mut world,
            old_lease,
            boot,
            GestureAction::Release,
            3,
            7
        ),
        AckStatus::Stale
    );
    assert!(old.retired());
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    // A forged old gesture ID on the new transport must not consume seq3.
    // Unknown higher-ID terminal intentionally receives NO ACK so a genuinely
    // lost PRESS can still be retried by the bounded reliable sender.
    assert!(
        current
            .accept_under_world_lock(
                &mut world,
                new_lease,
                boot,
                &event(GestureAction::Release, 3, 7),
            )
            .is_none(),
        "future terminal is withheld, never accepted or falsely rejected"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    assert_eq!(
        admit(
            &mut current,
            &mut world,
            new_lease,
            boot,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        advance(&mut current, &mut world, new_lease, boot, 55),
        vec![(46, 54)],
        "only the current lease's deliberate RELEASE may commit World damage"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    assert_eq!(
        admit(
            &mut current,
            &mut world,
            new_lease,
            boot,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Duplicate
    );
    assert_eq!(
        admit(
            &mut old,
            &mut world,
            old_lease,
            boot,
            GestureAction::Cancel,
            4,
            7
        ),
        AckStatus::Stale
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}

#[test]
fn disconnect_during_light_or_heavy_windup_fences_old_edges_without_ghost_hit() {
    // Separate lifecycle phases: the old actor is retired while it is still
    // winding up. A new incarnation reuses the same numeric World actor ID,
    // but neither the old physical edges nor its previous sequence may act.
    for (heavy, phase) in [(false, "light"), (true, "heavy")] {
        let boot = new_server_boot_nonce().expect("new CSPRNG boot nonce");
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));

        let old_lease = 51;
        let fresh_lease = 52;
        let mut old = SessionGestureWorldPath::from_admitted_world(&world, 1, old_lease, boot)
            .expect("old session admitted by authoritative World");
        let old_binding = old.binding();
        assert_eq!(
            admit(
                &mut old,
                &mut world,
                old_lease,
                boot,
                GestureAction::Press,
                1,
                7
            ),
            AckStatus::Accepted,
            "{phase} PRESS must be legitimate before disconnect"
        );
        if heavy {
            assert!(advance(&mut old, &mut world, old_lease, boot, 4).is_empty());
            assert_eq!(
                admit(
                    &mut old,
                    &mut world,
                    old_lease,
                    boot,
                    GestureAction::Upgrade,
                    2,
                    7
                ),
                AckStatus::Accepted
            );
            assert_eq!(
                world.fighter(1).unwrap().action.wire_code(),
                9,
                "heavy disconnect must happen in real HeavyWindup"
            );
        } else {
            assert_eq!(
                world.fighter(1).unwrap().action.wire_code(),
                1,
                "light disconnect must happen in real LightWindup"
            );
        }
        assert_eq!(world.fighter(2).unwrap().hp, 100.0);

        assert!(world.remove_player(1));
        assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
        let mut fresh = SessionGestureWorldPath::from_admitted_world(&world, 1, fresh_lease, boot)
            .expect("replacement incarnation admitted by original World");
        assert_eq!(fresh.binding().player_id, old_binding.player_id);
        assert_ne!(fresh.binding().incarnation, old_binding.incarnation);
        assert_ne!(fresh.binding().lease_epoch, old_binding.lease_epoch);

        // Tick advancement must independently retire the old actor even when
        // no old datagrams are subsequently delivered.
        old.advance_under_world_lock(&mut world, old_lease, boot);
        assert!(old.retired(), "{phase} old lease must retire at next tick");
        for (action, sequence) in [
            (GestureAction::Release, 3),
            (GestureAction::Cancel, 4),
            (GestureAction::Upgrade, 5),
            (GestureAction::Press, 6),
        ] {
            assert_eq!(
                admit(&mut old, &mut world, old_lease, boot, action, sequence, 7),
                AckStatus::Stale,
                "{phase} old edge must remain stale after reincarnation"
            );
            assert_eq!(world.fighter(1).unwrap().action.wire_code(), 0);
            assert_eq!(world.fighter(2).unwrap().hp, 100.0);
        }

        // The retired actor must not spend the replacement's source0 ordering.
        assert_eq!(
            admit(
                &mut fresh,
                &mut world,
                fresh_lease,
                boot,
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
                boot,
                GestureAction::Release,
                2,
                1
            ),
            AckStatus::Accepted
        );
        assert_eq!(
            advance(&mut fresh, &mut world, fresh_lease, boot, 55),
            vec![(34, 66)],
            "{phase} reconnect must yield only one genuine fresh 34HP HIT"
        );
        assert_eq!(world.fighter(2).unwrap().hp, 66.0);
    }
}

#[test]
fn old_boot_held_heavy_cannot_cross_fresh_world_with_reset_actor_and_lease() {
    // Simulate restart boundaries with two ORIGINAL Rust World instances.
    // Actual new-OS-process CSPRNG non-reuse is tested separately in
    // prealpha_boot_nonce_authority.rs; this is a deterministic lifecycle
    // regression, not persistent account identity or real two-socket QA.
    let previous_boot = new_server_boot_nonce().expect("original CSPRNG boot");
    let current_boot = new_server_boot_nonce().expect("fresh CSPRNG boot");
    assert_ne!(previous_boot, current_boot);
    let reset_lease = 1;

    let mut before = World::new(800.0, 600.0);
    assert!(before.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(before.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut old =
        SessionGestureWorldPath::from_admitted_world(&before, 1, reset_lease, previous_boot)
            .expect("old authoritative session admitted");
    let prior_binding = old.binding();
    assert_eq!(
        admit(
            &mut old,
            &mut before,
            reset_lease,
            previous_boot,
            GestureAction::Press,
            1,
            7
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut before, reset_lease, previous_boot, 4).is_empty());
    assert_eq!(
        admit(
            &mut old,
            &mut before,
            reset_lease,
            previous_boot,
            GestureAction::Upgrade,
            2,
            7
        ),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut before, reset_lease, previous_boot, 33).is_empty());
    assert_eq!(
        before.fighter(2).unwrap().hp,
        100.0,
        "old READY heavy must not produce damage without current release"
    );

    // Local actor ID and lease counter are deliberately recycled, exactly as
    // a fresh server process may do. Neither is durable authentication.
    let mut after = World::new(800.0, 600.0);
    assert!(after.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(after.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    let mut current =
        SessionGestureWorldPath::from_admitted_world(&after, 1, reset_lease, current_boot)
            .expect("fresh server session admitted");
    assert_eq!(current.binding().player_id, prior_binding.player_id);
    assert_eq!(current.binding().lease_epoch, prior_binding.lease_epoch);
    assert_ne!(current.binding().boot_nonce, prior_binding.boot_nonce);
    assert_ne!(
        current.binding().world_instance,
        prior_binding.world_instance
    );

    assert_eq!(
        admit(
            &mut old,
            &mut after,
            reset_lease,
            previous_boot,
            GestureAction::Release,
            3,
            7
        ),
        AckStatus::Stale,
        "old READY release cannot mutate the new server World"
    );
    assert!(old.retired());
    old.advance_under_world_lock(&mut after, reset_lease, previous_boot);
    assert_eq!(after.fighter(1).unwrap().action.wire_code(), 0);
    assert_eq!(after.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        admit(
            &mut old,
            &mut after,
            reset_lease,
            previous_boot,
            GestureAction::Cancel,
            4,
            7
        ),
        AckStatus::Stale
    );

    assert_eq!(
        admit(
            &mut current,
            &mut after,
            reset_lease,
            current_boot,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut current,
            &mut after,
            reset_lease,
            current_boot,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        advance(&mut current, &mut after, reset_lease, current_boot, 55),
        vec![(34, 66)],
        "only a new-boot admitted deliberate source0 release can commit HIT"
    );
    assert_eq!(after.fighter(2).unwrap().hp, 66.0);
}
