//! Dormant server-authoritative item ownership transaction invariants.
//!
//! This is an in-memory prototype for future durable/full-loot ownership,
//! not a production ledger. Callers MUST enforce item creation permissions,
//! PvP/loot permissions, distance, death authorization and account identity.
//! Persistence must commit item states, transaction receipts and outbox
//! changes atomically before enabling it on a live server.

use crate::identity::CharacterId;
use std::collections::{BTreeMap, BTreeSet};

/// Prevent an untrusted gameplay event from allocating unbounded batch work.
pub const MAX_OWNERSHIP_OPS: usize = 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash)]
pub struct ItemId(u128);

impl ItemId {
    pub fn new(value: u128) -> Option<Self> {
        (value != 0).then_some(Self(value))
    }

    pub fn get(self) -> u128 {
        self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct OwnershipTxnId(u128);

impl OwnershipTxnId {
    pub fn new(value: u128) -> Option<Self> {
        (value != 0).then_some(Self(value))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct CorpseId(u128);

impl CorpseId {
    pub fn new(value: u128) -> Option<Self> {
        (value != 0).then_some(Self(value))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct ZoneId(u64);

impl ZoneId {
    pub fn new(value: u64) -> Option<Self> {
        (value != 0).then_some(Self(value))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum ItemLocation {
    Inventory(CharacterId),
    Equipped { character_id: CharacterId, slot: u8 },
    Corpse(CorpseId),
    Ground { zone_id: ZoneId, x_cm: i32, y_cm: i32 },
}

type EquipmentSlot = (CharacterId, u8);

impl ItemLocation {
    fn equipment_slot(self) -> Option<EquipmentSlot> {
        match self {
            Self::Equipped { character_id, slot } => Some((character_id, slot)),
            _ => None,
        }
    }
}

/// An expected source is mandatory for moves/destroys. Blind remote writes
/// must never be allowed to steal or duplicate existing items.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OwnershipOp {
    Create { item: ItemId, at: ItemLocation },
    Move {
        item: ItemId,
        from: ItemLocation,
        to: ItemLocation,
    },
    Destroy { item: ItemId, from: ItemLocation },
}

impl OwnershipOp {
    pub fn item(self) -> ItemId {
        match self {
            Self::Create { item, .. } | Self::Move { item, .. } | Self::Destroy { item, .. } => {
                item
            }
        }
    }

    fn target(self) -> Option<ItemLocation> {
        match self {
            Self::Create { at, .. } => Some(at),
            Self::Move { to, .. } => Some(to),
            Self::Destroy { .. } => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OwnershipReceipt {
    pub sequence: u64,
    pub operation_count: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OwnershipError {
    EmptyTransaction,
    TooManyOperations,
    DuplicateItem,
    ItemAlreadyExists,
    ItemNotFound,
    ExpectedLocationMismatch,
    EquipmentSlotOccupied,
    ConflictingReplay,
    SequenceExhausted,
}

#[derive(Clone, Debug)]
struct AppliedTransaction {
    operations: Vec<OwnershipOp>,
    receipt: OwnershipReceipt,
}

/// Prototype state. The equipment index makes each batch O(k log n) rather
/// than O(all world items), excluding bounded transaction history allocation.
/// The applied transaction history is intentionally never evicted in this
/// prototype: production must use durable idempotency storage + retention.
#[derive(Default, Debug)]
pub struct ItemOwnershipLedger {
    items: BTreeMap<ItemId, ItemLocation>,
    equipped: BTreeMap<EquipmentSlot, ItemId>,
    applied: BTreeMap<OwnershipTxnId, AppliedTransaction>,
    sequence: u64,
}

impl ItemOwnershipLedger {
    pub fn location(&self, item: ItemId) -> Option<ItemLocation> {
        self.items.get(&item).copied()
    }

    pub fn equipped_item(&self, character: CharacterId, slot: u8) -> Option<ItemId> {
        self.equipped.get(&(character, slot)).copied()
    }

    pub fn item_count(&self) -> usize {
        self.items.len()
    }

    pub fn apply(
        &mut self,
        transaction: OwnershipTxnId,
        operations: &[OwnershipOp],
    ) -> Result<OwnershipReceipt, OwnershipError> {
        // Compare complete payload bytes semantically, not a short hash with
        // possible collisions. Identical replay returns the original receipt.
        if let Some(previous) = self.applied.get(&transaction) {
            return if previous.operations == operations {
                Ok(previous.receipt)
            } else {
                Err(OwnershipError::ConflictingReplay)
            };
        }
        if operations.is_empty() {
            return Err(OwnershipError::EmptyTransaction);
        }
        if operations.len() > MAX_OWNERSHIP_OPS {
            return Err(OwnershipError::TooManyOperations);
        }

        let next_sequence = self
            .sequence
            .checked_add(1)
            .ok_or(OwnershipError::SequenceExhausted)?;
        let mut touched = BTreeSet::new();
        let mut outgoing_slots = BTreeSet::new();
        let mut incoming_slots = BTreeMap::new();

        // Stage and validate every expected precondition before mutation.
        for &op in operations {
            let item = op.item();
            if !touched.insert(item) {
                return Err(OwnershipError::DuplicateItem);
            }
            let old_location = self.location(item);
            match op {
                OwnershipOp::Create { .. } if old_location.is_some() => {
                    return Err(OwnershipError::ItemAlreadyExists);
                }
                OwnershipOp::Move { from, .. } | OwnershipOp::Destroy { from, .. } => {
                    if old_location.is_none() {
                        return Err(OwnershipError::ItemNotFound);
                    }
                    if old_location != Some(from) {
                        return Err(OwnershipError::ExpectedLocationMismatch);
                    }
                }
                _ => {}
            }
            if let Some(slot) = old_location.and_then(ItemLocation::equipment_slot) {
                outgoing_slots.insert(slot);
            }
            if let Some(slot) = op.target().and_then(ItemLocation::equipment_slot) {
                if incoming_slots.insert(slot, item).is_some() {
                    return Err(OwnershipError::EquipmentSlotOccupied);
                }
            }
        }

        // A slot occupied by an item NOT leaving the slot in this batch
        // cannot be taken. Simultaneous equipment swaps are legal.
        for slot in incoming_slots.keys() {
            if self.equipped.contains_key(slot) && !outgoing_slots.contains(slot) {
                return Err(OwnershipError::EquipmentSlotOccupied);
            }
        }

        // No fallible checks remain after this point. First clear outgoing
        // equipment slots, then publish all final states and incoming slots.
        for slot in outgoing_slots {
            self.equipped.remove(&slot);
        }
        for &op in operations {
            let item = op.item();
            match op.target() {
                Some(next_location) => {
                    self.items.insert(item, next_location);
                    if let Some(slot) = next_location.equipment_slot() {
                        self.equipped.insert(slot, item);
                    }
                }
                None => {
                    self.items.remove(&item);
                }
            }
        }
        self.sequence = next_sequence;
        let receipt = OwnershipReceipt {
            sequence: next_sequence,
            operation_count: operations.len(),
        };
        self.applied.insert(
            transaction,
            AppliedTransaction {
                operations: operations.to_vec(),
                receipt,
            },
        );
        Ok(receipt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn character(id: u128) -> CharacterId {
        CharacterId::new(id).expect("nonzero character")
    }
    fn item(id: u128) -> ItemId {
        ItemId::new(id).expect("nonzero item")
    }
    fn txn(id: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(id).expect("nonzero txn")
    }
    fn corpse(id: u128) -> CorpseId {
        CorpseId::new(id).expect("nonzero corpse")
    }
    fn zone(id: u64) -> ZoneId {
        ZoneId::new(id).expect("nonzero zone")
    }
    fn bag(id: u128) -> ItemLocation {
        ItemLocation::Inventory(character(id))
    }
    fn sword(id: u128) -> ItemLocation {
        ItemLocation::Equipped {
            character_id: character(id),
            slot: 1,
        }
    }

    #[test]
    fn zero_identity_cannot_be_created() {
        assert!(ItemId::new(0).is_none());
        assert!(OwnershipTxnId::new(0).is_none());
        assert!(CorpseId::new(0).is_none());
        assert!(ZoneId::new(0).is_none());
    }

    #[test]
    fn full_loot_death_moves_inventory_and_equipment_atomically() {
        let mut ledger = ItemOwnershipLedger::default();
        ledger
            .apply(
                txn(1),
                &[
                    OwnershipOp::Create { item: item(100), at: sword(1) },
                    OwnershipOp::Create { item: item(101), at: bag(1) },
                    OwnershipOp::Create { item: item(102), at: bag(1) },
                ],
            )
            .expect("create loadout");
        let death = [
            OwnershipOp::Move { item: item(100), from: sword(1), to: ItemLocation::Corpse(corpse(55)) },
            OwnershipOp::Move { item: item(101), from: bag(1), to: ItemLocation::Corpse(corpse(55)) },
            OwnershipOp::Move {
                item: item(102),
                from: bag(1),
                to: ItemLocation::Ground { zone_id: zone(7), x_cm: -88, y_cm: 139 },
            },
        ];
        let receipt = ledger.apply(txn(2), &death).expect("atomic death");
        assert_eq!(receipt.operation_count, 3);
        assert_eq!(ledger.item_count(), 3);
        assert_eq!(ledger.equipped_item(character(1), 1), None);
        assert_eq!(ledger.location(item(100)), Some(ItemLocation::Corpse(corpse(55))));
        assert_eq!(ledger.location(item(101)), Some(ItemLocation::Corpse(corpse(55))));
        assert_eq!(ledger.location(item(102)), death[2].target());
        assert_eq!(ledger.apply(txn(2), &death), Ok(receipt));
        assert_eq!(ledger.item_count(), 3);
    }

    #[test]
    fn batch_rejects_one_bad_expected_location_without_partial_death() {
        let mut ledger = ItemOwnershipLedger::default();
        ledger.apply(txn(1), &[
            OwnershipOp::Create { item: item(1), at: sword(1) },
            OwnershipOp::Create { item: item(2), at: bag(1) },
        ]).expect("initial");
        let bad = [
            OwnershipOp::Move { item: item(1), from: sword(1), to: ItemLocation::Corpse(corpse(2)) },
            OwnershipOp::Move { item: item(2), from: bag(99), to: ItemLocation::Corpse(corpse(2)) },
        ];
        assert_eq!(ledger.apply(txn(2), &bad), Err(OwnershipError::ExpectedLocationMismatch));
        assert_eq!(ledger.location(item(1)), Some(sword(1)));
        assert_eq!(ledger.location(item(2)), Some(bag(1)));
        assert_eq!(ledger.equipped_item(character(1), 1), Some(item(1)));
        assert_eq!(ledger.apply(txn(2), &bad[..1]).expect("valid later").sequence, 2);
    }

    #[test]
    fn equipment_uniqueness_allows_atomic_swap_but_not_collisions() {
        let mut ledger = ItemOwnershipLedger::default();
        ledger.apply(txn(1), &[
            OwnershipOp::Create { item: item(1), at: sword(1) },
            OwnershipOp::Create { item: item(2), at: bag(1) },
        ]).expect("initial");
        let collision = [OwnershipOp::Move { item: item(2), from: bag(1), to: sword(1) }];
        assert_eq!(ledger.apply(txn(2), &collision), Err(OwnershipError::EquipmentSlotOccupied));
        let swap = [
            OwnershipOp::Move { item: item(1), from: sword(1), to: bag(1) },
            OwnershipOp::Move { item: item(2), from: bag(1), to: sword(1) },
        ];
        ledger.apply(txn(2), &swap).expect("atomic swap");
        assert_eq!(ledger.equipped_item(character(1), 1), Some(item(2)));
        assert_eq!(ledger.location(item(1)), Some(bag(1)));
        assert_eq!(ledger.location(item(2)), Some(sword(1)));
    }

    #[test]
    fn competing_looters_cannot_acquire_same_item_twice() {
        let mut ledger = ItemOwnershipLedger::default();
        let at = ItemLocation::Corpse(corpse(5));
        ledger.apply(txn(1), &[OwnershipOp::Create { item: item(8), at }]).expect("corpse");
        let first = [OwnershipOp::Move { item: item(8), from: at, to: bag(1) }];
        let second = [OwnershipOp::Move { item: item(8), from: at, to: bag(2) }];
        ledger.apply(txn(2), &first).expect("first looter");
        assert_eq!(ledger.apply(txn(3), &second), Err(OwnershipError::ExpectedLocationMismatch));
        assert_eq!(ledger.location(item(8)), Some(bag(1)));
        assert_eq!(ledger.item_count(), 1);
    }

    #[test]
    fn identical_retry_is_idempotent_and_different_payload_is_rejected() {
        let mut ledger = ItemOwnershipLedger::default();
        let create = [OwnershipOp::Create { item: item(7), at: bag(1) }];
        let first = ledger.apply(txn(7), &create).expect("create");
        assert_eq!(ledger.apply(txn(7), &create), Ok(first));
        assert_eq!(
            ledger.apply(txn(7), &[OwnershipOp::Create { item: item(7), at: bag(2) }]),
            Err(OwnershipError::ConflictingReplay)
        );
        assert_eq!(ledger.location(item(7)), Some(bag(1)));
        assert_eq!(ledger.apply(txn(8), &create), Err(OwnershipError::ItemAlreadyExists));
    }

    #[test]
    fn destroy_requires_location_and_cannot_recreate_using_same_transaction() {
        let mut ledger = ItemOwnershipLedger::default();
        ledger.apply(txn(1), &[OwnershipOp::Create { item: item(7), at: bag(1) }]).expect("create");
        assert_eq!(
            ledger.apply(txn(2), &[OwnershipOp::Destroy { item: item(7), from: bag(2) }]),
            Err(OwnershipError::ExpectedLocationMismatch)
        );
        ledger.apply(txn(2), &[OwnershipOp::Destroy { item: item(7), from: bag(1) }])
            .expect("valid destroy");
        assert_eq!(ledger.location(item(7)), None);
        assert_eq!(ledger.item_count(), 0);
    }

    #[test]
    fn duplicate_items_invalid_batch_and_overlarge_batches_fail_closed() {
        let mut ledger = ItemOwnershipLedger::default();
        assert_eq!(ledger.apply(txn(1), &[]), Err(OwnershipError::EmptyTransaction));
        let same = [OwnershipOp::Create { item: item(4), at: bag(1) }; 2];
        assert_eq!(ledger.apply(txn(1), &same), Err(OwnershipError::DuplicateItem));
        assert_eq!(ledger.item_count(), 0);
        let oversized = vec![OwnershipOp::Create { item: item(4), at: bag(1) }; MAX_OWNERSHIP_OPS + 1];
        assert_eq!(ledger.apply(txn(1), &oversized), Err(OwnershipError::TooManyOperations));
        assert_eq!(ledger.item_count(), 0);
    }

    #[test]
    fn sequence_overflow_rejects_without_mutation() {
        let mut ledger = ItemOwnershipLedger { sequence: u64::MAX, ..Default::default() };
        assert_eq!(
            ledger.apply(txn(1), &[OwnershipOp::Create { item: item(1), at: bag(1) }]),
            Err(OwnershipError::SequenceExhausted)
        );
        assert_eq!(ledger.item_count(), 0);
    }
}
