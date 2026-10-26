//! DORMANT Core8A M147 reliable HIT control wire proposal.
//! No live packet registry, listener, writer, client ACK task or activation.
//! The 16-byte opaque capability MUST be minted by the authenticated Core8C
//! session and is not an actor ID, a login token, or a v2 gesture lease.
use crate::PROTOCOL_VERSION;

pub const HIT_CONTROL_TYPE_PROPOSAL: u8 = 6;
pub const HIT_CONTROL_BYTES: usize = 32;
pub const MAX_PROPOSED_PENDING_HITS: u32 = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum HitControlOp {
    ClientHello = 1,
    ServerGrant = 2,
    ClientAck = 3,
    ServerGap = 4,
    ServerRetired = 5,
    ClientNack = 6,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct HitControl {
    pub op: HitControlOp,
    pub cursor: u32,
    pub token: [u8; 16],
    pub aux: u32,
}

impl std::fmt::Debug for HitControl {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HitControl")
            .field("op", &self.op)
            .field("cursor", &self.cursor)
            .field("token", &"[REDACTED]")
            .field("aux", &self.aux)
            .finish()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HitControlError {
    InvalidLength,
    WrongVersion,
    WrongType,
    UnknownOperation,
    Reserved,
    InvalidHello,
    MissingLease,
    InvalidGrantCapacity,
    InvalidAux,
}

impl HitControl {
    pub fn validate(&self) -> Result<(), HitControlError> {
        let no_lease = self.token.iter().all(|b| *b == 0);
        match self.op {
            HitControlOp::ClientHello => {
                if !no_lease || self.cursor != 0 || self.aux != 0 {
                    return Err(HitControlError::InvalidHello);
                }
            }
            HitControlOp::ServerGrant => {
                if no_lease {
                    return Err(HitControlError::MissingLease);
                }
                if self.cursor != 0 || !(1..=MAX_PROPOSED_PENDING_HITS).contains(&self.aux) {
                    return Err(HitControlError::InvalidGrantCapacity);
                }
            }
            HitControlOp::ClientAck | HitControlOp::ClientNack => {
                if no_lease {
                    return Err(HitControlError::MissingLease);
                }
                if self.aux != 0 {
                    return Err(HitControlError::InvalidAux);
                }
            }
            HitControlOp::ServerGap | HitControlOp::ServerRetired => {
                if no_lease {
                    return Err(HitControlError::MissingLease);
                }
            }
        }
        Ok(())
    }
}

pub fn encode_hit_control(value: HitControl) -> Result<[u8; HIT_CONTROL_BYTES], HitControlError> {
    value.validate()?;
    let mut bytes = [0u8; HIT_CONTROL_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = HIT_CONTROL_TYPE_PROPOSAL;
    bytes[2] = value.op as u8;
    bytes[4..8].copy_from_slice(&value.cursor.to_le_bytes());
    bytes[8..24].copy_from_slice(&value.token);
    bytes[24..28].copy_from_slice(&value.aux.to_le_bytes());
    Ok(bytes)
}

pub fn decode_hit_control(bytes: &[u8]) -> Result<HitControl, HitControlError> {
    if bytes.len() != HIT_CONTROL_BYTES {
        return Err(HitControlError::InvalidLength);
    }
    if bytes[0] != PROTOCOL_VERSION {
        return Err(HitControlError::WrongVersion);
    }
    if bytes[1] != HIT_CONTROL_TYPE_PROPOSAL {
        return Err(HitControlError::WrongType);
    }
    if bytes[3] != 0 || bytes[28..32] != [0u8; 4] {
        return Err(HitControlError::Reserved);
    }
    let op = match bytes[2] {
        1 => HitControlOp::ClientHello,
        2 => HitControlOp::ServerGrant,
        3 => HitControlOp::ClientAck,
        4 => HitControlOp::ServerGap,
        5 => HitControlOp::ServerRetired,
        6 => HitControlOp::ClientNack,
        _ => return Err(HitControlError::UnknownOperation),
    };
    let value = HitControl {
        op,
        cursor: u32::from_le_bytes(bytes[4..8].try_into().expect("length checked")),
        token: bytes[8..24].try_into().expect("length checked"),
        aux: u32::from_le_bytes(bytes[24..28].try_into().expect("length checked")),
    };
    value.validate()?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_redacts_token_without_changing_encoded_capability() {
        let first = HitControl {
            op: HitControlOp::ServerGrant,
            cursor: 0,
            token: [161; 16],
            aux: 64,
        };
        let second = HitControl {
            token: [239; 16],
            ..first
        };
        let debug = format!("{first:?}");
        assert!(debug.contains("[REDACTED]"));
        assert_eq!(debug, format!("{second:?}"));
        assert!(!debug.contains("161"));
        assert_ne!(encode_hit_control(first), encode_hit_control(second));
    }

    fn token() -> [u8; 16] {
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    }

    #[test]
    fn rust_javascript_fixed_32_byte_grant_vector_and_roundtrip() {
        let grant = HitControl {
            op: HitControlOp::ServerGrant,
            cursor: 0,
            token: token(),
            aux: 64,
        };
        let encoded = encode_hit_control(grant).unwrap();
        assert_eq!(
            encoded,
            [
                1, 6, 2, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 64,
                0, 0, 0, 0, 0, 0, 0,
            ]
        );
        assert_eq!(decode_hit_control(&encoded), Ok(grant));
        for op in [
            HitControlOp::ClientAck,
            HitControlOp::ClientNack,
            HitControlOp::ServerGap,
            HitControlOp::ServerRetired,
        ] {
            let other = HitControl {
                op,
                cursor: 17,
                token: token(),
                aux: if op == HitControlOp::ServerGap { 18 } else { 0 },
            };
            assert_eq!(
                decode_hit_control(&encode_hit_control(other).unwrap()),
                Ok(other)
            );
        }
    }

    #[test]
    fn hello_only_zero_token_zero_cursor_zero_aux() {
        let hello = HitControl {
            op: HitControlOp::ClientHello,
            cursor: 0,
            token: [0; 16],
            aux: 0,
        };
        assert_eq!(
            decode_hit_control(&encode_hit_control(hello).unwrap()),
            Ok(hello)
        );
        for bad in [
            HitControl {
                token: token(),
                ..hello
            },
            HitControl { cursor: 1, ..hello },
            HitControl { aux: 1, ..hello },
        ] {
            assert_eq!(encode_hit_control(bad), Err(HitControlError::InvalidHello));
        }
    }

    #[test]
    fn malformed_unknown_wrong_role_and_reserved_fail_closed() {
        let original = encode_hit_control(HitControl {
            op: HitControlOp::ServerGrant,
            cursor: 0,
            token: token(),
            aux: 64,
        })
        .unwrap();
        assert_eq!(
            decode_hit_control(&original[..31]),
            Err(HitControlError::InvalidLength)
        );
        let mut b = original;
        b[0] = 2;
        assert_eq!(decode_hit_control(&b), Err(HitControlError::WrongVersion));
        b = original;
        b[1] = 0x12;
        assert_eq!(decode_hit_control(&b), Err(HitControlError::WrongType));
        b = original;
        b[2] = 9;
        assert_eq!(
            decode_hit_control(&b),
            Err(HitControlError::UnknownOperation)
        );
        b = original;
        b[3] = 1;
        assert_eq!(decode_hit_control(&b), Err(HitControlError::Reserved));
        b = original;
        b[31] = 1;
        assert_eq!(decode_hit_control(&b), Err(HitControlError::Reserved));
        b = original;
        b[8..24].fill(0);
        assert_eq!(decode_hit_control(&b), Err(HitControlError::MissingLease));
        b = original;
        b[24] = 65;
        assert_eq!(
            decode_hit_control(&b),
            Err(HitControlError::InvalidGrantCapacity)
        );
        let ack = HitControl {
            op: HitControlOp::ClientAck,
            cursor: 2,
            token: token(),
            aux: 1,
        };
        assert_eq!(encode_hit_control(ack), Err(HitControlError::InvalidAux));
    }
}
