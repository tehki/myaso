//! Proposed M147 authoritative HIT receipt wire fixture.
//!
//! This is NOT registered in the live WebTransport writer/reader. Core 8A
//! must approve message type, ordered reliability, replay rules and session
//! generation fencing before enabling any client-visible hit confirmation.
//! Do not infer attacker identity from snapshot HP changes.
use crate::simulation::CombatEvent;
use crate::PROTOCOL_VERSION;

pub const HIT_RECEIPT_TYPE_PROPOSAL: u8 = 5;
pub const HIT_RECEIPT_BYTES: usize = 28;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct HitReceipt {
    pub sequence: u32,
    pub server_tick: u32,
    pub attacker: u32,
    pub target: u32,
    pub damage: f32,
    pub target_hp: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HitReceiptError {
    InvalidLength,
    WrongProtocol,
    WrongPacketType,
    ReservedBits,
    InvalidActors,
    InvalidDamage,
    InvalidHealth,
}

impl HitReceipt {
    /// Derived from a completed authoritative simulation event, never
    /// packet-supplied attacker claims or replicated HP deltas.
    pub fn from_combat_event(
        sequence: u32,
        server_tick: u32,
        event: &CombatEvent,
    ) -> Result<Option<Self>, HitReceiptError> {
        let CombatEvent::Hit {
            attacker,
            target,
            damage,
            hp,
        } = event
        else {
            return Ok(None);
        };
        let receipt = Self {
            sequence,
            server_tick,
            attacker: *attacker,
            target: *target,
            damage: f32::from(*damage),
            target_hp: f32::from(*hp),
        };
        receipt.validate()?;
        Ok(Some(receipt))
    }

    pub fn validate(&self) -> Result<(), HitReceiptError> {
        if self.attacker == 0 || self.target == 0 || self.attacker == self.target {
            return Err(HitReceiptError::InvalidActors);
        }
        if !self.damage.is_finite() || self.damage <= 0.0 {
            return Err(HitReceiptError::InvalidDamage);
        }
        if !self.target_hp.is_finite() || self.target_hp < 0.0 {
            return Err(HitReceiptError::InvalidHealth);
        }
        Ok(())
    }
}

pub fn encode_hit_receipt(receipt: HitReceipt) -> Result<[u8; HIT_RECEIPT_BYTES], HitReceiptError> {
    receipt.validate()?;
    let mut bytes = [0_u8; HIT_RECEIPT_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = HIT_RECEIPT_TYPE_PROPOSAL;
    bytes[4..8].copy_from_slice(&receipt.sequence.to_le_bytes());
    bytes[8..12].copy_from_slice(&receipt.server_tick.to_le_bytes());
    bytes[12..16].copy_from_slice(&receipt.attacker.to_le_bytes());
    bytes[16..20].copy_from_slice(&receipt.target.to_le_bytes());
    bytes[20..24].copy_from_slice(&receipt.damage.to_le_bytes());
    bytes[24..28].copy_from_slice(&receipt.target_hp.to_le_bytes());
    Ok(bytes)
}

pub fn decode_hit_receipt(bytes: &[u8]) -> Result<HitReceipt, HitReceiptError> {
    if bytes.len() != HIT_RECEIPT_BYTES {
        return Err(HitReceiptError::InvalidLength);
    }
    if bytes[0] != PROTOCOL_VERSION {
        return Err(HitReceiptError::WrongProtocol);
    }
    if bytes[1] != HIT_RECEIPT_TYPE_PROPOSAL {
        return Err(HitReceiptError::WrongPacketType);
    }
    if bytes[2] != 0 || bytes[3] != 0 {
        return Err(HitReceiptError::ReservedBits);
    }
    let receipt = HitReceipt {
        sequence: u32::from_le_bytes(bytes[4..8].try_into().expect("length checked")),
        server_tick: u32::from_le_bytes(bytes[8..12].try_into().expect("length checked")),
        attacker: u32::from_le_bytes(bytes[12..16].try_into().expect("length checked")),
        target: u32::from_le_bytes(bytes[16..20].try_into().expect("length checked")),
        damage: f32::from_le_bytes(bytes[20..24].try_into().expect("length checked")),
        target_hp: f32::from_le_bytes(bytes[24..28].try_into().expect("length checked")),
    };
    receipt.validate()?;
    Ok(receipt)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> HitReceipt {
        HitReceipt {
            sequence: 0x0102_0304,
            server_tick: 0x0a0b_0c0d,
            attacker: 2,
            target: 1,
            damage: 34.0,
            target_hp: 66.0,
        }
    }

    #[test]
    fn browser_golden_fixture_roundtrips_without_attribution_loss() {
        let bytes = encode_hit_receipt(fixture()).unwrap();
        assert_eq!(
            bytes,
            [
                1, 5, 0, 0, 4, 3, 2, 1, 13, 12, 11, 10, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 8, 66, 0, 0,
                132, 66
            ]
        );
        assert_eq!(decode_hit_receipt(&bytes), Ok(fixture()));
    }

    #[test]
    fn receipt_is_created_only_from_a_real_simulation_hit() {
        let hit = CombatEvent::Hit {
            attacker: 2,
            target: 1,
            damage: 34,
            hp: 66,
        };
        assert_eq!(
            HitReceipt::from_combat_event(fixture().sequence, fixture().server_tick, &hit),
            Ok(Some(fixture()))
        );
        assert_eq!(
            HitReceipt::from_combat_event(
                4,
                9,
                &CombatEvent::Parry {
                    attacker: 2,
                    target: 1,
                }
            ),
            Ok(None)
        );
        assert_eq!(
            HitReceipt::from_combat_event(
                4,
                9,
                &CombatEvent::Hit {
                    attacker: 2,
                    target: 2,
                    damage: 34,
                    hp: 66,
                }
            ),
            Err(HitReceiptError::InvalidActors)
        );
    }

    #[test]
    fn malformed_actor_or_nonfinite_damage_fails_closed() {
        let mut packet = fixture();
        packet.attacker = packet.target;
        assert_eq!(
            encode_hit_receipt(packet),
            Err(HitReceiptError::InvalidActors)
        );
        packet = fixture();
        packet.target_hp = f32::NAN;
        assert_eq!(
            encode_hit_receipt(packet),
            Err(HitReceiptError::InvalidHealth)
        );
        packet = fixture();
        packet.damage = f32::INFINITY;
        assert_eq!(
            encode_hit_receipt(packet),
            Err(HitReceiptError::InvalidDamage)
        );
        packet = fixture();
        packet.damage = 0.0;
        assert_eq!(
            encode_hit_receipt(packet),
            Err(HitReceiptError::InvalidDamage)
        );
    }

    #[test]
    fn reserved_bytes_wrong_type_and_corruption_are_rejected() {
        let bytes = encode_hit_receipt(fixture()).unwrap();
        assert_eq!(
            decode_hit_receipt(&bytes[..27]),
            Err(HitReceiptError::InvalidLength)
        );
        let mut bad = bytes;
        bad[0] = 2;
        assert_eq!(
            decode_hit_receipt(&bad),
            Err(HitReceiptError::WrongProtocol)
        );
        bad = bytes;
        bad[1] = 4;
        assert_eq!(
            decode_hit_receipt(&bad),
            Err(HitReceiptError::WrongPacketType)
        );
        bad = bytes;
        bad[2] = 1;
        assert_eq!(decode_hit_receipt(&bad), Err(HitReceiptError::ReservedBits));
        bad = bytes;
        bad[12..16].copy_from_slice(&0_u32.to_le_bytes());
        assert_eq!(
            decode_hit_receipt(&bad),
            Err(HitReceiptError::InvalidActors)
        );
        bad = bytes;
        bad[20..24].copy_from_slice(&f32::NAN.to_le_bytes());
        assert_eq!(
            decode_hit_receipt(&bad),
            Err(HitReceiptError::InvalidDamage)
        );
    }
}
