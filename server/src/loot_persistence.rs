//! Experimental checkpoint storage for a QUIESCENT loot world only.
//!
//! NOT activated in the live WebTransport server. This versioned, checksummed
//! file format refuses active ephemeral sessions and checks every item/entity
//! identity on read. The caller must halt game mutations and park all verified
//! inventories before saving. An atomic snapshot is NOT a per-action durable
//! transaction log and cannot guarantee latest gameplay actions survive power
//! loss until server-side write ordering and account authentication exist.
use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::character_identity::CharacterId;
use crate::loot::{
    Corpse, EquipmentSlot, GroundDrop, Inventory, ItemKind, ItemStack, LootAuthority,
    LootStateSnapshot, ParkedInventory, Point, LOOT_STATE_SCHEMA_VERSION,
    MAX_OPERATION_WATERMARKS,
};
use crate::zone::ZoneId;

const MAGIC: &[u8; 8] = b"MYASOL03";
const MAX_FILE_BYTES: usize = 32 * 1024 * 1024;
const MAX_CHARACTERS: usize = 4096;
const MAX_WORLD_OBJECTS: usize = 100_000;
const MAX_ITEM_STACKS: usize = 67;
static WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug)]
pub enum CheckpointError {
    Io(std::io::Error),
    InvalidState,
    Corrupt,
    TooLarge,
}

impl From<std::io::Error> for CheckpointError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Default)]
struct Writer(Vec<u8>);

impl Writer {
    fn u8(&mut self, value: u8) {
        self.0.push(value);
    }

    fn u16(&mut self, value: u16) {
        self.0.extend_from_slice(&value.to_le_bytes());
    }

    fn u32(&mut self, value: u32) {
        self.0.extend_from_slice(&value.to_le_bytes());
    }

    fn u64(&mut self, value: u64) {
        self.0.extend_from_slice(&value.to_le_bytes());
    }

    fn item(&mut self, item: &ItemStack) {
        self.u64(item.id);
        self.u8(kind_code(item.kind));
        self.u16(item.amount);
    }

    fn point(&mut self, point: Point) {
        self.u32(point.x.to_bits());
        self.u32(point.y.to_bits());
    }
}

struct Reader<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, pos: 0 }
    }

    fn take(&mut self, len: usize) -> Result<&'a [u8], CheckpointError> {
        let end = self.pos.checked_add(len).ok_or(CheckpointError::Corrupt)?;
        let slice = self
            .bytes
            .get(self.pos..end)
            .ok_or(CheckpointError::Corrupt)?;
        self.pos = end;
        Ok(slice)
    }

    fn u8(&mut self) -> Result<u8, CheckpointError> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16, CheckpointError> {
        let bytes: [u8; 2] = self.take(2)?.try_into().expect("exact slice");
        Ok(u16::from_le_bytes(bytes))
    }

    fn u32(&mut self) -> Result<u32, CheckpointError> {
        let bytes: [u8; 4] = self.take(4)?.try_into().expect("exact slice");
        Ok(u32::from_le_bytes(bytes))
    }

    fn u64(&mut self) -> Result<u64, CheckpointError> {
        let bytes: [u8; 8] = self.take(8)?.try_into().expect("exact slice");
        Ok(u64::from_le_bytes(bytes))
    }

    fn item(&mut self) -> Result<ItemStack, CheckpointError> {
        Ok(ItemStack {
            id: self.u64()?,
            kind: decode_kind(self.u8()?)?,
            amount: self.u16()?,
        })
    }

    fn point(&mut self) -> Result<Point, CheckpointError> {
        Ok(Point {
            x: f32::from_bits(self.u32()?),
            y: f32::from_bits(self.u32()?),
        })
    }

    fn count(&mut self, maximum: usize) -> Result<usize, CheckpointError> {
        let amount = self.u32()? as usize;
        if amount > maximum {
            return Err(CheckpointError::TooLarge);
        }
        Ok(amount)
    }

    fn done(&self) -> Result<(), CheckpointError> {
        if self.pos == self.bytes.len() {
            Ok(())
        } else {
            Err(CheckpointError::Corrupt)
        }
    }
}

fn kind_code(kind: ItemKind) -> u8 {
    match kind {
        ItemKind::RustySword => 0,
        ItemKind::LeatherArmor => 1,
        ItemKind::Spellbook => 2,
        ItemKind::FireRuneScroll => 3,
        ItemKind::SulfurAsh => 4,
        ItemKind::BlackPearl => 5,
        ItemKind::Gold => 6,
        ItemKind::HealingPotion => 7,
    }
}

fn decode_kind(value: u8) -> Result<ItemKind, CheckpointError> {
    match value {
        0 => Ok(ItemKind::RustySword),
        1 => Ok(ItemKind::LeatherArmor),
        2 => Ok(ItemKind::Spellbook),
        3 => Ok(ItemKind::FireRuneScroll),
        4 => Ok(ItemKind::SulfurAsh),
        5 => Ok(ItemKind::BlackPearl),
        6 => Ok(ItemKind::Gold),
        7 => Ok(ItemKind::HealingPotion),
        _ => Err(CheckpointError::Corrupt),
    }
}

fn slot_code(slot: EquipmentSlot) -> u8 {
    match slot {
        EquipmentSlot::MainHand => 0,
        EquipmentSlot::OffHand => 1,
        EquipmentSlot::Body => 2,
    }
}

fn decode_slot(value: u8) -> Result<EquipmentSlot, CheckpointError> {
    match value {
        0 => Ok(EquipmentSlot::MainHand),
        1 => Ok(EquipmentSlot::OffHand),
        2 => Ok(EquipmentSlot::Body),
        _ => Err(CheckpointError::Corrupt),
    }
}

fn zone_code(zone: ZoneId) -> u8 {
    match zone {
        ZoneId::Moonvale => 0,
        ZoneId::RedLionInn => 1,
    }
}

fn decode_zone(value: u8) -> Result<ZoneId, CheckpointError> {
    match value {
        0 => Ok(ZoneId::Moonvale),
        1 => Ok(ZoneId::RedLionInn),
        _ => Err(CheckpointError::Corrupt),
    }
}

/// Unkeyed corruption detection, NOT authentication or tamper resistance.
fn checksum(payload: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in payload {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn encode(snapshot: &LootStateSnapshot) -> Result<Vec<u8>, CheckpointError> {
    snapshot
        .validate()
        .map_err(|_| CheckpointError::InvalidState)?;
    if !snapshot.players.is_empty() || !snapshot.dead.is_empty() {
        return Err(CheckpointError::InvalidState);
    }
    let mut writer = Writer::default();
    writer.0.extend_from_slice(MAGIC);
    writer.u16(snapshot.schema_version);
    writer.u64(snapshot.next_id);
    writer.u32(snapshot.operation_highwater.len() as u32);
    for (character, sequence) in &snapshot.operation_highwater {
        writer.u64(character.get());
        writer.u64(*sequence);
    }
    writer.u32(
        snapshot
            .parked
            .len()
            .try_into()
            .map_err(|_| CheckpointError::TooLarge)?,
    );
    for (character, parked) in &snapshot.parked {
        writer.u64(character.get());
        writer.u8(u8::from(parked.dead));
        writer.u16(
            parked
                .inventory
                .backpack
                .len()
                .try_into()
                .map_err(|_| CheckpointError::TooLarge)?,
        );
        for item in &parked.inventory.backpack {
            writer.item(item);
        }
        writer.u8(parked
            .inventory
            .equipment
            .len()
            .try_into()
            .map_err(|_| CheckpointError::TooLarge)?);
        for (slot, item) in &parked.inventory.equipment {
            writer.u8(slot_code(*slot));
            writer.item(item);
        }
    }
    writer.u32(
        snapshot
            .ground
            .len()
            .try_into()
            .map_err(|_| CheckpointError::TooLarge)?,
    );
    for (id, drop) in &snapshot.ground {
        writer.u64(*id);
        writer.u8(zone_code(drop.zone));
        writer.point(drop.at);
        writer.u64(drop.expires_at_ms);
        writer.item(&drop.item);
    }
    writer.u32(
        snapshot
            .corpses
            .len()
            .try_into()
            .map_err(|_| CheckpointError::TooLarge)?,
    );
    for (id, corpse) in &snapshot.corpses {
        writer.u64(*id);
        writer.u32(corpse.victim);
        writer.u8(zone_code(corpse.zone));
        writer.point(corpse.at);
        writer.u64(corpse.expires_at_ms);
        writer.u16(
            corpse
                .items
                .len()
                .try_into()
                .map_err(|_| CheckpointError::TooLarge)?,
        );
        for item in &corpse.items {
            writer.item(item);
        }
    }
    let digest = checksum(&writer.0);
    writer.u64(digest);
    if writer.0.len() > MAX_FILE_BYTES {
        return Err(CheckpointError::TooLarge);
    }
    Ok(writer.0)
}

fn decode(bytes: &[u8]) -> Result<LootStateSnapshot, CheckpointError> {
    if bytes.len() > MAX_FILE_BYTES {
        return Err(CheckpointError::TooLarge);
    }
    if bytes.len() < MAGIC.len() + 2 + 8 + 4 + 4 + 8 {
        return Err(CheckpointError::Corrupt);
    }
    let content_size = bytes.len() - 8;
    let stored = u64::from_le_bytes(bytes[content_size..].try_into().expect("exact digest"));
    if checksum(&bytes[..content_size]) != stored {
        return Err(CheckpointError::Corrupt);
    }
    let mut reader = Reader::new(&bytes[..content_size]);
    if reader.take(MAGIC.len())? != MAGIC {
        return Err(CheckpointError::Corrupt);
    }
    let version = reader.u16()?;
    if version != LOOT_STATE_SCHEMA_VERSION {
        return Err(CheckpointError::Corrupt);
    }
    let next_id = reader.u64()?;
    let mut operation_highwater = BTreeMap::new();
    let operation_count = reader.count(MAX_OPERATION_WATERMARKS)?;
    for _ in 0..operation_count {
        let character = CharacterId::new(reader.u64()?).ok_or(CheckpointError::Corrupt)?;
        let sequence = reader.u64()?;
        if sequence == 0 || operation_highwater.insert(character, sequence).is_some() {
            return Err(CheckpointError::Corrupt);
        }
    }
    let mut parked = BTreeMap::new();
    let character_count = reader.count(MAX_CHARACTERS)?;
    for _ in 0..character_count {
        let character = CharacterId::new(reader.u64()?).ok_or(CheckpointError::Corrupt)?;
        let dead = match reader.u8()? {
            0 => false,
            1 => true,
            _ => return Err(CheckpointError::Corrupt),
        };
        let stacks = usize::from(reader.u16()?);
        if stacks > crate::loot::BACKPACK_CAPACITY {
            return Err(CheckpointError::TooLarge);
        }
        let mut backpack = Vec::with_capacity(stacks);
        for _ in 0..stacks {
            backpack.push(reader.item()?);
        }
        let equipped = usize::from(reader.u8()?);
        if equipped > 3 {
            return Err(CheckpointError::Corrupt);
        }
        let mut equipment = BTreeMap::new();
        for _ in 0..equipped {
            let slot = decode_slot(reader.u8()?)?;
            if equipment.insert(slot, reader.item()?).is_some() {
                return Err(CheckpointError::Corrupt);
            }
        }
        if parked
            .insert(
                character,
                ParkedInventory {
                    inventory: Inventory {
                        backpack,
                        equipment,
                    },
                    dead,
                },
            )
            .is_some()
        {
            return Err(CheckpointError::Corrupt);
        }
    }
    let mut ground = BTreeMap::new();
    let ground_count = reader.count(MAX_WORLD_OBJECTS)?;
    for _ in 0..ground_count {
        let entity_id = reader.u64()?;
        let zone = decode_zone(reader.u8()?)?;
        let at = reader.point()?;
        let expires_at_ms = reader.u64()?;
        let item = reader.item()?;
        if ground
            .insert(
                entity_id,
                GroundDrop {
                    entity_id,
                    zone,
                    at,
                    expires_at_ms,
                    item,
                },
            )
            .is_some()
        {
            return Err(CheckpointError::Corrupt);
        }
    }
    let mut corpses = BTreeMap::new();
    let corpse_count = reader.count(MAX_WORLD_OBJECTS)?;
    for _ in 0..corpse_count {
        let entity_id = reader.u64()?;
        let victim = reader.u32()?;
        let zone = decode_zone(reader.u8()?)?;
        let at = reader.point()?;
        let expires_at_ms = reader.u64()?;
        let item_count = usize::from(reader.u16()?);
        if item_count > MAX_ITEM_STACKS {
            return Err(CheckpointError::TooLarge);
        }
        let mut items = Vec::with_capacity(item_count);
        for _ in 0..item_count {
            items.push(reader.item()?);
        }
        if corpses
            .insert(
                entity_id,
                Corpse {
                    entity_id,
                    victim,
                    zone,
                    at,
                    expires_at_ms,
                    items,
                },
            )
            .is_some()
        {
            return Err(CheckpointError::Corrupt);
        }
    }
    reader.done()?;
    let snapshot = LootStateSnapshot {
        schema_version: version,
        next_id,
        players: BTreeMap::new(),
        dead: BTreeSet::new(),
        parked,
        operation_highwater,
        ground,
        corpses,
    };
    snapshot.validate().map_err(|_| CheckpointError::Corrupt)?;
    Ok(snapshot)
}

/// Write a replacement checkpoint using a same-directory exclusive staging
/// file, file fsync, atomic rename, and Unix parent directory fsync.
/// This is NOT a transaction around each gameplay event or account identity.
pub fn save_quiescent(path: &Path, loot: &LootAuthority) -> Result<(), CheckpointError> {
    let bytes = encode(
        &loot
            .export_state()
            .map_err(|_| CheckpointError::InvalidState)?,
    )?;
    let counter = WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let suffix = format!("pending-{}-{counter}", std::process::id());
    let temp = path.with_extension(suffix);
    let outcome = (|| -> Result<(), CheckpointError> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temp, path)?;
        #[cfg(unix)]
        {
            let parent = path.parent().unwrap_or_else(|| Path::new("."));
            std::fs::File::open(parent)?.sync_all()?;
        }
        Ok(())
    })();
    if outcome.is_err() {
        let _ = fs::remove_file(&temp);
    }
    outcome
}

/// Load a fully validated checkpoint. A corrupt file fails closed rather
/// than returning partial inventories or minting replacement loot.
pub fn load_quiescent(path: &Path) -> Result<LootAuthority, CheckpointError> {
    if fs::metadata(path)?.len() > MAX_FILE_BYTES as u64 {
        return Err(CheckpointError::TooLarge);
    }
    let snapshot = decode(&fs::read(path)?)?;
    LootAuthority::restore_state(snapshot).map_err(|_| CheckpointError::Corrupt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::{SessionIdentityRegistry, SessionLease};
    use crate::loot::EquipmentSlot;
    use crate::simulation::World;

    fn fighter(id: u32) -> crate::simulation::Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(id, 200.0, 200.0, 0.0);
        world.fighter(id).unwrap().clone()
    }

    fn checkpoint_path() -> std::path::PathBuf {
        let number = WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "myaso-checkpoint-{}-{number}.bin",
            std::process::id()
        ))
    }

    #[test]
    fn quiescent_roundtrip_restores_character_and_world_items_without_duplication() {
        let mut loot = LootAuthority::new();
        let mut identities = SessionIdentityRegistry::new();
        let a = CharacterId::new(700).unwrap();
        let b = CharacterId::new(800).unwrap();
        let la = SessionLease::new(1, 1).unwrap();
        let lb = SessionLease::new(2, 1).unwrap();
        identities.bind_verified(la, a).unwrap();
        identities.bind_verified(lb, b).unwrap();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let gold = loot.grant(1, ItemKind::Gold, 15).unwrap();
        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, sword, EquipmentSlot::MainHand).unwrap();
        let reagent = loot.grant(2, ItemKind::SulfurAsh, 8).unwrap();
        let dropped = loot
            .drop_backpack(2, &fighter(2), ZoneId::Moonvale, reagent, 10)
            .unwrap();
        loot.park_inventory(&identities, la).unwrap();
        loot.park_inventory(&identities, lb).unwrap();
        let path = checkpoint_path();
        save_quiescent(&path, &loot).unwrap();
        let restored = load_quiescent(&path).unwrap();
        let _ = fs::remove_file(&path);
        assert_eq!(restored.parked_inventory(a).unwrap().backpack()[0].id, gold);
        assert_eq!(
            restored
                .parked_inventory(a)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            sword
        );
        assert_eq!(restored.ground()[&dropped].item.id, reagent);
        assert_eq!(
            restored.export_state().unwrap(),
            loot.export_state().unwrap()
        );
    }

    #[test]
    fn saving_active_ephemeral_sessions_refuses_to_write() {
        let mut loot = LootAuthority::new();
        loot.register(9).unwrap();
        loot.grant(9, ItemKind::Gold, 100).unwrap();
        let path = checkpoint_path();
        assert!(matches!(
            save_quiescent(&path, &loot),
            Err(CheckpointError::InvalidState)
        ));
        assert!(!path.exists());
    }

    #[test]
    fn checksum_tampering_fails_closed_without_minting_items() {
        let mut loot = LootAuthority::new();
        let mut identities = SessionIdentityRegistry::new();
        let character = CharacterId::new(900).unwrap();
        let lease = SessionLease::new(9, 1).unwrap();
        identities.bind_verified(lease, character).unwrap();
        loot.register(9).unwrap();
        loot.grant(9, ItemKind::Gold, 7).unwrap();
        loot.park_inventory(&identities, lease).unwrap();
        let path = checkpoint_path();
        save_quiescent(&path, &loot).unwrap();
        let mut bytes = fs::read(&path).unwrap();
        bytes[15] ^= 0x42;
        fs::write(&path, bytes).unwrap();
        assert!(matches!(
            load_quiescent(&path),
            Err(CheckpointError::Corrupt)
        ));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn strict_format_rejects_truncated_data_and_wrong_versions() {
        let loot = LootAuthority::new();
        let bytes = encode(&loot.export_state().unwrap()).unwrap();
        assert!(matches!(
            decode(&bytes[..bytes.len() - 1]),
            Err(CheckpointError::Corrupt)
        ));
        let mut wrong_version = bytes;
        wrong_version[MAGIC.len()] ^= 0x10;
        let payload_len = wrong_version.len() - 8;
        let new_sum = checksum(&wrong_version[..payload_len]);
        wrong_version[payload_len..].copy_from_slice(&new_sum.to_le_bytes());
        assert!(matches!(
            decode(&wrong_version),
            Err(CheckpointError::Corrupt)
        ));
    }
}
