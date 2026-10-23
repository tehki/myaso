//! Combat 4C fail-first: genuine rapid repeat of the SAME physical source
//! during original World windup/recovery must NOT fatally close Core8A's one
//! shared source0+source1 typed outbox. This is only a NONRELEASE test.
use myaso_server::prealpha_authenticated_gesture::SessionGestureWorldPath;
use myaso_server::prealpha_lmb_gesture_proposal::{
    encode_typed_event, AckStatus, GestureAction, GestureEvent, GestureSource, TypedGestureEvent,
};
use myaso_server::simulation::{Action, CombatEvent, World};

const LEASE: u64 = 0x4c44;
const BOOT: u128 = 0x9876_5432_1234_abcd;

fn arena() -> World {
    let mut w = World::new(800.0, 600.0);
    assert!(w.add_player_at(1, 250.0, 300.0, 0.0));
    assert!(w.add_player_at(2, 310.0, 300.0, std::f32::consts::PI));
    w
}

fn admit(
    p: &mut SessionGestureWorldPath,
    w: &mut World,
    source: GestureSource,
    action: GestureAction,
    seq: u32,
    id: u32,
) -> AckStatus {
    let bytes = encode_typed_event(TypedGestureEvent {
        source,
        event: GestureEvent {
            action,
            sequence: seq,
            gesture_id: id,
            client_tick: u32::MAX,
        },
    })
    .unwrap();
    let ack = p.accept_under_world_lock(w, LEASE, BOOT, &bytes).unwrap();
    assert_eq!(ack.sequence, seq);
    assert_eq!(ack.gesture_id, id);
    assert_eq!(ack.server_tick, w.tick);
    ack.status
}

fn hits(p: &mut SessionGestureWorldPath, w: &mut World, ticks: usize) -> Vec<(u8, u8)> {
    let mut result = vec![];
    for _ in 0..ticks {
        for e in w.step() {
            if let CombatEvent::Hit {
                attacker: 1,
                target: 2,
                damage,
                hp,
            } = e
            {
                result.push((damage, hp));
            }
        }
        p.advance_under_world_lock(w, LEASE, BOOT);
    }
    result
}

#[test]
fn genuine_second_lmb_click_during_light_recovery_must_not_kill_shared_outbox() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
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
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 10), vec![(34, 66)]);
    assert_ne!(w.fighter(1).unwrap().action, Action::Idle);

    // Human rapid clicking can produce another real DOWN/UP even though World
    // is still executing the first committed strike. This second gesture is
    // physically valid but must be NO-COMBAT, not a fatal shared-lease reject.
    let second = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Press,
        3,
        2,
    );
    assert_eq!(
        second,
        AckStatus::Accepted,
        "benign same-source busy PRESS must not retire shared source0/source1 outbox"
    );
    let terminal = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Release,
        4,
        2,
    );
    assert_eq!(terminal, AckStatus::Accepted);
    let duplicate = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Release,
        4,
        2,
    );
    assert_eq!(duplicate, AckStatus::Duplicate);
    assert!(hits(&mut p, &mut w, 55).is_empty());
    assert_eq!(w.fighter(2).unwrap().hp, 66.0);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // The no-op receipt must not poison the next real World 34HP light.
    let next = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Press,
        5,
        3,
    );
    assert_eq!(next, AckStatus::Accepted);
    let release = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Release,
        6,
        3,
    );
    assert_eq!(release, AckStatus::Accepted);
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 32)]);
}

#[test]
fn genuine_second_keye_click_during_autoheavy_must_not_kill_shared_outbox() {
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
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
            GestureSource::KeyE,
            GestureAction::Release,
            2,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    // Second distinct, monotonic, genuinely released KeyE keypress, while
    // first World autoheavy is still charging: transport only, no new 46HP.
    let second = admit(
        &mut p,
        &mut w,
        GestureSource::KeyE,
        GestureAction::Press,
        3,
        2,
    );
    assert_eq!(second, AckStatus::Accepted);
    let release = admit(
        &mut p,
        &mut w,
        GestureSource::KeyE,
        GestureAction::Release,
        4,
        2,
    );
    assert_eq!(release, AckStatus::Accepted);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Duplicate
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(46, 54)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

    // A later physically valid source0 light must not be lost when the
    // autoheavy ends. This is NOT a request to change standalone KeyE policy.
    let next = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Press,
        5,
        3,
    );
    assert_eq!(next, AckStatus::Accepted);
    let terminal = admit(
        &mut p,
        &mut w,
        GestureSource::Lmb,
        GestureAction::Release,
        6,
        3,
    );
    assert_eq!(terminal, AckStatus::Accepted);
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 20)]);
}

#[test]
fn same_source_new_press_cannot_be_admitted_while_previous_physical_press_is_held() {
    // Legitimate shared outbox permits only one held gesture per source.
    // A malicious second DOWN with new monotonic ID (but no first terminal)
    // must not steal the original World ownership, consume seq2 or mint a hit.
    // The *real* first RELEASE and the later fresh busy press still work.
    for source in [GestureSource::Lmb, GestureSource::KeyE] {
        let mut w = arena();
        let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 1, 1),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 2, 2),
            AckStatus::Rejected,
            "a second same-source press is invalid until the original source terminal"
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Release, 2, 1),
            AckStatus::Accepted,
            "invalid second source press may not consume the legitimate first terminal sequence"
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 3, 2),
            AckStatus::Accepted,
            "after the original release, the second physical press can be suppressed as busy"
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Release, 4, 2),
            AckStatus::Accepted
        );
        let expected = if source == GestureSource::Lmb {
            vec![(34, 66)]
        } else {
            vec![(46, 54)]
        };
        assert_eq!(hits(&mut p, &mut w, 55), expected);
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    }
}

#[test]
fn older_keye_terminal_must_not_unlock_a_newer_held_lmb_world_owner() {
    // An old source1 key-up can arrive long after standalone heavy committed.
    // Its receipt is valid, but must NOT mark a newer real source0 LMB
    // world owner as physically released and admit a forged double DOWN.
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(46, 54)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::AttackWindup);

    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted,
        "older KeyE physical terminal remains an ordered receipt"
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            4,
            3
        ),
        AckStatus::Rejected,
        "old KeyE terminal cannot authorize a second held-LMB DOWN"
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted,
        "real newer LMB terminal still owns the next nonconsumed seq"
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 20)]);
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}

#[test]
fn original_physical_hold_stays_owned_after_world_returns_idle() {
    // World 60Hz recovery is NOT an authenticated physical RELEASE.
    // A second same-source PRESS cannot be manufactured just because the
    // previous World strike fully completed while original key/button is held.
    for source in [GestureSource::Lmb, GestureSource::KeyE] {
        let mut w = arena();
        let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 1, 1),
            AckStatus::Accepted
        );
        let first = if source == GestureSource::Lmb {
            vec![(34, 66)]
        } else {
            vec![(46, 54)]
        };
        assert_eq!(hits(&mut p, &mut w, 55), first);
        assert_eq!(w.fighter(1).unwrap().action, Action::Idle);

        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 2, 2),
            AckStatus::Rejected,
            "World returning Idle must NOT impersonate physical source1/0 terminal"
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Release, 2, 1),
            AckStatus::Accepted,
            "a forged second PRESS may not consume the original matching release"
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Press, 3, 2),
            AckStatus::Accepted
        );
        assert_eq!(
            admit(&mut p, &mut w, source, GestureAction::Release, 4, 2),
            AckStatus::Accepted
        );
        let next = if source == GestureSource::Lmb {
            vec![(34, 32)]
        } else {
            vec![(46, 8)]
        };
        assert_eq!(hits(&mut p, &mut w, 55), next);
    }
}

#[test]
fn earlier_held_lmb_cannot_be_pressed_again_during_newer_keye_world_action() {
    // Source0 LMB physically held: original light lands without a RELEASE.
    // Independent source1 may later become a real World heavy owner, but a
    // forged second LMB DOWN must still be rejected (not no-combat ACK).
    let mut w = arena();
    let mut p = SessionGestureWorldPath::from_admitted_world(&w, 1, LEASE, BOOT).unwrap();
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(34, 66)]);
    assert_eq!(w.fighter(1).unwrap().action, Action::Idle);
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Press,
            2,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(w.fighter(1).unwrap().action, Action::HeavyAttackWindup);

    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Press,
            3,
            3
        ),
        AckStatus::Rejected,
        "independent KeyE World ownership must not release earlier held LMB"
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::Lmb,
            GestureAction::Release,
            3,
            1
        ),
        AckStatus::Accepted
    );
    assert_eq!(
        admit(
            &mut p,
            &mut w,
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2
        ),
        AckStatus::Accepted
    );
    assert_eq!(hits(&mut p, &mut w, 55), vec![(46, 20)]);
    assert_eq!(w.fighter(2).unwrap().hp, 20.0);
}
