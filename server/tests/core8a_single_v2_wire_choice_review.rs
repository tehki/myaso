//! TEST-ONLY byte decision review for Main #723.
//! No runtime QUIC handler, protocol enabling, actor permission or hit grant.
//! Combat4/Core8A old 0x11 LMB / 0x12 ACK vectors must remain unchanged;
//! standalone KEY_E byte3=1 is a PROPOSED extension, currently REJECTED.
use myaso_server::prealpha_lmb_gesture_proposal::{
    decode_event, encode_ack, AckStatus, DecodeError, GestureAck, GestureAction,
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
