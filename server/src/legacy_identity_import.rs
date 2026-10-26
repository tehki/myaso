//! DORMANT Core8B/Magic legacy-ID import primitives (X1 #405).
//!
//! Pure, in-memory mapping validation only. This module does NOT authenticate
//! accounts, allocate canonical IDs, write a durable migration, or connect
//! Magic's isolated loot state to the live arena. A caller must provide
//! independently allocated, server-verified canonical IDs and commit the full
//! mapping + dependent references transactionally before using any result.

use crate::{identity::CharacterId, item_ownership::ItemId};
use std::{collections::BTreeMap, num::NonZeroU64};

/// A trusted import-source namespace and a historical nonzero local ID.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct LegacyKey {
    namespace: NonZeroU64,
    local_id: NonZeroU64,
}

impl LegacyKey {
    pub fn new(namespace: u64, local_id: u64) -> Option<Self> {
        Some(Self {
            namespace: NonZeroU64::new(namespace)?,
            local_id: NonZeroU64::new(local_id)?,
        })
    }

    pub fn namespace(self) -> u64 {
        self.namespace.get()
    }

    pub fn local_id(self) -> u64 {
        self.local_id.get()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ImportError {
    ConflictingLegacyId,
    CanonicalIdAlreadyAllocated,
}

/// Staging map, NOT a durable allocator or authenticated authority.
///
/// Identity domains remain distinct: use CharacterId for players, ItemId for
/// physical objects. Do not infer an identity by numeric widening of an old ID.
#[derive(Debug)]
pub struct LegacyImportMap<Canonical: Ord + Copy> {
    by_legacy: BTreeMap<LegacyKey, Canonical>,
    by_canonical: BTreeMap<Canonical, LegacyKey>,
}

impl<Canonical: Ord + Copy> Default for LegacyImportMap<Canonical> {
    fn default() -> Self {
        Self {
            by_legacy: BTreeMap::new(),
            by_canonical: BTreeMap::new(),
        }
    }
}

pub type CharacterImportMap = LegacyImportMap<CharacterId>;
pub type ItemImportMap = LegacyImportMap<ItemId>;

impl<Canonical: Ord + Copy> LegacyImportMap<Canonical> {
    pub fn canonical_for(&self, key: LegacyKey) -> Option<Canonical> {
        self.by_legacy.get(&key).copied()
    }

    pub fn legacy_for(&self, canonical: Canonical) -> Option<LegacyKey> {
        self.by_canonical.get(&canonical).copied()
    }

    pub fn len(&self) -> usize {
        self.by_legacy.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_legacy.is_empty()
    }

    /// Validate a complete batch before publishing ANY staging-map changes.
    /// Identical retries are idempotent; changing either side is rejected.
    /// Atomicity applies only to these two in-memory indexes, not disk or
    /// dependent Magic corpse/inventory references.
    pub fn stage_batch(
        &mut self,
        mappings: &[(LegacyKey, Canonical)],
    ) -> Result<usize, ImportError> {
        let mut forward = self.by_legacy.clone();
        let mut reverse = self.by_canonical.clone();
        let mut inserted = 0usize;
        for &(old, canonical) in mappings {
            match forward.get(&old) {
                Some(existing) if *existing != canonical => {
                    return Err(ImportError::ConflictingLegacyId);
                }
                Some(_) => continue, // exact idempotent repeat
                None => {}
            }
            if reverse.contains_key(&canonical) {
                return Err(ImportError::CanonicalIdAlreadyAllocated);
            }
            forward.insert(old, canonical);
            reverse.insert(canonical, old);
            inserted += 1;
        }
        self.by_legacy = forward;
        self.by_canonical = reverse;
        Ok(inserted)
    }
}

/// PostgreSQL bytea identity key: fixed-width BIG-ENDIAN u128, never a signed
/// bigint or truncated legacy u64. This is intentionally distinct from the
/// existing MYCH 36-byte little-endian on-disk record wire encoding.
pub fn character_db_key(character: CharacterId) -> [u8; 16] {
    character.get().to_be_bytes()
}

pub fn parse_character_db_key(bytes: [u8; 16]) -> Option<CharacterId> {
    CharacterId::new(u128::from_be_bytes(bytes))
}

pub fn item_db_key(item: ItemId) -> [u8; 16] {
    item.get().to_be_bytes()
}

pub fn parse_item_db_key(bytes: [u8; 16]) -> Option<ItemId> {
    ItemId::new(u128::from_be_bytes(bytes))
}

/// A PostgreSQL positive signed-bigint zone/epoch/worker is NOT a generic
/// u64. Reject zero or values outside the signed-positive range; never wrap.
pub fn positive_pg_bigint(value: u64) -> Option<i64> {
    i64::try_from(value).ok().filter(|&n| n > 0)
}

// ---------------------- Dormant Magic carried-item preflight ----------------
// Only Backpack and Equipment from Magic 2B are covered. Real corpses/ground
// require independent location/zone/receipt semantics; they MUST NOT be
// represented as an inventory owner or silently dropped during migration.

use std::collections::BTreeSet;

/// Bounds work for ONE staging partition. This does not establish global
/// physical uniqueness across partitions, source namespaces or other writers.
pub const MAX_CARRIED_REFERENCE_BATCH: usize = 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum CarriedSlot {
    Backpack,
    /// Tag is opaque until Magic 2B supplies an explicit reviewed slot codec.
    Equipped(u8),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LegacyCarriedStack {
    pub owner: LegacyKey,
    pub item: LegacyKey,
    pub slot: CarriedSlot,
    pub amount: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ResolvedCarriedStack {
    pub owner: CharacterId,
    pub item: ItemId,
    pub slot: CarriedSlot,
    pub amount: u16,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CarriedImportError {
    UnmappedOwner,
    UnmappedItem,
    InvalidStackAmount,
    DuplicatePhysicalItem,
    DuplicateEquipmentSlot,
    TooManyReferences,
}

/// Read-only preflight for one complete carrier partition (the caller must
/// decide and verify that partition's completeness). A failure returns NO
/// partial result. The mappings are assumed to be separately vetted; presence
/// alone is NOT authentication nor proof of durable allocation.
///
/// Full Magic domain validation must additionally check permitted equipment
/// slots and kind/stackability, and a complete global import must enforce item
/// uniqueness across corpse/ground, other partitions and the existing ledger.
/// The returned rows are NOT committed locations and authorize no live write.
pub fn resolve_carried_stacks(
    characters: &CharacterImportMap,
    items: &ItemImportMap,
    entries: &[LegacyCarriedStack],
) -> Result<Vec<ResolvedCarriedStack>, CarriedImportError> {
    if entries.len() > MAX_CARRIED_REFERENCE_BATCH {
        return Err(CarriedImportError::TooManyReferences);
    }
    let mut rows = Vec::with_capacity(entries.len());
    let mut physical_items = BTreeSet::new();
    let mut equipped_slots = BTreeSet::new();

    for entry in entries {
        if entry.amount == 0 {
            return Err(CarriedImportError::InvalidStackAmount);
        }
        let owner = characters
            .canonical_for(entry.owner)
            .ok_or(CarriedImportError::UnmappedOwner)?;
        let item = items
            .canonical_for(entry.item)
            .ok_or(CarriedImportError::UnmappedItem)?;
        if !physical_items.insert(item) {
            return Err(CarriedImportError::DuplicatePhysicalItem);
        }
        if let CarriedSlot::Equipped(slot) = entry.slot {
            if !equipped_slots.insert((owner, slot)) {
                return Err(CarriedImportError::DuplicateEquipmentSlot);
            }
        }
        rows.push(ResolvedCarriedStack {
            owner,
            item,
            slot: entry.slot,
            amount: entry.amount,
        });
    }
    Ok(rows)
}

/// Maximum number of declared partitions in one carrier-only import snapshot.
pub const MAX_CARRIED_MANIFEST_PARTITIONS: usize = 64;
/// Maximum total carried rows in one preflight. Not a live world/item limit.
pub const MAX_CARRIED_MANIFEST_ROWS: usize = 4096;

/// Additional **read-only** cross-partition check when the caller provides
/// all carried-item partitions in one authenticated, complete snapshot.
///
/// It rejects physical-item duplicates and conflicting equipment slots across
/// independent partitions, including distinct legacy source namespaces that
/// resolve to the same canonical owner/item. It returns no rows on failure;
/// this is NOT a transaction, global durable scan or live authorization.
/// Corpse/Ground/existing physical-ledger checks remain separately mandatory.
pub fn resolve_carried_manifest(
    characters: &CharacterImportMap,
    items: &ItemImportMap,
    partitions: &[&[LegacyCarriedStack]],
) -> Result<Vec<ResolvedCarriedStack>, CarriedImportError> {
    if partitions.len() > MAX_CARRIED_MANIFEST_PARTITIONS {
        return Err(CarriedImportError::TooManyReferences);
    }
    let mut total = 0usize;
    for partition in partitions {
        total = total
            .checked_add(partition.len())
            .ok_or(CarriedImportError::TooManyReferences)?;
        if total > MAX_CARRIED_MANIFEST_ROWS {
            return Err(CarriedImportError::TooManyReferences);
        }
    }
    let mut all = Vec::with_capacity(total);
    let mut physical_items = BTreeSet::new();
    let mut equipped_slots = BTreeSet::new();
    for partition in partitions {
        let resolved = resolve_carried_stacks(characters, items, partition)?;
        for row in resolved {
            if !physical_items.insert(row.item) {
                return Err(CarriedImportError::DuplicatePhysicalItem);
            }
            if let CarriedSlot::Equipped(slot) = row.slot {
                if !equipped_slots.insert((row.owner, slot)) {
                    return Err(CarriedImportError::DuplicateEquipmentSlot);
                }
            }
            all.push(row);
        }
    }
    Ok(all)
}
