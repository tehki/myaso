//! Phase C1, dormant, exact 12-byte door request + 24-byte zone entry ack.
//! Encode/decode only. NO live WebTransport handler uses these packet types.
//! A door request can never carry a destination, coordinate, or fighter ID.

use crate::zone::{PortalId, Position, ZoneId, MAP_MANIFEST_VERSION};
use crate::PROTOCOL_VERSION;

pub const DOOR_REQUEST_PACKET_TYPE: u8 = 5;
pub const ZONE_ENTERED_PACKET_TYPE: u8 = 6;
pub const DOOR_REQUEST_BYTES: usize = 12;
pub const ZONE_ENTERED_BYTES: usize = 24;
const COORDINATE_SCALE: f32 = 4.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DoorWireError {
    InvalidLength,
    InvalidVersion,
    WrongPacketType,
    InvalidManifest,
    InvalidPortal,
    InvalidZone,
    InvalidFighter,
    InvalidEpoch,
    InvalidPosition,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DoorRequest {
    pub portal_id: PortalId,
    pub request_nonce: u32,
    /// Expected epoch last received in a server-accepted entry ACK.
    /// An authenticated server must reject an obsolete epoch before transfer.
    pub expected_epoch: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ZoneEntered {
    pub zone_id: ZoneId,
    pub request_nonce: u32,
    pub fighter_id: u32,
    pub server_tick: u32,
    pub spawn: Position,
    pub zone_epoch: u32,
}

pub fn encode_door_request(request: DoorRequest) -> [u8; DOOR_REQUEST_BYTES] {
    let mut bytes = [0_u8; DOOR_REQUEST_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = DOOR_REQUEST_PACKET_TYPE;
    bytes[2] = MAP_MANIFEST_VERSION as u8;
    bytes[3] = match request.portal_id {
        PortalId::RedLionEnter => 1,
        PortalId::RedLionExit => 2,
    };
    bytes[4..8].copy_from_slice(&request.request_nonce.to_le_bytes());
    bytes[8..12].copy_from_slice(&request.expected_epoch.to_le_bytes());
    bytes
}

pub fn decode_door_request(bytes: &[u8]) -> Result<DoorRequest, DoorWireError> {
    if bytes.len() != DOOR_REQUEST_BYTES {
        return Err(DoorWireError::InvalidLength);
    }
    if bytes[0] != PROTOCOL_VERSION {
        return Err(DoorWireError::InvalidVersion);
    }
    if bytes[1] != DOOR_REQUEST_PACKET_TYPE {
        return Err(DoorWireError::WrongPacketType);
    }
    if bytes[2] != MAP_MANIFEST_VERSION as u8 {
        return Err(DoorWireError::InvalidManifest);
    }
    let portal_id = match bytes[3] {
        1 => PortalId::RedLionEnter,
        2 => PortalId::RedLionExit,
        _ => return Err(DoorWireError::InvalidPortal),
    };
    Ok(DoorRequest {
        portal_id,
        request_nonce: u32::from_le_bytes(bytes[4..8].try_into().unwrap()),
        expected_epoch: u32::from_le_bytes(bytes[8..12].try_into().unwrap()),
    })
}

fn coordinate_to_wire(value: f32, limit: f32) -> Result<u16, DoorWireError> {
    if !value.is_finite() || !(18.0..=limit - 18.0).contains(&value) {
        return Err(DoorWireError::InvalidPosition);
    }
    let quantized = (value * COORDINATE_SCALE).round();
    if !(0.0..=u16::MAX as f32).contains(&quantized) {
        return Err(DoorWireError::InvalidPosition);
    }
    Ok(quantized as u16)
}

pub fn encode_zone_entered(ack: ZoneEntered) -> Result<[u8; ZONE_ENTERED_BYTES], DoorWireError> {
    if ack.fighter_id == 0 {
        return Err(DoorWireError::InvalidFighter);
    }
    if ack.zone_epoch == 0 {
        return Err(DoorWireError::InvalidEpoch);
    }
    let (width, height) = ack.zone_id.bounds();
    let x = coordinate_to_wire(ack.spawn.x, width)?;
    let y = coordinate_to_wire(ack.spawn.y, height)?;
    let mut bytes = [0_u8; ZONE_ENTERED_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = ZONE_ENTERED_PACKET_TYPE;
    bytes[2] = MAP_MANIFEST_VERSION as u8;
    bytes[3] = match ack.zone_id {
        ZoneId::Moonvale => 1,
        ZoneId::RedLionInn => 2,
    };
    bytes[4..8].copy_from_slice(&ack.request_nonce.to_le_bytes());
    bytes[8..12].copy_from_slice(&ack.fighter_id.to_le_bytes());
    bytes[12..16].copy_from_slice(&ack.server_tick.to_le_bytes());
    bytes[16..18].copy_from_slice(&x.to_le_bytes());
    bytes[18..20].copy_from_slice(&y.to_le_bytes());
    bytes[20..24].copy_from_slice(&ack.zone_epoch.to_le_bytes());
    Ok(bytes)
}

pub fn decode_zone_entered(bytes: &[u8]) -> Result<ZoneEntered, DoorWireError> {
    if bytes.len() != ZONE_ENTERED_BYTES {
        return Err(DoorWireError::InvalidLength);
    }
    if bytes[0] != PROTOCOL_VERSION {
        return Err(DoorWireError::InvalidVersion);
    }
    if bytes[1] != ZONE_ENTERED_PACKET_TYPE {
        return Err(DoorWireError::WrongPacketType);
    }
    if bytes[2] != MAP_MANIFEST_VERSION as u8 {
        return Err(DoorWireError::InvalidManifest);
    }
    let zone_id = match bytes[3] {
        1 => ZoneId::Moonvale,
        2 => ZoneId::RedLionInn,
        _ => return Err(DoorWireError::InvalidZone),
    };
    let fighter_id = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    if fighter_id == 0 {
        return Err(DoorWireError::InvalidFighter);
    }
    let zone_epoch = u32::from_le_bytes(bytes[20..24].try_into().unwrap());
    if zone_epoch == 0 {
        return Err(DoorWireError::InvalidEpoch);
    }
    let spawn = Position {
        x: f32::from(u16::from_le_bytes(bytes[16..18].try_into().unwrap())) / COORDINATE_SCALE,
        y: f32::from(u16::from_le_bytes(bytes[18..20].try_into().unwrap())) / COORDINATE_SCALE,
    };
    coordinate_to_wire(spawn.x, zone_id.bounds().0)?;
    coordinate_to_wire(spawn.y, zone_id.bounds().1)?;
    Ok(ZoneEntered {
        zone_id,
        request_nonce: u32::from_le_bytes(bytes[4..8].try_into().unwrap()),
        fighter_id,
        server_tick: u32::from_le_bytes(bytes[12..16].try_into().unwrap()),
        spawn,
        zone_epoch,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_request_fixture_and_round_trip() {
        let request = DoorRequest {
            portal_id: PortalId::RedLionEnter,
            request_nonce: 0x0102_0304,
            expected_epoch: 0x0506_0708,
        };
        let bytes = encode_door_request(request);
        assert_eq!(bytes, [1, 5, 1, 1, 4, 3, 2, 1, 8, 7, 6, 5]);
        assert_eq!(decode_door_request(&bytes), Ok(request));
        let mut forged = bytes;
        forged[3] = 0;
        assert_eq!(
            decode_door_request(&forged),
            Err(DoorWireError::InvalidPortal)
        );
        forged = bytes;
        forged[2] = 0;
        assert_eq!(
            decode_door_request(&forged),
            Err(DoorWireError::InvalidManifest)
        );
        forged = bytes;
        forged[0] = 2;
        assert_eq!(
            decode_door_request(&forged),
            Err(DoorWireError::InvalidVersion)
        );
        assert_eq!(
            decode_door_request(&bytes[..11]),
            Err(DoorWireError::InvalidLength)
        );
        assert_eq!(
            decode_door_request(&[1, 5, 1, 1, 4, 3, 2, 1, 8, 7, 6, 5, 0]),
            Err(DoorWireError::InvalidLength)
        );
    }

    #[test]
    fn exact_server_ack_fixture_and_round_trip() {
        let ack = ZoneEntered {
            zone_id: ZoneId::RedLionInn,
            request_nonce: 0x0102_0304,
            fighter_id: 0x0a0b_0c0d,
            server_tick: 0x0101_0202,
            spawn: Position { x: 390.0, y: 480.0 },
            zone_epoch: 0x0203_0405,
        };
        let encoded = encode_zone_entered(ack).unwrap();
        assert_eq!(
            encoded,
            [1, 6, 1, 2, 4, 3, 2, 1, 13, 12, 11, 10, 2, 2, 1, 1, 24, 6, 128, 7, 5, 4, 3, 2]
        );
        assert_eq!(decode_zone_entered(&encoded), Ok(ack));
        let mut invalid = encoded;
        invalid[3] = 99;
        assert_eq!(
            decode_zone_entered(&invalid),
            Err(DoorWireError::InvalidZone)
        );
        invalid = encoded;
        invalid[20..24].fill(0);
        assert_eq!(
            decode_zone_entered(&invalid),
            Err(DoorWireError::InvalidEpoch)
        );
        invalid = encoded;
        invalid[8..12].fill(0);
        assert_eq!(
            decode_zone_entered(&invalid),
            Err(DoorWireError::InvalidFighter)
        );
        invalid = encoded;
        invalid[16..18].copy_from_slice(&u16::MAX.to_le_bytes());
        assert_eq!(
            decode_zone_entered(&invalid),
            Err(DoorWireError::InvalidPosition)
        );
    }

    #[test]
    fn only_authoritative_valid_spawn_can_be_encoded() {
        let mut ack = ZoneEntered {
            zone_id: ZoneId::RedLionInn,
            request_nonce: 1,
            fighter_id: 11,
            server_tick: 55,
            spawn: Position { x: 390.0, y: 480.0 },
            zone_epoch: 1,
        };
        ack.spawn.x = f32::NAN;
        assert_eq!(
            encode_zone_entered(ack),
            Err(DoorWireError::InvalidPosition)
        );
        ack.spawn.x = 390.0;
        ack.spawn.y = 1000.0;
        assert_eq!(
            encode_zone_entered(ack),
            Err(DoorWireError::InvalidPosition)
        );
        ack.spawn.y = 480.0;
        ack.fighter_id = 0;
        assert_eq!(encode_zone_entered(ack), Err(DoorWireError::InvalidFighter));
        ack.fighter_id = 11;
        ack.zone_epoch = 0;
        assert_eq!(encode_zone_entered(ack), Err(DoorWireError::InvalidEpoch));
    }
}
