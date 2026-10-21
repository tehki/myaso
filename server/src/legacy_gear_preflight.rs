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
    const ALL: [Self; 5] = [
        Self::Character,
        Self::Item,
        Self::Corpse,
        Self::GroundEntity,
        Self::Operation,
    ];

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
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LegacyMigrationError {
    ZeroNamespace,
    ReusedNamespace,
    ZeroLegacyId,
    ZeroExistingCanonicalId,
    CanonicalIdCollision,
    DuplicateSourceIdentity,
    UnregisteredSourceIdentity,
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
            existing.insert(id);
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
        let slot = match LegacyEquipmentSlot::from_checkpoint_code(checkpoint_slot) {
            Some(slot) => slot,
            None => return Ok(None),
        };
        Ok(Some(ItemLocation::Equipped {
            character_id: self.core_character(legacy_character)?,
            slot: slot.proposed_core_slot(),
        }))
    }

    pub fn staged_count(&self) -> usize {
        self.staged.len()
    }
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
        assert_eq!(m.proposed_equipped(17, 255), Ok(None));
    }

    #[test]
    fn all_magic_item_kind_disk_codes_are_explicit_not_invisible_swords() {
        for code in 0..=13 {
            let kind = LegacyItemKind::from_checkpoint_code(code).unwrap();
            assert_eq!(kind.checkpoint_code(), code);
            assert_eq!(kind.is_alpha_sword(), code == 0 || code == 8);
        }
        assert!(LegacyItemKind::from_checkpoint_code(14).is_none());
        assert!(LegacyItemKind::from_checkpoint_code(255).is_none());
        assert_eq!(
            LegacyItemKind::from_checkpoint_code(9),
            Some(LegacyItemKind::WoodenClub)
        );
    }

    #[test]
    fn network_order_and_journal_order_must_never_be_mixed() {
        let mut preflight = LegacyImportPreflight::new(namespaces(), []).unwrap();
        let source_id = 0x0102_0304_0506_0708;
        let mapped = preflight.stage_owner(LegacyDomain::Item, source_id).unwrap();
        let be = mapped.to_be_bytes();
        let le = mapped.to_le_bytes();
        assert_eq!(&be[..8], &0x4D59_4153_0000_0002_u64.to_be_bytes());
        assert_eq!(&be[8..], &source_id.to_be_bytes());
        assert_ne!(be, le);
        assert_eq!(u128::from_be_bytes(be), mapped);
        assert_ne!(u128::from_be_bytes(le), mapped);
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
