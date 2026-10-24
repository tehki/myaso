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
        admit(&mut old, &mut world, old_lease, boot, GestureAction::Press, 1, 7),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut world, old_lease, boot, 4).is_empty());
    assert_eq!(
        admit(&mut old, &mut world, old_lease, boot, GestureAction::Upgrade, 2, 7),
        AckStatus::Accepted
    );
    assert!(advance(&mut old, &mut world, old_lease, boot, 33).is_empty());
    assert_eq!(world.fighter(2).unwrap().hp, 100.0,
        "old held READY must not auto-commit 46HP");

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
        admit(&mut current, &mut world, new_lease, boot, GestureAction::Press, 1, 1),
        AckStatus::Accepted
    );
    assert!(advance(&mut current, &mut world, new_lease, boot, 4).is_empty());
    assert_eq!(
        admit(&mut current, &mut world, new_lease, boot, GestureAction::Upgrade, 2, 1),
        AckStatus::Accepted
    );
    assert!(advance(&mut current, &mut world, new_lease, boot, 33).is_empty());
    assert_eq!(world.fighter(2).unwrap().hp, 100.0,
        "new heavy must also wait for deliberate release");

    // Real old-session bytes cannot release the new actor's READY gesture.
    assert_eq!(
        admit(&mut old, &mut world, old_lease, boot, GestureAction::Release, 3, 7),
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
        admit(&mut current, &mut world, new_lease, boot, GestureAction::Release, 3, 1),
        AckStatus::Accepted
    );
    assert_eq!(
        advance(&mut current, &mut world, new_lease, boot, 55),
        vec![(46, 54)],
        "only the current lease's deliberate RELEASE may commit World damage"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
    assert_eq!(
        admit(&mut current, &mut world, new_lease, boot, GestureAction::Release, 3, 1),
        AckStatus::Duplicate
    );
    assert_eq!(
        admit(&mut old, &mut world, old_lease, boot, GestureAction::Cancel, 4, 7),
        AckStatus::Stale
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}
