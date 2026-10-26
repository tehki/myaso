//! Proposed, DORMANT Pre-Alpha Combat input-provenance envelope.
//! There are no runtime callers and NO permission to accept protocol v2.
//! Live protocol v1 34-byte datagrams, combat and releases remain unchanged.
//! Every proposed event is bound to the authenticated QUIC *connection lease*
//! by a future reviewed ingress adapter; its client_tick is diagnostic ONLY.

pub const VERSION: u8 = 2;
pub const EVENT_TYPE: u8 = 0x11;
pub const ACK_TYPE: u8 = 0x12;
pub const BYTES: usize = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum GestureAction {
    Press = 1,
    Upgrade = 2,
    Release = 3,
    Cancel = 4,
    // P0 review-only same source0 chord; never public or source1 Use.
    JumpAttack = 5,
}
impl TryFrom<u8> for GestureAction {
    type Error = DecodeError;
    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Press),
            2 => Ok(Self::Upgrade),
            3 => Ok(Self::Release),
            4 => Ok(Self::Cancel),
            5 => Ok(Self::JumpAttack),
            _ => Err(DecodeError::UnknownAction(value)),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum AckStatus {
    Accepted = 1,
    Duplicate = 2,
    Stale = 3,
    Rejected = 4,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GestureEvent {
    pub action: GestureAction,
    pub sequence: u32,
    pub gesture_id: u32,
    /// For diagnostics and correlation only; never set authoritative windup.
    pub client_tick: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GestureAck {
    pub status: AckStatus,
    pub sequence: u32,
    pub gesture_id: u32,
    /// Actual authoritative world server tick.
    pub server_tick: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecodeError {
    Length,
    Version,
    PacketType,
    Reserved,
    UnknownAction(u8),
    ZeroSequence,
    ZeroGestureId,
}

fn parse_header(bytes: &[u8], expected_type: u8) -> Result<(), DecodeError> {
    if bytes.len() != BYTES {
        return Err(DecodeError::Length);
    }
    if bytes[0] != VERSION {
        return Err(DecodeError::Version);
    }
    if bytes[1] != expected_type {
        return Err(DecodeError::PacketType);
    }
    if bytes[3] != 0 {
        return Err(DecodeError::Reserved);
    }
    Ok(())
}
fn nonzero(value: u32, is_sequence: bool) -> Result<u32, DecodeError> {
    if value == 0 {
        return Err(if is_sequence {
            DecodeError::ZeroSequence
        } else {
            DecodeError::ZeroGestureId
        });
    }
    Ok(value)
}
fn number(bytes: &[u8], pos: usize) -> u32 {
    u32::from_le_bytes(
        bytes[pos..pos + 4]
            .try_into()
            .expect("header length checked"),
    )
}
pub fn decode_event(bytes: &[u8]) -> Result<GestureEvent, DecodeError> {
    parse_header(bytes, EVENT_TYPE)?;
    Ok(GestureEvent {
        action: GestureAction::try_from(bytes[2])?,
        sequence: nonzero(number(bytes, 4), true)?,
        gesture_id: nonzero(number(bytes, 8), false)?,
        client_tick: number(bytes, 12),
    })
}
pub fn encode_event(event: GestureEvent) -> Result<[u8; BYTES], DecodeError> {
    nonzero(event.sequence, true)?;
    nonzero(event.gesture_id, false)?;
    let mut out = [0u8; BYTES];
    out[0] = VERSION;
    out[1] = EVENT_TYPE;
    out[2] = event.action as u8;
    out[4..8].copy_from_slice(&event.sequence.to_le_bytes());
    out[8..12].copy_from_slice(&event.gesture_id.to_le_bytes());
    out[12..16].copy_from_slice(&event.client_tick.to_le_bytes());
    Ok(out)
}
pub fn encode_ack(ack: GestureAck) -> Result<[u8; BYTES], DecodeError> {
    nonzero(ack.sequence, true)?;
    nonzero(ack.gesture_id, false)?;
    let mut out = [0u8; BYTES];
    out[0] = VERSION;
    out[1] = ACK_TYPE;
    out[2] = ack.status as u8;
    out[4..8].copy_from_slice(&ack.sequence.to_le_bytes());
    out[8..12].copy_from_slice(&ack.gesture_id.to_le_bytes());
    out[12..16].copy_from_slice(&ack.server_tick.to_le_bytes());
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn press() -> GestureEvent {
        GestureEvent {
            action: GestureAction::Press,
            sequence: 0x0102_0304,
            gesture_id: 0x1122_3344,
            client_tick: 0x5566_7788,
        }
    }

    #[test]
    fn golden_matches_independent_js_little_endian_envelope() {
        let encoded = encode_event(press()).unwrap();
        assert_eq!(
            encoded,
            [2, 0x11, 1, 0, 4, 3, 2, 1, 0x44, 0x33, 0x22, 0x11, 0x88, 0x77, 0x66, 0x55]
        );
        assert_eq!(decode_event(&encoded), Ok(press()));
        let ack = GestureAck {
            status: AckStatus::Accepted,
            sequence: press().sequence,
            gesture_id: press().gesture_id,
            server_tick: 0x0a0b_0c0d,
        };
        assert_eq!(
            encode_ack(ack).unwrap(),
            [2, 0x12, 1, 0, 4, 3, 2, 1, 0x44, 0x33, 0x22, 0x11, 0x0d, 0x0c, 0x0b, 0x0a]
        );
    }

    #[test]
    fn all_actions_have_distinct_ids_and_same_gesture_identity() {
        for (value, kind) in [
            (1, GestureAction::Press),
            (2, GestureAction::Upgrade),
            (3, GestureAction::Release),
            (4, GestureAction::Cancel),
        ] {
            let event = GestureEvent {
                action: kind,
                ..press()
            };
            assert_eq!(encode_event(event).unwrap()[2], value);
            assert_eq!(decode_event(&encode_event(event).unwrap()), Ok(event));
        }
    }

    #[test]
    fn malformed_reserved_and_zero_identity_fail_closed() {
        let mut encoded = encode_event(press()).unwrap();
        assert_eq!(decode_event(&encoded[..15]), Err(DecodeError::Length));
        encoded[0] = 1;
        assert_eq!(decode_event(&encoded), Err(DecodeError::Version));
        encoded[0] = VERSION;
        encoded[1] = ACK_TYPE;
        assert_eq!(decode_event(&encoded), Err(DecodeError::PacketType));
        encoded[1] = EVENT_TYPE;
        encoded[3] = 1;
        assert_eq!(decode_event(&encoded), Err(DecodeError::Reserved));
        encoded[3] = 0;
        encoded[2] = 99;
        assert_eq!(decode_event(&encoded), Err(DecodeError::UnknownAction(99)));
        encoded[2] = 1;
        encoded[4..8].copy_from_slice(&0u32.to_le_bytes());
        assert_eq!(decode_event(&encoded), Err(DecodeError::ZeroSequence));
        encoded[4..8].copy_from_slice(&1u32.to_le_bytes());
        encoded[8..12].copy_from_slice(&0u32.to_le_bytes());
        assert_eq!(decode_event(&encoded), Err(DecodeError::ZeroGestureId));
    }
}

/// Explicit opt-in REVIEW codec for the draft source discriminator from #723.
/// Original decode_event keeps refusing byte3 != 0 until all owners approve
/// future authenticated QUIC stream negotiation. This module has no live call.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum GestureSource {
    Lmb = 0,
    KeyE = 1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TypedGestureEvent {
    pub source: GestureSource,
    pub event: GestureEvent,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TypedDecodeError {
    Original(DecodeError),
    UnknownSource(u8),
    InvalidSourceAction,
}

impl From<DecodeError> for TypedDecodeError {
    fn from(error: DecodeError) -> Self {
        Self::Original(error)
    }
}

fn check_source_action(
    source: GestureSource,
    action: GestureAction,
) -> Result<(), TypedDecodeError> {
    if source == GestureSource::KeyE && action == GestureAction::Upgrade {
        return Err(TypedDecodeError::InvalidSourceAction);
    }
    Ok(())
}

pub fn encode_typed_event(event: TypedGestureEvent) -> Result<[u8; BYTES], TypedDecodeError> {
    check_source_action(event.source, event.event.action)?;
    let mut bytes = encode_event(event.event)?;
    bytes[3] = event.source as u8;
    Ok(bytes)
}

pub fn decode_typed_event(bytes: &[u8]) -> Result<TypedGestureEvent, TypedDecodeError> {
    if bytes.len() != BYTES {
        return Err(DecodeError::Length.into());
    }
    let source = match bytes[3] {
        0 => GestureSource::Lmb,
        1 => GestureSource::KeyE,
        other => return Err(TypedDecodeError::UnknownSource(other)),
    };
    // Delegate canonical v2 length/type/version/identity checks to existing
    // Combat4 byte parser. Normalizing byte3 in a COPY never changes the
    // received packet and does NOT authenticate the sender or actor.
    let mut normalized = [0_u8; BYTES];
    normalized.copy_from_slice(bytes);
    normalized[3] = 0;
    let event = decode_event(&normalized)?;
    check_source_action(source, event.action)?;
    Ok(TypedGestureEvent { source, event })
}
