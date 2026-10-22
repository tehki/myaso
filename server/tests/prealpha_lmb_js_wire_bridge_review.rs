//! Original, dormant Combat4 JS-outbox-to-Rust-gate wire interop proof.
//! Rust consumes byte-identical fixture exported from the actual JS outbox.
//! No live QUIC, Combat HIT, World lease, browser or packet negotiation.
use myaso_server::{
    prealpha_lmb_gesture_proposal::{decode_event, encode_ack, AckStatus, GestureAction, BYTES},
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
};

fn fixture(label: &str) -> [u8; BYTES] {
    let source = include_str!("../../tests/fixtures/core8a-prealpha-v2-js-rust-wire.hex");
    let hex = source
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            match (parts.next(), parts.next(), parts.next()) {
                (Some(name), Some(value), None) if name == label => Some(value),
                _ => None,
            }
        })
        .next()
        .expect("byte fixture label");
    assert_eq!(hex.len(), BYTES * 2, "must be exact fixed Combat ABI");
    let mut bytes = [0u8; BYTES];
    for (i, value) in bytes.iter_mut().enumerate() {
        *value = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).expect("ASCII hex");
    }
    bytes
}
fn lease() -> TrustedLeaseKey {
    TrustedLeaseKey::review_from_admission(4, 3, 123).expect("fixture connection is assigned")
}
fn accepted(result: IngressResult, actions: &[GestureAction], server_tick: u32) {
    let IngressResult::Accepted(edges) = result else {
        panic!("expected accepted ordered original JS events");
    };
    assert_eq!(edges.len(), actions.len());
    for (edge, action) in edges.iter().zip(actions) {
        assert_eq!(edge.event.action, *action);
        assert_eq!(edge.ack.status, AckStatus::Accepted);
        assert_eq!(edge.ack.server_tick, server_tick);
        assert_eq!(edge.ack.gesture_id, edge.event.gesture_id);
        assert_eq!(edge.ack.sequence, edge.event.sequence);
        let encoded = encode_ack(edge.ack).expect("original Combat ACK codec");
        assert_eq!(encoded[0], 2);
        assert_eq!(encoded[1], 0x12);
    }
}
#[test]
fn original_js_same_tick_press_release_survives_reverse_wire_arrival_without_two_hits() {
    let l = lease();
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let press = fixture("TAP_PRESS");
    let release = fixture("TAP_RELEASE");
    assert_eq!(
        decode_event(&press).expect("JS press").client_tick,
        0x11223344
    );
    assert_eq!(
        decode_event(&release).expect("JS release").client_tick,
        0x11223344
    );
    assert_eq!(
        gate.review_ingest(l, &release, 0x0a0b0c0d),
        IngressResult::Deferred
    );
    let IngressResult::Accepted(edges) = gate.review_ingest(l, &press, 0x0a0b0c0d) else {
        panic!("real JS press must release the buffered exact matching up event");
    };
    assert_eq!(edges.len(), 2);
    assert_eq!(edges[0].event.action, GestureAction::Press);
    assert_eq!(edges[1].event.action, GestureAction::Release);
    assert_eq!(
        encode_ack(edges[0].ack).expect("original Rust accepted ACK"),
        fixture("ACK_ACCEPTED_FIRST"),
    );
    let duplicate = gate.review_ingest(l, &release, 0x0a0b0c0d);
    let IngressResult::Duplicate(ack) = duplicate else {
        panic!("same exact JS release retransmit must never be accepted twice");
    };
    assert_eq!(
        encode_ack(ack).expect("Rust duplicate ACK"),
        fixture("ACK_DUPLICATE_SECOND"),
    );
    assert_eq!(gate.accepted_count(), 2);
}
#[test]
fn original_js_held_press_upgrade_release_is_one_ordered_gesture_despite_reorder() {
    let l = lease();
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    let press = fixture("HOLD_PRESS");
    let upgrade = fixture("HOLD_UPGRADE");
    let release = fixture("HOLD_RELEASE");
    assert_eq!(decode_event(&press).expect("press").gesture_id, 1);
    assert_eq!(
        decode_event(&upgrade).expect("upgrade").client_tick,
        0x66778899
    );
    assert_eq!(
        decode_event(&release).expect("release").client_tick,
        0x99aabbcc
    );
    assert_eq!(
        gate.review_ingest(l, &release, 111),
        IngressResult::Deferred
    );
    assert_eq!(
        gate.review_ingest(l, &upgrade, 112),
        IngressResult::Deferred
    );
    accepted(
        gate.review_ingest(l, &press, 113),
        &[
            GestureAction::Press,
            GestureAction::Upgrade,
            GestureAction::Release,
        ],
        113,
    );
    assert_eq!(gate.accepted_count(), 3);
    assert!(!gate.is_closed());
    // No server Combat timing or damage authority is claimed by this gate.
}
#[test]
fn original_js_cancel_is_not_promoted_to_release_or_legacy_standalone_keye() {
    let l = lease();
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    accepted(
        gate.review_ingest(l, &fixture("CANCEL_PRESS"), 1),
        &[GestureAction::Press],
        1,
    );
    accepted(
        gate.review_ingest(l, &fixture("CANCEL_CANCEL"), 2),
        &[GestureAction::Cancel],
        2,
    );
    assert_eq!(gate.accepted_count(), 2);
    let stale = fixture("TAP_RELEASE");
    assert!(matches!(
        gate.review_ingest(l, &stale, 3),
        IngressResult::Stale(_) | IngressResult::Rejected(_)
    ));
}
#[test]
fn real_js_event_bytes_refuse_wrong_authenticated_actor_generation_and_8c_alternative() {
    let l = lease();
    let stale = TrustedLeaseKey::review_from_admission(4, 2, 123).expect("old lease");
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    assert!(matches!(
        gate.review_ingest(stale, &fixture("TAP_PRESS"), 20),
        IngressResult::Stale(_)
    ));
    assert_eq!(gate.accepted_count(), 0);
    let mut other = fixture("TAP_PRESS");
    other[1] = 0x52;
    assert_eq!(
        gate.review_ingest(l, &other, 20),
        IngressResult::Rejected(None)
    );
    assert_eq!(gate.accepted_count(), 0);
    assert!(gate.is_closed());
}
