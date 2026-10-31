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
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::character_identity::CharacterId;
use crate::loot::{
    Corpse, CurrentRackSword, EquipmentSlot, GroundDrop, Inventory, ItemKind, ItemStack,
    LootAuthority, LootError, LootStateSnapshot, ParkedInventory, Point, ProposedRackSocket,
    BACKPACK_CAPACITY, EQUIPMENT_SLOT_COUNT, LOOT_STATE_SCHEMA_VERSION, MAX_OPERATION_WATERMARKS,
};
use crate::zone::ZoneId;

const MAGIC: &[u8; 8] = b"MYASOL03";
pub(crate) const MAX_FILE_BYTES: usize = 32 * 1024 * 1024;
const MAX_CHARACTERS: usize = 4096;
const MAX_WORLD_OBJECTS: usize = 100_000;
const MAX_ITEM_STACKS: usize = BACKPACK_CAPACITY + EQUIPMENT_SLOT_COUNT;
// MYASOL03 encodes all five typed equipment slots (0..=4). The original
// three-slot decoder cap rejected valid snapshots written by this encoder.
const MAX_EQUIPMENT_SLOTS: usize = EQUIPMENT_SLOT_COUNT;
static WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug)]
pub enum CheckpointError {
    Io(std::io::Error),
    InvalidState,
    Corrupt,
    TooLarge,
    /// A valid checkpoint contains ambiguous or invalid authored rack contents.
    RackProjection(LootError),
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
        ItemKind::IronSword => 8,
        ItemKind::WoodenClub => 9,
        ItemKind::ChainmailArmor => 10,
        ItemKind::IronHelmet => 11,
        ItemKind::LeatherBoots => 12,
        ItemKind::WoodenShield => 13,
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
        8 => Ok(ItemKind::IronSword),
        9 => Ok(ItemKind::WoodenClub),
        10 => Ok(ItemKind::ChainmailArmor),
        11 => Ok(ItemKind::IronHelmet),
        12 => Ok(ItemKind::LeatherBoots),
        13 => Ok(ItemKind::WoodenShield),
        _ => Err(CheckpointError::Corrupt),
    }
}

fn slot_code(slot: EquipmentSlot) -> u8 {
    match slot {
        EquipmentSlot::MainHand => 0,
        EquipmentSlot::OffHand => 1,
        EquipmentSlot::Body => 2,
        EquipmentSlot::Head => 3,
        EquipmentSlot::Feet => 4,
    }
}

fn decode_slot(value: u8) -> Result<EquipmentSlot, CheckpointError> {
    match value {
        0 => Ok(EquipmentSlot::MainHand),
        1 => Ok(EquipmentSlot::OffHand),
        2 => Ok(EquipmentSlot::Body),
        3 => Ok(EquipmentSlot::Head),
        4 => Ok(EquipmentSlot::Feet),
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
pub(crate) fn checksum(payload: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in payload {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub(crate) fn encode(snapshot: &LootStateSnapshot) -> Result<Vec<u8>, CheckpointError> {
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

pub(crate) fn decode(bytes: &[u8]) -> Result<LootStateSnapshot, CheckpointError> {
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
        if equipped > MAX_EQUIPMENT_SLOTS {
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
    atomic_write(path, &bytes)
}

/// Shared offline-only atomic replacement for a versioned world checkpoint.
/// A failure after rename may leave a new file while the in-memory mutation
/// was not published; callers must treat such a failure as indeterminate.
pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), CheckpointError> {
    let counter = WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let suffix = format!("pending-{}-{counter}", std::process::id());
    let temp = path.with_extension(suffix);
    let outcome = (|| -> Result<(), CheckpointError> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        file.write_all(bytes)?;
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

/// Offline Items-only checkpoint evidence, derived from ONE bounded, fully
/// decoded and validated MYASOL03 byte read. The source's four ground/item
/// pairs come from real persisted Items state and cannot be supplied as a
/// second, independently fabricated manifest.
///
/// The FNV-64 checksum is UNKEYED and collision-prone: it detects accidental
/// corruption, NOT tampering, authenticity, anti-rollback or write epoch.
/// Neither this structure nor its exact IDs can authorize network pickup.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuiescentRackCheckpointView {
    pub checkpoint_length: usize,
    pub unkeyed_legacy_checksum: u64,
    pub caller_observation_time_ms: u64,
    pub slots: [Option<CurrentRackSword>; 4],
}

/// Offline migration review input ONLY. Inspect the exact single file bytes,
/// fully validate MYASOL03 state and derive all four current rack bindings
/// from that same snapshot, failing closed on corrupt/ambiguous contents.
///
/// Caller must supply four trusted World-authored socket coordinates, the
/// zone, and a server-observed time. This cannot verify their origin; it
/// does not observe an authoritative world tick or prevent checkpoint replay.
/// Revalidate under the chosen SINGLE fenced Core item writer before commit.
/// Never expose this nonauthenticated view to a live browser or as an ACK.
pub fn read_quiescent_four_rack_checkpoint(
    path: &Path,
    zone: ZoneId,
    sockets: [ProposedRackSocket; 4],
    now_ms: u64,
) -> Result<QuiescentRackCheckpointView, CheckpointError> {
    // One actually bounded file read, then decode AND project from exactly
    // that buffer. A separate metadata check followed by fs::read would race
    // a growing file and could read beyond MAX_FILE_BYTES into memory.
    // Concurrent replacement may still present a valid historical snapshot:
    // this is NOT a signed epoch or active writer fence.
    let bytes = read_bounded_quiescent_bytes(path)?;
    let snapshot = decode(&bytes)?;
    let world = LootAuthority::restore_state(snapshot).map_err(|_| CheckpointError::Corrupt)?;
    let slots = world
        .proposed_current_rack_swords(zone, sockets, now_ms)
        .map_err(CheckpointError::RackProjection)?;
    let digest_at = bytes.len() - 8; // decode checked format and length
    let unkeyed_legacy_checksum =
        u64::from_le_bytes(bytes[digest_at..].try_into().expect("decoded suffix"));
    Ok(QuiescentRackCheckpointView {
        checkpoint_length: bytes.len(),
        unkeyed_legacy_checksum,
        caller_observation_time_ms: now_ms,
        slots,
    })
}

/// Read no more than the configured maximum PLUS ONE discriminating byte
/// from the opened file handle. Bounds allocations even if a file grows
/// between metadata inspection and reading; no TOCTOU size assumption.
fn read_bounded_quiescent_bytes(path: &Path) -> Result<Vec<u8>, CheckpointError> {
    let mut reader = fs::File::open(path)?.take(MAX_FILE_BYTES as u64 + 1);
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes)?;
    if bytes.len() > MAX_FILE_BYTES {
        return Err(CheckpointError::TooLarge);
    }
    Ok(bytes)
}

/// Load a fully validated checkpoint. A corrupt file fails closed rather
/// than returning partial inventories or minting replacement loot.
pub fn load_quiescent(path: &Path) -> Result<LootAuthority, CheckpointError> {
    let snapshot = decode(&read_bounded_quiescent_bytes(path)?)?;
    LootAuthority::restore_state(snapshot).map_err(|_| CheckpointError::Corrupt)
}

#[cfg(test)]
mod new_gear_codec_tests {
    use super::*;

    #[test]
    fn new_gear_codes_roundtrip_without_changing_existing_disk_ids() {
        assert_eq!(kind_code(ItemKind::RustySword), 0);
        assert_eq!(kind_code(ItemKind::LeatherArmor), 1);
        assert_eq!(slot_code(EquipmentSlot::MainHand), 0);
        assert_eq!(slot_code(EquipmentSlot::OffHand), 1);
        assert_eq!(slot_code(EquipmentSlot::Body), 2);
        for item in [
            ItemKind::IronSword,
            ItemKind::WoodenClub,
            ItemKind::ChainmailArmor,
            ItemKind::IronHelmet,
            ItemKind::LeatherBoots,
            ItemKind::WoodenShield,
        ] {
            assert_eq!(decode_kind(kind_code(item)).unwrap(), item);
        }
        for slot in [EquipmentSlot::Head, EquipmentSlot::Feet] {
            assert_eq!(decode_slot(slot_code(slot)).unwrap(), slot);
        }
        assert!(decode_kind(255).is_err());
        assert!(decode_slot(255).is_err());
    }
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
    fn quiescent_rack_checkpoint_source_is_exact_but_not_rollback_safe() {
        use crate::loot::{ItemKind, LootError, Point};
        let sockets = [3740.0_f32, 3780.0, 3820.0, 3860.0].map(|x| ProposedRackSocket {
            at: Point { x, y: 4038.0 },
        });
        let mut loot = LootAuthority::new();
        let mut world = World::new(8192.0, 8192.0);
        let mut identity = SessionIdentityRegistry::new();
        for (i, socket) in sockets.iter().enumerate() {
            let actor = (i + 1) as u32;
            assert!(world.add_player_at(actor, socket.at.x, socket.at.y, 0.0));
            let lease = SessionLease::new(actor, 1).unwrap();
            identity
                .bind_verified(lease, CharacterId::new(u64::from(actor)).unwrap())
                .unwrap();
            loot.register(actor).unwrap();
            let sword = loot
                .grant(
                    actor,
                    if i % 2 == 0 {
                        ItemKind::RustySword
                    } else {
                        ItemKind::IronSword
                    },
                    1,
                )
                .unwrap();
            loot.drop_backpack(
                actor,
                world.fighter(actor).unwrap(),
                ZoneId::Moonvale,
                sword,
                1,
            )
            .unwrap();
        }
        let initial = loot
            .proposed_current_rack_swords(ZoneId::Moonvale, sockets, 2)
            .unwrap();
        for actor in 1..=4 {
            loot.park_inventory(&identity, SessionLease::new(actor, 1).unwrap())
                .unwrap();
        }
        let path = checkpoint_path();
        save_quiescent(&path, &loot).unwrap();
        let first_bytes = fs::read(&path).unwrap();
        let first =
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 2).unwrap();
        assert_eq!(first.slots, initial);
        assert_eq!(first.checkpoint_length, first_bytes.len());
        assert_eq!(
            first.unkeyed_legacy_checksum,
            checksum(&first_bytes[..first_bytes.len() - 8])
        );
        assert!(read_quiescent_four_rack_checkpoint(
            &path,
            ZoneId::Moonvale,
            sockets,
            crate::loot::GROUND_DECAY_MS + 1,
        )
        .unwrap()
        .slots
        .iter()
        .all(Option::is_none));

        // A real player pickup and quiescent checkpoint removes one physical
        // source slot; no snapshot function remints or guesses an item ID.
        let mut restored = load_quiescent(&path).unwrap();
        let lease = SessionLease::new(1, 1).unwrap();
        restored.resume_inventory(&identity, lease).unwrap();
        assert_eq!(
            restored
                .take_ground(
                    1,
                    world.fighter(1).unwrap(),
                    ZoneId::Moonvale,
                    initial[0].unwrap().ground_entity_id,
                    3
                )
                .unwrap()
                .id,
            initial[0].unwrap().item_id
        );
        restored.park_inventory(&identity, lease).unwrap();
        save_quiescent(&path, &restored).unwrap();
        let next =
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 4).unwrap();
        assert_eq!(next.slots[0], None);
        assert_eq!(next.slots[1..], first.slots[1..]);
        assert_ne!(next.unkeyed_legacy_checksum, first.unkeyed_legacy_checksum);

        // A single-byte corrupt source fails before any rack binding is
        // returned. Valid bytes copied from an OLD snapshot still decode:
        // checksum verification is NOT an epoch fence or rollback defense.
        let next_bytes = fs::read(&path).unwrap();
        let mut corrupt = next_bytes.clone();
        corrupt[15] ^= 0x42;
        fs::write(&path, corrupt).unwrap();
        assert!(matches!(
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 4),
            Err(CheckpointError::Corrupt)
        ));
        fs::write(&path, &first_bytes).unwrap();
        let replay =
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 4).unwrap();
        assert_eq!(replay.slots, first.slots);
        assert_ne!(replay.slots, next.slots, "stale but valid bytes CAN replay");
        fs::write(&path, &next_bytes).unwrap();

        // A fully valid checkpoint with conflicting physical occupancy
        // refuses the ENTIRE candidate set instead of picking a first item.
        let mut snapshot = restored.export_state().unwrap();
        let duplicate = snapshot.ground[&initial[1].unwrap().ground_entity_id].clone();
        let another_id = snapshot.next_id;
        snapshot.next_id += 2;
        let mut another = duplicate;
        another.entity_id = another_id;
        another.item.id = another_id + 1;
        snapshot.ground.insert(another_id, another);
        let ambiguous = LootAuthority::restore_state(snapshot).unwrap();
        save_quiescent(&path, &ambiguous).unwrap();
        assert!(matches!(
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 4),
            Err(CheckpointError::RackProjection(LootError::InvalidState))
        ));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn bounded_checkpoint_reads_reject_sparse_oversize_without_trusting_metadata() {
        use crate::loot::{Point, ProposedRackSocket};

        // A sparse source file is cheap to create. Neither the offline
        // provenance view nor the regular quiescent recovery path may read
        // unbounded bytes if file size changes after an initial stat.
        let path = checkpoint_path();
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_FILE_BYTES as u64 + 1)
            .unwrap();
        let sockets = [3740.0_f32, 3780.0, 3820.0, 3860.0].map(|x| ProposedRackSocket {
            at: Point { x, y: 4038.0 },
        });
        assert!(matches!(
            read_quiescent_four_rack_checkpoint(&path, ZoneId::Moonvale, sockets, 1),
            Err(CheckpointError::TooLarge)
        ));
        assert!(matches!(
            load_quiescent(&path),
            Err(CheckpointError::TooLarge)
        ));
        fs::remove_file(path).unwrap();
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
    fn quiescent_checkpoint_roundtrips_legacy_and_all_five_equipment_slots() {
        use crate::character_identity::{SessionIdentityRegistry, SessionLease};

        let equipment = [
            (EquipmentSlot::MainHand, ItemKind::IronSword),
            (EquipmentSlot::OffHand, ItemKind::WoodenShield),
            (EquipmentSlot::Body, ItemKind::ChainmailArmor),
            (EquipmentSlot::Head, ItemKind::IronHelmet),
            (EquipmentSlot::Feet, ItemKind::LeatherBoots),
        ];
        // MYASOL03 has always written a count+0..4 slot tags. Verify old
        // zero-to-three records and the formerly unreadable 4/5-slot cases
        // with real grant/equip/park/checkpoint/recover identity conservation.
        for equipped_count in 0..=MAX_EQUIPMENT_SLOTS {
            let mut loot = LootAuthority::new();
            let mut identities = SessionIdentityRegistry::new();
            let owner = CharacterId::new(701).unwrap();
            let lease = SessionLease::new(7, 1).unwrap();
            identities.bind_verified(lease, owner).unwrap();
            loot.register(7).unwrap();
            let gold = loot.grant(7, ItemKind::Gold, 17).unwrap();
            let mut expected = BTreeMap::new();
            for (slot, kind) in equipment.iter().take(equipped_count).copied() {
                let id = loot.grant(7, kind, 1).unwrap();
                loot.equip(7, id, slot).unwrap();
                expected.insert(slot, (id, kind));
            }
            loot.park_inventory(&identities, lease).unwrap();
            let original = loot.export_state().unwrap();
            let bytes = encode(&original).unwrap();
            assert_eq!(decode(&bytes).unwrap(), original);
            let path = checkpoint_path();
            save_quiescent(&path, &loot).unwrap();
            let recovered = load_quiescent(&path).unwrap();
            fs::remove_file(&path).unwrap();
            assert_eq!(recovered.export_state().unwrap(), original);
            let inventory = recovered.parked_inventory(owner).unwrap();
            assert_eq!(inventory.backpack().len(), 1);
            assert_eq!(inventory.backpack()[0].id, gold);
            assert_eq!(inventory.backpack()[0].amount, 17);
            for (slot, (id, kind)) in &expected {
                let stack = inventory.equipped(*slot).expect("equipped slot recovered");
                assert_eq!(stack.id, *id);
                assert_eq!(stack.kind, *kind);
                assert_eq!(stack.amount, 1);
            }
            assert_eq!(inventory.stack_count(), equipped_count + 1);
        }
    }

    #[test]
    fn five_slot_checkpoint_rejects_extra_duplicate_and_invalid_equipment_tags() {
        use crate::character_identity::{SessionIdentityRegistry, SessionLease};

        let mut loot = LootAuthority::new();
        let mut identities = SessionIdentityRegistry::new();
        let owner = CharacterId::new(702).unwrap();
        let lease = SessionLease::new(8, 1).unwrap();
        identities.bind_verified(lease, owner).unwrap();
        loot.register(8).unwrap();
        loot.grant(8, ItemKind::Gold, 3).unwrap();
        for (slot, kind) in [
            (EquipmentSlot::MainHand, ItemKind::RustySword),
            (EquipmentSlot::OffHand, ItemKind::Spellbook),
            (EquipmentSlot::Body, ItemKind::LeatherArmor),
            (EquipmentSlot::Head, ItemKind::IronHelmet),
            (EquipmentSlot::Feet, ItemKind::LeatherBoots),
        ] {
            let id = loot.grant(8, kind, 1).unwrap();
            loot.equip(8, id, slot).unwrap();
        }
        loot.park_inventory(&identities, lease).unwrap();
        let bytes = encode(&loot.export_state().unwrap()).unwrap();
        assert!(decode(&bytes).is_ok());

        // Locate the encoded equipment count by parsing the versioned source,
        // not assuming a magic byte offset that breaks for old backpack data.
        let mut reader = Reader::new(&bytes[..bytes.len() - 8]);
        assert_eq!(reader.take(MAGIC.len()).unwrap(), MAGIC);
        assert_eq!(reader.u16().unwrap(), LOOT_STATE_SCHEMA_VERSION);
        reader.u64().unwrap();
        assert_eq!(reader.count(MAX_OPERATION_WATERMARKS).unwrap(), 0);
        assert_eq!(reader.count(MAX_CHARACTERS).unwrap(), 1);
        assert_eq!(reader.u64().unwrap(), owner.get());
        assert_eq!(reader.u8().unwrap(), 0);
        let backpack_count = usize::from(reader.u16().unwrap());
        for _ in 0..backpack_count {
            reader.item().unwrap();
        }
        let count_at = reader.pos;
        assert_eq!(bytes[count_at], 5);
        let first_slot_at = count_at + 1;
        let second_slot_at = first_slot_at + 12; // slot u8 + item u64,u8,u16
        assert_eq!(bytes[first_slot_at], slot_code(EquipmentSlot::MainHand));
        assert_eq!(bytes[second_slot_at], slot_code(EquipmentSlot::OffHand));

        for (offset, replacement) in [
            (count_at, 6_u8),                       // refuse unbounded sixth equipment record
            (first_slot_at, 255),                   // unknown slot
            (second_slot_at, bytes[first_slot_at]), // duplicate MainHand
        ] {
            let mut malformed = bytes.clone();
            malformed[offset] = replacement;
            // Recompute the unkeyed checksum so the decoder must reject
            // malformed semantic data instead of merely a checksum mismatch.
            let payload_end = malformed.len() - 8;
            let digest = checksum(&malformed[..payload_end]);
            malformed[payload_end..].copy_from_slice(&digest.to_le_bytes());
            assert!(matches!(decode(&malformed), Err(CheckpointError::Corrupt)));
            let path = checkpoint_path();
            fs::write(&path, malformed).unwrap();
            assert!(matches!(
                load_quiescent(&path),
                Err(CheckpointError::Corrupt)
            ));
            fs::remove_file(&path).unwrap();
        }
    }

    #[test]
    fn five_equipped_items_and_full_backpack_fit_corpse_checkpoint_capacity() {
        use crate::simulation::Action;

        let mut loot = LootAuthority::new();
        let mut identities = SessionIdentityRegistry::new();
        let lease = SessionLease::new(1, 1).unwrap();
        identities
            .bind_verified(lease, CharacterId::new(911).unwrap())
            .unwrap();
        loot.register(1).unwrap();
        for (slot, kind) in [
            (EquipmentSlot::MainHand, ItemKind::IronSword),
            (EquipmentSlot::OffHand, ItemKind::WoodenShield),
            (EquipmentSlot::Body, ItemKind::ChainmailArmor),
            (EquipmentSlot::Head, ItemKind::IronHelmet),
            (EquipmentSlot::Feet, ItemKind::LeatherBoots),
        ] {
            let id = loot.grant(1, kind, 1).unwrap();
            loot.equip(1, id, slot).unwrap();
        }
        for _ in 0..BACKPACK_CAPACITY {
            loot.grant(1, ItemKind::WoodenClub, 1).unwrap();
        }
        let original_item_ids: std::collections::BTreeSet<_> = loot
            .inventory(1)
            .unwrap()
            .backpack()
            .iter()
            .map(|item| item.id)
            .chain(
                [
                    EquipmentSlot::MainHand,
                    EquipmentSlot::OffHand,
                    EquipmentSlot::Body,
                    EquipmentSlot::Head,
                    EquipmentSlot::Feet,
                ]
                .into_iter()
                .map(|slot| loot.inventory(1).unwrap().equipped(slot).unwrap().id),
            )
            .collect();
        assert_eq!(
            original_item_ids.len(),
            BACKPACK_CAPACITY + EQUIPMENT_SLOT_COUNT
        );
        let mut dead = fighter(1);
        dead.action = Action::Dead;
        dead.hp = 0.0;
        let corpse_id = loot.death(1, &dead, ZoneId::Moonvale, 10).unwrap();
        loot.park_inventory(&identities, lease).unwrap();
        let snapshot = loot.export_state().unwrap();
        let corpse = &snapshot.corpses[&corpse_id];
        let mut remaining_ids: std::collections::BTreeSet<_> =
            corpse.items.iter().map(|item| item.id).collect();
        for drop in snapshot.ground.values() {
            assert!(remaining_ids.insert(drop.item.id));
        }
        assert_eq!(remaining_ids, original_item_ids);
        assert_eq!(decode(&encode(&snapshot).unwrap()).unwrap(), snapshot);

        // Exhaustive valid 69-stack corpse bound (3 existing scattered stacks
        // returned to the same corpse, retaining every exact physical ItemId).
        let mut packed = snapshot;
        let scattered: Vec<_> = packed
            .ground
            .values()
            .map(|drop| drop.item.clone())
            .collect();
        packed.ground.clear();
        packed
            .corpses
            .get_mut(&corpse_id)
            .unwrap()
            .items
            .extend(scattered);
        assert_eq!(packed.corpses[&corpse_id].items.len(), MAX_ITEM_STACKS);
        assert_eq!(decode(&encode(&packed).unwrap()).unwrap(), packed);
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

#[cfg(test)]
#[path = "loot_persistence_process_tests.rs"]
mod process_tests;
