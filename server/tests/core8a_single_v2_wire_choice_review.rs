//! TEST-ONLY byte decision review for Main #723.
//! No runtime QUIC handler, protocol enabling, actor permission or hit grant.
//! Combat4/Core8A old 0x11 LMB / 0x12 ACK vectors must remain unchanged;
//! standalone KEY_E byte3=1 is a PROPOSED extension, currently REJECTED.
use myaso_server::prealpha_lmb_gesture_proposal::{
    decode_event, decode_typed_event, encode_ack, encode_typed_event, AckStatus, DecodeError,
    GestureAck, GestureAction, GestureSource, TypedDecodeError, TypedGestureEvent,
};

const LMB_PRESS_T42: [u8; 16] = [2, 0x11, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
const LMB_RELEASE_T42: [u8; 16] = [2, 0x11, 3, 0, 2, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
const KEY_E_PRESS_T43: [u8; 16] = [2, 0x11, 1, 1, 3, 0, 0, 0, 2, 0, 0, 0, 43, 0, 0, 0];
const KEY_E_RELEASE_T44: [u8; 16] = [2, 0x11, 3, 1, 4, 0, 0, 0, 2, 0, 0, 0, 44, 0, 0, 0];
const KEY_E_ACK_SERVER_T50: [u8; 16] = [2, 0x12, 1, 0, 3, 0, 0, 0, 2, 0, 0, 0, 50, 0, 0, 0];

fn review_decode(bytes: &[u8]) -> Result<(u8, u8, u32, u32, u32), &'static str> {
    if bytes.len() != 16 {
        return Err("not a sixteen-byte envelope");
    }
    if bytes[0] != 2 || bytes[1] != 0x11 {
        return Err("wrong version or incompatible type");
    }
    let source = bytes[3];
    let action = bytes[2];
    if !matches!(source, 0 | 1) || !matches!(action, 1..=4) || (source == 1 && action == 2) {
        return Err("unsupported source or action");
    }
    let sequence = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
    let gesture_id = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    let tick = u32::from_le_bytes(bytes[12..16].try_into().unwrap());
    if sequence == 0 || gesture_id == 0 {
        return Err("zero identity");
    }
    Ok((source, action, sequence, gesture_id, tick))
}
#[test]
fn existing_combat4_lmb_bytes_are_preserved_and_old_decoder_still_accepts() {
    let press = decode_event(&LMB_PRESS_T42).expect("original source-owned LMB bytes");
    assert_eq!(press.action, GestureAction::Press);
    assert_eq!(
        (press.sequence, press.gesture_id, press.client_tick),
        (1, 1, 42)
    );
    let release = decode_event(&LMB_RELEASE_T42).unwrap();
    assert_eq!(release.action, GestureAction::Release);
    assert_eq!(
        (release.sequence, release.gesture_id, release.client_tick),
        (2, 1, 42)
    );
    assert_eq!(review_decode(&LMB_PRESS_T42), Ok((0, 1, 1, 1, 42)));
    assert_eq!(review_decode(&LMB_RELEASE_T42), Ok((0, 3, 2, 1, 42)));
}
#[test]
fn key_e_source_bit_is_non_aliasing_and_must_stay_denied_by_old_codec() {
    assert_eq!(review_decode(&KEY_E_PRESS_T43), Ok((1, 1, 3, 2, 43)));
    assert_eq!(review_decode(&KEY_E_RELEASE_T44), Ok((1, 3, 4, 2, 44)));
    assert_eq!(decode_event(&KEY_E_PRESS_T43), Err(DecodeError::Reserved));
    assert_eq!(decode_event(&KEY_E_RELEASE_T44), Err(DecodeError::Reserved));
    // One future source bit cannot turn a KeyE press into an LMB upgrade.
    let mut illegal = KEY_E_PRESS_T43;
    illegal[2] = 2;
    assert_eq!(review_decode(&illegal), Err("unsupported source or action"));
}
#[test]
fn original_combat4_ack_schema_correlates_key_e_transport_edge_not_hit() {
    let ack = GestureAck {
        status: AckStatus::Accepted,
        sequence: 3,
        gesture_id: 2,
        server_tick: 50,
    };
    assert_eq!(encode_ack(ack), Ok(KEY_E_ACK_SERVER_T50));
    // No combat damage/hit can be derived from this transport-level ACK.
}
#[test]
fn unselected_core8c_wire_wrong_epoch_bad_source_and_zero_identity_stay_denied() {
    let mut alternate = LMB_PRESS_T42;
    alternate[1] = 0x52;
    assert_eq!(
        review_decode(&alternate),
        Err("wrong version or incompatible type")
    );
    assert_eq!(decode_event(&alternate), Err(DecodeError::PacketType));
    let mut old = LMB_PRESS_T42;
    old[0] = 1;
    assert_eq!(
        review_decode(&old),
        Err("wrong version or incompatible type")
    );
    let mut bad_source = KEY_E_PRESS_T43;
    bad_source[3] = 2;
    assert_eq!(
        review_decode(&bad_source),
        Err("unsupported source or action")
    );
    let mut zero_sequence = KEY_E_PRESS_T43;
    zero_sequence[4..8].fill(0);
    assert_eq!(review_decode(&zero_sequence), Err("zero identity"));
    let mut zero_gesture = KEY_E_PRESS_T43;
    zero_gesture[8..12].fill(0);
    assert_eq!(review_decode(&zero_gesture), Err("zero identity"));
    assert_eq!(
        review_decode(&LMB_PRESS_T42[..15]),
        Err("not a sixteen-byte envelope")
    );
}

fn shared_selected_family_bytes(name: &str) -> [u8; 16] {
    let fixture = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../tests/fixtures/core8a-p723-selected-family-v2.golden"
    ));
    let hex = fixture
        .lines()
        .filter_map(|line| line.split_once('='))
        .find_map(|(key, value)| (key == name).then_some(value))
        .expect("named immutable JS/Rust golden fixture");
    assert_eq!(hex.len(), 32, "exact 16-byte wire vector for {name}");
    let mut result = [0u8; 16];
    for (i, byte) in result.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
            .expect("lowercase hex fixture is byte-aligned");
    }
    result
}

#[test]
fn selected_family_shared_fixture_matches_original_combat4_rust_codec_and_review_only_key_e() {
    // Exactly the same independent fixture Node reads. Original unchanged
    // Combat4 decoder must continue refusing source=1, and runtime QUIC v2
    // must remain disabled until Main and all source owners approve the ABI.
    let cases = [
        ("LMB_PRESS", 0, 1, 1, 1, 42),
        ("LMB_RELEASE", 0, 3, 2, 1, 42),
        ("KEY_E_PRESS", 1, 1, 3, 2, 43),
        ("KEY_E_RELEASE", 1, 3, 4, 2, 44),
        ("KEY_E_CANCEL", 1, 4, 5, 2, 45),
        ("LMB_UPGRADE", 0, 2, 6, 3, 42),
        ("LMB_CANCEL", 0, 4, 7, 3, 42),
    ];
    for (name, source, action, sequence, gesture_id, tick) in cases {
        let bytes = shared_selected_family_bytes(name);
        assert_eq!(
            review_decode(&bytes),
            Ok((source, action, sequence, gesture_id, tick)),
            "{name} review layout"
        );
        if source == 1 {
            assert_eq!(
                decode_event(&bytes),
                Err(DecodeError::Reserved),
                "{name} must stay rejected by old decoder"
            );
        } else {
            let original = decode_event(&bytes).expect("original source0 LMB codec");
            assert_eq!(
                (
                    original.action as u8,
                    original.sequence,
                    original.gesture_id,
                    original.client_tick
                ),
                (action, sequence, gesture_id, tick)
            );
        }
    }
    for (name, status) in [
        ("ACK_ACCEPTED", AckStatus::Accepted),
        ("ACK_DUPLICATE", AckStatus::Duplicate),
        ("ACK_STALE", AckStatus::Stale),
        ("ACK_REJECTED", AckStatus::Rejected),
    ] {
        let ack = GestureAck {
            status,
            sequence: 3,
            gesture_id: 2,
            server_tick: 50,
        };
        assert_eq!(
            encode_ack(ack),
            Ok(shared_selected_family_bytes(name)),
            "{name} agrees with JS encoder"
        );
    }
    for name in [
        "BAD_KEY_E_UPGRADE",
        "BAD_UNKNOWN_SOURCE",
        "BAD_UNSELECTED_52",
    ] {
        assert!(review_decode(&shared_selected_family_bytes(name)).is_err());
    }
    let bad_ack = shared_selected_family_bytes("BAD_ACK_SOURCE");
    assert_eq!((bad_ack[0], bad_ack[1], bad_ack[3]), (2, 0x12, 1));
    // The old Rust source does NOT implement an ACK decoder; source byte3=1
    // is specified as malformed for future ACK ingress and independently
    // rejected by the original JavaScript ACK decoder in the same fixture.
}

#[test]
fn selected_main_draft_opt_in_rust_codec_matches_shared_js_vectors_without_live_enable() {
    let cases = [
        (
            "LMB_PRESS",
            GestureSource::Lmb,
            GestureAction::Press,
            1,
            1,
            42,
        ),
        (
            "LMB_RELEASE",
            GestureSource::Lmb,
            GestureAction::Release,
            2,
            1,
            42,
        ),
        (
            "KEY_E_PRESS",
            GestureSource::KeyE,
            GestureAction::Press,
            3,
            2,
            43,
        ),
        (
            "KEY_E_RELEASE",
            GestureSource::KeyE,
            GestureAction::Release,
            4,
            2,
            44,
        ),
        (
            "KEY_E_CANCEL",
            GestureSource::KeyE,
            GestureAction::Cancel,
            5,
            2,
            45,
        ),
        (
            "LMB_UPGRADE",
            GestureSource::Lmb,
            GestureAction::Upgrade,
            6,
            3,
            42,
        ),
        (
            "LMB_CANCEL",
            GestureSource::Lmb,
            GestureAction::Cancel,
            7,
            3,
            42,
        ),
    ];
    for (name, source, action, sequence, gesture_id, client_tick) in cases {
        let received = shared_selected_family_bytes(name);
        let typed = TypedGestureEvent {
            source,
            event: myaso_server::prealpha_lmb_gesture_proposal::GestureEvent {
                action,
                sequence,
                gesture_id,
                client_tick,
            },
        };
        assert_eq!(
            encode_typed_event(typed),
            Ok(received),
            "{name} Rust encoding matches immutable JS fixture"
        );
        assert_eq!(
            decode_typed_event(&received),
            Ok(typed),
            "{name} Rust opt-in decoding matches original bytes"
        );
        if source == GestureSource::KeyE {
            assert_eq!(decode_event(&received), Err(DecodeError::Reserved));
        }
    }
    for name in [
        "BAD_UNKNOWN_SOURCE",
        "BAD_KEY_E_UPGRADE",
        "BAD_UNSELECTED_52",
    ] {
        let received = shared_selected_family_bytes(name);
        assert!(decode_typed_event(&received).is_err(), "{name} denied");
    }
    assert_eq!(
        decode_typed_event(&shared_selected_family_bytes("BAD_KEY_E_UPGRADE")),
        Err(TypedDecodeError::InvalidSourceAction)
    );
    assert_eq!(
        decode_typed_event(&shared_selected_family_bytes("BAD_UNKNOWN_SOURCE")),
        Err(TypedDecodeError::UnknownSource(2))
    );
    assert_eq!(
        encode_typed_event(TypedGestureEvent {
            source: GestureSource::KeyE,
            event: myaso_server::prealpha_lmb_gesture_proposal::GestureEvent {
                action: GestureAction::Upgrade,
                sequence: 8,
                gesture_id: 4,
                client_tick: 0,
            }
        }),
        Err(TypedDecodeError::InvalidSourceAction)
    );
    // No v2 QUIC route is linked: this tests byte grammar ONLY.
}
