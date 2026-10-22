//! Core 8B P0 First Playable: DORMANT legacy Magic/Items identity preflight.
//!
//! This is a proposed migration compatibility gate, NOT approved namespace
//! allocation, a runtime adapter, player auth, or a second item ledger.
//! Legacy Magic/Items uses u64 IDs and checkpoint slot codes 0..4. Core 8B
//! uses u128 and MYTX little-endian; Core 8C PostgreSQL uses BE 16-byte IDs.
//! Never cast or copy raw checkpoint/journal bytes directly into a live ledger.

use crate::{
    identity::CharacterId,
    item_ownership::{CorpseId, ItemId, ItemLocation},
};
use std::collections::{BTreeMap, BTreeSet};

/// Distinct legacy source identity domains; namespaces are supplied *only*
/// by a reviewed offline migration configuration, never by a browser packet.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum LegacyDomain {
    Character,
    Item,
    Corpse,
    GroundEntity,
    Operation,
}
impl LegacyDomain {
    const fn index(self) -> usize {
        match self {
            Self::Character => 0,
            Self::Item => 1,
            Self::Corpse => 2,
            Self::GroundEntity => 3,
            Self::Operation => 4,
        }
    }
}

/// Source checkpoint (MYWLD003) codes observed in Magic & Items #424.
/// Old 0/1/2 meanings MUST NOT shift when adding Head=3 and Feet=4.
/// This is not an approved Core network/DB equipment-slot schema yet.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LegacyEquipmentSlot {
    MainHand,
    OffHand,
    Body,
    Head,
    Feet,
}
impl LegacyEquipmentSlot {
    pub const fn from_checkpoint_code(code: u8) -> Option<Self> {
        match code {
            0 => Some(Self::MainHand),
            1 => Some(Self::OffHand),
            2 => Some(Self::Body),
            3 => Some(Self::Head),
            4 => Some(Self::Feet),
            _ => None,
        }
    }

    pub const fn checkpoint_code(self) -> u8 {
        match self {
            Self::MainHand => 0,
            Self::OffHand => 1,
            Self::Body => 2,
            Self::Head => 3,
            Self::Feet => 4,
        }
    }

    /// Only for offline data migration/preflight: Core's generic u8 slot
    /// lacks a frozen semantic registry, so do not call this on live gear.
    pub const fn proposed_core_slot(self) -> u8 {
        self.checkpoint_code()
    }
}

/// Existing Magic & Items #424 disk ItemKind codes, in source order.
/// Unknown codes are never treated as a default sword or invisible weapon.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LegacyItemKind {
    RustySword,
    LeatherArmor,
    Spellbook,
    FireRuneScroll,
    SulfurAsh,
    BlackPearl,
    Gold,
    HealingPotion,
    IronSword,
    WoodenClub,
    ChainmailArmor,
    IronHelmet,
    LeatherBoots,
    WoodenShield,
}
impl LegacyItemKind {
    pub const fn from_checkpoint_code(code: u8) -> Option<Self> {
        match code {
            0 => Some(Self::RustySword),
            1 => Some(Self::LeatherArmor),
            2 => Some(Self::Spellbook),
            3 => Some(Self::FireRuneScroll),
            4 => Some(Self::SulfurAsh),
            5 => Some(Self::BlackPearl),
            6 => Some(Self::Gold),
            7 => Some(Self::HealingPotion),
            8 => Some(Self::IronSword),
            9 => Some(Self::WoodenClub),
            10 => Some(Self::ChainmailArmor),
            11 => Some(Self::IronHelmet),
            12 => Some(Self::LeatherBoots),
            13 => Some(Self::WoodenShield),
            _ => None,
        }
    }

    pub const fn checkpoint_code(self) -> u8 {
        match self {
            Self::RustySword => 0,
            Self::LeatherArmor => 1,
            Self::Spellbook => 2,
            Self::FireRuneScroll => 3,
            Self::SulfurAsh => 4,
            Self::BlackPearl => 5,
            Self::Gold => 6,
            Self::HealingPotion => 7,
            Self::IronSword => 8,
            Self::WoodenClub => 9,
            Self::ChainmailArmor => 10,
            Self::IronHelmet => 11,
            Self::LeatherBoots => 12,
            Self::WoodenShield => 13,
        }
    }

    pub const fn is_alpha_sword(self) -> bool {
        matches!(self, Self::RustySword | Self::IronSword)
    }

    /// Mirrors Magic/Items #424 ItemKind::stackable for its disk codes.
    pub const fn stackable(self) -> bool {
        matches!(
            self,
            Self::SulfurAsh | Self::BlackPearl | Self::Gold | Self::HealingPotion
        )
    }

    pub fn require_checkpoint_kind(code: u8) -> Result<Self, LegacyMigrationError> {
        Self::from_checkpoint_code(code).ok_or(LegacyMigrationError::InvalidKindCode)
    }

    /// Mirrors the actual Magic/Items #424 ItemKind::fits slot rule. This
    /// alone does not authenticate the source item's metadata or ownership.
    pub const fn fits_checkpoint_slot(self, slot: LegacyEquipmentSlot) -> bool {
        matches!(
            (self, slot),
            (
                Self::RustySword | Self::IronSword | Self::WoodenClub,
                LegacyEquipmentSlot::MainHand
            ) | (
                Self::LeatherArmor | Self::ChainmailArmor,
                LegacyEquipmentSlot::Body
            ) | (Self::IronHelmet, LegacyEquipmentSlot::Head)
                | (Self::LeatherBoots, LegacyEquipmentSlot::Feet)
                | (
                    Self::WoodenShield | Self::Spellbook,
                    LegacyEquipmentSlot::OffHand
                )
        )
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LegacyMigrationError {
    ZeroNamespace,
    ReusedNamespace,
    ZeroLegacyId,
    ZeroExistingCanonicalId,
    DuplicateExistingCanonicalId,
    CanonicalIdCollision,
    DuplicateSourceIdentity,
    UnregisteredSourceIdentity,
    InvalidSlotCode,
    InvalidKindCode,
    NonSwordRackItem,
    DuplicateRackItem,
    TooManyEquippedSlots,
    DuplicateEquippedSlot,
    DuplicateEquippedItem,
    IncompatibleEquippedKind,
    InvalidSourceNextId,
    SourceIdBeyondNextId,
    DuplicateSourceItemRecord,
    InvalidSourceItemStack,
    MissingSourceItemRecord,
    SourceItemKindMismatch,
}

/// A five-domain high-64 namespace proposal. Do NOT hard-code its values in
/// production: first inventory all actual old source IDs and canonical IDs,
/// then obtain joint approval in #432. This reserves no persistent identity.
#[derive(Clone, Copy, Debug)]
pub struct ProposedLegacyNamespaces {
    high64: [u64; 5],
}
impl ProposedLegacyNamespaces {
    pub fn new(high64: [u64; 5]) -> Result<Self, LegacyMigrationError> {
        let mut used = BTreeSet::new();
        for value in high64 {
            if value == 0 {
                return Err(LegacyMigrationError::ZeroNamespace);
            }
            if !used.insert(value) {
                return Err(LegacyMigrationError::ReusedNamespace);
            }
        }
        Ok(Self { high64 })
    }

    fn candidate(self, domain: LegacyDomain, source: u64) -> Result<u128, LegacyMigrationError> {
        if source == 0 {
            return Err(LegacyMigrationError::ZeroLegacyId);
        }
        Ok((u128::from(self.high64[domain.index()]) << 64) | u128::from(source))
    }
}

/// Deterministic collision-checked *offline preflight*, not a live allocator.
/// Existing IDs must enumerate ALL active/retired canonical IDs in the same
/// ownership namespace. An incomplete inventory invalidates the preflight.
pub struct LegacyImportPreflight {
    namespaces: ProposedLegacyNamespaces,
    existing: BTreeSet<u128>,
    staged: BTreeMap<(LegacyDomain, u64), u128>,
    imported: BTreeSet<u128>,
}
impl LegacyImportPreflight {
    pub fn new(
        namespaces: ProposedLegacyNamespaces,
        existing_ids: impl IntoIterator<Item = u128>,
    ) -> Result<Self, LegacyMigrationError> {
        let mut existing = BTreeSet::new();
        for id in existing_ids {
            if id == 0 {
                return Err(LegacyMigrationError::ZeroExistingCanonicalId);
            }
            if !existing.insert(id) {
                return Err(LegacyMigrationError::DuplicateExistingCanonicalId);
            }
        }
        Ok(Self {
            namespaces,
            existing,
            staged: BTreeMap::new(),
            imported: BTreeSet::new(),
        })
    }

    /// Reserve once for the source object's real ownership record. Extra
    /// references must call resolve_registered; a duplicate owner row fails.
    pub fn stage_owner(
        &mut self,
        domain: LegacyDomain,
        legacy_id: u64,
    ) -> Result<u128, LegacyMigrationError> {
        let mapped = self.namespaces.candidate(domain, legacy_id)?;
        let key = (domain, legacy_id);
        if self.staged.contains_key(&key) {
            return Err(LegacyMigrationError::DuplicateSourceIdentity);
        }
        if self.existing.contains(&mapped) || self.imported.contains(&mapped) {
            return Err(LegacyMigrationError::CanonicalIdCollision);
        }
        self.staged.insert(key, mapped);
        self.imported.insert(mapped);
        Ok(mapped)
    }

    /// No raw source reference is authoritative without a staged matching
    /// owner object. Do not silently invent a new entity while reading.
    pub fn resolve_registered(
        &self,
        domain: LegacyDomain,
        legacy_id: u64,
    ) -> Result<u128, LegacyMigrationError> {
        self.staged
            .get(&(domain, legacy_id))
            .copied()
            .ok_or(LegacyMigrationError::UnregisteredSourceIdentity)
    }

    pub fn core_character(&self, legacy_id: u64) -> Result<CharacterId, LegacyMigrationError> {
        CharacterId::new(self.resolve_registered(LegacyDomain::Character, legacy_id)?)
            .ok_or(LegacyMigrationError::ZeroLegacyId)
    }

    pub fn core_item(&self, legacy_id: u64) -> Result<ItemId, LegacyMigrationError> {
        ItemId::new(self.resolve_registered(LegacyDomain::Item, legacy_id)?)
            .ok_or(LegacyMigrationError::ZeroLegacyId)
    }

    pub fn core_corpse(&self, legacy_id: u64) -> Result<CorpseId, LegacyMigrationError> {
        CorpseId::new(self.resolve_registered(LegacyDomain::Corpse, legacy_id)?)
            .ok_or(LegacyMigrationError::ZeroLegacyId)
    }

    /// Only constructs a typed future location. Never commits either
    /// Magic's checkpoint or Core's journal: one-authority cutover is missing.
    pub fn proposed_equipped(
        &self,
        legacy_character: u64,
        checkpoint_slot: u8,
    ) -> Result<Option<ItemLocation>, LegacyMigrationError> {
        let slot = LegacyEquipmentSlot::from_checkpoint_code(checkpoint_slot)
            .ok_or(LegacyMigrationError::InvalidSlotCode)?;
        Ok(Some(ItemLocation::Equipped {
            character_id: self.core_character(legacy_character)?,
            slot: slot.proposed_core_slot(),
        }))
    }

    pub fn staged_count(&self) -> usize {
        self.staged.len()
    }
}

/// An extracted equipment entry from an independently validated legacy
/// snapshot. Its provenance and current ownership MUST be validated by the
/// Magic/Items source-owner; this Core preflight is only a proposed mapping.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LegacyEquippedRow {
    pub checkpoint_slot_code: u8,
    pub legacy_item_id: u64,
    /// Explicit source disk ItemKind, never inferred from slot or item ID.
    pub checkpoint_kind_code: u8,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedCanonicalEquippedRow {
    pub item_id: ItemId,
    pub location: ItemLocation,
    pub kind: LegacyItemKind,
}

/// Preflight at most five DISTINCT legacy slot/item bindings. Historic
/// snapshots with 0..3 occupied slots and expanded 4..5 layouts use the
/// SAME recorded slot codes (0 MainHand, 1 OffHand, 2 Body, 3 Head,
/// 4 Feet), never positional reinterpretation or implicit empty-slot fill.
/// This is not a live equipment owner, disk parser, or migration writer.
pub fn preflight_equipment_manifest<const N: usize>(
    import: &LegacyImportPreflight,
    legacy_character_id: u64,
    rows: [LegacyEquippedRow; N],
) -> Result<[ProposedCanonicalEquippedRow; N], LegacyMigrationError> {
    if N > 5 {
        return Err(LegacyMigrationError::TooManyEquippedSlots);
    }
    let character_id = import.core_character(legacy_character_id)?;
    let mut seen_slots = BTreeSet::new();
    let mut seen_items = BTreeSet::new();
    let mut canonical = Vec::with_capacity(N);
    for row in rows {
        let slot = LegacyEquipmentSlot::from_checkpoint_code(row.checkpoint_slot_code)
            .ok_or(LegacyMigrationError::InvalidSlotCode)?;
        if !seen_slots.insert(slot.checkpoint_code()) {
            return Err(LegacyMigrationError::DuplicateEquippedSlot);
        }
        let kind = LegacyItemKind::require_checkpoint_kind(row.checkpoint_kind_code)?;
        if !kind.fits_checkpoint_slot(slot) {
            return Err(LegacyMigrationError::IncompatibleEquippedKind);
        }
        if row.legacy_item_id == 0 {
            return Err(LegacyMigrationError::ZeroLegacyId);
        }
        if !seen_items.insert(row.legacy_item_id) {
            return Err(LegacyMigrationError::DuplicateEquippedItem);
        }
        canonical.push(ProposedCanonicalEquippedRow {
            item_id: import.core_item(row.legacy_item_id)?,
            kind,
            location: ItemLocation::Equipped {
                character_id,
                slot: slot.proposed_core_slot(),
            },
        });
    }
    canonical
        .try_into()
        .map_err(|_| LegacyMigrationError::TooManyEquippedSlots)
}

/// Source `ItemStack` (id u64, kind u8, amount u16) extracted from a
/// separately reviewed, QUIESCENT and internally validated Magic checkpoint.
/// This struct alone is NOT source authentication or a migration receipt.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LegacySourceItemRecord {
    pub legacy_item_id: u64,
    pub checkpoint_kind_code: u8,
    pub amount: u16,
}

/// Bounded only by the reviewed source inventory; never construct this from
/// browser or unauthenticated records. The caller must attest complete source
/// coverage and `next_id` from the SAME source snapshot, excluding untrusted
/// active mutations, retired identity collisions and rollback/forked copies.
pub struct LegacySourceItemCatalog {
    items: BTreeMap<u64, (LegacyItemKind, u16)>,
}

impl LegacySourceItemCatalog {
    pub fn new(
        import: &LegacyImportPreflight,
        source_next_id: u64,
        rows: impl IntoIterator<Item = LegacySourceItemRecord>,
    ) -> Result<Self, LegacyMigrationError> {
        if source_next_id == 0 {
            return Err(LegacyMigrationError::InvalidSourceNextId);
        }
        let mut items = BTreeMap::new();
        for row in rows {
            if row.legacy_item_id == 0 {
                return Err(LegacyMigrationError::ZeroLegacyId);
            }
            if row.legacy_item_id >= source_next_id {
                return Err(LegacyMigrationError::SourceIdBeyondNextId);
            }
            let kind = LegacyItemKind::require_checkpoint_kind(row.checkpoint_kind_code)?;
            if row.amount == 0 || (row.amount != 1 && !kind.stackable()) {
                return Err(LegacyMigrationError::InvalidSourceItemStack);
            }
            import.core_item(row.legacy_item_id)?;
            if items
                .insert(row.legacy_item_id, (kind, row.amount))
                .is_some()
            {
                return Err(LegacyMigrationError::DuplicateSourceItemRecord);
            }
        }
        Ok(Self { items })
    }

    pub fn count(&self) -> usize {
        self.items.len()
    }
}

/// Stronger *consistency* review using two records from the exact same
/// externally reviewed quiescent source: equipment positions and the source
/// item inventory. A forged/incomplete source remains untrusted and must NOT
/// be converted to live Core ownership merely by passing this check.
pub fn preflight_equipment_manifest_against_source<const N: usize>(
    import: &LegacyImportPreflight,
    catalog: &LegacySourceItemCatalog,
    legacy_character_id: u64,
    rows: [LegacyEquippedRow; N],
) -> Result<[ProposedCanonicalEquippedRow; N], LegacyMigrationError> {
    if N > 5 {
        return Err(LegacyMigrationError::TooManyEquippedSlots);
    }
    for row in rows {
        let (kind, amount) = catalog
            .items
            .get(&row.legacy_item_id)
            .ok_or(LegacyMigrationError::MissingSourceItemRecord)?;
        if *kind != LegacyItemKind::require_checkpoint_kind(row.checkpoint_kind_code)? {
            return Err(LegacyMigrationError::SourceItemKindMismatch);
        }
        if *amount != 1 {
            return Err(LegacyMigrationError::InvalidSourceItemStack);
        }
    }
    preflight_equipment_manifest(import, legacy_character_id, rows)
}

/// An offline, owner-reviewed item row extracted from a trusted legacy
/// checkpoint. These bytes MUST NOT originate directly from a client packet.
/// This does not validate physical rack geometry or current item location.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LegacyRackSword {
    pub legacy_item_id: u64,
    pub checkpoint_kind_code: u8,
}

/// One canonical ID and preserved sword kind. No live ledger writes occur.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CanonicalRackSword {
    pub item_id: ItemId,
    pub kind: LegacyItemKind,
}

/// First Playable demands exactly four independently identifiable sword rows.
/// Validate source kind, uniqueness and prior owner registration before
/// exporting candidate IDs for Magic/Items/Core 8C review.
///
/// This does NOT verify source checkpoint authenticity, item location, rack
/// line-of-sight, inventory capacity or the trusted world epoch.
pub fn preflight_four_armory_swords(
    import: &LegacyImportPreflight,
    records: [LegacyRackSword; 4],
) -> Result<[CanonicalRackSword; 4], LegacyMigrationError> {
    let mut seen = BTreeSet::new();
    let mut canonical = Vec::with_capacity(4);
    for row in records {
        if row.legacy_item_id == 0 {
            return Err(LegacyMigrationError::ZeroLegacyId);
        }
        let kind = LegacyItemKind::require_checkpoint_kind(row.checkpoint_kind_code)?;
        if !kind.is_alpha_sword() {
            return Err(LegacyMigrationError::NonSwordRackItem);
        }
        if !seen.insert(row.legacy_item_id) {
            return Err(LegacyMigrationError::DuplicateRackItem);
        }
        let item_id = import.core_item(row.legacy_item_id)?;
        canonical.push(CanonicalRackSword { item_id, kind });
    }
    canonical
        .try_into()
        .map_err(|_| LegacyMigrationError::DuplicateRackItem)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn namespaces() -> ProposedLegacyNamespaces {
        // TEST VALUES ONLY; not a migration schema decision.
        ProposedLegacyNamespaces::new([
            0x4D59_4153_0000_0001,
            0x4D59_4153_0000_0002,
            0x4D59_4153_0000_0003,
            0x4D59_4153_0000_0004,
            0x4D59_4153_0000_0005,
        ])
        .unwrap()
    }

    #[test]
    fn namespace_preflight_rejects_zero_duplicate_and_existing_id_collisions() {
        assert!(matches!(
            ProposedLegacyNamespaces::new([1, 2, 3, 3, 5]),
            Err(LegacyMigrationError::ReusedNamespace)
        ));
        assert!(matches!(
            ProposedLegacyNamespaces::new([1, 0, 3, 4, 5]),
            Err(LegacyMigrationError::ZeroNamespace)
        ));
        assert!(matches!(
            LegacyImportPreflight::new(namespaces(), [0]),
            Err(LegacyMigrationError::ZeroExistingCanonicalId)
        ));
        let candidate = (0x4D59_4153_0000_0002_u128 << 64) | 201;
        let mut preflight = LegacyImportPreflight::new(namespaces(), [candidate]).unwrap();
        assert_eq!(
            preflight.stage_owner(LegacyDomain::Item, 201),
            Err(LegacyMigrationError::CanonicalIdCollision)
        );
        assert_eq!(preflight.staged_count(), 0);
        assert_eq!(
            preflight.stage_owner(LegacyDomain::Character, 0),
            Err(LegacyMigrationError::ZeroLegacyId)
        );
    }

    #[test]
    fn duplicate_active_or_retired_canonical_inventory_fails_before_any_import() {
        assert!(matches!(
            LegacyImportPreflight::new(namespaces(), [42, 42]),
            Err(LegacyMigrationError::DuplicateExistingCanonicalId)
        ));
        assert!(LegacyImportPreflight::new(namespaces(), [42, 43]).is_ok());
        // A raw concatenation of active and retired inventories is not a
        // proven distinct canonical inventory unless duplicates are rejected.
        let collided_import = (0x4D59_4153_0000_0002_u128 << 64) | 201;
        assert!(matches!(
            LegacyImportPreflight::new(namespaces(), [collided_import, collided_import]),
            Err(LegacyMigrationError::DuplicateExistingCanonicalId)
        ));
    }

    #[test]
    fn real_five_slot_codes_preserve_four_and_five_equipped_items() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        import.stage_owner(LegacyDomain::Character, 101).unwrap();
        for item in 201..=205 {
            import.stage_owner(LegacyDomain::Item, item).unwrap();
        }
        let rows = [
            LegacyEquippedRow {
                checkpoint_slot_code: 0,
                legacy_item_id: 201,
                checkpoint_kind_code: 0,
            },
            LegacyEquippedRow {
                checkpoint_slot_code: 1,
                legacy_item_id: 202,
                checkpoint_kind_code: 2,
            },
            LegacyEquippedRow {
                checkpoint_slot_code: 2,
                legacy_item_id: 203,
                checkpoint_kind_code: 1,
            },
            LegacyEquippedRow {
                checkpoint_slot_code: 3,
                legacy_item_id: 204,
                checkpoint_kind_code: 11,
            },
            LegacyEquippedRow {
                checkpoint_slot_code: 4,
                legacy_item_id: 205,
                checkpoint_kind_code: 12,
            },
        ];
        let character_id = import.core_character(101).unwrap();
        for count in [3, 4, 5] {
            let actual = match count {
                3 => preflight_equipment_manifest(&import, 101, [rows[0], rows[1], rows[2]])
                    .unwrap()
                    .to_vec(),
                4 => {
                    preflight_equipment_manifest(&import, 101, [rows[0], rows[1], rows[2], rows[3]])
                        .unwrap()
                        .to_vec()
                }
                _ => preflight_equipment_manifest(&import, 101, rows)
                    .unwrap()
                    .to_vec(),
            };
            assert_eq!(actual.len(), count);
            for (index, row) in actual.iter().enumerate() {
                assert_eq!(row.item_id, import.core_item(201 + index as u64).unwrap());
                assert_eq!(
                    row.location,
                    ItemLocation::Equipped {
                        character_id,
                        slot: index as u8
                    }
                );
            }
        }
        assert!(preflight_equipment_manifest(&import, 101, [])
            .unwrap()
            .is_empty());
    }

    #[test]
    fn proposed_equipment_import_rejects_duplicate_slots_items_and_missing_ids() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        import.stage_owner(LegacyDomain::Character, 101).unwrap();
        import.stage_owner(LegacyDomain::Item, 201).unwrap();
        import.stage_owner(LegacyDomain::Item, 202).unwrap();
        let hand = LegacyEquippedRow {
            checkpoint_slot_code: 0,
            legacy_item_id: 201,
            checkpoint_kind_code: 0,
        };
        assert_eq!(
            preflight_equipment_manifest(&import, 101, [hand, hand]),
            Err(LegacyMigrationError::DuplicateEquippedSlot)
        );
        assert_eq!(
            preflight_equipment_manifest(
                &import,
                101,
                [
                    hand,
                    LegacyEquippedRow {
                        checkpoint_slot_code: 1,
                        legacy_item_id: 201,
                        checkpoint_kind_code: 2
                    }
                ]
            ),
            Err(LegacyMigrationError::DuplicateEquippedItem)
        );
        for (bad_row, expected) in [
            (
                LegacyEquippedRow {
                    checkpoint_slot_code: 5,
                    legacy_item_id: 202,
                    checkpoint_kind_code: 2,
                },
                LegacyMigrationError::InvalidSlotCode,
            ),
            (
                LegacyEquippedRow {
                    checkpoint_slot_code: 1,
                    legacy_item_id: 0,
                    checkpoint_kind_code: 2,
                },
                LegacyMigrationError::ZeroLegacyId,
            ),
            (
                LegacyEquippedRow {
                    checkpoint_slot_code: 1,
                    legacy_item_id: 203,
                    checkpoint_kind_code: 2,
                },
                LegacyMigrationError::UnregisteredSourceIdentity,
            ),
        ] {
            assert_eq!(
                preflight_equipment_manifest(&import, 101, [hand, bad_row]),
                Err(expected)
            );
        }
        assert_eq!(
            preflight_equipment_manifest(&import, 102, [hand]),
            Err(LegacyMigrationError::UnregisteredSourceIdentity)
        );
        assert_eq!(
            preflight_equipment_manifest(&import, 101, [hand; 6]),
            Err(LegacyMigrationError::TooManyEquippedSlots)
        );
    }

    #[test]
    fn four_sword_legacy_ids_map_to_distinct_stable_core_items() {
        let mut preflight = LegacyImportPreflight::new(namespaces(), []).unwrap();
        for sword_id in 201..=204 {
            let new_id = preflight.stage_owner(LegacyDomain::Item, sword_id).unwrap();
            assert_eq!(new_id >> 64, 0x4D59_4153_0000_0002);
            assert_eq!(new_id as u64, sword_id);
            let mapped = preflight.core_item(sword_id).unwrap();
            assert_eq!(mapped.get(), new_id);
        }
        assert_eq!(preflight.staged_count(), 4);
        assert_eq!(
            preflight.stage_owner(LegacyDomain::Item, 201),
            Err(LegacyMigrationError::DuplicateSourceIdentity)
        );
        assert_eq!(
            preflight.core_item(205),
            Err(LegacyMigrationError::UnregisteredSourceIdentity)
        );
        // Reusing raw 201 in a different legacy domain CANNOT alias item 201.
        let character_id = preflight.stage_owner(LegacyDomain::Character, 201).unwrap();
        assert_ne!(character_id, preflight.core_item(201).unwrap().get());
        assert_eq!(preflight.core_character(201).unwrap().get(), character_id);
        let corpse_id = preflight.stage_owner(LegacyDomain::Corpse, 201).unwrap();
        assert_ne!(corpse_id, character_id);
        assert_ne!(corpse_id, preflight.core_item(201).unwrap().get());
    }

    #[test]
    fn every_magic_checkpoint_slot_preserves_legacy_meaning() {
        for (code, slot) in [
            (0, LegacyEquipmentSlot::MainHand),
            (1, LegacyEquipmentSlot::OffHand),
            (2, LegacyEquipmentSlot::Body),
            (3, LegacyEquipmentSlot::Head),
            (4, LegacyEquipmentSlot::Feet),
        ] {
            assert_eq!(LegacyEquipmentSlot::from_checkpoint_code(code), Some(slot));
            assert_eq!(slot.checkpoint_code(), code);
        }
        assert_eq!(LegacyEquipmentSlot::from_checkpoint_code(5), None);
        assert_eq!(LegacyEquipmentSlot::from_checkpoint_code(255), None);
        let mut m = LegacyImportPreflight::new(namespaces(), []).unwrap();
        m.stage_owner(LegacyDomain::Character, 17).unwrap();
        assert_eq!(
            m.proposed_equipped(17, 0).unwrap(),
            Some(ItemLocation::Equipped {
                character_id: m.core_character(17).unwrap(),
                slot: 0,
            })
        );
        assert_eq!(
            m.proposed_equipped(17, 255),
            Err(LegacyMigrationError::InvalidSlotCode)
        );
    }

    #[test]
    fn all_magic_item_kind_disk_codes_are_explicit_not_invisible_swords() {
        for code in 0..=13 {
            let kind = LegacyItemKind::from_checkpoint_code(code).unwrap();
            assert_eq!(kind.checkpoint_code(), code);
            assert_eq!(kind.is_alpha_sword(), code == 0 || code == 8);
        }
        assert_eq!(
            LegacyItemKind::require_checkpoint_kind(14),
            Err(LegacyMigrationError::InvalidKindCode)
        );
        assert!(LegacyItemKind::from_checkpoint_code(14).is_none());
        assert!(LegacyItemKind::from_checkpoint_code(255).is_none());
        assert_eq!(
            LegacyItemKind::from_checkpoint_code(9),
            Some(LegacyItemKind::WoodenClub)
        );
    }

    #[test]
    fn four_real_swords_preserve_kind_and_one_canonical_id_each() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        for raw in 201..=204 {
            import.stage_owner(LegacyDomain::Item, raw).unwrap();
        }
        let four = [
            LegacyRackSword {
                legacy_item_id: 201,
                checkpoint_kind_code: 0,
            },
            LegacyRackSword {
                legacy_item_id: 202,
                checkpoint_kind_code: 8,
            },
            LegacyRackSword {
                legacy_item_id: 203,
                checkpoint_kind_code: 0,
            },
            LegacyRackSword {
                legacy_item_id: 204,
                checkpoint_kind_code: 8,
            },
        ];
        let checked = preflight_four_armory_swords(&import, four).unwrap();
        assert_eq!(checked.len(), 4);
        assert_eq!(checked[0].kind, LegacyItemKind::RustySword);
        assert_eq!(checked[1].kind, LegacyItemKind::IronSword);
        let ids: BTreeSet<_> = checked.iter().map(|row| row.item_id.get()).collect();
        assert_eq!(ids.len(), 4);
        for (index, row) in checked.iter().enumerate() {
            assert_eq!(row.item_id, import.core_item(201 + index as u64).unwrap());
        }
    }

    #[test]
    fn rack_manifest_rejects_duplicates_missing_and_non_sword_kinds() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        for raw in 201..=203 {
            import.stage_owner(LegacyDomain::Item, raw).unwrap();
        }
        let four = [
            LegacyRackSword {
                legacy_item_id: 201,
                checkpoint_kind_code: 0,
            },
            LegacyRackSword {
                legacy_item_id: 202,
                checkpoint_kind_code: 8,
            },
            LegacyRackSword {
                legacy_item_id: 203,
                checkpoint_kind_code: 0,
            },
            LegacyRackSword {
                legacy_item_id: 204,
                checkpoint_kind_code: 8,
            },
        ];
        assert_eq!(
            preflight_four_armory_swords(&import, four),
            Err(LegacyMigrationError::UnregisteredSourceIdentity)
        );
        import.stage_owner(LegacyDomain::Item, 204).unwrap();
        let mut duplicate = four;
        duplicate[3].legacy_item_id = 201;
        assert_eq!(
            preflight_four_armory_swords(&import, duplicate),
            Err(LegacyMigrationError::DuplicateRackItem)
        );
        let mut club = four;
        club[1].checkpoint_kind_code = 9;
        assert_eq!(
            preflight_four_armory_swords(&import, club),
            Err(LegacyMigrationError::NonSwordRackItem)
        );
        let mut invalid = four;
        invalid[1].checkpoint_kind_code = 255;
        assert_eq!(
            preflight_four_armory_swords(&import, invalid),
            Err(LegacyMigrationError::InvalidKindCode)
        );
        let mut zero = four;
        zero[0].legacy_item_id = 0;
        assert_eq!(
            preflight_four_armory_swords(&import, zero),
            Err(LegacyMigrationError::ZeroLegacyId)
        );
    }

    #[test]
    fn network_order_and_journal_order_must_never_be_mixed() {
        let mut preflight = LegacyImportPreflight::new(namespaces(), []).unwrap();
        let source_id = 0x0102_0304_0506_0708;
        let mapped = preflight
            .stage_owner(LegacyDomain::Item, source_id)
            .unwrap();
        let be = mapped.to_be_bytes();
        let le = mapped.to_le_bytes();
        assert_eq!(&be[..8], &0x4D59_4153_0000_0002_u64.to_be_bytes());
        assert_eq!(&be[8..], &source_id.to_be_bytes());
        assert_ne!(be, le);
        assert_eq!(u128::from_be_bytes(be), mapped);
        assert_ne!(u128::from_be_bytes(le), mapped);
    }

    #[test]
    fn exact_magic_kind_slot_matrix_rejects_wrong_gear_and_non_equipment() {
        let allowed = [
            (0, 0),
            (8, 0),
            (9, 0), // original swords and club -> MainHand
            (1, 2),
            (10, 2), // leather/chainmail -> Body
            (2, 1),
            (13, 1), // book/shield -> OffHand
            (11, 3),
            (12, 4), // helmet and boots -> Head and Feet
        ];
        for kind_code in 0..=13 {
            let kind = LegacyItemKind::require_checkpoint_kind(kind_code).unwrap();
            for slot_code in 0..=4 {
                let slot = LegacyEquipmentSlot::from_checkpoint_code(slot_code).unwrap();
                assert_eq!(
                    kind.fits_checkpoint_slot(slot),
                    allowed.contains(&(kind_code, slot_code)),
                    "source kind code {kind_code} on slot {slot_code}"
                );
            }
        }
    }

    #[test]
    fn kind_bound_equipment_manifest_denies_swap_unknown_kind_and_incompatible_item() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        import.stage_owner(LegacyDomain::Character, 10).unwrap();
        import.stage_owner(LegacyDomain::Item, 20).unwrap();
        let valid = LegacyEquippedRow {
            checkpoint_slot_code: 0,
            legacy_item_id: 20,
            checkpoint_kind_code: 8,
        };
        let approved = preflight_equipment_manifest(&import, 10, [valid]).unwrap();
        assert_eq!(approved[0].item_id, import.core_item(20).unwrap());
        assert_eq!(approved[0].kind, LegacyItemKind::IronSword);
        for (bad_kind, expected) in [
            (1, LegacyMigrationError::IncompatibleEquippedKind),
            (4, LegacyMigrationError::IncompatibleEquippedKind),
            (6, LegacyMigrationError::IncompatibleEquippedKind),
            (14, LegacyMigrationError::InvalidKindCode),
            (255, LegacyMigrationError::InvalidKindCode),
        ] {
            let wrong = LegacyEquippedRow {
                checkpoint_kind_code: bad_kind,
                ..valid
            };
            assert_eq!(
                preflight_equipment_manifest(&import, 10, [wrong]),
                Err(expected)
            );
        }
        assert_eq!(
            preflight_equipment_manifest(
                &import,
                10,
                [LegacyEquippedRow {
                    checkpoint_slot_code: 3,
                    ..valid
                }]
            ),
            Err(LegacyMigrationError::IncompatibleEquippedKind)
        );
    }

    #[test]
    fn source_item_catalog_preserves_kind_amount_and_allocator_boundary() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        import.stage_owner(LegacyDomain::Character, 101).unwrap();
        for item_id in [201, 202, 203] {
            import.stage_owner(LegacyDomain::Item, item_id).unwrap();
        }
        let sword = LegacySourceItemRecord {
            legacy_item_id: 201,
            checkpoint_kind_code: 8,
            amount: 1,
        };
        let shield = LegacySourceItemRecord {
            legacy_item_id: 202,
            checkpoint_kind_code: 13,
            amount: 1,
        };
        let gold = LegacySourceItemRecord {
            legacy_item_id: 203,
            checkpoint_kind_code: 6,
            amount: 400,
        };
        let catalog = LegacySourceItemCatalog::new(&import, 204, [sword, shield, gold]).unwrap();
        assert_eq!(catalog.count(), 3);
        let bound = preflight_equipment_manifest_against_source(
            &import,
            &catalog,
            101,
            [
                LegacyEquippedRow {
                    legacy_item_id: 201,
                    checkpoint_slot_code: 0,
                    checkpoint_kind_code: 8,
                },
                LegacyEquippedRow {
                    legacy_item_id: 202,
                    checkpoint_slot_code: 1,
                    checkpoint_kind_code: 13,
                },
            ],
        )
        .unwrap();
        assert_eq!(bound[0].item_id, import.core_item(201).unwrap());
        assert_eq!(bound[0].kind, LegacyItemKind::IronSword);
        assert_eq!(bound[1].kind, LegacyItemKind::WoodenShield);
        assert_eq!(
            bound[1].location,
            ItemLocation::Equipped {
                character_id: import.core_character(101).unwrap(),
                slot: 1,
            }
        );
        let incompatible_but_well_formed = LegacyEquippedRow {
            legacy_item_id: 201,
            checkpoint_slot_code: 0,
            checkpoint_kind_code: 9,
        };
        // Club also fits MainHand; it must NOT replace a catalogued sword.
        assert_eq!(
            preflight_equipment_manifest(&import, 101, [incompatible_but_well_formed]).unwrap()[0]
                .kind,
            LegacyItemKind::WoodenClub
        );
        assert_eq!(
            preflight_equipment_manifest_against_source(
                &import,
                &catalog,
                101,
                [incompatible_but_well_formed]
            ),
            Err(LegacyMigrationError::SourceItemKindMismatch)
        );
        assert_eq!(
            preflight_equipment_manifest_against_source(
                &import,
                &catalog,
                101,
                [LegacyEquippedRow {
                    legacy_item_id: 203,
                    checkpoint_slot_code: 0,
                    checkpoint_kind_code: 6
                }]
            ),
            Err(LegacyMigrationError::InvalidSourceItemStack)
        );
    }

    #[test]
    fn source_item_catalog_rejects_duplicates_corruption_and_unregistered_ids() {
        let mut import = LegacyImportPreflight::new(namespaces(), []).unwrap();
        import.stage_owner(LegacyDomain::Character, 101).unwrap();
        import.stage_owner(LegacyDomain::Item, 201).unwrap();
        let record = LegacySourceItemRecord {
            legacy_item_id: 201,
            checkpoint_kind_code: 8,
            amount: 1,
        };
        assert!(matches!(
            LegacySourceItemCatalog::new(&import, 0, [record]),
            Err(LegacyMigrationError::InvalidSourceNextId)
        ));
        assert!(matches!(
            LegacySourceItemCatalog::new(&import, 201, [record]),
            Err(LegacyMigrationError::SourceIdBeyondNextId)
        ));
        assert!(matches!(
            LegacySourceItemCatalog::new(&import, 202, [record, record]),
            Err(LegacyMigrationError::DuplicateSourceItemRecord)
        ));
        for (bad, expected) in [
            (
                LegacySourceItemRecord {
                    legacy_item_id: 0,
                    ..record
                },
                LegacyMigrationError::ZeroLegacyId,
            ),
            (
                LegacySourceItemRecord {
                    legacy_item_id: 202,
                    ..record
                },
                LegacyMigrationError::UnregisteredSourceIdentity,
            ),
            (
                LegacySourceItemRecord {
                    checkpoint_kind_code: 255,
                    ..record
                },
                LegacyMigrationError::InvalidKindCode,
            ),
            (
                LegacySourceItemRecord {
                    amount: 0,
                    ..record
                },
                LegacyMigrationError::InvalidSourceItemStack,
            ),
            (
                LegacySourceItemRecord {
                    amount: 2,
                    ..record
                },
                LegacyMigrationError::InvalidSourceItemStack,
            ),
        ] {
            assert!(
                matches!(LegacySourceItemCatalog::new(&import, 203, [bad]), Err(e) if e == expected)
            );
        }
        let catalog = LegacySourceItemCatalog::new(&import, 202, [record]).unwrap();
        assert_eq!(
            preflight_equipment_manifest_against_source(
                &import,
                &catalog,
                101,
                [LegacyEquippedRow {
                    legacy_item_id: 999,
                    checkpoint_slot_code: 0,
                    checkpoint_kind_code: 8
                }]
            ),
            Err(LegacyMigrationError::MissingSourceItemRecord)
        );
    }

    #[test]
    fn maximum_legacy_id_is_lossless_but_only_after_registration() {
        let mut p = LegacyImportPreflight::new(namespaces(), []).unwrap();
        assert_eq!(
            p.resolve_registered(LegacyDomain::Item, u64::MAX),
            Err(LegacyMigrationError::UnregisteredSourceIdentity)
        );
        let id = p.stage_owner(LegacyDomain::Item, u64::MAX).unwrap();
        assert_eq!(id as u64, u64::MAX);
        assert_eq!(id >> 64, 0x4D59_4153_0000_0002);
        assert_eq!(p.core_item(u64::MAX).unwrap().get(), id);
    }
}
