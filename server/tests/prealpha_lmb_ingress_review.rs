//! Strict dormant Core 8A ingress ordering tests. REAL original Combat codec
//! event bytes/ACK encoding, but no production QUIC hook or Combat dispatch.
use myaso_server::{
    prealpha_lmb_gesture_proposal::{
        encode_ack, encode_event, AckStatus, GestureAction, GestureEvent, BYTES,
    },
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
};

fn lease(id: u32, generation: u64, nonce: u64) -> TrustedLeaseKey {
    TrustedLeaseKey::review_from_admission(id, generation, nonce).expect("valid trusted fixture")
}
fn event(kind: GestureAction, seq: u32, gesture: u32, client_tick: u32) -> [u8; BYTES] {
    encode_event(GestureEvent {
        action: kind,
        sequence: seq,
        gesture_id: gesture,
        client_tick,
    })
    .expect("typed Combat-owned protocol")
}
fn accepted(result: IngressResult, expected: &[(u32, u32)]) {
    match result {
        IngressResult::Accepted(edges) => {
            let pairs: Vec<_> = edges
                .iter()
                .map(|e| (e.event.sequence, e.event.gesture_id))
                .collect();
            assert_eq!(pairs, expected);
            for edge in edges {
                assert_eq!(edge.ack.status, AckStatus::Accepted);
                let bytes = encode_ack(edge.ack).expect("correlated canonical ACK");
                assert_eq!(bytes[0], 2);
                assert_eq!(bytes[1], 0x12);
                assert_eq!(edge.ack.sequence, edge.event.sequence);
                assert_eq!(edge.ack.gesture_id, edge.event.gesture_id);
                // Receipt is ONLY transport application, no HIT, no HP, no timing.
            }
        }
        other => panic!("missing legitimate ordered event: {other:?}"),
    }
}

#[test]
fn fast_press_and_release_same_client_tick_are_two_server_accepted_ordered_edges() {
    let l = lease(1, 1, 100);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 1, 99), 30),
        &[(1, 1)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Release, 2, 1, 99), 30),
        &[(2, 1)],
    );
    assert_eq!(gate.accepted_count(), 2);
    assert!(!gate.is_closed());
}

#[test]
fn real_out_of_order_release_waits_for_press_without_speculative_server_ack() {
    let l = lease(2, 4, 222);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    assert_eq!(
        gate.review_ingest(l, &event(GestureAction::Release, 2, 8, 222), 40),
        IngressResult::Deferred
    );
    assert_eq!(gate.buffered_count(), 1);
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 8, 222), 41),
        &[(1, 8), (2, 8)],
    );
    assert_eq!(gate.buffered_count(), 0);
}

#[test]
fn accepted_retransmit_acks_duplicate_not_second_combat_edge() {
    let l = lease(1, 2, 3);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let p = event(GestureAction::Press, 1, 1, 1);
    accepted(gate.review_ingest(l, &p, 5), &[(1, 1)]);
    let reply = gate.review_ingest(l, &p, 6);
    match reply {
        IngressResult::Duplicate(ack) => {
            assert_eq!(ack.status, AckStatus::Duplicate);
            assert_eq!(ack.server_tick, 6);
        }
        other => panic!("replayed sequence caused different outcome: {other:?}"),
    }
    assert_eq!(gate.accepted_count(), 1);
}

#[test]
fn accepted_sequence_replay_with_changed_action_or_tick_is_not_a_duplicate_ack() {
    for tampered in [
        event(GestureAction::Release, 1, 1, 777),
        event(GestureAction::Press, 1, 1, 778),
    ] {
        let l = lease(1, 5, 100);
        let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
        accepted(
            gate.review_ingest(l, &event(GestureAction::Press, 1, 1, 777), 50),
            &[(1, 1)],
        );
        match gate.review_ingest(l, &tampered, 51) {
            IngressResult::Rejected(Some(ack)) => {
                assert_eq!(ack.status, AckStatus::Rejected);
                assert_eq!(ack.sequence, 1);
            }
            other => panic!("equivocal accepted-event replay was not denied: {other:?}"),
        }
        assert!(gate.is_closed());
        assert_eq!(gate.accepted_count(), 1);
    }
}

#[test]
fn old_actor_lease_and_connection_nonce_can_never_drive_new_actor() {
    let old = lease(4, 8, 88);
    let current = lease(4, 9, 99);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(current);
    let p = event(GestureAction::Press, 1, 1, 1);
    match gate.review_ingest(old, &p, 20) {
        IngressResult::Stale(ack) => assert_eq!(ack.status, AckStatus::Stale),
        other => panic!("stale old connection replay accepted: {other:?}"),
    }
    assert_eq!(gate.accepted_count(), 0);
    accepted(gate.review_ingest(current, &p, 21), &[(1, 1)]);
    gate.close();
    assert!(gate.is_closed());
    assert_eq!(
        gate.review_ingest(current, &event(GestureAction::Release, 2, 1, 2), 22),
        IngressResult::Rejected(None)
    );
}

#[test]
fn stale_malformed_packets_cannot_poison_live_lease_or_held_out_of_order_edges() {
    let current = lease(9, 11, 999);
    let stale_generation = lease(9, 10, 998);
    let different_actor = lease(10, 11, 999);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(current);
    let press = event(GestureAction::Press, 1, 10, 1);
    let release = event(GestureAction::Release, 2, 10, 1);

    // Hold a real future RELEASE until the current lease's PRESS arrives.
    assert_eq!(gate.review_ingest(current, &release, 30), IngressResult::Deferred);
    assert_eq!(gate.buffered_count(), 1);

    let mut wrong_version = press;
    wrong_version[0] = 1;
    let mut wrong_wire_family = press;
    wrong_wire_family[1] = 0x52;
    for old in [stale_generation, different_actor] {
        for malformed in [&[][..], &wrong_version[..], &wrong_wire_family[..]] {
            // No ACK possible for malformed events, but the current lease
            // MUST NOT be retired by bytes from another trusted connection.
            assert_eq!(
                gate.review_ingest(old, malformed, 31),
                IngressResult::Rejected(None)
            );
            assert!(!gate.is_closed());
            assert_eq!(gate.buffered_count(), 1);
            assert_eq!(gate.accepted_count(), 0);
        }
    }

    // Valid packets from a stale lease retain the existing STALE response,
    // without consuming either pending event or changing the active lease.
    match gate.review_ingest(stale_generation, &press, 32) {
        IngressResult::Stale(ack) => assert_eq!(ack.status, AckStatus::Stale),
        other => panic!("stale valid event had unexpected result: {other:?}"),
    }
    assert!(!gate.is_closed());

    accepted(gate.review_ingest(current, &press, 33), &[(1, 10), (2, 10)]);
    assert_eq!(gate.buffered_count(), 0);
    assert_eq!(gate.accepted_count(), 2);
    assert!(!gate.is_closed());
}

#[test]
fn buffered_duplicate_keeps_one_edge_and_equivocal_payload_closes_fail_closed() {
    let l = lease(1, 1, 1);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let future = event(GestureAction::Release, 2, 1, 30);
    assert_eq!(gate.review_ingest(l, &future, 1), IngressResult::Deferred);
    assert_eq!(gate.review_ingest(l, &future, 1), IngressResult::Deferred);
    assert_eq!(gate.buffered_count(), 1);
    let equivocal = event(GestureAction::Cancel, 2, 1, 30);
    assert!(matches!(
        gate.review_ingest(l, &equivocal, 2),
        IngressResult::Rejected(Some(_))
    ));
    assert!(gate.is_closed());
    assert_eq!(gate.accepted_count(), 0);
}

#[test]
fn unknown_missing_prefix_or_large_gap_is_never_skipped_into_release() {
    let l = lease(1, 1, 2);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    assert!(matches!(
        gate.review_ingest(l, &event(GestureAction::Release, 50, 1, 0), 1),
        IngressResult::Rejected(Some(_))
    ));
    assert!(gate.is_closed());
}

#[test]
fn orphan_release_is_rejected_and_does_not_claim_attack_hit() {
    let l = lease(1, 1, 9);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    assert!(matches!(
        gate.review_ingest(l, &event(GestureAction::Release, 1, 1, 0), 1),
        IngressResult::Rejected(Some(_))
    ));
    assert_eq!(gate.accepted_count(), 0);
    assert!(gate.is_closed());
}

#[test]
fn one_held_gesture_upgrades_and_releases_in_exact_order_and_new_id_increases() {
    let l = lease(1, 1, 10);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 101, 1), 9),
        &[(1, 101)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Upgrade, 2, 101, 2), 10),
        &[(2, 101)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Release, 3, 101, 3), 20),
        &[(3, 101)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 4, 102, 4), 21),
        &[(4, 102)],
    );
    assert_eq!(gate.accepted_count(), 4);
}

#[test]
fn late_upgrade_after_terminal_is_rejected_no_revival() {
    let l = lease(1, 1, 11);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 1, 0), 1),
        &[(1, 1)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Cancel, 2, 1, 0), 2),
        &[(2, 1)],
    );
    assert!(matches!(
        gate.review_ingest(l, &event(GestureAction::Upgrade, 3, 1, 0), 4),
        IngressResult::Rejected(Some(_))
    ));
    assert!(gate.is_closed());
}

#[test]
fn new_gesture_with_reused_or_lower_monotonic_id_is_rejected() {
    let l = lease(1, 1, 12);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    accepted(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 10, 0), 1),
        &[(1, 10)],
    );
    accepted(
        gate.review_ingest(l, &event(GestureAction::Release, 2, 10, 0), 2),
        &[(2, 10)],
    );
    assert!(matches!(
        gate.review_ingest(l, &event(GestureAction::Press, 3, 9, 0), 3),
        IngressResult::Rejected(Some(_))
    ));
    assert!(gate.is_closed());
}

#[test]
fn buffered_invalid_future_transition_prevents_partial_earlier_event_dispatch() {
    let l = lease(1, 1, 13);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    // Simultaneous RED scenario: pending future unmatched upgrade after release.
    assert_eq!(
        gate.review_ingest(l, &event(GestureAction::Upgrade, 3, 1, 0), 1),
        IngressResult::Deferred
    );
    assert_eq!(
        gate.review_ingest(l, &event(GestureAction::Release, 2, 1, 0), 1),
        IngressResult::Deferred
    );
    assert!(matches!(
        gate.review_ingest(l, &event(GestureAction::Press, 1, 1, 0), 1),
        IngressResult::Rejected(Some(_))
    ));
    assert_eq!(gate.accepted_count(), 0);
    assert!(gate.is_closed());
}

#[test]
fn invalid_v1_or_alternative_8c_wire_cannot_activate_review_v2_gate() {
    let l = lease(1, 1, 14);
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let mut bad = event(GestureAction::Press, 1, 1, 1);
    bad[0] = 1;
    assert_eq!(
        gate.review_ingest(l, &bad, 2),
        IngressResult::Rejected(None)
    );
    assert!(gate.is_closed());
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let mut variant = event(GestureAction::Press, 1, 1, 1);
    variant[1] = 0x52;
    assert_eq!(
        gate.review_ingest(l, &variant, 2),
        IngressResult::Rejected(None)
    );
    assert!(gate.is_closed());
}

#[test]
fn current_lease_binding_must_have_nonzero_authenticated_values() {
    assert!(TrustedLeaseKey::review_from_admission(0, 1, 1).is_none());
    assert!(TrustedLeaseKey::review_from_admission(1, 0, 1).is_none());
    assert!(TrustedLeaseKey::review_from_admission(1, 1, 0).is_none());
}
