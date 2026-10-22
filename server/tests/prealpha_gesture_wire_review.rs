//! DORMANT review-only wire conformance test. Not server admission/runtime.
const GOLDEN: [u8; 48] = [
    2, 0x52, 2, 0, 8, 7, 6, 5, 4, 3, 2, 1, 9, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 1, 1,
    0, 0, 2, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 3, 1, 0, 0,
];
#[derive(Debug, PartialEq, Eq)]
struct Event {
    seq: u32,
    gesture: u32,
    tick: u32,
    kind: u8,
}
#[derive(Debug, PartialEq, Eq)]
struct Envelope {
    epoch: u64,
    packet_seq: u32,
    events: Vec<Event>,
}
fn decode_review(bytes: &[u8], assigned_epoch: u64) -> Result<Envelope, &'static str> {
    if bytes.len() < 16 {
        return Err("truncated");
    }
    if bytes[0] != 2 || bytes[1] != 0x52 {
        return Err("unnegotiated protocol");
    }
    if bytes[3] != 0 {
        return Err("reserved header");
    }
    let count = bytes[2] as usize;
    if !(1..=4).contains(&count) || bytes.len() != 16 + count * 16 {
        return Err("invalid length");
    }
    let epoch = u64::from_le_bytes(bytes[4..12].try_into().unwrap());
    if epoch == 0 || epoch != assigned_epoch {
        return Err("wrong actor lease");
    }
    let packet_seq = u32::from_le_bytes(bytes[12..16].try_into().unwrap());
    let mut events = Vec::new();
    for chunk in bytes[16..].chunks_exact(16) {
        let seq = u32::from_le_bytes(chunk[..4].try_into().unwrap());
        let gesture = u32::from_le_bytes(chunk[4..8].try_into().unwrap());
        let tick = u32::from_le_bytes(chunk[8..12].try_into().unwrap());
        let kind = chunk[12];
        if seq == 0 || gesture == 0 || !(1..=6).contains(&kind) {
            return Err("invalid event");
        }
        if chunk[13] != if kind <= 4 { 1 } else { 2 } || chunk[14..16] != [0, 0] {
            return Err("kind or source mismatch");
        }
        events.push(Event {
            seq,
            gesture,
            tick,
            kind,
        });
    }
    Ok(Envelope {
        epoch,
        packet_seq,
        events,
    })
}
#[test]
fn little_endian_js_contract_preserves_same_tick_down_and_up_as_distinct_events() {
    let actual = decode_review(&GOLDEN, 0x0102030405060708).unwrap();
    assert_eq!(actual.packet_seq, 9);
    assert_eq!(
        actual.events,
        vec![
            Event {
                seq: 1,
                gesture: 7,
                tick: 100,
                kind: 1
            },
            Event {
                seq: 2,
                gesture: 7,
                tick: 100,
                kind: 3
            },
        ]
    );
    assert_eq!(
        decode_review(&GOLDEN, 0x0102030405060709),
        Err("wrong actor lease")
    );
}
#[test]
fn unnegotiated_protocol_source_reserved_and_length_corruptions_fail_closed() {
    let expected = 0x0102030405060708;
    for (offset, value) in [(0, 1), (1, 1), (2, 3), (3, 1), (29, 2), (30, 1)] {
        let mut bytes = GOLDEN;
        bytes[offset] = value;
        assert!(
            decode_review(&bytes, expected).is_err(),
            "bad offset {offset}"
        );
    }
    assert!(decode_review(&GOLDEN[..47], expected).is_err());
    assert!(decode_review(&GOLDEN[..15], expected).is_err());
}

#[test]
fn original_live_rust_ingress_rejects_unnegotiated_v2_review_envelope() {
    use myaso_server::{decode_input_packet, DecodeError};
    assert_eq!(
        decode_input_packet(&GOLDEN),
        Err(DecodeError::UnsupportedProtocol(2))
    );
}
