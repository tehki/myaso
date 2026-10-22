//! Fail-first pure authoritative gesture tests. No live QUIC/browser callers.
use myaso_server::prealpha_lmb_gesture_authority::{Command, Disposition, GestureAuthority, Phase};
use myaso_server::prealpha_lmb_gesture_proposal::{GestureAction, GestureEvent};

const LEASE: u64 = 0x0102_0304;
fn event(action: GestureAction, seq: u32, id: u32, client_tick: u32) -> GestureEvent {
    GestureEvent {
        action,
        sequence: seq,
        gesture_id: id,
        client_tick,
    }
}
fn send(
    a: &mut GestureAuthority,
    action: GestureAction,
    seq: u32,
    id: u32,
    at: u64,
) -> (Disposition, Command) {
    let decision = a.process(LEASE, event(action, seq, id, 999_999_999), at);
    (decision.disposition, decision.command)
}
#[test]
fn light_windup_starts_at_authenticated_press_and_activates_only_at_135_server_ms() {
    let mut a = GestureAuthority::new(LEASE);
    assert_eq!(
        send(&mut a, GestureAction::Press, 1, 7, 10),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
    assert_eq!(a.phase(), Phase::LightWindup);
    assert_eq!(
        a.advance(LEASE, 144),
        None,
        "client tick must never bypass original 135ms windup"
    );
    assert_eq!(a.advance(LEASE, 145), Some(Command::ActivateLight));
    assert_eq!(a.phase(), Phase::LightActive);
    assert_eq!(
        a.advance(LEASE, 450),
        None,
        "same press can activate one light only"
    );
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 7, 450),
        (Disposition::Rejected, Command::None)
    );
}
#[test]
fn early_upgrade_keeps_original_server_press_clock_ready_320_until_release() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 7, 100);
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 7, 180),
        (
            Disposition::Accepted,
            Command::UpgradeHeldHeavy {
                server_elapsed_ms: 80
            }
        )
    );
    assert_eq!(a.advance(LEASE, 419), None);
    assert_eq!(a.phase(), Phase::HeavyCharging);
    assert_eq!(a.advance(LEASE, 420), Some(Command::HeavyReady));
    assert_eq!(a.phase(), Phase::HeavyReady);
    for now in [800, 1200, 90_000] {
        assert_eq!(a.advance(LEASE, now), None, "READY never auto-hits");
    }
    assert_eq!(
        send(&mut a, GestureAction::Release, 3, 7, 90_001),
        (Disposition::Accepted, Command::ReleaseHeavy)
    );
    assert_eq!(a.phase(), Phase::HeavyActive);
    assert_eq!(a.advance(LEASE, 90_100), None);
}
#[test]
fn quick_release_and_early_upgrade_release_are_one_light_only() {
    let mut a = GestureAuthority::new(LEASE);
    assert_eq!(
        send(&mut a, GestureAction::Press, 1, 7, 100),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 2, 7, 105),
        (Disposition::Accepted, Command::None)
    );
    assert_eq!(a.advance(LEASE, 235), Some(Command::ActivateLight));
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 3, 7, 240),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(a.advance(LEASE, 999), None);
    assert!(a.retire(LEASE, 7));

    assert_eq!(
        send(&mut a, GestureAction::Press, 4, 8, 1_000),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 5, 8, 1_080),
        (
            Disposition::Accepted,
            Command::UpgradeHeldHeavy {
                server_elapsed_ms: 80
            }
        )
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 6, 8, 1_300),
        (
            Disposition::Accepted,
            Command::ResumeLight {
                server_elapsed_ms: 300
            }
        ),
        "release before 320ms may only resume the original legitimate light"
    );
    assert_eq!(a.phase(), Phase::LightActive);
    assert_eq!(a.advance(LEASE, 1_999), None);
}
#[test]
fn cancelled_before_contact_has_no_impact_and_cannot_upgrade() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 3, 100);
    assert_eq!(
        send(&mut a, GestureAction::Cancel, 2, 3, 150),
        (Disposition::Accepted, Command::CancelUnlandedLight)
    );
    assert_eq!(a.phase(), Phase::Cancelled);
    assert_eq!(a.advance(LEASE, 999), None);
    assert_eq!(
        send(&mut a, GestureAction::Release, 3, 3, 1_000),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 4, 3, 1_001),
        (Disposition::Rejected, Command::None)
    );
}
#[test]
fn cancellation_after_held_upgrade_never_fires_a_heavy() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 8, 100);
    send(&mut a, GestureAction::Upgrade, 2, 8, 160);
    assert_eq!(a.advance(LEASE, 520), Some(Command::HeavyReady));
    assert_eq!(
        send(&mut a, GestureAction::Cancel, 3, 8, 530),
        (Disposition::Accepted, Command::CancelUnlandedLight)
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 4, 8, 540),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(a.advance(LEASE, 600), None);
}
#[test]
fn replay_reordering_id_reuse_and_a_different_session_fail_closed() {
    let mut a = GestureAuthority::new(LEASE);
    let press = event(GestureAction::Press, 1, 41, 20);
    assert_eq!(
        a.process(LEASE + 1, press, 0).disposition,
        Disposition::Rejected,
        "QUIC lease mismatch"
    );
    assert_eq!(
        a.process(LEASE, press, 0).command,
        Command::BeginLightWindup
    );
    assert_eq!(
        a.process(LEASE, press, 1).disposition,
        Disposition::Duplicate
    );
    assert_eq!(
        a.process(LEASE, event(GestureAction::Cancel, 1, 41, 20), 2)
            .disposition,
        Disposition::Rejected,
        "same sequence with different action is not an idempotent replay"
    );
    assert_eq!(
        a.process(LEASE, event(GestureAction::Release, 9, 42, 20), 3)
            .disposition,
        Disposition::Rejected,
        "no cross-gesture release"
    );
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 41, 70),
        (
            Disposition::Accepted,
            Command::UpgradeHeldHeavy {
                server_elapsed_ms: 70
            }
        )
    );
    assert_eq!(
        a.process(LEASE, press, 71).disposition,
        Disposition::Duplicate
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 3, 41, 320),
        (Disposition::Accepted, Command::ReleaseHeavy)
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 3, 41, 321).0,
        Disposition::Duplicate
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 4, 41, 322).0,
        Disposition::Rejected
    );
    assert!(a.retire(LEASE, 41));
    assert_eq!(
        send(&mut a, GestureAction::Press, 5, 41, 400).0,
        Disposition::Rejected,
        "retired ID never resurrects"
    );
    assert_eq!(
        send(&mut a, GestureAction::Press, 6, 42, 401),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
}
#[test]
fn delayed_upgrade_after_light_hit_and_dropped_upgrade_edge_never_double_hit() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 7, 0);
    assert_eq!(a.advance(LEASE, 135), Some(Command::ActivateLight));
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 7, 300),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(
        send(&mut a, GestureAction::Release, 3, 7, 500),
        (Disposition::Accepted, Command::None)
    );
    assert_eq!(a.advance(LEASE, 1000), None);
    assert_eq!(a.phase(), Phase::LightActive);
}
#[test]
fn delayed_release_without_server_upgrade_is_just_one_light_even_after_320ms() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 7, 0);
    assert_eq!(a.advance(LEASE, 135), Some(Command::ActivateLight));
    assert_eq!(
        send(&mut a, GestureAction::Release, 4, 7, 9_000),
        (Disposition::Accepted, Command::None)
    );
    assert_eq!(a.phase(), Phase::LightActive);
    assert_eq!(a.advance(LEASE, 50_000), None);
}
#[test]
fn early_out_of_order_upgrade_does_not_adopt_unrelated_future_press() {
    let mut a = GestureAuthority::new(LEASE);
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 17, 5),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(
        send(&mut a, GestureAction::Press, 1, 17, 10),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 17, 50),
        (
            Disposition::Accepted,
            Command::UpgradeHeldHeavy {
                server_elapsed_ms: 40
            }
        )
    );
}

#[test]
fn strict_135_and_320_millisecond_server_boundaries_never_authorize_early_heavy() {
    for upgrade_at in [1, 80, 134] {
        let mut a = GestureAuthority::new(LEASE);
        send(&mut a, GestureAction::Press, 1, 8, 0);
        assert_eq!(
            send(&mut a, GestureAction::Upgrade, 2, 8, upgrade_at),
            (
                Disposition::Accepted,
                Command::UpgradeHeldHeavy {
                    server_elapsed_ms: upgrade_at
                }
            )
        );
        assert_eq!(a.advance(LEASE, 319), None);
        assert_eq!(
            send(&mut a, GestureAction::Release, 3, 8, 319),
            (
                Disposition::Accepted,
                Command::ResumeLight {
                    server_elapsed_ms: 319
                }
            )
        );
        assert_eq!(
            a.advance(LEASE, 321),
            None,
            "early release must never turn into delayed heavy"
        );
    }
    let mut at_boundary = GestureAuthority::new(LEASE);
    send(&mut at_boundary, GestureAction::Press, 1, 8, 0);
    send(&mut at_boundary, GestureAction::Upgrade, 2, 8, 134);
    assert_eq!(
        send(&mut at_boundary, GestureAction::Release, 3, 8, 320),
        (Disposition::Accepted, Command::ReleaseHeavy)
    );
    let mut too_late = GestureAuthority::new(LEASE);
    send(&mut too_late, GestureAction::Press, 1, 8, 0);
    assert_eq!(
        send(&mut too_late, GestureAction::Upgrade, 2, 8, 135),
        (Disposition::Rejected, Command::None),
        "light is already active at 135 server ms"
    );
}
#[test]
fn strict_lease_cancel_and_stale_time_cannot_reanimate_or_rollback_server_actions() {
    let mut a = GestureAuthority::new(LEASE);
    send(&mut a, GestureAction::Press, 1, 7, 1_000);
    assert_eq!(a.advance(LEASE, 1_100), None);
    assert_eq!(a.advance(LEASE + 1, 9_999), None);
    assert_eq!(a.advance(LEASE, 1_050), None);
    assert_eq!(
        send(&mut a, GestureAction::Upgrade, 2, 7, 1_070),
        (Disposition::Rejected, Command::None)
    );
    assert_eq!(
        send(&mut a, GestureAction::Cancel, 3, 7, 1_101),
        (Disposition::Accepted, Command::CancelUnlandedLight)
    );
    assert!(!a.retire(LEASE + 1, 7));
    assert!(a.retire(LEASE, 7));
    assert_eq!(
        send(&mut a, GestureAction::Press, 4, 8, 1_102),
        (Disposition::Accepted, Command::BeginLightWindup)
    );
}
#[test]
fn bounded_replay_window_keeps_safe_monotonic_sequence_and_rejects_old_ids() {
    let mut a = GestureAuthority::new(LEASE);
    let mut sequence = 1;
    for gesture_id in 1..=80u32 {
        assert_eq!(
            send(
                &mut a,
                GestureAction::Press,
                sequence,
                gesture_id,
                gesture_id as u64 * 500
            )
            .0,
            Disposition::Accepted
        );
        sequence += 1;
        assert_eq!(
            send(
                &mut a,
                GestureAction::Cancel,
                sequence,
                gesture_id,
                gesture_id as u64 * 500 + 1
            )
            .0,
            Disposition::Accepted
        );
        sequence += 1;
        assert!(a.retire(LEASE, gesture_id));
    }
    assert_eq!(
        send(&mut a, GestureAction::Press, 1, 1, 41_000).0,
        Disposition::Stale
    );
    assert_eq!(
        send(&mut a, GestureAction::Press, sequence, 1, 41_001).0,
        Disposition::Rejected,
        "reused gesture identity is denied even after journal eviction"
    );
    assert_eq!(
        send(&mut a, GestureAction::Press, sequence + 1, 81, 41_002).0,
        Disposition::Accepted
    );
}
