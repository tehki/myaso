//! C3f dormant canonical PostgreSQL `bytea` adapter for item identifiers
//! and locations. Does not connect to a database or admit gameplay actions.
//!
//! The C3b local MYTX journal is deliberately little-endian. Core C4d SQL
//! uses big-endian 16-byte entity/operation IDs. Never pass journal record
//! bytes directly to PostgreSQL; always encode the typed values explicitly.

use crate::{
    identity::CharacterId,
    item_ownership::{CorpseId, ItemId, ItemLocation, OwnershipTxnId, ZoneId},
};

/// Matches C4d `core_zone.entities.entity_kind = 2` for ground items.
pub const PG_GROUND_ITEM_ENTITY_KIND: i16 = 2;

/// Proposed fixed-width, canonical and lossless item-location `bytea` format.
/// Versioning/migration is required before any production SQL schema uses it.
pub const PG_ITEM_LOCATION_BYTES: usize = 26;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ItemPgCodecError {
    InvalidLength,
    InvalidTag,
    InvalidIdentity,
    NonCanonicalPadding,
}

/// Matches C4d's `NonZeroU128::get().to_be_bytes()` stable entity mapping.
pub fn item_id_to_pg(item: ItemId) -> [u8; 16] {
    item.get().to_be_bytes()
}

pub fn item_id_from_pg(bytes: &[u8]) -> Result<ItemId, ItemPgCodecError> {
    let id = decode_nonzero_u128(bytes)?;
    ItemId::new(id).ok_or(ItemPgCodecError::InvalidIdentity)
}

pub fn transaction_id_to_pg(transaction: OwnershipTxnId) -> [u8; 16] {
    transaction.get().to_be_bytes()
}

pub fn transaction_id_from_pg(bytes: &[u8]) -> Result<OwnershipTxnId, ItemPgCodecError> {
    OwnershipTxnId::new(decode_nonzero_u128(bytes)?).ok_or(ItemPgCodecError::InvalidIdentity)
}

fn decode_nonzero_u128(bytes: &[u8]) -> Result<u128, ItemPgCodecError> {
    let raw: [u8; 16] = bytes
        .try_into()
        .map_err(|_| ItemPgCodecError::InvalidLength)?;
    let value = u128::from_be_bytes(raw);
    if value == 0 {
        return Err(ItemPgCodecError::InvalidIdentity);
    }
    Ok(value)
}

/// Serialize a typed location, not the underlying little-endian journal slot.
///
/// Bytes: tag [0], 16-byte BE principal/corpse ID [1..17] for tags 1-3;
/// equipped slot at [17] for tag 2. Ground (tag 4) uses 8-byte BE zone ID
/// [1..9], nine zero reserved bytes [9..18], and two signed BE i32
/// centimeter coordinates [18..22] and [22..26]. Every unused byte is zero.
pub fn location_to_pg(location: ItemLocation) -> [u8; PG_ITEM_LOCATION_BYTES] {
    let mut bytes = [0_u8; PG_ITEM_LOCATION_BYTES];
    match location {
        ItemLocation::Inventory(character) => {
            bytes[0] = 1;
            bytes[1..17].copy_from_slice(&character.get().to_be_bytes());
        }
        ItemLocation::Equipped { character_id, slot } => {
            bytes[0] = 2;
            bytes[1..17].copy_from_slice(&character_id.get().to_be_bytes());
            bytes[17] = slot;
        }
        ItemLocation::Corpse(corpse) => {
            bytes[0] = 3;
            bytes[1..17].copy_from_slice(&corpse.get().to_be_bytes());
        }
        ItemLocation::Ground {
            zone_id,
            x_cm,
            y_cm,
        } => {
            bytes[0] = 4;
            bytes[1..9].copy_from_slice(&zone_id.get().to_be_bytes());
            bytes[18..22].copy_from_slice(&x_cm.to_be_bytes());
            bytes[22..26].copy_from_slice(&y_cm.to_be_bytes());
        }
    }
    bytes
}

/// Reject zero principals and noncanonical padding, so each location has one
/// unambiguous representation suitable for bytewise CAS and idempotency.
pub fn location_from_pg(bytes: &[u8]) -> Result<ItemLocation, ItemPgCodecError> {
    let bytes: &[u8; PG_ITEM_LOCATION_BYTES] = bytes
        .try_into()
        .map_err(|_| ItemPgCodecError::InvalidLength)?;
    match bytes[0] {
        1 => {
            if bytes[17..26].iter().any(|b| *b != 0) {
                return Err(ItemPgCodecError::NonCanonicalPadding);
            }
            let value = decode_nonzero_u128(&bytes[1..17])?;
            CharacterId::new(value)
                .map(ItemLocation::Inventory)
                .ok_or(ItemPgCodecError::InvalidIdentity)
        }
        2 => {
            if bytes[18..26].iter().any(|b| *b != 0) {
                return Err(ItemPgCodecError::NonCanonicalPadding);
            }
            let value = decode_nonzero_u128(&bytes[1..17])?;
            CharacterId::new(value)
                .map(|character_id| ItemLocation::Equipped {
                    character_id,
                    slot: bytes[17],
                })
                .ok_or(ItemPgCodecError::InvalidIdentity)
        }
        3 => {
            if bytes[17..26].iter().any(|b| *b != 0) {
                return Err(ItemPgCodecError::NonCanonicalPadding);
            }
            let value = decode_nonzero_u128(&bytes[1..17])?;
            CorpseId::new(value)
                .map(ItemLocation::Corpse)
                .ok_or(ItemPgCodecError::InvalidIdentity)
        }
        4 => {
            if bytes[9..18].iter().any(|b| *b != 0) {
                return Err(ItemPgCodecError::NonCanonicalPadding);
            }
            let zone = u64::from_be_bytes(bytes[1..9].try_into().expect("length checked"));
            let zone_id = ZoneId::new(zone).ok_or(ItemPgCodecError::InvalidIdentity)?;
            let x_cm = i32::from_be_bytes(bytes[18..22].try_into().expect("length checked"));
            let y_cm = i32::from_be_bytes(bytes[22..26].try_into().expect("length checked"));
            Ok(ItemLocation::Ground {
                zone_id,
                x_cm,
                y_cm,
            })
        }
        _ => Err(ItemPgCodecError::InvalidTag),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn character(n: u128) -> CharacterId {
        CharacterId::new(n).unwrap()
    }
    fn corpse(n: u128) -> CorpseId {
        CorpseId::new(n).unwrap()
    }
    fn zone(n: u64) -> ZoneId {
        ZoneId::new(n).unwrap()
    }

    #[test]
    fn item_and_transaction_ids_match_c4d_big_endian_mapping() {
        let numeric = 0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10;
        let item = ItemId::new(numeric).unwrap();
        let tx = OwnershipTxnId::new(numeric).unwrap();
        let expected: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        assert_eq!(PG_GROUND_ITEM_ENTITY_KIND, 2);
        assert_eq!(item_id_to_pg(item), expected);
        assert_eq!(transaction_id_to_pg(tx), expected);
        assert_eq!(item_id_from_pg(&expected), Ok(item));
        assert_eq!(transaction_id_from_pg(&expected), Ok(tx));
        assert_ne!(
            numeric.to_le_bytes(),
            expected,
            "journal format is not SQL format"
        );
    }

    #[test]
    fn roundtrip_all_four_ownership_locations() {
        let id = character(0x0102_0304_0506_0708_090a_0b0c_0d0e_0f10);
        let all = [
            ItemLocation::Inventory(id),
            ItemLocation::Equipped {
                character_id: id,
                slot: 255,
            },
            ItemLocation::Corpse(corpse(u128::MAX)),
            ItemLocation::Ground {
                zone_id: zone(u64::MAX),
                x_cm: i32::MIN,
                y_cm: i32::MAX,
            },
        ];
        for location in all {
            assert_eq!(location_from_pg(&location_to_pg(location)), Ok(location));
        }
        assert_eq!(location_to_pg(all[0])[0], 1);
        assert_eq!(location_to_pg(all[1])[17], 255);
        assert_eq!(location_to_pg(all[2])[0], 3);
        assert_eq!(location_to_pg(all[3])[0], 4);
        assert_eq!(
            &location_to_pg(all[0])[1..17],
            &[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,]
        );
    }

    #[test]
    fn ground_coordinates_are_signed_network_order() {
        let ground = ItemLocation::Ground {
            zone_id: zone(0x0102_0304_0506_0708),
            x_cm: -1,
            y_cm: 0x0102_0304,
        };
        let bytes = location_to_pg(ground);
        assert_eq!(&bytes[1..9], &[1, 2, 3, 4, 5, 6, 7, 8]);
        assert_eq!(&bytes[18..22], &[255, 255, 255, 255]);
        assert_eq!(&bytes[22..26], &[1, 2, 3, 4]);
        assert!(bytes[9..18].iter().all(|b| *b == 0));
    }

    #[test]
    fn reject_zero_identity_bad_length_and_invalid_tags() {
        assert_eq!(
            item_id_from_pg(&[0; 16]),
            Err(ItemPgCodecError::InvalidIdentity)
        );
        assert_eq!(
            transaction_id_from_pg(&[0; 16]),
            Err(ItemPgCodecError::InvalidIdentity)
        );
        assert_eq!(
            item_id_from_pg(&[1; 15]),
            Err(ItemPgCodecError::InvalidLength)
        );
        assert_eq!(
            location_from_pg(&[1; 25]),
            Err(ItemPgCodecError::InvalidLength)
        );
        assert_eq!(
            location_from_pg(&[1; 27]),
            Err(ItemPgCodecError::InvalidLength)
        );
        assert_eq!(
            location_from_pg(&[0; 26]),
            Err(ItemPgCodecError::InvalidTag)
        );
        assert_eq!(
            location_from_pg(&[5; 26]),
            Err(ItemPgCodecError::InvalidTag)
        );

        for tag in [1_u8, 2, 3, 4] {
            let mut bytes = [0; PG_ITEM_LOCATION_BYTES];
            bytes[0] = tag;
            assert_eq!(
                location_from_pg(&bytes),
                Err(ItemPgCodecError::InvalidIdentity)
            );
        }
    }

    #[test]
    fn noncanonical_unused_bytes_are_rejected() {
        let id = character(1);
        for location in [
            ItemLocation::Inventory(id),
            ItemLocation::Equipped {
                character_id: id,
                slot: 1,
            },
            ItemLocation::Corpse(corpse(1)),
            ItemLocation::Ground {
                zone_id: zone(1),
                x_cm: 1,
                y_cm: -1,
            },
        ] {
            let mut bytes = location_to_pg(location);
            let reserved = match location {
                ItemLocation::Inventory(_) | ItemLocation::Corpse(_) => 17,
                ItemLocation::Equipped { .. } => 18,
                ItemLocation::Ground { .. } => 9,
            };
            bytes[reserved] = 0xff;
            assert_eq!(
                location_from_pg(&bytes),
                Err(ItemPgCodecError::NonCanonicalPadding)
            );
        }
    }

    #[test]
    fn canonical_encoding_is_injective_for_test_vectors() {
        use std::collections::BTreeSet;
        let mut unique = BTreeSet::new();
        for n in 1..64_u128 {
            let id = character(n);
            for loc in [
                ItemLocation::Inventory(id),
                ItemLocation::Equipped {
                    character_id: id,
                    slot: 3,
                },
                ItemLocation::Corpse(corpse(n)),
                ItemLocation::Ground {
                    zone_id: zone(n as u64),
                    x_cm: n as i32,
                    y_cm: -(n as i32),
                },
            ] {
                assert!(unique.insert(location_to_pg(loc)));
            }
        }
    }
}
