//! Server-owned UO-style full-loot inventory domain, prepared for a future
//! authoritative world-entity protocol. NOT connected to live sessions yet.
//! Do not expose grants, item IDs or positions as client-controlled authority.
use std::collections::{BTreeMap, BTreeSet};

use crate::simulation::{Action, Fighter};
use crate::zone::ZoneId;

pub const BACKPACK_CAPACITY: usize = 64;
pub const PICKUP_REACH: f32 = 56.0;
pub const GROUND_DECAY_MS: u64 = 15 * 60 * 1000;
pub const CORPSE_DECAY_MS: u64 = 20 * 60 * 1000;
pub const MAX_SCATTERED_OBJECTS: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ItemKind {
    RustySword,
    LeatherArmor,
    Spellbook,
    FireRuneScroll,
    SulfurAsh,
    BlackPearl,
    Gold,
    HealingPotion,
}

impl ItemKind {
    pub const fn stackable(self) -> bool {
        matches!(
            self,
            Self::SulfurAsh | Self::BlackPearl | Self::Gold | Self::HealingPotion
        )
    }

    pub const fn fits(self, slot: EquipmentSlot) -> bool {
        matches!(
            (self, slot),
            (Self::RustySword, EquipmentSlot::MainHand)
                | (Self::LeatherArmor, EquipmentSlot::Body)
                | (Self::Spellbook, EquipmentSlot::OffHand)
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum EquipmentSlot {
    MainHand,
    OffHand,
    Body,
}

/// Server-resolved corpse and item selection; IDs are never authority alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CorpseItemRef {
    pub corpse_id: u64,
    pub item_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemStack {
    pub id: u64,
    pub kind: ItemKind,
    pub amount: u16,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Inventory {
    backpack: Vec<ItemStack>,
    equipment: BTreeMap<EquipmentSlot, ItemStack>,
}

impl Inventory {
    pub fn backpack(&self) -> &[ItemStack] {
        &self.backpack
    }

    pub fn equipped(&self, slot: EquipmentSlot) -> Option<&ItemStack> {
        self.equipment.get(&slot)
    }

    pub fn stack_count(&self) -> usize {
        self.backpack.len() + self.equipment.len()
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

impl Point {
    fn from_fighter(fighter: &Fighter) -> Self {
        Self {
            x: fighter.x,
            y: fighter.y,
        }
    }

    fn in_zone(self, zone: ZoneId) -> bool {
        let (width, height) = zone.bounds();
        self.x.is_finite()
            && self.y.is_finite()
            && self.x >= 18.0
            && self.y >= 18.0
            && self.x <= width - 18.0
            && self.y <= height - 18.0
    }

    fn near(self, other: Self) -> bool {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        dx * dx + dy * dy <= PICKUP_REACH * PICKUP_REACH
    }

    fn scattered(self, zone: ZoneId, index: usize) -> Self {
        const OFFSETS: [(f32, f32); 3] = [(26.0, 0.0), (-18.0, 20.0), (0.0, -26.0)];
        let (dx, dy) = OFFSETS[index];
        let (width, height) = zone.bounds();
        Self {
            x: (self.x + dx).clamp(18.0, width - 18.0),
            y: (self.y + dy).clamp(18.0, height - 18.0),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct GroundDrop {
    pub entity_id: u64,
    pub zone: ZoneId,
    pub at: Point,
    pub expires_at_ms: u64,
    pub item: ItemStack,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Corpse {
    pub entity_id: u64,
    pub victim: u32,
    pub zone: ZoneId,
    pub at: Point,
    pub expires_at_ms: u64,
    pub items: Vec<ItemStack>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LootError {
    InvalidPlayer,
    DuplicatePlayer,
    UnknownPlayer,
    DeadPlayer,
    AlreadyDead,
    NotDead,
    InvalidPosition,
    InvalidStack,
    InventoryFull,
    NotFound,
    OutOfReach,
    WrongZone,
    SlotOccupied,
    WrongSlot,
    IdExhausted,
}

#[derive(Debug)]
pub struct LootAuthority {
    next_id: u64,
    players: BTreeMap<u32, Inventory>,
    dead: BTreeSet<u32>,
    ground: BTreeMap<u64, GroundDrop>,
    corpses: BTreeMap<u64, Corpse>,
}

impl Default for LootAuthority {
    fn default() -> Self {
        Self {
            next_id: 1,
            players: BTreeMap::new(),
            dead: BTreeSet::new(),
            ground: BTreeMap::new(),
            corpses: BTreeMap::new(),
        }
    }
}

impl LootAuthority {
    pub fn new() -> Self {
        Self::default()
    }

    fn allocate_id(&mut self) -> Result<u64, LootError> {
        let id = self.next_id;
        self.next_id = id.checked_add(1).ok_or(LootError::IdExhausted)?;
        Ok(id)
    }

    pub fn register(&mut self, authenticated_id: u32) -> Result<(), LootError> {
        if authenticated_id == 0 {
            return Err(LootError::InvalidPlayer);
        }
        if self.players.contains_key(&authenticated_id) {
            return Err(LootError::DuplicatePlayer);
        }
        self.players.insert(authenticated_id, Inventory::default());
        Ok(())
    }

    pub fn inventory(&self, authenticated_id: u32) -> Option<&Inventory> {
        self.players.get(&authenticated_id)
    }

    pub fn ground(&self) -> &BTreeMap<u64, GroundDrop> {
        &self.ground
    }

    pub fn corpses(&self) -> &BTreeMap<u64, Corpse> {
        &self.corpses
    }

    fn require_alive(&self, id: u32, fighter: &Fighter) -> Result<(), LootError> {
        if fighter.net_id != id {
            return Err(LootError::InvalidPlayer);
        }
        if !self.players.contains_key(&id) {
            return Err(LootError::UnknownPlayer);
        }
        if self.dead.contains(&id) || fighter.action == Action::Dead {
            return Err(LootError::DeadPlayer);
        }
        Ok(())
    }

    /// Trusted server-only grant, never an incoming client action.
    pub fn grant(
        &mut self,
        authenticated_id: u32,
        kind: ItemKind,
        amount: u16,
    ) -> Result<u64, LootError> {
        if amount == 0 || (amount != 1 && !kind.stackable()) {
            return Err(LootError::InvalidStack);
        }
        if self.dead.contains(&authenticated_id) {
            return Err(LootError::DeadPlayer);
        }
        let inventory = self
            .players
            .get(&authenticated_id)
            .ok_or(LootError::UnknownPlayer)?;
        if inventory.backpack.len() >= BACKPACK_CAPACITY {
            return Err(LootError::InventoryFull);
        }
        let id = self.allocate_id()?;
        self.players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .push(ItemStack { id, kind, amount });
        Ok(id)
    }

    pub fn equip(
        &mut self,
        authenticated_id: u32,
        item_id: u64,
        slot: EquipmentSlot,
    ) -> Result<(), LootError> {
        if self.dead.contains(&authenticated_id) {
            return Err(LootError::DeadPlayer);
        }
        let inventory = self
            .players
            .get_mut(&authenticated_id)
            .ok_or(LootError::UnknownPlayer)?;
        if inventory.equipment.contains_key(&slot) {
            return Err(LootError::SlotOccupied);
        }
        let index = inventory
            .backpack
            .iter()
            .position(|item| item.id == item_id)
            .ok_or(LootError::NotFound)?;
        if !inventory.backpack[index].kind.fits(slot) {
            return Err(LootError::WrongSlot);
        }
        let item = inventory.backpack.remove(index);
        inventory.equipment.insert(slot, item);
        Ok(())
    }

    pub fn unequip(&mut self, authenticated_id: u32, slot: EquipmentSlot) -> Result<(), LootError> {
        if self.dead.contains(&authenticated_id) {
            return Err(LootError::DeadPlayer);
        }
        let inventory = self
            .players
            .get_mut(&authenticated_id)
            .ok_or(LootError::UnknownPlayer)?;
        if inventory.backpack.len() >= BACKPACK_CAPACITY {
            return Err(LootError::InventoryFull);
        }
        let item = inventory
            .equipment
            .remove(&slot)
            .ok_or(LootError::NotFound)?;
        inventory.backpack.push(item);
        Ok(())
    }

    /// Server-authoritative death event. No item is destroyed or kept by the victim:
    /// all equipment and backpack items move to the corpse or visible ground drops.
    /// Knowledge of previously learned runes is NOT a physical item here.
    pub fn death(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        now_ms: u64,
    ) -> Result<u64, LootError> {
        if fighter.net_id != authenticated_id {
            return Err(LootError::InvalidPlayer);
        }
        if fighter.action != Action::Dead {
            return Err(LootError::NotDead);
        }
        if !self.players.contains_key(&authenticated_id) {
            return Err(LootError::UnknownPlayer);
        }
        if self.dead.contains(&authenticated_id) {
            return Err(LootError::AlreadyDead);
        }
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }

        let inventory = self.players.get(&authenticated_id).expect("checked");
        let total = inventory.stack_count();
        let scatter_count = if total >= 12 {
            3
        } else if total >= 6 {
            2
        } else if total >= 2
            || inventory
                .backpack
                .first()
                .is_some_and(|stack| stack.kind.stackable() && stack.amount > 1)
        {
            1
        } else {
            0
        };
        // Reserve every ID before modifying inventory to make ID exhaustion atomic.
        let needed = 1_u64 + scatter_count as u64 * 2;
        self.next_id
            .checked_add(needed)
            .ok_or(LootError::IdExhausted)?;

        let corpse_id = self.allocate_id()?;
        let inventory = self.players.get_mut(&authenticated_id).expect("checked");
        let mut items = std::mem::take(&mut inventory.backpack);
        items.extend(std::mem::take(&mut inventory.equipment).into_values());
        for index in 0..scatter_count {
            // A physical stack is scattered whole, except bulk reagents/gold/potions:
            // scatter one unit and preserve the rest in the corpse.
            let candidate_index = items
                .iter()
                .rposition(|item| item.kind.stackable() && item.amount > 1)
                .unwrap_or(items.len() - 1);
            let mut stack = items.remove(candidate_index);
            let drop_item = if stack.kind.stackable() && stack.amount > 1 {
                stack.amount -= 1;
                let split_id = self.allocate_id().expect("IDs reserved");
                let fragment = ItemStack {
                    id: split_id,
                    kind: stack.kind,
                    amount: 1,
                };
                items.push(stack);
                fragment
            } else {
                stack
            };
            let drop_id = self.allocate_id().expect("IDs reserved");
            self.ground.insert(
                drop_id,
                GroundDrop {
                    entity_id: drop_id,
                    zone,
                    at: at.scattered(zone, index),
                    expires_at_ms: now_ms.saturating_add(GROUND_DECAY_MS),
                    item: drop_item,
                },
            );
        }
        self.corpses.insert(
            corpse_id,
            Corpse {
                entity_id: corpse_id,
                victim: authenticated_id,
                zone,
                at,
                expires_at_ms: now_ms.saturating_add(CORPSE_DECAY_MS),
                items,
            },
        );
        self.dead.insert(authenticated_id);
        Ok(corpse_id)
    }

    pub fn respawn(&mut self, authenticated_id: u32, fighter: &Fighter) -> Result<(), LootError> {
        if fighter.net_id != authenticated_id || !self.players.contains_key(&authenticated_id) {
            return Err(LootError::InvalidPlayer);
        }
        if fighter.action == Action::Dead {
            return Err(LootError::DeadPlayer);
        }
        self.dead.remove(&authenticated_id);
        Ok(())
    }

    /// Drop one item from the backpack into the physical world.
    /// Caller MUST source zone and fighter from server-owned state.
    pub fn drop_backpack(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        item_id: u64,
        now_ms: u64,
    ) -> Result<u64, LootError> {
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let inventory = self.players.get(&authenticated_id).expect("checked");
        let index = inventory
            .backpack
            .iter()
            .position(|item| item.id == item_id)
            .ok_or(LootError::NotFound)?;
        let entity_id = self.allocate_id()?;
        let item = self
            .players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .remove(index);
        self.ground.insert(
            entity_id,
            GroundDrop {
                entity_id,
                zone,
                at,
                expires_at_ms: now_ms.saturating_add(GROUND_DECAY_MS),
                item,
            },
        );
        Ok(entity_id)
    }

    /// Caller MUST source zone from ZoneAuthority and fighter from authoritative World.
    pub fn take_ground(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        drop_id: u64,
        now_ms: u64,
    ) -> Result<ItemStack, LootError> {
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let drop = self.ground.get(&drop_id).ok_or(LootError::NotFound)?;
        if drop.expires_at_ms <= now_ms {
            return Err(LootError::NotFound);
        }
        if drop.zone != zone {
            return Err(LootError::WrongZone);
        }
        if !at.near(drop.at) {
            return Err(LootError::OutOfReach);
        }
        if self
            .players
            .get(&authenticated_id)
            .expect("checked")
            .backpack
            .len()
            >= BACKPACK_CAPACITY
        {
            return Err(LootError::InventoryFull);
        }
        let drop = self.ground.remove(&drop_id).expect("checked");
        let item = drop.item;
        self.players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .push(item.clone());
        Ok(item)
    }

    pub fn take_corpse(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        corpse_id: u64,
        item_id: u64,
        now_ms: u64,
    ) -> Result<ItemStack, LootError> {
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let corpse = self.corpses.get(&corpse_id).ok_or(LootError::NotFound)?;
        if corpse.expires_at_ms <= now_ms {
            return Err(LootError::NotFound);
        }
        if corpse.zone != zone {
            return Err(LootError::WrongZone);
        }
        if !at.near(corpse.at) {
            return Err(LootError::OutOfReach);
        }
        let index = corpse
            .items
            .iter()
            .position(|item| item.id == item_id)
            .ok_or(LootError::NotFound)?;
        if self
            .players
            .get(&authenticated_id)
            .expect("checked")
            .backpack
            .len()
            >= BACKPACK_CAPACITY
        {
            return Err(LootError::InventoryFull);
        }
        let item = self
            .corpses
            .get_mut(&corpse_id)
            .expect("checked")
            .items
            .remove(index);
        self.players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .push(item.clone());
        Ok(item)
    }

    /// Split a stack while dropping it into the world. Full-stack drops retain
    /// their existing item identity; partial drops receive a fresh server ID.
    /// Both item and world entity identities are allocated before mutation.
    pub fn drop_backpack_amount(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        item_id: u64,
        amount: u16,
        now_ms: u64,
    ) -> Result<u64, LootError> {
        if amount == 0 {
            return Err(LootError::InvalidStack);
        }
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let inventory = self.players.get(&authenticated_id).expect("checked");
        let index = inventory
            .backpack
            .iter()
            .position(|item| item.id == item_id)
            .ok_or(LootError::NotFound)?;
        let source = &inventory.backpack[index];
        if amount > source.amount || (!source.kind.stackable() && amount != source.amount) {
            return Err(LootError::InvalidStack);
        }
        if amount == source.amount {
            return self.drop_backpack(authenticated_id, fighter, zone, item_id, now_ms);
        }
        self.next_id.checked_add(2).ok_or(LootError::IdExhausted)?;
        let fragment_id = self.allocate_id().expect("IDs reserved");
        let entity_id = self.allocate_id().expect("IDs reserved");
        let inventory = self.players.get_mut(&authenticated_id).expect("checked");
        let source = &mut inventory.backpack[index];
        source.amount -= amount;
        let fragment = ItemStack {
            id: fragment_id,
            kind: source.kind,
            amount,
        };
        self.ground.insert(
            entity_id,
            GroundDrop {
                entity_id,
                zone,
                at,
                expires_at_ms: now_ms.saturating_add(GROUND_DECAY_MS),
                item: fragment,
            },
        );
        Ok(entity_id)
    }

    /// Take all or part of a ground stack. The remainder keeps its world
    /// identity so observers cannot mistake a partial pickup for a new drop.
    pub fn take_ground_amount(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        drop_id: u64,
        amount: u16,
        now_ms: u64,
    ) -> Result<ItemStack, LootError> {
        if amount == 0 {
            return Err(LootError::InvalidStack);
        }
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let drop = self.ground.get(&drop_id).ok_or(LootError::NotFound)?;
        if drop.expires_at_ms <= now_ms {
            return Err(LootError::NotFound);
        }
        if drop.zone != zone {
            return Err(LootError::WrongZone);
        }
        if !at.near(drop.at) {
            return Err(LootError::OutOfReach);
        }
        if amount > drop.item.amount || (!drop.item.kind.stackable() && amount != drop.item.amount)
        {
            return Err(LootError::InvalidStack);
        }
        if self.players[&authenticated_id].backpack.len() >= BACKPACK_CAPACITY {
            return Err(LootError::InventoryFull);
        }
        if amount == drop.item.amount {
            return self.take_ground(authenticated_id, fighter, zone, drop_id, now_ms);
        }
        let fragment_id = self.allocate_id()?;
        let drop = self.ground.get_mut(&drop_id).expect("checked");
        drop.item.amount -= amount;
        let fragment = ItemStack {
            id: fragment_id,
            kind: drop.item.kind,
            amount,
        };
        self.players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .push(fragment.clone());
        Ok(fragment)
    }

    /// Take a partial reagent, potion or gold stack from a corpse while
    /// leaving the unclaimed remainder available to competing looters.
    pub fn take_corpse_amount(
        &mut self,
        authenticated_id: u32,
        fighter: &Fighter,
        zone: ZoneId,
        selection: CorpseItemRef,
        amount: u16,
        now_ms: u64,
    ) -> Result<ItemStack, LootError> {
        if amount == 0 {
            return Err(LootError::InvalidStack);
        }
        self.require_alive(authenticated_id, fighter)?;
        let at = Point::from_fighter(fighter);
        if !at.in_zone(zone) {
            return Err(LootError::InvalidPosition);
        }
        let corpse = self.corpses.get(&selection.corpse_id).ok_or(LootError::NotFound)?;
        if corpse.expires_at_ms <= now_ms {
            return Err(LootError::NotFound);
        }
        if corpse.zone != zone {
            return Err(LootError::WrongZone);
        }
        if !at.near(corpse.at) {
            return Err(LootError::OutOfReach);
        }
        let source = corpse
            .items
            .iter()
            .find(|item| item.id == selection.item_id)
            .ok_or(LootError::NotFound)?;
        if amount > source.amount || (!source.kind.stackable() && amount != source.amount) {
            return Err(LootError::InvalidStack);
        }
        if self.players[&authenticated_id].backpack.len() >= BACKPACK_CAPACITY {
            return Err(LootError::InventoryFull);
        }
        if amount == source.amount {
            return self.take_corpse(
                authenticated_id,
                fighter,
                zone,
                selection.corpse_id,
                selection.item_id,
                now_ms,
            );
        }
        let fragment_id = self.allocate_id()?;
        let corpse = self.corpses.get_mut(&selection.corpse_id).expect("checked");
        let source = corpse
            .items
            .iter_mut()
            .find(|item| item.id == selection.item_id)
            .expect("checked");
        source.amount -= amount;
        let fragment = ItemStack {
            id: fragment_id,
            kind: source.kind,
            amount,
        };
        self.players
            .get_mut(&authenticated_id)
            .expect("checked")
            .backpack
            .push(fragment.clone());
        Ok(fragment)
    }

    /// A server-side world tick may call this after all loot actions for the tick.
    /// Items decay only through this explicit policy, not when their owner dies.
    pub fn expire(&mut self, now_ms: u64) {
        self.ground.retain(|_, drop| drop.expires_at_ms > now_ms);
        self.corpses
            .retain(|_, corpse| corpse.expires_at_ms > now_ms);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::World;

    fn fighter(id: u32, x: f32, y: f32, dead: bool) -> Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(id, x, y, 0.0);
        let mut fighter = world.fighter(id).unwrap().clone();
        if dead {
            fighter.action = Action::Dead;
        }
        fighter
    }

    #[test]
    fn every_possession_moves_to_corpse_or_ground_and_all_is_lootable() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let weapon = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let armor = loot.grant(1, ItemKind::LeatherArmor, 1).unwrap();
        let reagent = loot.grant(1, ItemKind::SulfurAsh, 12).unwrap();
        loot.equip(1, weapon, EquipmentSlot::MainHand).unwrap();
        loot.equip(1, armor, EquipmentSlot::Body).unwrap();
        let corpse_id = loot
            .death(1, &fighter(1, 200.0, 200.0, true), ZoneId::Moonvale, 100)
            .unwrap();
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 0);
        assert_eq!(loot.ground().len(), 1);
        assert_eq!(loot.corpses()[&corpse_id].items.len(), 3);
        let scattered = loot.ground().values().next().unwrap();
        let drop_id = scattered.entity_id;
        assert_eq!(
            (scattered.item.kind, scattered.item.amount),
            (ItemKind::SulfurAsh, 1)
        );
        assert_eq!(
            loot.corpses()[&corpse_id]
                .items
                .iter()
                .find(|i| i.id == reagent)
                .unwrap()
                .amount,
            11
        );
        assert_eq!(
            loot.death(1, &fighter(1, 200.0, 200.0, true), ZoneId::Moonvale, 110),
            Err(LootError::AlreadyDead)
        );
        let thief = fighter(2, 200.0, 200.0, false);
        let stolen = loot
            .take_ground(2, &thief, ZoneId::Moonvale, drop_id, 200)
            .unwrap();
        assert_eq!(stolen.amount, 1);
        assert_eq!(
            loot.take_ground(2, &thief, ZoneId::Moonvale, drop_id, 201),
            Err(LootError::NotFound)
        );
        for item_id in [weapon, armor, reagent] {
            loot.take_corpse(2, &thief, ZoneId::Moonvale, corpse_id, item_id, 200)
                .unwrap();
        }
        assert_eq!(loot.inventory(2).unwrap().stack_count(), 4);
        assert!(loot.corpses()[&corpse_id].items.is_empty());
    }

    #[test]
    fn attempts_to_forge_death_or_steal_from_another_zone_or_far_away_fail() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        loot.grant(1, ItemKind::Gold, 20).unwrap();
        assert_eq!(
            loot.death(1, &fighter(1, 100.0, 100.0, false), ZoneId::Moonvale, 0),
            Err(LootError::NotDead)
        );
        assert_eq!(
            loot.death(1, &fighter(2, 100.0, 100.0, true), ZoneId::Moonvale, 0),
            Err(LootError::InvalidPlayer)
        );
        let corpse_id = loot
            .death(1, &fighter(1, 100.0, 100.0, true), ZoneId::Moonvale, 0)
            .unwrap();
        let item_id = loot.corpses()[&corpse_id].items[0].id;
        assert_eq!(
            loot.take_corpse(
                2,
                &fighter(2, 100.0, 100.0, false),
                ZoneId::RedLionInn,
                corpse_id,
                item_id,
                1
            ),
            Err(LootError::WrongZone)
        );
        assert_eq!(
            loot.take_corpse(
                2,
                &fighter(2, 400.0, 400.0, false),
                ZoneId::Moonvale,
                corpse_id,
                item_id,
                1
            ),
            Err(LootError::OutOfReach)
        );
        assert_eq!(
            loot.take_corpse(
                2,
                &fighter(1, 100.0, 100.0, false),
                ZoneId::Moonvale,
                corpse_id,
                item_id,
                1
            ),
            Err(LootError::InvalidPlayer)
        );
        assert_eq!(loot.inventory(2).unwrap().stack_count(), 0);
    }

    #[test]
    fn capacity_and_decay_reject_pickups_without_item_loss_or_duplication() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        for _ in 0..BACKPACK_CAPACITY {
            loot.grant(2, ItemKind::Gold, 1).unwrap();
        }
        let corpse_id = loot
            .death(1, &fighter(1, 100.0, 100.0, true), ZoneId::Moonvale, 0)
            .unwrap();
        assert_eq!(
            loot.take_corpse(
                2,
                &fighter(2, 100.0, 100.0, false),
                ZoneId::Moonvale,
                corpse_id,
                id,
                1
            ),
            Err(LootError::InventoryFull)
        );
        assert_eq!(loot.corpses()[&corpse_id].items.len(), 1);
        loot.expire(CORPSE_DECAY_MS);
        assert!(!loot.corpses().contains_key(&corpse_id));
        assert_eq!(
            loot.take_corpse(
                2,
                &fighter(2, 100.0, 100.0, false),
                ZoneId::Moonvale,
                corpse_id,
                id,
                CORPSE_DECAY_MS
            ),
            Err(LootError::NotFound)
        );
    }

    #[test]
    fn player_can_deliberately_drop_equipped_items_after_unequipping() {
        let mut loot = LootAuthority::default();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, sword, EquipmentSlot::MainHand).unwrap();
        assert_eq!(
            loot.drop_backpack(
                1,
                &fighter(1, 150.0, 150.0, false),
                ZoneId::Moonvale,
                sword,
                1
            ),
            Err(LootError::NotFound)
        );
        loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        let drop_id = loot
            .drop_backpack(
                1,
                &fighter(1, 150.0, 150.0, false),
                ZoneId::Moonvale,
                sword,
                10,
            )
            .unwrap();
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 0);
        assert_eq!(
            loot.take_ground(
                2,
                &fighter(2, 150.0, 150.0, false),
                ZoneId::Moonvale,
                drop_id,
                11
            )
            .unwrap()
            .id,
            sword
        );
        assert!(!loot.ground().contains_key(&drop_id));
        assert_eq!(loot.inventory(2).unwrap().backpack()[0].id, sword);
    }

    #[test]
    fn splitting_ground_stack_preserves_every_unit_across_competing_looters() {
        let mut loot = LootAuthority::new();
        for id in [1, 2, 3] {
            loot.register(id).unwrap();
        }
        let gold_id = loot.grant(1, ItemKind::Gold, 10).unwrap();
        let drop_id = loot
            .drop_backpack_amount(
                1,
                &fighter(1, 200.0, 200.0, false),
                ZoneId::Moonvale,
                gold_id,
                7,
                0,
            )
            .unwrap();
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 3);
        assert_eq!(loot.ground()[&drop_id].item.amount, 7);
        let first = loot
            .take_ground_amount(
                2,
                &fighter(2, 200.0, 200.0, false),
                ZoneId::Moonvale,
                drop_id,
                4,
                1,
            )
            .unwrap();
        assert_eq!(first.amount, 4);
        assert_ne!(first.id, gold_id);
        assert_eq!(loot.ground()[&drop_id].item.amount, 3);
        let second = loot
            .take_ground_amount(
                3,
                &fighter(3, 200.0, 200.0, false),
                ZoneId::Moonvale,
                drop_id,
                3,
                2,
            )
            .unwrap();
        assert_eq!(second.amount, 3);
        assert!(!loot.ground().contains_key(&drop_id));
        assert_eq!(3 + first.amount + second.amount, 10);
        assert_eq!(
            loot.take_ground_amount(
                2,
                &fighter(2, 200.0, 200.0, false),
                ZoneId::Moonvale,
                drop_id,
                1,
                3,
            ),
            Err(LootError::NotFound)
        );
    }

    #[test]
    fn corpse_partial_pickup_preserves_item_remainder_and_rejects_overdraw() {
        let mut loot = LootAuthority::new();
        for id in [1, 2, 3] {
            loot.register(id).unwrap();
        }
        let gold_id = loot.grant(1, ItemKind::Gold, 9).unwrap();
        let corpse_id = loot
            .death(1, &fighter(1, 200.0, 200.0, true), ZoneId::Moonvale, 0)
            .unwrap();
        assert_eq!(loot.corpses()[&corpse_id].items[0].amount, 8);
        let first = loot
            .take_corpse_amount(
                2,
                &fighter(2, 200.0, 200.0, false),
                ZoneId::Moonvale,
                CorpseItemRef {
                    corpse_id,
                    item_id: gold_id,
                },
                5,
                1,
            )
            .unwrap();
        assert_eq!(first.amount, 5);
        assert_eq!(loot.corpses()[&corpse_id].items[0].amount, 3);
        assert_eq!(
            loot.take_corpse_amount(
                3,
                &fighter(3, 200.0, 200.0, false),
                ZoneId::Moonvale,
                CorpseItemRef {
                    corpse_id,
                    item_id: gold_id,
                },
                4,
                2,
            ),
            Err(LootError::InvalidStack)
        );
        assert_eq!(loot.corpses()[&corpse_id].items[0].amount, 3);
        let remainder = loot
            .take_corpse_amount(
                3,
                &fighter(3, 200.0, 200.0, false),
                ZoneId::Moonvale,
                CorpseItemRef {
                    corpse_id,
                    item_id: gold_id,
                },
                3,
                3,
            )
            .unwrap();
        assert_eq!(first.amount + remainder.amount + 1, 9);
        assert!(loot.corpses()[&corpse_id].items.is_empty());
    }

    #[test]
    fn partial_pickup_denials_never_reduce_world_stack() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let drop_id = loot
            .drop_backpack(
                1,
                &fighter(1, 200.0, 200.0, false),
                ZoneId::Moonvale,
                sword,
                0,
            )
            .unwrap();
        let nearby = fighter(2, 200.0, 200.0, false);
        assert_eq!(
            loot.take_ground_amount(2, &nearby, ZoneId::Moonvale, drop_id, 0, 1),
            Err(LootError::InvalidStack)
        );
        assert_eq!(
            loot.take_ground_amount(2, &nearby, ZoneId::Moonvale, drop_id, 2, 1),
            Err(LootError::InvalidStack)
        );
        assert_eq!(
            loot.take_ground_amount(2, &nearby, ZoneId::RedLionInn, drop_id, 1, 1),
            Err(LootError::WrongZone)
        );
        assert_eq!(
            loot.take_ground_amount(
                2,
                &fighter(2, 450.0, 450.0, false),
                ZoneId::Moonvale,
                drop_id,
                1,
                1,
            ),
            Err(LootError::OutOfReach)
        );
        assert_eq!(loot.ground()[&drop_id].item.id, sword);
        assert_eq!(loot.ground()[&drop_id].item.amount, 1);
        assert!(loot.inventory(2).unwrap().backpack().is_empty());
    }

    #[test]
    fn unlearned_spellbook_is_physical_but_knowledge_is_outside_loot_inventory() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
        assert!(loot.grant(1, ItemKind::FireRuneScroll, 2).is_err());
        let corpse_id = loot
            .death(1, &fighter(1, 100.0, 100.0, true), ZoneId::Moonvale, 0)
            .unwrap();
        assert_eq!(loot.corpses()[&corpse_id].items[0].id, book);
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::OffHand)
            .is_none());
    }
}
