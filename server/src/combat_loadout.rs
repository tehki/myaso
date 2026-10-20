//! Read-only Combat view of server-owned physical equipment.
//!
//! This module deliberately has NO live simulation call site. Core must resolve
//! the authenticated actor and hold the single-writer World/Loot tick lock
//! before Combat consumes a snapshot. No client-selected item IDs, inventory
//! mutations, damage numbers, armor mitigation or wire format are introduced.
//!
//! The existing arena's 34 HP attacks MUST NOT be construed as unarmed hits.
//! Wiring unarmed / item-derived stats is a separate balance and integration
//! gate shared with Magic & Items, Core and Graphics.

use std::collections::BTreeSet;

use crate::loot::{EquipmentSlot, Inventory, ItemKind, ItemStack, LootAuthority};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MainHandCombatItem {
    Unarmed,
    RustySword(u64),
    IronSword(u64),
    WoodenClub(u64),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OffHandCombatItem {
    Empty,
    WoodenShield(u64),
    Spellbook(u64),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BodyCombatArmor {
    Unarmored,
    LeatherArmor(u64),
    ChainmailArmor(u64),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CombatLoadout {
    pub main_hand: MainHandCombatItem,
    pub off_hand: OffHandCombatItem,
    pub body: BodyCombatArmor,
    pub helmet_id: Option<u64>,
    pub boots_id: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CombatLoadoutError {
    MissingInventory,
    InvalidEquippedItem(EquipmentSlot),
    DuplicateEquippedItem(u64),
}

/// Only for a server-resolved actor; callers MUST NOT accept a network-provided
/// actor ID or read this outside the authoritative Loot/World tick boundary.
pub fn resolve_server_owned_loadout(
    loot: &LootAuthority,
    server_actor_id: u32,
) -> Result<CombatLoadout, CombatLoadoutError> {
    let inventory = loot
        .inventory(server_actor_id)
        .ok_or(CombatLoadoutError::MissingInventory)?;
    resolve_inventory_loadout(inventory)
}

fn checked_slot<'a>(
    inventory: &'a Inventory,
    slot: EquipmentSlot,
    seen_ids: &mut BTreeSet<u64>,
) -> Result<Option<&'a ItemStack>, CombatLoadoutError> {
    let Some(item) = inventory.equipped(slot) else {
        return Ok(None);
    };
    if item.id == 0 || item.amount != 1 || !item.kind.fits(slot) {
        return Err(CombatLoadoutError::InvalidEquippedItem(slot));
    }
    if !seen_ids.insert(item.id) {
        return Err(CombatLoadoutError::DuplicateEquippedItem(item.id));
    }
    Ok(Some(item))
}

fn resolve_inventory_loadout(inventory: &Inventory) -> Result<CombatLoadout, CombatLoadoutError> {
    let mut seen_ids = BTreeSet::new();
    let main = checked_slot(inventory, EquipmentSlot::MainHand, &mut seen_ids)?;
    let off = checked_slot(inventory, EquipmentSlot::OffHand, &mut seen_ids)?;
    let body = checked_slot(inventory, EquipmentSlot::Body, &mut seen_ids)?;
    let head = checked_slot(inventory, EquipmentSlot::Head, &mut seen_ids)?;
    let feet = checked_slot(inventory, EquipmentSlot::Feet, &mut seen_ids)?;

    let main_hand = match main.map(|item| (item.kind, item.id)) {
        None => MainHandCombatItem::Unarmed,
        Some((ItemKind::RustySword, id)) => MainHandCombatItem::RustySword(id),
        Some((ItemKind::IronSword, id)) => MainHandCombatItem::IronSword(id),
        Some((ItemKind::WoodenClub, id)) => MainHandCombatItem::WoodenClub(id),
        Some(_) => {
            return Err(CombatLoadoutError::InvalidEquippedItem(
                EquipmentSlot::MainHand,
            ))
        }
    };
    let off_hand = match off.map(|item| (item.kind, item.id)) {
        None => OffHandCombatItem::Empty,
        Some((ItemKind::WoodenShield, id)) => OffHandCombatItem::WoodenShield(id),
        Some((ItemKind::Spellbook, id)) => OffHandCombatItem::Spellbook(id),
        Some(_) => {
            return Err(CombatLoadoutError::InvalidEquippedItem(
                EquipmentSlot::OffHand,
            ))
        }
    };
    let body = match body.map(|item| (item.kind, item.id)) {
        None => BodyCombatArmor::Unarmored,
        Some((ItemKind::LeatherArmor, id)) => BodyCombatArmor::LeatherArmor(id),
        Some((ItemKind::ChainmailArmor, id)) => BodyCombatArmor::ChainmailArmor(id),
        Some(_) => return Err(CombatLoadoutError::InvalidEquippedItem(EquipmentSlot::Body)),
    };

    Ok(CombatLoadout {
        main_hand,
        off_hand,
        body,
        helmet_id: head.map(|item| item.id),
        boots_id: feet.map(|item| item.id),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newly_registered_player_is_unarmed_and_unarmored() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        assert_eq!(
            resolve_server_owned_loadout(&loot, 1).unwrap(),
            CombatLoadout {
                main_hand: MainHandCombatItem::Unarmed,
                off_hand: OffHandCombatItem::Empty,
                body: BodyCombatArmor::Unarmored,
                helmet_id: None,
                boots_id: None,
            }
        );
        assert_eq!(
            resolve_server_owned_loadout(&loot, 2),
            Err(CombatLoadoutError::MissingInventory)
        );
    }

    #[test]
    fn equip_and_unequip_change_loadout_without_creating_any_combat_item() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let sword = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        let shield = loot.grant(1, ItemKind::WoodenShield, 1).unwrap();
        let armor = loot.grant(1, ItemKind::ChainmailArmor, 1).unwrap();
        let helm = loot.grant(1, ItemKind::IronHelmet, 1).unwrap();
        let boots = loot.grant(1, ItemKind::LeatherBoots, 1).unwrap();
        for (item, slot) in [
            (sword, EquipmentSlot::MainHand),
            (shield, EquipmentSlot::OffHand),
            (armor, EquipmentSlot::Body),
            (helm, EquipmentSlot::Head),
            (boots, EquipmentSlot::Feet),
        ] {
            loot.equip(1, item, slot).unwrap();
        }
        assert_eq!(
            resolve_server_owned_loadout(&loot, 1).unwrap(),
            CombatLoadout {
                main_hand: MainHandCombatItem::IronSword(sword),
                off_hand: OffHandCombatItem::WoodenShield(shield),
                body: BodyCombatArmor::ChainmailArmor(armor),
                helmet_id: Some(helm),
                boots_id: Some(boots),
            }
        );
        loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        let after = resolve_server_owned_loadout(&loot, 1).unwrap();
        assert_eq!(after.main_hand, MainHandCombatItem::Unarmed);
        assert_eq!(after.off_hand, OffHandCombatItem::WoodenShield(shield));
        assert_eq!(after.body, BodyCombatArmor::ChainmailArmor(armor));
    }

    #[test]
    fn forged_or_duplicate_equipped_items_fail_closed() {
        let mut inventory = Inventory::default();
        inventory.equipment.insert(
            EquipmentSlot::MainHand,
            ItemStack {
                id: 1,
                kind: ItemKind::Gold,
                amount: 1,
            },
        );
        assert_eq!(
            resolve_inventory_loadout(&inventory),
            Err(CombatLoadoutError::InvalidEquippedItem(
                EquipmentSlot::MainHand
            ))
        );
        inventory.equipment.insert(
            EquipmentSlot::MainHand,
            ItemStack {
                id: 1,
                kind: ItemKind::RustySword,
                amount: 1,
            },
        );
        inventory.equipment.insert(
            EquipmentSlot::OffHand,
            ItemStack {
                id: 1,
                kind: ItemKind::WoodenShield,
                amount: 1,
            },
        );
        assert_eq!(
            resolve_inventory_loadout(&inventory),
            Err(CombatLoadoutError::DuplicateEquippedItem(1))
        );
        inventory.equipment.remove(&EquipmentSlot::OffHand);
        inventory.equipment.insert(
            EquipmentSlot::MainHand,
            ItemStack {
                id: 0,
                kind: ItemKind::RustySword,
                amount: 1,
            },
        );
        assert_eq!(
            resolve_inventory_loadout(&inventory),
            Err(CombatLoadoutError::InvalidEquippedItem(
                EquipmentSlot::MainHand
            ))
        );
    }
}
