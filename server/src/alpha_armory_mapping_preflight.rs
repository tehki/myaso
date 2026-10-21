//! P0 First Playable, OFFLINE ONLY: reviewed socket -> ground entity ->
//! canonical item identity + explicit world-unit -> Core centimeter proposal.
//! World #493's *socket* labels, Items #522's `u64` ground entities and
//! `u64` item IDs, and Core's `u128` ItemId are distinct namespaces.
//! No runtime writer, packet codec, trusted zone epoch, click/LOS or approval.

use crate::{
    item_ownership::{ItemId, ItemLocation, ZoneId},
    legacy_gear_preflight::{LegacyDomain, LegacyImportPreflight, LegacyMigrationError},
};
use std::collections::BTreeSet;

/// Authoring version 1 from World #493. These frozen positions are an
/// OFFLINE drift check, not a second world source or an agreed transform.
pub const GREYHAVEN_RACK_V1: [(&str, i32, i32); 4] = [
    ("greyhaven-rack-1", 3740, 4038),
    ("greyhaven-rack-2", 3780, 4038),
    ("greyhaven-rack-3", 3820, 4038),
    ("greyhaven-rack-4", 3860, 4038),
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RackPreflightError {
    UnexpectedSocketOrWorldPosition,
    DuplicateGroundEntity,
    DuplicateLegacyItem,
    ZeroEntityOrItem,
    InvalidScale,
    FractionalCentimeter,
    CoordinateOverflow,
    Legacy(LegacyMigrationError),
}
impl From<LegacyMigrationError> for RackPreflightError {
    fn from(value: LegacyMigrationError) -> Self {
        Self::Legacy(value)
    }
}

/// The source world point is in World #493 authored world units.
/// Ground entity ID and item ID are distinct legacy `u64` values.
/// This row MUST be assembled from independently trusted checkpoint and
/// authoring records (never a client packet), and cannot mint either ID.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedRackSource {
    pub socket_id: &'static str,
    pub world_x: i32,
    pub world_y: i32,
    pub ground_entity_id: u64,
    pub legacy_item_id: u64,
}

/// An explicit *unapproved* rational conversion. For example, 100/1
/// (test only!) is not authorized as the live world-unit centimeter scale.
/// Exact integer centimeters are REQUIRED; no rounding or silent truncation.
/// Typed zone must be resolved by authoritative 8C world/zone ownership.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedWorldToCentimeter {
    pub zone: ZoneId,
    pub numerator_cm: i64,
    pub denominator_world_units: i64,
    pub offset_x_cm: i64,
    pub offset_y_cm: i64,
}
impl ProposedWorldToCentimeter {
    fn coordinate(self, world: i32, offset: i64) -> Result<i32, RackPreflightError> {
        if self.numerator_cm <= 0 || self.denominator_world_units <= 0 {
            return Err(RackPreflightError::InvalidScale);
        }
        let scaled = i64::from(world)
            .checked_mul(self.numerator_cm)
            .ok_or(RackPreflightError::CoordinateOverflow)?;
        if scaled % self.denominator_world_units != 0 {
            return Err(RackPreflightError::FractionalCentimeter);
        }
        let converted = scaled
            .checked_div(self.denominator_world_units)
            .and_then(|scaled_cm| scaled_cm.checked_add(offset))
            .ok_or(RackPreflightError::CoordinateOverflow)?;
        i32::try_from(converted).map_err(|_| RackPreflightError::CoordinateOverflow)
    }

    pub fn propose_ground(
        self,
        world_x: i32,
        world_y: i32,
    ) -> Result<ItemLocation, RackPreflightError> {
        // Invalid mappings must also fail on coordinates whose products are
        // zero; no degenerate unit ratios are accepted.
        if self.numerator_cm <= 0 || self.denominator_world_units <= 0 {
            return Err(RackPreflightError::InvalidScale);
        }
        Ok(ItemLocation::Ground {
            zone_id: self.zone,
            x_cm: self.coordinate(world_x, self.offset_x_cm)?,
            y_cm: self.coordinate(world_y, self.offset_y_cm)?,
        })
    }
}

/// Typed proposed result for review: no implicit item/ground-entity aliases.
/// This is not an item creation event or a signed outbox receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedRackProjection {
    pub socket_id: &'static str,
    pub canonical_ground_entity: u128,
    pub canonical_item: ItemId,
    pub ground: ItemLocation,
}

/// Fail closed unless the authoring source EXACTLY matches World #493 V1,
/// both legacy source namespaces are staged in one complete Core import
/// preflight, and four independent ground entities map to four unique items.
///
/// Important: a matching manifest is NOT sufficient live authorization.
/// This reads no 8C epoch, active actor position, physics LOS, or checkpoint
/// signatures. Central #432 must approve the conversion before any usage.
pub fn preflight_greyhaven_rack_v1(
    source: [ProposedRackSource; 4],
    imported: &LegacyImportPreflight,
    mapping: ProposedWorldToCentimeter,
) -> Result<[ProposedRackProjection; 4], RackPreflightError> {
    if mapping.numerator_cm <= 0 || mapping.denominator_world_units <= 0 {
        return Err(RackPreflightError::InvalidScale);
    }
    let mut entities = BTreeSet::new();
    let mut items = BTreeSet::new();
    let mut results = Vec::with_capacity(4);
    for (row, (socket, x, y)) in source.into_iter().zip(GREYHAVEN_RACK_V1) {
        if row.socket_id != socket || row.world_x != x || row.world_y != y {
            return Err(RackPreflightError::UnexpectedSocketOrWorldPosition);
        }
        if row.ground_entity_id == 0 || row.legacy_item_id == 0 {
            return Err(RackPreflightError::ZeroEntityOrItem);
        }
        if !entities.insert(row.ground_entity_id) {
            return Err(RackPreflightError::DuplicateGroundEntity);
        }
        if !items.insert(row.legacy_item_id) {
            return Err(RackPreflightError::DuplicateLegacyItem);
        }
        let canonical_ground_entity =
            imported.resolve_registered(LegacyDomain::GroundEntity, row.ground_entity_id)?;
        let canonical_item = imported.core_item(row.legacy_item_id)?;
        let ground = mapping.propose_ground(row.world_x, row.world_y)?;
        results.push(ProposedRackProjection {
            socket_id: row.socket_id,
            canonical_ground_entity,
            canonical_item,
            ground,
        });
    }
    results
        .try_into()
        .map_err(|_| RackPreflightError::UnexpectedSocketOrWorldPosition)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::legacy_gear_preflight::ProposedLegacyNamespaces;
    use std::collections::BTreeSet;

    fn example_import() -> LegacyImportPreflight {
        // Fixed high halves are synthetic TEST-ONLY, not a namespace grant.
        let namespaces = ProposedLegacyNamespaces::new([
            0x4D59_4153_0000_0001,
            0x4D59_4153_0000_0002,
            0x4D59_4153_0000_0003,
            0x4D59_4153_0000_0004,
            0x4D59_4153_0000_0005,
        ])
        .unwrap();
        let mut imported = LegacyImportPreflight::new(namespaces, []).unwrap();
        for id in 101..=104 {
            imported.stage_owner(LegacyDomain::Item, id).unwrap();
        }
        for id in 201..=204 {
            imported
                .stage_owner(LegacyDomain::GroundEntity, id)
                .unwrap();
        }
        imported
    }

    fn rows() -> [ProposedRackSource; 4] {
        std::array::from_fn(|n| {
            let (socket, x, y) = GREYHAVEN_RACK_V1[n];
            ProposedRackSource {
                socket_id: socket,
                world_x: x,
                world_y: y,
                ground_entity_id: 201 + n as u64,
                legacy_item_id: 101 + n as u64,
            }
        })
    }

    fn sample_mapping() -> ProposedWorldToCentimeter {
        // Only illustrates explicit configuration, NOT approved x100.
        ProposedWorldToCentimeter {
            zone: ZoneId::new(1).unwrap(),
            numerator_cm: 100,
            denominator_world_units: 1,
            offset_x_cm: 0,
            offset_y_cm: 0,
        }
    }

    #[test]
    fn world_socket_ground_entity_and_item_are_three_distinct_namespaces() {
        let imported = example_import();
        let mapped = preflight_greyhaven_rack_v1(rows(), &imported, sample_mapping()).unwrap();
        let mut distinct_items = BTreeSet::new();
        let mut distinct_entities = BTreeSet::new();
        for (idx, row) in mapped.iter().enumerate() {
            assert_eq!(row.socket_id, GREYHAVEN_RACK_V1[idx].0);
            assert_eq!(
                row.canonical_item,
                imported.core_item(101 + idx as u64).unwrap()
            );
            assert_eq!(
                row.canonical_ground_entity,
                imported
                    .resolve_registered(LegacyDomain::GroundEntity, 201 + idx as u64)
                    .unwrap()
            );
            assert_ne!(row.canonical_item.get(), row.canonical_ground_entity);
            assert!(distinct_items.insert(row.canonical_item.get()));
            assert!(distinct_entities.insert(row.canonical_ground_entity));
            assert_eq!(
                row.ground,
                ItemLocation::Ground {
                    zone_id: ZoneId::new(1).unwrap(),
                    x_cm: 374_000 + idx as i32 * 4_000,
                    y_cm: 403_800,
                }
            );
        }
        assert_eq!(distinct_items.len(), 4);
        assert_eq!(distinct_entities.len(), 4);
    }

    #[test]
    fn previous_core_placeholder_is_not_the_actual_world_blacksmith_rack() {
        let imported = example_import();
        let mapped = preflight_greyhaven_rack_v1(rows(), &imported, sample_mapping()).unwrap();
        assert_ne!(
            mapped[0].ground,
            ItemLocation::Ground {
                zone_id: ZoneId::new(1).unwrap(),
                x_cm: 371_000,
                y_cm: 385_000,
            },
            "old C3o fixture coordinates must never silently authorize M2"
        );
        let mut old_position = rows();
        old_position[0].world_x = 3710;
        old_position[0].world_y = 3850;
        assert_eq!(
            preflight_greyhaven_rack_v1(old_position, &imported, sample_mapping()),
            Err(RackPreflightError::UnexpectedSocketOrWorldPosition)
        );
        let mut swapped = rows();
        swapped.swap(0, 1);
        assert_eq!(
            preflight_greyhaven_rack_v1(swapped, &imported, sample_mapping()),
            Err(RackPreflightError::UnexpectedSocketOrWorldPosition)
        );
    }

    #[test]
    fn repeated_and_unknown_world_item_and_ground_entity_ids_fail_closed() {
        let imported = example_import();
        let mut same_item = rows();
        same_item[3].legacy_item_id = same_item[0].legacy_item_id;
        assert_eq!(
            preflight_greyhaven_rack_v1(same_item, &imported, sample_mapping()),
            Err(RackPreflightError::DuplicateLegacyItem)
        );
        let mut same_ground_entity = rows();
        same_ground_entity[3].ground_entity_id = same_ground_entity[0].ground_entity_id;
        assert_eq!(
            preflight_greyhaven_rack_v1(same_ground_entity, &imported, sample_mapping()),
            Err(RackPreflightError::DuplicateGroundEntity)
        );
        let mut missing_item = rows();
        missing_item[3].legacy_item_id = 999;
        assert_eq!(
            preflight_greyhaven_rack_v1(missing_item, &imported, sample_mapping()),
            Err(RackPreflightError::Legacy(
                LegacyMigrationError::UnregisteredSourceIdentity
            ))
        );
        let mut missing_entity = rows();
        missing_entity[2].ground_entity_id = 999;
        assert_eq!(
            preflight_greyhaven_rack_v1(missing_entity, &imported, sample_mapping()),
            Err(RackPreflightError::Legacy(
                LegacyMigrationError::UnregisteredSourceIdentity
            ))
        );
        let mut zero_item = rows();
        zero_item[0].legacy_item_id = 0;
        assert_eq!(
            preflight_greyhaven_rack_v1(zero_item, &imported, sample_mapping()),
            Err(RackPreflightError::ZeroEntityOrItem)
        );
    }

    #[test]
    fn explicit_transform_rejects_zero_fractional_cm_and_int_overflow() {
        let imported = example_import();
        let good = sample_mapping();
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    numerator_cm: 0,
                    ..good
                }
            ),
            Err(RackPreflightError::InvalidScale)
        );
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    denominator_world_units: -1,
                    ..good
                }
            ),
            Err(RackPreflightError::InvalidScale)
        );
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    numerator_cm: 1,
                    denominator_world_units: 3,
                    ..good
                }
            ),
            Err(RackPreflightError::FractionalCentimeter)
        );
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    numerator_cm: i64::MAX,
                    ..good
                }
            ),
            Err(RackPreflightError::CoordinateOverflow)
        );
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    offset_x_cm: i64::MAX,
                    ..good
                }
            ),
            Err(RackPreflightError::CoordinateOverflow)
        );
        assert_eq!(
            preflight_greyhaven_rack_v1(
                rows(),
                &imported,
                ProposedWorldToCentimeter {
                    numerator_cm: 1_000_000,
                    ..good
                }
            ),
            Err(RackPreflightError::CoordinateOverflow)
        );
    }

    #[test]
    fn explicit_offset_and_ratio_different_from_100_are_not_guessed() {
        let imported = example_import();
        let alternate = ProposedWorldToCentimeter {
            numerator_cm: 1,
            denominator_world_units: 1,
            offset_x_cm: -1000,
            offset_y_cm: -2000,
            ..sample_mapping()
        };
        let mapped = preflight_greyhaven_rack_v1(rows(), &imported, alternate).unwrap();
        assert_eq!(
            mapped[0].ground,
            ItemLocation::Ground {
                zone_id: ZoneId::new(1).unwrap(),
                x_cm: 2740,
                y_cm: 2038,
            }
        );
        // Successful arithmetic is NOT evidence this alternative has
        // been approved by World/8C; it is only a proposal for review.
    }
}
