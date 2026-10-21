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

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::{EquipmentSlot, Inventory, ItemKind, ItemStack, LootAuthority};
use crate::simulation::{Action, World};

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
    UnverifiedSession,
    MissingWorldFighter,
    DeadFighter,
    MissingInventory,
    InvalidEquippedItem(EquipmentSlot),
    DuplicateEquippedItem(u64),
}

/// Only for a server-resolved actor; callers MUST NOT accept a network-provided
/// actor ID or read this outside the authoritative Loot/World tick boundary.
pub(crate) fn resolve_server_owned_loadout(
    loot: &LootAuthority,
    server_actor_id: u32,
) -> Result<CombatLoadout, CombatLoadoutError> {
    let inventory = loot
        .inventory(server_actor_id)
        .ok_or(CombatLoadoutError::MissingInventory)?;
    resolve_inventory_loadout(inventory)
}

/// Trusted runtime-facing path: only an *exact active server-issued lease*
/// can read an actor's gear. A dead/missing World actor cannot supply combat
/// stats, even if Loot still contains a physical inventory.
///
/// Core must hold the World/Identity/Loot tick fence and guarantee that a
/// disconnect parks the old character's inventory before reusing a numeric
/// session ID. This check alone is NOT an ownership/connection transaction.
pub fn resolve_verified_session_loadout(
    identity: &SessionIdentityRegistry,
    lease: SessionLease,
    world: &World,
    loot: &LootAuthority,
) -> Result<CombatLoadout, CombatLoadoutError> {
    identity
        .resolve_session(lease)
        .ok_or(CombatLoadoutError::UnverifiedSession)?;
    let actor = lease.server_session();
    let fighter = world
        .fighter(actor)
        .ok_or(CombatLoadoutError::MissingWorldFighter)?;
    if fighter.action == Action::Dead
        || !fighter.hp.is_finite()
        || fighter.hp <= 0.0
        || loot.is_dead(actor)
    {
        return Err(CombatLoadoutError::DeadFighter);
    }
    resolve_server_owned_loadout(loot, actor)
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

    // Combat may never resolve a wielded sword from an inventory that also
    // contains the *same physical item ID* in the backpack. The Loot domain
    // should prevent this state, but fail closed if a corrupted/migrated
    // snapshot crosses the read-only Combat boundary.
    for item in inventory.backpack() {
        if seen_ids.contains(&item.id) {
            return Err(CombatLoadoutError::DuplicateEquippedItem(item.id));
        }
    }

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
    fn stale_session_missing_fighter_and_death_never_expose_equipped_gear() {
        use crate::character_identity::CharacterId;
        use crate::zone::ZoneId;

        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let sword = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        loot.equip(1, sword, EquipmentSlot::MainHand).unwrap();

        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(23).unwrap();
        let current = SessionLease::new(1, 1).unwrap();
        let stale = SessionLease::new(1, 2).unwrap();
        identity.bind_verified(current, character).unwrap();

        assert_eq!(
            resolve_verified_session_loadout(&identity, current, &world, &loot)
                .unwrap()
                .main_hand,
            MainHandCombatItem::IronSword(sword)
        );
        assert_eq!(
            resolve_verified_session_loadout(&identity, stale, &world, &loot),
            Err(CombatLoadoutError::UnverifiedSession)
        );

        assert!(world.remove_player(1));
        assert_eq!(
            resolve_verified_session_loadout(&identity, current, &world, &loot),
            Err(CombatLoadoutError::MissingWorldFighter)
        );
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));

        let mut dead_fighter = world.fighter(1).unwrap().clone();
        dead_fighter.action = Action::Dead;
        loot.death(1, &dead_fighter, ZoneId::Moonvale, 10).unwrap();
        assert_eq!(
            resolve_verified_session_loadout(&identity, current, &world, &loot),
            Err(CombatLoadoutError::DeadFighter)
        );

        assert_eq!(identity.release_session(current), Some(character));
        identity.bind_verified(stale, character).unwrap();
        assert_eq!(
            resolve_verified_session_loadout(&identity, current, &world, &loot),
            Err(CombatLoadoutError::UnverifiedSession)
        );
        assert_eq!(
            resolve_verified_session_loadout(&identity, stale, &world, &loot),
            Err(CombatLoadoutError::DeadFighter)
        );
    }

    #[test]
    fn full_loot_death_removes_weapon_from_victim_and_allows_only_looter_to_re_equip() {
        use crate::simulation::{Action, World};
        use crate::zone::ZoneId;

        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 205.0, 200.0, 0.0));
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();

        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, sword, EquipmentSlot::MainHand).unwrap();
        assert_eq!(
            resolve_server_owned_loadout(&loot, 1).unwrap().main_hand,
            MainHandCombatItem::RustySword(sword)
        );
        assert_eq!(
            resolve_server_owned_loadout(&loot, 2).unwrap().main_hand,
            MainHandCombatItem::Unarmed
        );

        // Only the server-authoritative death event is allowed to move gear.
        let mut dead_fighter = world.fighter(1).unwrap().clone();
        dead_fighter.action = Action::Dead;
        let corpse = loot.death(1, &dead_fighter, ZoneId::Moonvale, 100).unwrap();
        assert_eq!(
            resolve_server_owned_loadout(&loot, 1).unwrap().main_hand,
            MainHandCombatItem::Unarmed
        );
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 0);
        assert!(loot.corpses()[&corpse]
            .items
            .iter()
            .any(|item| item.id == sword));

        loot.take_corpse(
            2,
            world.fighter(2).unwrap(),
            ZoneId::Moonvale,
            corpse,
            sword,
            101,
        )
        .unwrap();
        // A sword in another character's backpack is NOT equipped.
        assert_eq!(
            resolve_server_owned_loadout(&loot, 2).unwrap().main_hand,
            MainHandCombatItem::Unarmed
        );
        loot.equip(2, sword, EquipmentSlot::MainHand).unwrap();
        assert_eq!(
            resolve_server_owned_loadout(&loot, 2).unwrap().main_hand,
            MainHandCombatItem::RustySword(sword)
        );
        assert_eq!(
            resolve_server_owned_loadout(&loot, 1).unwrap().main_hand,
            MainHandCombatItem::Unarmed
        );
        loot.export_state().unwrap();
    }

    #[test]
    fn equipped_sword_cannot_also_exist_in_backpack() {
        let mut inventory = Inventory::default();
        inventory.equipment.insert(
            EquipmentSlot::MainHand,
            ItemStack {
                id: 77,
                kind: ItemKind::IronSword,
                amount: 1,
            },
        );
        inventory.backpack.push(ItemStack {
            id: 77,
            kind: ItemKind::RustySword,
            amount: 1,
        });
        assert_eq!(
            resolve_inventory_loadout(&inventory),
            Err(CombatLoadoutError::DuplicateEquippedItem(77))
        );
        inventory.backpack.clear();
        assert_eq!(
            resolve_inventory_loadout(&inventory).unwrap().main_hand,
            MainHandCombatItem::IronSword(77)
        );
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
