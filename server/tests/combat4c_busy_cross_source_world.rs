//! Combat 4C P0 fail-first cross-source integration contract against the
//! ORIGINAL World. This is a nonrelease regression candidate, not a protocol
//! activation, transport acknowledgement-as-HIT, or user-facing KeyE policy.
//!
//! Context: the one Core8A typed source0/source1 outbox currently retires its
//! whole lease on a REJECTED 0x12 ACK. In Core8 #855, an independent KeyE PRESS
//! sent while LMB owns a windup is REJECTED by the single-gesture reducer;
//! an already-scheduled genuine LMB RELEASE can then never reach World.
//! Reconcile ordered noncombat busy admissions with Core8A/Combat4 before GO.

use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4c;
const BOOT: u128 = 0x1234_5678_9abc_def0;

fn arena() -> World {
    let mut world = World::new(800.0, 600.0);
    assert!(world.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(world.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    world
}

fn event(source: GestureSource, action: GestureAction, seq: u32, gesture: u32) -> [u8; 16] {
    encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence: seq,
            gesture_id: gesture,
            client_tick: 1, // diagnostics only: never combat authority
        },
    })
    .expect("canonical typed 0x11 edge")
}

#[test]
fn spoofed_other_source_terminal_cannot_release_real_lmb() {
    let mut world = arena();
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    let press = path
        .accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Press, 1, 1),
        )
        .unwrap();
    assert_eq!(press.status, AckStatus::Accepted);
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    // Wrong source claiming the ACTIVE LMB gesture identity is not a valid
    // independent KeyE gesture. It must still be REJECTED and cannot mutate
    // the original World action, even after the busy-source bug is fixed.
    let spoof = path
        .accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Release, 2, 1),
        )
        .unwrap();
    assert_eq!(spoof.status, AckStatus::Rejected);
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
}

#[test]
fn independent_keye_busy_press_must_not_strand_legitimate_lmb_release() {
    let mut world = arena();
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();

    let lmb_press = path
        .accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Press, 1, 1),
        )
        .unwrap();
    assert_eq!(lmb_press.status, AckStatus::Accepted);
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    // UI10 #859 can emit this REAL, distinct KeyE source1 PRESS while LMB
    // source0 is active. Combat cannot execute a second simultaneous attack,
    // but the server must distinguish benign World-busy input from an invalid
    // actor/lease or a spoofed terminal; no 46HP heavy may be invented.
    //
    // FAIL-FIRST on Core8 #855 (2026-10-23): status is REJECTED, so the
    // shared Core8A outbox retires BOTH sources, discarding valid seq3 below.
    // Any eventual fix must also consume/fence seq2 exactly once in the
    // ordered replay journal; returning a false HIT or silently omitting the
    // sequence creates replay and cross-source deadlocks.
    let busy = path
        .accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Press, 2, 2),
        )
        .expect("admitted distinct busy gesture needs a definitive ordered receipt");
    assert_eq!(
        busy.status,
        AckStatus::Accepted,
        "a benign busy-source input must be an ordered no-combat admission; \
         a REJECTED ACK closes the shared Core8A outbox and loses genuine LMB RELEASE"
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    let lmb_release = path
        .accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Release, 3, 1),
        )
        .expect("valid LMB terminal must remain processable after independent busy KeyE");
    assert_eq!(lmb_release.status, AckStatus::Accepted);

    let mut hits = vec![];
    for _ in 0..55 {
        for outcome in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = outcome
            {
                hits.push((damage, hp));
            }
        }
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(hits, vec![(34, 66)], "only the genuine 34HP LMB may land");
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);

    // The KeyE terminal belongs to a tombstoned busy gesture: its late
    // arrival after original LMB recovery must not become a heavy strike.
    let no_op_terminal = event(GestureSource::KeyE, GestureAction::Release, 4, 2);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &no_op_terminal)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &no_op_terminal)
            .unwrap()
            .status,
        AckStatus::Duplicate
    );
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);

    // Busy ACKs cannot replace the last active World attack ID; once the
    // first action recovers, a new genuine LMB gesture must be possible.
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Press, 5, 3),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Release, 6, 3),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    let mut next_hits = vec![];
    for _ in 0..55 {
        for outcome in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = outcome
            {
                next_hits.push((damage, hp));
            }
        }
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(next_hits, vec![(34, 32)]);
    assert_eq!(world.fighter(2).unwrap().hp, 32.0);
}

#[test]
fn busy_lmb_upgrade_while_keye_owns_world_must_not_retire_shared_outbox() {
    let mut world = arena();
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();

    // Source1 is the sole real World attack. This #855 branch deliberately
    // uses release-only standalone KeyE until Combat4/Main choose the rule.
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Press, 1, 1),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Press, 2, 2),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    // UI10's real held source0 can still issue its single UPGRADE while
    // source1 owns HeavyWindup. It is transport-admitted but NO COMBAT;
    // REJECTED would retire the one shared Core8A outbox and strand KeyE.
    let upgrade = event(GestureSource::Lmb, GestureAction::Upgrade, 3, 2);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &upgrade)
            .unwrap()
            .status,
        AckStatus::Accepted,
        "busy LMB UPGRADE must be a typed no-combat receipt, not lease-fatal"
    );
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &upgrade)
            .unwrap()
            .status,
        AckStatus::Duplicate
    );
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Release, 4, 2),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    let mut before_release = vec![];
    for _ in 0..37 {
        for outcome in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = outcome
            {
                before_release.push((damage, hp));
            }
        }
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert!(
        before_release.is_empty(),
        "busy LMB cannot cause phantom 34/46HP"
    );
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Release, 5, 1),
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    let mut hits = vec![];
    for _ in 0..55 {
        for outcome in world.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = outcome
            {
                hits.push((damage, hp));
            }
        }
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(hits, vec![(46, 54)], "only source1's actual heavy may land");
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}
