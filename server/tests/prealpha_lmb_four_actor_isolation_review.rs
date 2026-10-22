//! Dormant Rust receiver test: identical original JS source bytes on four fixture leases.
//! This does not implement or authenticate a real network connection.
use myaso_server::{
    prealpha_lmb_gesture_proposal::{AckStatus, GestureAction, BYTES},
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
};
fn sample(label: &str) -> [u8; BYTES] {
    let data = include_str!("../../tests/fixtures/core8a-prealpha-v2-js-rust-wire.hex");
    let hex = data.lines().filter_map(|line| {
        let mut fields = line.split_whitespace();
        match (fields.next(), fields.next(), fields.next()) {
            (Some(name), Some(hex), None) if name == label => Some(hex),
            _ => None,
        }
    }).next().expect("original JS fixture");
    assert_eq!(hex.len(), 2 * BYTES);
    let mut bytes = [0u8; BYTES];
    for (i, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).expect("hex");
    }
    bytes
}
fn lease(actor: u32, generation: u64) -> TrustedLeaseKey {
    TrustedLeaseKey::review_from_admission(actor, generation, 100 + u64::from(actor))
        .expect("valid test lease")
}
#[test]
fn four_fixture_receivers_keep_identical_js_bytes_and_ack_histories_independent() {
    let press = sample("TAP_PRESS");
    let release = sample("TAP_RELEASE");
    let keys: Vec<_> = (1..=4).map(|a| lease(a, 7)).collect();
    let mut gates: Vec<_> = keys.iter().copied()
        .map(ReviewLmbIngress::new_from_trusted_admission).collect();
    for i in 0..4 {
        let wrong_key = keys[(i + 1) % 4];
        assert!(matches!(gates[i].review_ingest(wrong_key, &press, 11),
            IngressResult::Stale(_)));
        assert_eq!(gates[i].accepted_count(), 0);
        assert!(!gates[i].is_closed());
    }
    for i in 0..4 {
        let IngressResult::Accepted(edges) = gates[i].review_ingest(keys[i], &press, 12)
        else { panic!("own first edge"); };
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].event.sequence, 1);
        assert_eq!(edges[0].event.action, GestureAction::Press);
        assert_eq!(edges[0].ack.status, AckStatus::Accepted);
    }
    for i in (0..4).rev() {
        let IngressResult::Accepted(edges) = gates[i].review_ingest(keys[i], &release, 13)
        else { panic!("own terminal edge"); };
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].event.sequence, 2);
        assert_eq!(edges[0].event.action, GestureAction::Release);
        assert_eq!(edges[0].ack.status, AckStatus::Accepted);
    }
    for i in 0..4 {
        let IngressResult::Duplicate(ack) = gates[i].review_ingest(keys[i], &press, 14)
        else { panic!("exact retransmit"); };
        assert_eq!(ack.status, AckStatus::Duplicate);
        assert_eq!(gates[i].accepted_count(), 2);
        assert_eq!(gates[i].buffered_count(), 0);
    }
}
#[test]
fn replaced_fixture_generation_restarts_sequence_without_inheriting_history() {
    let press = sample("TAP_PRESS");
    let release = sample("TAP_RELEASE");
    let prior = lease(4, 9);
    let current = lease(4, 10);
    let mut old = ReviewLmbIngress::new_from_trusted_admission(prior);
    assert!(matches!(old.review_ingest(prior, &press, 20), IngressResult::Accepted(_)));
    old.close();
    let mut fresh = ReviewLmbIngress::new_from_trusted_admission(current);
    assert!(matches!(fresh.review_ingest(prior, &press, 21), IngressResult::Stale(_)));
    assert_eq!(fresh.accepted_count(), 0);
    assert!(matches!(fresh.review_ingest(current, &press, 22), IngressResult::Accepted(_)));
    assert!(matches!(fresh.review_ingest(current, &release, 23), IngressResult::Accepted(_)));
    assert_eq!(fresh.accepted_count(), 2);
}
