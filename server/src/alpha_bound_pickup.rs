//! P0 C3x: dormant, versioned PICKUP REQUEST METADATA for the existing
//! exclusive Core C3e MYTX journal. These bytes are NOT a browser packet,
//! session authentication, completed World authority proof, or live writer.
//! They only allow a future single commit to correlate its exact request
//! context with the same durable item mutation after a crash/retry.

use crate::{
    identity::CharacterId,
    item_ownership::{ItemLocation, OwnershipOp},
};

pub const PICKUP_ENVELOPE_V2_BYTES: usize = 80;

/// All fields are a *PROPOSAL* provided by a future trusted server caller.
/// Public fields are not evidence of server-side provenance.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedRackPickupEnvelope {
    /// Frozen authored GREYHAVEN_RACK_V1 socket index 1..=4.
    pub rack_socket: u8,
    /// Separate canonical mapped ground-entity identity; NOT an ItemId.
    pub ground_entity: u128,
    pub character: CharacterId,
    pub session_generation: u64,
    pub world_authority_epoch: u64,
    pub completed_world_tick: u64,
    pub world_map_revision: u64,
    /// Last committed mutation of this physical item, before the pickup.
    pub observed_item_mutation_sequence: u64,
}

impl ProposedRackPickupEnvelope {
    /// A preliminary format and operation-shape check, not a permission check.
    pub fn validate_shape(self, operation: OwnershipOp) -> Result<(), &'static str> {
        if !(1..=4).contains(&self.rack_socket)
            || self.ground_entity == 0
            || self.session_generation == 0
            || self.world_authority_epoch == 0
            || self.completed_world_tick == 0
            || self.world_map_revision == 0
            || self.observed_item_mutation_sequence == 0
            || self.ground_entity == operation.item().get()
        {
            return Err("invalid proposed pickup authority/identity fields");
        }
        if !matches!(
            operation,
            OwnershipOp::Move {
                from: ItemLocation::Ground { .. },
                to: ItemLocation::Equipped { character_id, slot: 0 },
                ..
            } if character_id == self.character
        ) {
            return Err("pickup metadata must match one exact Ground-to-MainHand move");
        }
        Ok(())
    }

    /// Deterministic local-record proposal bytes; NOT a public network packet.
    pub fn encode(self) -> [u8; PICKUP_ENVELOPE_V2_BYTES] {
        let mut out = [0_u8; PICKUP_ENVELOPE_V2_BYTES];
        out[0..16].copy_from_slice(&self.character.get().to_le_bytes());
        out[16..32].copy_from_slice(&self.ground_entity.to_le_bytes());
        out[32..40].copy_from_slice(&self.session_generation.to_le_bytes());
        out[40..48].copy_from_slice(&self.world_authority_epoch.to_le_bytes());
        out[48..56].copy_from_slice(&self.completed_world_tick.to_le_bytes());
        out[56..64].copy_from_slice(&self.world_map_revision.to_le_bytes());
        out[64..72].copy_from_slice(&self.observed_item_mutation_sequence.to_le_bytes());
        out[72] = self.rack_socket;
        out
    }

    /// Decode a proposed record. Server authorization is still mandatory.
    pub fn decode(bytes: &[u8]) -> Result<Self, &'static str> {
        if bytes.len() != PICKUP_ENVELOPE_V2_BYTES || bytes[73..].iter().any(|b| *b != 0) {
            return Err("invalid pickup envelope length or reserved bytes");
        }
        let character = CharacterId::new(u128::from_le_bytes(
            bytes[0..16].try_into().expect("length verified"),
        ))
        .ok_or("zero envelope character")?;
        let value = Self {
            character,
            ground_entity: u128::from_le_bytes(bytes[16..32].try_into().expect("length verified")),
            session_generation: u64::from_le_bytes(
                bytes[32..40].try_into().expect("length verified"),
            ),
            world_authority_epoch: u64::from_le_bytes(
                bytes[40..48].try_into().expect("length verified"),
            ),
            completed_world_tick: u64::from_le_bytes(
                bytes[48..56].try_into().expect("length verified"),
            ),
            world_map_revision: u64::from_le_bytes(
                bytes[56..64].try_into().expect("length verified"),
            ),
            observed_item_mutation_sequence: u64::from_le_bytes(
                bytes[64..72].try_into().expect("length verified"),
            ),
            rack_socket: bytes[72],
        };
        if !(1..=4).contains(&value.rack_socket)
            || value.ground_entity == 0
            || value.session_generation == 0
            || value.world_authority_epoch == 0
            || value.completed_world_tick == 0
            || value.world_map_revision == 0
            || value.observed_item_mutation_sequence == 0
        {
            return Err("invalid required pickup envelope field");
        }
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item_ownership::{ItemId, ZoneId};

    fn proposal() -> ProposedRackPickupEnvelope {
        ProposedRackPickupEnvelope {
            rack_socket: 1,
            ground_entity: (2_u128 << 64) | 201,
            character: CharacterId::new((1_u128 << 64) | 101).unwrap(),
            session_generation: 7,
            world_authority_epoch: 11,
            completed_world_tick: 39,
            world_map_revision: 6,
            observed_item_mutation_sequence: 3,
        }
    }

    fn move_op() -> OwnershipOp {
        OwnershipOp::Move {
            item: ItemId::new((3_u128 << 64) | 101).unwrap(),
            from: ItemLocation::Ground {
                zone_id: ZoneId::new(5).unwrap(),
                x_cm: 3740,
                y_cm: 4038,
            },
            to: ItemLocation::Equipped {
                character_id: proposal().character,
                slot: 0,
            },
        }
    }

    #[test]
    fn strict_endian_roundtrip_with_nontruncated_128bit_domains() {
        let e = proposal();
        e.validate_shape(move_op()).unwrap();
        let bytes = e.encode();
        assert_eq!(&bytes[0..16], &e.character.get().to_le_bytes());
        assert_eq!(&bytes[16..32], &e.ground_entity.to_le_bytes());
        assert_eq!(ProposedRackPickupEnvelope::decode(&bytes), Ok(e));
        let mut bad = bytes;
        bad[73] = 1;
        assert!(ProposedRackPickupEnvelope::decode(&bad).is_err());
        bad = bytes;
        bad[72] = 5;
        assert!(ProposedRackPickupEnvelope::decode(&bad).is_err());
        bad = bytes;
        bad[48..56].fill(0);
        assert!(ProposedRackPickupEnvelope::decode(&bad).is_err());
        assert!(ProposedRackPickupEnvelope::decode(&bytes[..79]).is_err());
    }

    #[test]
    fn reject_ambiguous_alias_and_incomplete_or_wrong_slot_context() {
        let mut e = proposal();
        e.ground_entity = move_op().item().get();
        assert!(e.validate_shape(move_op()).is_err());
        e = proposal();
        e.session_generation = 0;
        assert!(e.validate_shape(move_op()).is_err());
        e = proposal();
        assert!(e
            .validate_shape(OwnershipOp::Create {
                item: move_op().item(),
                at: ItemLocation::Ground {
                    zone_id: ZoneId::new(5).unwrap(),
                    x_cm: 3740,
                    y_cm: 4038,
                },
            })
            .is_err());
        assert!(e
            .validate_shape(OwnershipOp::Move {
                item: move_op().item(),
                from: ItemLocation::Ground {
                    zone_id: ZoneId::new(5).unwrap(),
                    x_cm: 3740,
                    y_cm: 4038,
                },
                to: ItemLocation::Equipped {
                    character_id: e.character,
                    slot: 1
                },
            })
            .is_err());
    }
}
