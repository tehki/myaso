//! Core 8A exact-source JS 22-edge first-send window -> original Rust ingress.
//! The shared immutable fixture is asserted against ACTUAL JS outbox bytes in
//! tests/core8a-prealpha-v2-22edge-window.test.mjs. No live QUIC or Combat HIT.
use myaso_server::{
    prealpha_lmb_gesture_proposal::{decode_event, encode_ack, AckStatus, GestureAction, BYTES},
    prealpha_lmb_ingress_review::{IngressResult, ReviewLmbIngress, TrustedLeaseKey},
};

fn golden() -> Vec<[u8; BYTES]> {
    let source = include_str!("../../tests/fixtures/core8a-prealpha-v2-22edge-window.hex");
    source
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .enumerate()
        .map(|(index, line)| {
            let columns: Vec<_> = line.split_whitespace().collect();
            assert_eq!(columns.len(), 3, "fixture must have seq, action, hex");
            let seq: usize = columns[0].parse().expect("decimal sequence");
            assert_eq!(seq, index + 1);
            assert_eq!(columns[2].len(), 2 * BYTES);
            let mut bytes = [0u8; BYTES];
            for (i, byte) in bytes.iter_mut().enumerate() {
                *byte = u8::from_str_radix(&columns[2][i * 2..i * 2 + 2], 16).expect("hex event");
            }
            let event = decode_event(&bytes).expect("original Combat4 Rust event");
            assert_eq!(event.sequence as usize, seq);
            assert_eq!(event.gesture_id as usize, (seq + 1) / 2);
            assert_eq!(event.client_tick, 0x1100 + (index / 2) as u32);
            assert_eq!(
                event.action,
                if seq % 2 == 1 {
                    GestureAction::Press
                } else {
                    GestureAction::Release
                }
            );
            bytes
        })
        .collect()
}
fn lease() -> TrustedLeaseKey {
    // TEST ONLY: the constructor does not authenticate a true WebTransport session.
    TrustedLeaseKey::review_from_admission(7, 13, 31).expect("nonzero review-only lease")
}

#[test]
fn actual_js_22_edge_byte_fixture_fits_original_rust_gap_at_exact_17_event_boundary() {
    let fixture = golden();
    assert_eq!(fixture.len(), 22);
    let l = lease();
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);

    // On a future independently reordered transport, JS never offers seq18
    // before the oldest seq1 is acknowledged. The entire allowed seq2..17
    // prefix can be buffered without any false accepted-edge transport ACK.
    for sequence in (2..=17).rev() {
        assert_eq!(
            gate.review_ingest(l, &fixture[sequence - 1], sequence as u32),
            IngressResult::Deferred,
        );
        assert!(!gate.is_closed(), "sender window must match Rust MAX_GAP");
    }
    assert_eq!(gate.buffered_count(), 16);
    assert_eq!(gate.accepted_count(), 0);
    // Missing seq1 arrives: Rust validates all 17 real distinct original
    // PRESS/RELEASE events atomically and ACKs exact original source bytes.
    let IngressResult::Accepted(unblocked) = gate.review_ingest(l, &fixture[0], 100) else {
        panic!("true original JS prefix must atomically unblock all 17 legal edges");
    };
    assert_eq!(unblocked.len(), 17);
    for (i, edge) in unblocked.iter().enumerate() {
        assert_eq!(edge.event.sequence as usize, i + 1);
        assert_eq!(edge.ack.status, AckStatus::Accepted);
        assert_eq!(edge.ack.server_tick, 100);
        let ack_bytes = encode_ack(edge.ack).expect("original typed Rust ACK");
        assert_eq!(&ack_bytes[..2], &[2, 0x12]);
        assert_eq!(ack_bytes[3], 0);
    }
    assert_eq!(gate.buffered_count(), 0);
    assert_eq!(gate.accepted_count(), 17);
    for (i, event) in fixture.iter().enumerate().skip(17) {
        let IngressResult::Accepted(edges) = gate.review_ingest(l, event, 101) else {
            panic!("later JS window event must be accepted only after prefix");
        };
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].event.sequence as usize, i + 1);
        assert_eq!(edges[0].ack.status, AckStatus::Accepted);
    }
    assert!(!gate.is_closed());
    assert_eq!(gate.accepted_count(), 22);
    assert_eq!(gate.buffered_count(), 0);
    // Retransmitting a genuine original JS event cannot create another action.
    let IngressResult::Duplicate(ack) = gate.review_ingest(l, &fixture[1], 102) else {
        panic!("exact original JS replays must be transport-only duplicates");
    };
    assert_eq!(ack.status, AckStatus::Duplicate);
    assert_eq!(gate.accepted_count(), 22);
}
#[test]
fn one_event_beyond_the_allowed_js_window_fail_closes_real_rust_ingress() {
    let fixture = golden();
    let l = lease();
    let mut gate = ReviewLmbIngress::new_from_trusted_admission(l);
    // The formerly unrestricted JS nextSendBatch(32) could expose #18
    // while #1 was still missing. This must NOT be treated as acceptable.
    let IngressResult::Rejected(Some(ack)) = gate.review_ingest(l, &fixture[17], 5) else {
        panic!("original Rust must reject 17-ahead seq18");
    };
    assert_eq!(ack.status, AckStatus::Rejected);
    assert_eq!(ack.sequence, 18);
    assert!(gate.is_closed());
    assert_eq!(gate.accepted_count(), 0);
    assert_eq!(
        gate.review_ingest(l, &fixture[0], 6),
        IngressResult::Rejected(None)
    );
}
