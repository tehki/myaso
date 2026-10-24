//! Combat 4C P0 owner-approved E = Use, LMB-only Combat regression.
//! Independent typed source1 KeyE is RETIRED and cannot claim World authority,
//! the single Core8A LMB sequence cursor, or a committed 34/46HP hit.
//! This test is nonrelease and does not approve public 0x11/0x12 activation.

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

    // Retired source1 claiming ACTIVE source0 identity must be rejected
    // without changing original World action or the matching LMB release.
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
fn retired_keye_press_cannot_strand_authentic_lmb_release_or_claim_next_sequence() {
    let mut world = arena();
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    let press = event(GestureSource::Lmb, GestureAction::Press, 1, 1);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &press)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);

    // Legacy E source1 must never be considered a benign Combat action.
    // It must not consume seq2 belonging to the genuine LMB terminal.
    let old_e = event(GestureSource::KeyE, GestureAction::Press, 2, 2);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &old_e)
            .unwrap()
            .status,
        AckStatus::Rejected
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::AttackWindup);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    let release = event(GestureSource::Lmb, GestureAction::Release, 2, 1);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &release)
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
    assert_eq!(hits, vec![(34, 66)], "only the authentic LMB may hit");
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &release)
            .unwrap()
            .status,
        AckStatus::Duplicate
    );

    // Rejected source1 RELEASE cannot claim seq3 or resurrect an old heavy.
    let old_release = event(GestureSource::KeyE, GestureAction::Release, 3, 2);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &old_release)
            .unwrap()
            .status,
        AckStatus::Rejected
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(world.fighter(2).unwrap().hp, 66.0);

    let new_press = event(GestureSource::Lmb, GestureAction::Press, 3, 3);
    let new_release = event(GestureSource::Lmb, GestureAction::Release, 4, 3);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &new_press)
            .unwrap()
            .status,
        AckStatus::Accepted
    );
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &new_release)
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
fn retired_keye_cannot_own_world_or_steal_held_lmb_release_heavy() {
    let mut world = arena();
    let mut path = SessionGestureWorldPath::from_admitted_world(&world, 1, LEASE, BOOT).unwrap();
    for action in [
        GestureAction::Press,
        GestureAction::Release,
        GestureAction::Cancel,
    ] {
        assert_eq!(
            path.accept_under_world_lock(
                &mut world,
                LEASE,
                BOOT,
                &event(GestureSource::KeyE, action, 1, 1)
            )
            .unwrap()
            .status,
            AckStatus::Rejected
        );
        assert_eq!(world.fighter(1).unwrap().action, Action::Idle);
        assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    }

    // Same original lease and sequence still admit a physical source0 LMB.
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Press, 1, 1)
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    for _ in 0..4 {
        world.step();
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::Lmb, GestureAction::Upgrade, 2, 1)
        )
        .unwrap()
        .status,
        AckStatus::Accepted
    );
    for _ in 0..35 {
        world.step();
        path.advance_under_world_lock(&mut world, LEASE, BOOT);
    }
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Press, 3, 2)
        )
        .unwrap()
        .status,
        AckStatus::Rejected
    );
    assert_eq!(
        path.accept_under_world_lock(
            &mut world,
            LEASE,
            BOOT,
            &event(GestureSource::KeyE, GestureAction::Release, 3, 1)
        )
        .unwrap()
        .status,
        AckStatus::Rejected
    );
    assert_eq!(world.fighter(1).unwrap().action, Action::HeavyAttackWindup);
    assert_eq!(world.fighter(2).unwrap().hp, 100.0);

    // Exactly the matching source0 release is allowed to land a 46HP hit.
    let release = event(GestureSource::Lmb, GestureAction::Release, 3, 1);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &release)
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
    assert_eq!(hits, vec![(46, 54)]);
    assert_eq!(
        path.accept_under_world_lock(&mut world, LEASE, BOOT, &release)
            .unwrap()
            .status,
        AckStatus::Duplicate
    );
    assert_eq!(world.fighter(2).unwrap().hp, 54.0);
}
