//! Copy-on-write transaction gate for the ISOLATED loot domain.
//!
//! This is NOT connected to WebTransport, combat, or production storage.
//! The caller must serialize all loot mutations and session lifecycle changes
//! under one authoritative world lock and independently authenticate accounts.
//! The callback may only modify the supplied staged LootAuthority.
//!
//! The disk format is a complete checkpoint, not a scalable WAL or a durable
//! idempotent command ledger. Combat simulation and networking remain separate.

use std::path::Path;

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::{
    CorpseItemRef, EquipmentSlot, ItemStack, LootAuthority, LootError, LootStateSnapshot,
    ParkedInventory, PICKUP_REACH,
};
#[cfg(test)]
use crate::loot_persistence::save_quiescent;
use crate::loot_persistence::{atomic_write, CheckpointError};
use crate::magic::MagicAuthority;
use crate::magic_checkpoint::{bundle, JointCheckpointError};
#[cfg(test)]
use crate::simulation::Action;
use crate::simulation::World;
use crate::zone::ZoneAuthority;

#[derive(Debug)]
pub enum TransactionError {
    Loot(LootError),
    Checkpoint(CheckpointError),
    UnverifiedOwnership,
    InvalidOperation,
}

impl From<LootError> for TransactionError {
    fn from(error: LootError) -> Self {
        Self::Loot(error)
    }
}

impl From<CheckpointError> for TransactionError {
    fn from(error: CheckpointError) -> Self {
        Self::Checkpoint(error)
    }
}

/// Prepare a RECOVERY copy using only verified character IDs, not ephemeral
/// fighter IDs. An incomplete binding map must never produce a saved world.
pub(crate) fn quiescent_verified(
    mut state: LootStateSnapshot,
    identity: &SessionIdentityRegistry,
) -> Result<LootAuthority, TransactionError> {
    state.validate()?;
    for (lease, character) in identity.verified_bindings() {
        let session = lease.server_session();
        let inventory = state
            .players
            .remove(&session)
            .ok_or(TransactionError::UnverifiedOwnership)?;
        if state.parked.contains_key(&character) {
            return Err(TransactionError::UnverifiedOwnership);
        }
        let dead = state.dead.remove(&session);
        state
            .parked
            .insert(character, ParkedInventory { inventory, dead });
    }
    if !state.players.is_empty() || !state.dead.is_empty() {
        return Err(TransactionError::UnverifiedOwnership);
    }
    state.validate()?;
    Ok(LootAuthority::restore_state(state)?)
}

/// OFFLINE TEST-ONLY mutation primitive. Unrestricted closures bypass the
/// single canonical u128 item ledger and checked Physics geometry. This
/// function MUST NOT be present in production or exposed as a network API.
/// Stage one mutation, validate the whole resulting loot world, save an
/// authenticated-character-keyed recovery copy, THEN publish the live copy.
///
/// This method does not lock anything. The caller MUST serialize it with all
/// world actions, session binding changes, combat deaths, and disconnects.
/// Action closures must have no effects outside the staged LootAuthority,
/// including messages, remote writes or player mutations in other services.
/// This is a stepping stone, not a safe live per-action protocol.
#[cfg(test)]
pub(crate) fn transact_verified<T, F>(
    path: &Path,
    loot: &mut LootAuthority,
    identity: &SessionIdentityRegistry,
    action: F,
) -> Result<T, TransactionError>
where
    F: FnOnce(&mut LootAuthority) -> Result<T, LootError>,
{
    let mut staged = LootAuthority::restore_state(loot.export_state()?)?;
    let result = action(&mut staged)?;
    let saveable = quiescent_verified(staged.export_state()?, identity)?;
    save_quiescent(path, &saveable)?;
    *loot = staged;
    Ok(result)
}

/// A server-owned connection lease plus per-character command sequence.
/// Never trust client-provided actor IDs or session leases.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VerifiedLootOperation {
    pub lease: SessionLease,
    pub sequence: u64,
}

/// OFFLINE TEST-ONLY mutation primitive. Arbitrary staged closures are NOT
/// a Core 8B writer, authoritative LOS proof or real ACK/receipt path.
/// Stage and checkpoint both the committed sequence and the loot mutation.
/// A lower or equal sequence is rejected, including after checkpoint recovery.
/// The caller must serialize actions and binding changes under one world lock.
#[cfg(test)]
pub(crate) fn transact_operation<T, F>(
    path: &Path,
    loot: &mut LootAuthority,
    identity: &SessionIdentityRegistry,
    operation: VerifiedLootOperation,
    action: F,
) -> Result<T, TransactionError>
where
    F: FnOnce(&mut LootAuthority) -> Result<T, LootError>,
{
    if operation.sequence == 0 {
        return Err(TransactionError::InvalidOperation);
    }
    let character = identity
        .resolve_session(operation.lease)
        .ok_or(TransactionError::UnverifiedOwnership)?;
    let mut staged = LootAuthority::restore_state(loot.export_state()?)?;
    staged.record_operation(character, operation.sequence)?;
    let result = action(&mut staged)?;
    let checkpoint = quiescent_verified(staged.export_state()?, identity)?;
    save_quiescent(path, &checkpoint)?;
    *loot = staged;
    Ok(result)
}

/// Narrow, non-networked selection of a physical item. A client may supply
/// an item/entity ID and amount, but never its actor identity, position, or zone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifiedPickupSelection {
    Ground {
        entity_id: u64,
        amount: u16,
    },
    Corpse {
        selection: CorpseItemRef,
        amount: u16,
    },
}

/// Authoritative, completed tick supplied while Core holds the single-writer
/// World/Zone/Identity/Loot/Magic lock. This is not a proof of lock ownership.
pub struct PickupWorldTick<'a> {
    pub world: &'a World,
    pub completed_tick: u32,
    pub zones: &'a ZoneAuthority,
}

#[derive(Debug)]
pub enum PickupCommitError {
    StaleWorldTick,
    InvalidWorldTime,
    UnverifiedSession,
    MissingWorldFighter,
    UnknownZone,
    GeometryRejected,
    Loot(LootError),
    JointCheckpoint(JointCheckpointError),
    Io(CheckpointError),
}

/// OFFLINE TEST-ONLY legacy pickup. A direct ground/corpse command bypasses
/// the P0 sword-specific exact-ID and Physics check and cannot be linked into
/// production; recovery tests retain this code under cfg(test).
/// Experimental server-internal, typed physical pickup: derive actor, Fighter,
/// position, zone and time from trusted authority, never from packet arguments.
/// One copy-on-write MYWLD003 checkpoint preserves *both* item ownership and
/// learned magic plus the actor's durable operation watermark. Failed
/// validation or pre-rename I/O does not publish mutated RAM.
///
/// This does NOT solve post-rename fsync ambiguity, writer fencing, combat HP,
/// persistent account admission or an authenticated wire protocol. Never
/// expose this method as a live handler until Core's durable transaction
/// contract and single-writer exclusion are proven.
#[cfg(test)]
pub(crate) fn commit_verified_pickup(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &MagicAuthority,
    identity: &SessionIdentityRegistry,
    tick: PickupWorldTick<'_>,
    operation: VerifiedLootOperation,
    selection: VerifiedPickupSelection,
) -> Result<ItemStack, PickupCommitError> {
    if tick.world.tick != tick.completed_tick {
        return Err(PickupCommitError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(PickupCommitError::InvalidWorldTime);
    }
    let character = identity
        .resolve_session(operation.lease)
        .ok_or(PickupCommitError::UnverifiedSession)?;
    let actor = operation.lease.server_session();
    let fighter = tick
        .world
        .fighter(actor)
        .ok_or(PickupCommitError::MissingWorldFighter)?;
    let zone = tick
        .zones
        .zone_of(actor)
        .ok_or(PickupCommitError::UnknownZone)?;

    let mut staged =
        LootAuthority::restore_state(loot.export_state().map_err(PickupCommitError::Loot)?)
            .map_err(PickupCommitError::Loot)?;
    staged
        .record_operation(character, operation.sequence)
        .map_err(PickupCommitError::Loot)?;
    let now_ms = tick.world.now_ms as u64;
    let item = match selection {
        VerifiedPickupSelection::Ground { entity_id, amount } => {
            staged.take_ground_amount(actor, fighter, zone, entity_id, amount, now_ms)
        }
        VerifiedPickupSelection::Corpse { selection, amount } => {
            staged.take_corpse_amount(actor, fighter, zone, selection, amount, now_ms)
        }
    }
    .map_err(PickupCommitError::Loot)?;
    let bytes = bundle(&staged, identity, magic).map_err(PickupCommitError::JointCheckpoint)?;
    atomic_write(path, &bytes).map_err(PickupCommitError::Io)?;
    *loot = staged;
    Ok(item)
}

/// OFFLINE TEST-ONLY LEGACY PATH — intentionally not compiled in production.
/// A live handler must never bypass the required authoritative Physics/Core
/// line-of-sight witness by using an always-OK geometry callback.
/// P0 armory domain primitive: physically take ONE nearby server-owned ground
/// sword and equip MainHand as ONE staged, checkpointed operation. A client may
/// select a visible ground entity but cannot choose actor, zone, origin, time,
/// equipment slot, item kind or owner. A failed take/equip/receipt/I/O never
/// publishes half-equipped state or consumes a command sequence in RAM.
///
/// This is NOT a live TryPickup handler. Core must prove rack entity identity,
/// authoritative server collision/LOS, canonical Core 8B item IDs, fencing,
/// atomic durable receipt/outbox and post-commit-ACK recovery BEFORE exposure.
/// Caller holds the common World/Zone/Identity/Loot/Magic writer lock.
#[cfg(test)]
pub(crate) fn commit_verified_ground_sword_equip(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &MagicAuthority,
    identity: &SessionIdentityRegistry,
    tick: PickupWorldTick<'_>,
    operation: VerifiedLootOperation,
    ground_entity_id: u64,
) -> Result<ItemStack, PickupCommitError> {
    commit_ground_sword_equip_inner(
        GroundSwordAuthority {
            path,
            loot,
            magic,
            identity,
            tick,
            operation,
        },
        ground_entity_id,
        None,
        |_, _, _| Ok(()),
    )
}

/// Server-owned transaction context supplied only under the authoritative
/// World/Zone/Identity/Loot/Magic writer lock, not decoded from wire data.
pub struct GroundSwordAuthority<'a> {
    pub path: &'a Path,
    pub loot: &'a mut LootAuthority,
    pub magic: &'a MagicAuthority,
    pub identity: &'a SessionIdentityRegistry,
    pub tick: PickupWorldTick<'a>,
    pub operation: VerifiedLootOperation,
}

/// Both IDs are untrusted UI selections, never actor or authoritative position.
/// The u64 values are prototype-only until Core 8B canonical IDs are adopted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GroundSwordSelection {
    pub ground_entity_id: u64,
    pub expected_item_id: u64,
}

/// Read-only P0 rack click target for the already-authenticated viewer.
/// This is an ephemeral *domain* snapshot, not a network packet or a promise
/// that the item will remain available before Core's fenced TryPickup commit.
/// Exact prototype u64 IDs must be replaced by Core 8B canonical u128 IDs
/// (never truncated), and Core 8A owns any opaque public wire encoding.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VerifiedGroundSwordTarget {
    pub selection: GroundSwordSelection,
    pub at: crate::loot::Point,
    pub kind: crate::loot::ItemKind,
    pub completed_tick: u32,
}

/// Get EXACT entity+physical item pairs required by the checked pickup API,
/// never a forged visual ID or client-supplied position. This is an
/// *interaction candidate* query, NOT the wider world-render visibility list:
/// only swords at or within the authoritative 56-unit pickup reach appear.
/// Distant but visually rendered swords remain in LootAuthority::visible_loot
/// and MUST NOT be presented by the UI as selectable pickup targets.
/// Non-swords, backpack/equipment and corpse contents are excluded. The query
/// also inherits existing liveness, zone and expiry rules.
///
/// Core must hold a common authoritative snapshot/read lock while obtaining
/// this list, and must revalidate under its exclusive item+geometry writer
/// after any browser intent. No Core epoch, LOS witness, journal, network
/// receipt, or actor authorization can be inferred from this result alone.
pub fn inspect_verified_ground_sword_targets(
    loot: &LootAuthority,
    identity: &SessionIdentityRegistry,
    tick: PickupWorldTick<'_>,
    lease: SessionLease,
) -> Result<Vec<VerifiedGroundSwordTarget>, PickupCommitError> {
    if tick.world.tick != tick.completed_tick {
        return Err(PickupCommitError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(PickupCommitError::InvalidWorldTime);
    }
    identity
        .resolve_session(lease)
        .ok_or(PickupCommitError::UnverifiedSession)?;
    let actor = lease.server_session();
    let fighter = tick
        .world
        .fighter(actor)
        .ok_or(PickupCommitError::MissingWorldFighter)?;
    let zone = tick
        .zones
        .zone_of(actor)
        .ok_or(PickupCommitError::UnknownZone)?;
    let visible = loot
        .visible_loot(actor, fighter, zone, tick.world.now_ms as u64)
        .map_err(PickupCommitError::Loot)?;
    let mut swords = Vec::new();
    for preview in visible {
        if let crate::loot::LootAppearance::Ground { kind, amount: 1 } = preview.appearance {
            if !matches!(
                kind,
                crate::loot::ItemKind::RustySword | crate::loot::ItemKind::IronSword
            ) {
                continue;
            }
            // Resolve exact physical ID only from the SAME trusted loot
            // instance used for the public appearance, not browser inputs.
            let Some(drop) = loot.ground().get(&preview.entity_id) else {
                return Err(PickupCommitError::Loot(LootError::InvalidState));
            };
            if drop.item.id == 0
                || drop.item.kind != kind
                || drop.item.amount != 1
                || drop.at != preview.at
                || drop.zone != zone
            {
                return Err(PickupCommitError::Loot(LootError::InvalidState));
            }
            // LootAuthority::visible_loot is a 550-unit rendering envelope,
            // whereas a true pickup has a distinct 56-unit physical reach.
            // Mirror the SAME inclusive squared-distance predicate as
            // LootAuthority::take_ground_amount, using only server fighter
            // position and the authoritative physical ground item.
            let dx = drop.at.x - fighter.x;
            let dy = drop.at.y - fighter.y;
            if dx * dx + dy * dy > PICKUP_REACH * PICKUP_REACH {
                continue;
            }
            swords.push(VerifiedGroundSwordTarget {
                selection: GroundSwordSelection {
                    ground_entity_id: drop.entity_id,
                    expected_item_id: drop.item.id,
                },
                at: drop.at,
                kind,
                completed_tick: tick.completed_tick,
            });
        }
    }
    Ok(swords)
}

/// Offline P0 integration seam. Core must supply a trusted same-tick Physics
/// check with complete zone solids and current worker/geometry epoch under the
/// one World/Identity/Loot writer lock. The callback receives ONLY authoritative
/// fighter, pre-pickup ground item and zone, never client coordinates.
/// This does not itself provide an unforgeable geometry proof, canonical u128
/// ledger, idempotent network ACK/outbox or a live /game endpoint.
pub fn commit_verified_ground_sword_equip_checked(
    authority: GroundSwordAuthority<'_>,
    selection: GroundSwordSelection,
    geometry: impl FnOnce(
        &crate::simulation::Fighter,
        &crate::loot::GroundDrop,
        crate::zone::ZoneId,
    ) -> Result<(), PickupCommitError>,
) -> Result<ItemStack, PickupCommitError> {
    commit_ground_sword_equip_inner(
        authority,
        selection.ground_entity_id,
        Some(selection.expected_item_id),
        geometry,
    )
}

fn commit_ground_sword_equip_inner(
    authority: GroundSwordAuthority<'_>,
    ground_entity_id: u64,
    expected_item_id: Option<u64>,
    geometry: impl FnOnce(
        &crate::simulation::Fighter,
        &crate::loot::GroundDrop,
        crate::zone::ZoneId,
    ) -> Result<(), PickupCommitError>,
) -> Result<ItemStack, PickupCommitError> {
    let GroundSwordAuthority {
        path,
        loot,
        magic,
        identity,
        tick,
        operation,
    } = authority;
    if tick.world.tick != tick.completed_tick {
        return Err(PickupCommitError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(PickupCommitError::InvalidWorldTime);
    }
    let character = identity
        .resolve_session(operation.lease)
        .ok_or(PickupCommitError::UnverifiedSession)?;
    let actor = operation.lease.server_session();
    let fighter = tick
        .world
        .fighter(actor)
        .ok_or(PickupCommitError::MissingWorldFighter)?;
    let zone = tick
        .zones
        .zone_of(actor)
        .ok_or(PickupCommitError::UnknownZone)?;
    let mut staged =
        LootAuthority::restore_state(loot.export_state().map_err(PickupCommitError::Loot)?)
            .map_err(PickupCommitError::Loot)?;
    staged
        .record_operation(character, operation.sequence)
        .map_err(PickupCommitError::Loot)?;
    let ground = staged
        .ground()
        .get(&ground_entity_id)
        .cloned()
        .ok_or(PickupCommitError::Loot(LootError::NotFound))?;
    if expected_item_id.is_some_and(|id| id == 0 || id != ground.item.id) {
        return Err(PickupCommitError::Loot(LootError::NotFound));
    }
    let item = staged
        .take_ground_amount(
            actor,
            fighter,
            zone,
            ground_entity_id,
            1,
            tick.world.now_ms as u64,
        )
        .map_err(PickupCommitError::Loot)?;
    if !matches!(
        item.kind,
        crate::loot::ItemKind::RustySword | crate::loot::ItemKind::IronSword
    ) {
        return Err(PickupCommitError::Loot(LootError::WrongSlot));
    }
    geometry(fighter, &ground, zone)?;
    staged
        .equip(actor, item.id, EquipmentSlot::MainHand)
        .map_err(PickupCommitError::Loot)?;
    let bytes = bundle(&staged, identity, magic).map_err(PickupCommitError::JointCheckpoint)?;
    atomic_write(path, &bytes).map_err(PickupCommitError::Io)?;
    *loot = staged;
    Ok(item)
}

/// Experimental Items-only inverse of checked ground-sword equip:
/// MainHand -> one world GroundDrop as a SINGLE staged and checkpointed action.
/// The item keeps its physical identity; only the ground entity ID is new.
/// A server-held, exclusive World/Identity/Loot/Physics lock and trusted
/// geometry callback are REQUIRED. No client drop coordinates are accepted.
///
/// This is NOT live Core 8B canonical storage, a distributed writer, a QUIC
/// opcode, a post-rename durable ACK/outbox, or permission to deploy a drop
/// handler. All live integrations MUST use the approved canonical writer.
pub fn commit_verified_equipped_sword_drop_checked(
    authority: GroundSwordAuthority<'_>,
    // Client-originating selection is untrusted. A delayed intent must not
    // drop a replacement sword that now occupies the same MainHand.
    expected_item_id: u64,
    geometry: impl FnOnce(
        &crate::simulation::Fighter,
        &crate::loot::GroundDrop,
        crate::zone::ZoneId,
    ) -> Result<(), PickupCommitError>,
) -> Result<GroundSwordSelection, PickupCommitError> {
    let GroundSwordAuthority {
        path,
        loot,
        magic,
        identity,
        tick,
        operation,
    } = authority;
    if tick.world.tick != tick.completed_tick {
        return Err(PickupCommitError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(PickupCommitError::InvalidWorldTime);
    }
    let character = identity
        .resolve_session(operation.lease)
        .ok_or(PickupCommitError::UnverifiedSession)?;
    let actor = operation.lease.server_session();
    let fighter = tick
        .world
        .fighter(actor)
        .ok_or(PickupCommitError::MissingWorldFighter)?;
    let zone = tick
        .zones
        .zone_of(actor)
        .ok_or(PickupCommitError::UnknownZone)?;

    let mut staged =
        LootAuthority::restore_state(loot.export_state().map_err(PickupCommitError::Loot)?)
            .map_err(PickupCommitError::Loot)?;
    staged
        .record_operation(character, operation.sequence)
        .map_err(PickupCommitError::Loot)?;
    let sword = staged
        .inventory(actor)
        .ok_or(PickupCommitError::Loot(LootError::UnknownPlayer))?
        .equipped(EquipmentSlot::MainHand)
        .ok_or(PickupCommitError::Loot(LootError::NotFound))?
        .clone();
    if sword.id == 0
        || sword.amount != 1
        || !matches!(
            sword.kind,
            crate::loot::ItemKind::RustySword | crate::loot::ItemKind::IronSword
        )
    {
        return Err(PickupCommitError::Loot(LootError::WrongSlot));
    }

    if expected_item_id == 0 || expected_item_id != sword.id {
        // Stale or substituted MainHand selection. The staged operation
        // watermark is discarded with the rejected transaction.
        return Err(PickupCommitError::Loot(LootError::NotFound));
    }

    // Direct MainHand -> ground preserves physical ID without requiring a
    // free backpack slot. No intermediate inventory state can be published;
    // later geometry/checkpoint failure discards the entire staged snapshot.
    let ground_entity_id = staged
        .drop_mainhand_sword(actor, fighter, zone, tick.world.now_ms as u64)
        .map_err(PickupCommitError::Loot)?;
    let drop = staged
        .ground()
        .get(&ground_entity_id)
        .ok_or(PickupCommitError::Loot(LootError::InvalidState))?;
    if drop.item.id != sword.id || drop.item.amount != 1 || drop.zone != zone {
        return Err(PickupCommitError::Loot(LootError::InvalidState));
    }
    // Core/Physics sees the ACTUAL staged world entity, position and item ID,
    // not an independently reconstructed client destination or obsolete
    // slot projection. No ownership mutation is published before approval.
    geometry(fighter, drop, zone)?;

    let bytes = bundle(&staged, identity, magic).map_err(PickupCommitError::JointCheckpoint)?;
    atomic_write(path, &bytes).map_err(PickupCommitError::Io)?;
    *loot = staged;
    Ok(GroundSwordSelection {
        ground_entity_id,
        expected_item_id: sword.id,
    })
}

/// A gear request contains only an item/slot selection; the actor identity,
/// position, authoritative tick and zone never come from a packet.
/// Dropping equipped gear requires explicit unequip first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifiedEquipmentAction {
    Equip { item_id: u64, slot: EquipmentSlot },
    Unequip { slot: EquipmentSlot },
    Drop { item_id: u64, amount: u16 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EquipmentActionResult {
    Equipped { item_id: u64, slot: EquipmentSlot },
    Unequipped { item_id: u64, slot: EquipmentSlot },
    Dropped { entity_id: u64 },
}

/// OFFLINE TEST-ONLY legacy gear transaction. This cannot be paired with
/// generic ground pickup to bypass the canonical P0 sword+geometry receipt.
/// Offline server-side gear transaction. Core must hold one exclusive
/// World/Zone/Identity/Loot/Magic tick lock. Stages item changes and a replay
/// watermark, then checkpoints all Loot and Magic before publishing RAM.
///
/// This is not a live network handler, combat damage/mitigation adapter, real
/// account authenticator, or post-rename I/O recovery mechanism.
#[cfg(test)]
pub(crate) fn commit_verified_equipment(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &MagicAuthority,
    identity: &SessionIdentityRegistry,
    tick: PickupWorldTick<'_>,
    operation: VerifiedLootOperation,
    action: VerifiedEquipmentAction,
) -> Result<EquipmentActionResult, PickupCommitError> {
    if tick.world.tick != tick.completed_tick {
        return Err(PickupCommitError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(PickupCommitError::InvalidWorldTime);
    }
    let character = identity
        .resolve_session(operation.lease)
        .ok_or(PickupCommitError::UnverifiedSession)?;
    let actor = operation.lease.server_session();
    let fighter = tick
        .world
        .fighter(actor)
        .ok_or(PickupCommitError::MissingWorldFighter)?;
    let zone = tick
        .zones
        .zone_of(actor)
        .ok_or(PickupCommitError::UnknownZone)?;
    let (width, height) = zone.bounds();
    if !fighter.x.is_finite()
        || !fighter.y.is_finite()
        || fighter.x < 18.0
        || fighter.y < 18.0
        || fighter.x > width - 18.0
        || fighter.y > height - 18.0
    {
        return Err(PickupCommitError::Loot(LootError::InvalidPosition));
    }
    if fighter.action == Action::Dead
        || !fighter.hp.is_finite()
        || fighter.hp <= 0.0
        || loot.is_dead(actor)
    {
        return Err(PickupCommitError::Loot(LootError::DeadPlayer));
    }
    let mut staged =
        LootAuthority::restore_state(loot.export_state().map_err(PickupCommitError::Loot)?)
            .map_err(PickupCommitError::Loot)?;
    staged
        .record_operation(character, operation.sequence)
        .map_err(PickupCommitError::Loot)?;
    let result = match action {
        VerifiedEquipmentAction::Equip { item_id, slot } => {
            staged
                .equip(actor, item_id, slot)
                .map_err(PickupCommitError::Loot)?;
            EquipmentActionResult::Equipped { item_id, slot }
        }
        VerifiedEquipmentAction::Unequip { slot } => {
            let item_id = staged
                .inventory(actor)
                .ok_or(PickupCommitError::Loot(LootError::UnknownPlayer))?
                .equipped(slot)
                .ok_or(PickupCommitError::Loot(LootError::NotFound))?
                .id;
            staged
                .unequip(actor, slot)
                .map_err(PickupCommitError::Loot)?;
            EquipmentActionResult::Unequipped { item_id, slot }
        }
        VerifiedEquipmentAction::Drop { item_id, amount } => {
            let entity_id = staged
                .drop_backpack_amount(
                    actor,
                    fighter,
                    zone,
                    item_id,
                    amount,
                    tick.world.now_ms as u64,
                )
                .map_err(PickupCommitError::Loot)?;
            EquipmentActionResult::Dropped { entity_id }
        }
    };
    let bytes = bundle(&staged, identity, magic).map_err(PickupCommitError::JointCheckpoint)?;
    atomic_write(path, &bytes).map_err(PickupCommitError::Io)?;
    *loot = staged;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::{CharacterId, SessionLease};
    use crate::loot::{ItemKind, ItemStack};
    use crate::loot_persistence::load_quiescent;
    use crate::magic::MagicAuthority;
    use crate::simulation::World;
    use crate::zone::{ZoneAuthority, ZoneId};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_SEQ: AtomicU64 = AtomicU64::new(1);

    fn lease(id: u32) -> SessionLease {
        SessionLease::new(id, 1).unwrap()
    }

    fn fighter(id: u32) -> crate::simulation::Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(id, 200.0, 200.0, 0.0);
        world.fighter(id).unwrap().clone()
    }

    fn checkpoint_path() -> PathBuf {
        let index = TEST_SEQ.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("myaso-transact-{}-{index}.bin", std::process::id()))
    }

    #[test]
    fn rack_equipment_denies_forged_stale_far_expired_and_non_sword_requests() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 700.0, 500.0, 0.0));
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(1), CharacterId::new(1).unwrap())
            .unwrap();
        identity
            .bind_verified(lease(2), CharacterId::new(2).unwrap())
            .unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let rack = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, sword, 0)
            .unwrap();
        let shield = loot.grant(1, ItemKind::WoodenShield, 1).unwrap();
        let rack_shield = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, shield, 0)
            .unwrap();
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        let operation = |lease| VerifiedLootOperation { lease, sequence: 1 };
        fn server_tick<'a>(
            world: &'a World,
            zones: &'a ZoneAuthority,
            completed_tick: u32,
        ) -> PickupWorldTick<'a> {
            PickupWorldTick {
                world,
                completed_tick,
                zones,
            }
        }

        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(SessionLease::new(2, 2).unwrap()),
                rack
            ),
            Err(PickupCommitError::UnverifiedSession)
        ));
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick.wrapping_add(1)),
                operation(lease(2)),
                rack
            ),
            Err(PickupCommitError::StaleWorldTick)
        ));
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(lease(2)),
                rack
            ),
            Err(PickupCommitError::Loot(LootError::OutOfReach))
        ));
        assert!(world.remove_player(2));
        assert!(world.add_player_at(2, 215.0, 200.0, 0.0));
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(lease(2)),
                rack_shield
            ),
            Err(PickupCommitError::Loot(LootError::WrongSlot))
        ));
        assert!(loot.ground().contains_key(&rack_shield));
        world.now_ms = (crate::loot::GROUND_DECAY_MS + 1) as f32;
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(lease(2)),
                rack
            ),
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        world.now_ms = f32::NAN;
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(lease(2)),
                rack
            ),
            Err(PickupCommitError::InvalidWorldTime)
        ));
        world.now_ms = 0.0;
        let mut dead = world.fighter(2).unwrap().clone();
        dead.hp = 0.0;
        dead.action = Action::Dead;
        loot.death(2, &dead, ZoneId::Moonvale, 0).unwrap();
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                server_tick(&world, &zones, world.tick),
                operation(lease(2)),
                rack
            ),
            Err(PickupCommitError::Loot(LootError::DeadPlayer))
        ));
        assert!(loot.ground().contains_key(&rack));
        assert!(loot.ground().contains_key(&rack_shield));
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(2).unwrap()),
            None
        );
        assert!(!path.exists());
    }

    #[test]
    fn checked_sword_pickup_binds_exact_item_and_denied_geometry_is_atomic() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 212.0, 200.0, 0.0));
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for actor in 1..=2 {
            zones.register(actor).unwrap();
            identity
                .bind_verified(lease(actor), CharacterId::new(u64::from(actor)).unwrap())
                .unwrap();
            loot.register(actor).unwrap();
        }
        let item_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let entity_id = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, item_id, 0)
            .unwrap();
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        macro_rules! ctx {
            () => {
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: lease(2),
                        sequence: 1,
                    },
                }
            };
        }
        let choice = GroundSwordSelection {
            ground_entity_id: entity_id,
            expected_item_id: item_id,
        };
        assert!(matches!(
            commit_verified_ground_sword_equip_checked(
                ctx!(),
                GroundSwordSelection {
                    expected_item_id: item_id + 1,
                    ..choice
                },
                |_, _, _| panic!("stale sword ID must fail before geometry")
            ),
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        assert!(matches!(
            commit_verified_ground_sword_equip_checked(
                ctx!(),
                GroundSwordSelection {
                    expected_item_id: 0,
                    ..choice
                },
                |_, _, _| panic!("zero sword ID must fail before geometry")
            ),
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        let mut called = 0;
        assert!(matches!(
            commit_verified_ground_sword_equip_checked(ctx!(), choice, |fighter, drop, zone| {
                called += 1;
                assert_eq!((fighter.net_id, fighter.x, fighter.y), (2, 212.0, 200.0));
                assert_eq!((drop.entity_id, drop.item.id), (entity_id, item_id));
                assert_eq!((drop.at.x, drop.at.y), (200.0, 200.0));
                assert_eq!(zone, ZoneId::Moonvale);
                Err(PickupCommitError::GeometryRejected)
            }),
            Err(PickupCommitError::GeometryRejected)
        ));
        assert_eq!(called, 1);
        assert_eq!(loot.ground()[&entity_id].item.id, item_id);
        assert_eq!(loot.inventory(2).unwrap().stack_count(), 0);
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(2).unwrap()),
            None
        );
        assert!(!path.exists());

        // This is a trusted server callback fixture, not the Physics #494
        // authoritative solid-window implementation; Core must supply it.
        let winner =
            commit_verified_ground_sword_equip_checked(ctx!(), choice, |fighter, drop, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(drop.zone, zone);
                Ok(())
            })
            .unwrap();
        assert_eq!(winner.id, item_id);
        assert!(!loot.ground().contains_key(&entity_id));
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(2).unwrap()),
            Some(1)
        );

        assert!(matches!(
            commit_verified_ground_sword_equip_checked(ctx!(), choice, |_, _, _| panic!(
                "cannot reacquire removed sword"
            )),
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn checked_mainhand_drop_transfers_same_sword_to_another_player_and_recovers() {
        use crate::magic_checkpoint::load_joint;
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 212.0, 200.0, 0.0));
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for id in 1..=2 {
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
        }
        let item_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        loot.equip(1, item_id, EquipmentSlot::MainHand).unwrap();
        // Fill all backpack slots with distinct physical items. A real
        // MainHand -> ground transfer must remain valid at exact capacity.
        for _ in 0..crate::loot::BACKPACK_CAPACITY {
            loot.grant(1, ItemKind::Gold, 1).unwrap();
        }
        assert_eq!(
            loot.inventory(1).unwrap().backpack().len(),
            crate::loot::BACKPACK_CAPACITY
        );
        let magic = MagicAuthority::new();
        let path = checkpoint_path();
        macro_rules! authority {
            ($actor:expr, $seq:expr) => {
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: lease($actor),
                        sequence: $seq,
                    },
                }
            };
        }

        // A blocked ground placement must not unequip, consume sequence,
        // create an item or ground entity, or leave a checkpoint.
        assert!(matches!(
            commit_verified_equipped_sword_drop_checked(authority!(1, 1), item_id, |_, _, _| {
                Err(PickupCommitError::GeometryRejected)
            }),
            Err(PickupCommitError::GeometryRejected)
        ));
        assert!(!path.exists());
        assert!(loot.ground().is_empty());
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(1).unwrap()),
            None
        );

        // Only the successful commit makes the hand empty and materializes
        // exactly one ground entity with the ORIGINAL physical item ID.
        let dropped = commit_verified_equipped_sword_drop_checked(
            authority!(1, 1),
            item_id,
            |fighter, drop, zone| {
                assert_eq!((fighter.x, fighter.y), (200.0, 200.0));
                assert_eq!((drop.at.x, drop.at.y), (fighter.x, fighter.y));
                assert_eq!(drop.zone, zone);
                assert_eq!(drop.item.id, item_id);
                assert_ne!(drop.entity_id, drop.item.id);
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(dropped.expected_item_id, item_id);
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            loot.inventory(1).unwrap().backpack().len(),
            crate::loot::BACKPACK_CAPACITY,
            "dropping a sword must not consume, split or lose backpack items"
        );
        assert_eq!(loot.ground().len(), 1);
        assert_eq!(loot.ground()[&dropped.ground_entity_id].item.id, item_id);
        assert!(matches!(
            commit_verified_equipped_sword_drop_checked(authority!(1, 1), item_id, |_, _, _| {
                panic!("replayed command must not reach geometry")
            }),
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));

        // Player B picks up the exact entity+item, not a reminted copy.
        let taken = commit_verified_ground_sword_equip_checked(
            authority!(2, 1),
            dropped,
            |fighter, drop, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(drop.item.id, item_id);
                assert_eq!(drop.zone, zone);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(taken.id, item_id);
        assert!(loot.ground().is_empty());
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());

        let (recovered, _) = load_joint(&path).unwrap();
        assert!(recovered.ground().is_empty());
        assert_eq!(
            recovered
                .parked_inventory(CharacterId::new(2).unwrap())
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert!(recovered
            .parked_inventory(CharacterId::new(1).unwrap())
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            recovered
                .parked_inventory(CharacterId::new(1).unwrap())
                .unwrap()
                .backpack()
                .len(),
            crate::loot::BACKPACK_CAPACITY
        );
        assert_eq!(
            recovered.committed_operation_sequence(CharacterId::new(1).unwrap()),
            Some(1)
        );
        assert_eq!(
            recovered.committed_operation_sequence(CharacterId::new(2).unwrap()),
            Some(1)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn drop_rejects_stale_equipment_selection_after_mainhand_replacement() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(1), CharacterId::new(1).unwrap())
            .unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();

        let old_sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let new_sword = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        loot.equip(1, old_sword, EquipmentSlot::MainHand).unwrap();
        // Simulate trusted equipment replacement after a client preview,
        // before its original delayed (but numerically fresh) drop command.
        loot.unequip(1, EquipmentSlot::MainHand).unwrap();
        loot.equip(1, new_sword, EquipmentSlot::MainHand).unwrap();
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        macro_rules! authority {
            () => {
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: lease(1),
                        sequence: 1,
                    },
                }
            };
        }
        for expected in [old_sword, 0] {
            assert!(matches!(
                commit_verified_equipped_sword_drop_checked(
                    authority!(),
                    expected,
                    |_, _, _| panic!("stale/zero selection must not reach geometry")
                ),
                Err(PickupCommitError::Loot(LootError::NotFound))
            ));
            assert!(loot.ground().is_empty());
            assert_eq!(
                loot.inventory(1)
                    .unwrap()
                    .equipped(EquipmentSlot::MainHand)
                    .unwrap()
                    .id,
                new_sword
            );
            assert_eq!(
                loot.committed_operation_sequence(CharacterId::new(1).unwrap()),
                None
            );
            assert!(!path.exists());
        }
        // The actual currently equipped sword can still be dropped once,
        // with its exact committed entity/item identity given to Physics.
        let selection = commit_verified_equipped_sword_drop_checked(
            authority!(),
            new_sword,
            |fighter, drop, zone| {
                assert_eq!((fighter.x, fighter.y), (200.0, 200.0));
                assert_eq!((drop.at.x, drop.at.y), (200.0, 200.0));
                assert_eq!(drop.zone, zone);
                assert_eq!(drop.item.id, new_sword);
                assert_eq!(drop.item.kind, ItemKind::IronSword);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(selection.expected_item_id, new_sword);
        assert_eq!(
            loot.ground()[&selection.ground_entity_id].item.id,
            new_sword
        );
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .backpack()
                .iter()
                .filter(|s| s.id == old_sword)
                .count(),
            1
        );
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(1).unwrap()),
            Some(1)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn sword_interaction_candidates_enforce_exact_physical_reach_boundary() {
        let mut world = World::new(900.0, 700.0);
        for (id, x, y) in [
            (1, 200.0, 200.0),
            (2, 200.0 + PICKUP_REACH, 200.0),
            (3, 200.0 + PICKUP_REACH + 1.0, 200.0),
            (4, 800.0, 600.0),
        ] {
            assert!(world.add_player_at(id, x, y, 0.0));
        }
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for id in 1..=4 {
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
        }
        let item_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let entity_id = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, item_id, 0)
            .unwrap();

        // Both viewers can *see* the same physical sword through the wider
        // 550-unit world-visibility contract. Only the exact 56-unit viewer
        // receives an actionable pickup selector: the one at 57 is too far.
        for id in [2, 3] {
            assert_eq!(
                loot.visible_loot(id, world.fighter(id).unwrap(), ZoneId::Moonvale, 0)
                    .unwrap()
                    .len(),
                1
            );
        }
        let tick = || PickupWorldTick {
            world: &world,
            completed_tick: world.tick,
            zones: &zones,
        };
        let nearest =
            inspect_verified_ground_sword_targets(&loot, &identity, tick(), lease(2)).unwrap();
        assert_eq!(nearest.len(), 1);
        assert_eq!(
            nearest[0].selection,
            GroundSwordSelection {
                ground_entity_id: entity_id,
                expected_item_id: item_id,
            }
        );
        for id in [3, 4] {
            assert!(
                inspect_verified_ground_sword_targets(&loot, &identity, tick(), lease(id))
                    .unwrap()
                    .is_empty()
            );
        }

        // The same physical candidate is eligible for the existing checked
        // transfer at the inclusive distance boundary (with fixture geometry
        // approval only; NOT a real Core 8C / Physics 494 LOS certificate).
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        let result = commit_verified_ground_sword_equip_checked(
            GroundSwordAuthority {
                path: &path,
                loot: &mut loot,
                magic: &magic,
                identity: &identity,
                tick: tick(),
                operation: VerifiedLootOperation {
                    lease: lease(2),
                    sequence: 1,
                },
            },
            nearest[0].selection,
            |fighter, drop, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(fighter.x - drop.at.x, PICKUP_REACH);
                assert_eq!(drop.zone, zone);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(result.id, item_id);
        assert!(loot.ground().is_empty());
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert!(
            inspect_verified_ground_sword_targets(&loot, &identity, tick(), lease(2))
                .unwrap()
                .is_empty()
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn authenticated_sword_preview_binds_visible_entity_to_exact_physical_id() {
        use crate::loot::{LootAppearance, Point};

        let mut world = World::new(900.0, 700.0);
        for (id, x, y) in [
            (1, 200.0, 200.0),
            (2, 224.0, 200.0),
            (3, 800.0, 600.0),
            (4, 240.0, 200.0),
        ] {
            assert!(world.add_player_at(id, x, y, 0.0));
        }
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for id in 1..=4 {
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
        }
        let rusty = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let first = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, rusty, 0)
            .unwrap();
        let iron = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        let second = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, iron, 0)
            .unwrap();
        let gold = loot.grant(1, ItemKind::Gold, 10).unwrap();
        let gold_entity = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, gold, 0)
            .unwrap();

        // A real corpse may contain another sword but the preview must
        // never publish any corpse contents as a selectable ground sword.
        let corpse_sword = loot.grant(4, ItemKind::RustySword, 1).unwrap();
        let mut victim = world.fighter(4).unwrap().clone();
        victim.hp = 0.0;
        victim.action = Action::Dead;
        loot.death(4, &victim, ZoneId::Moonvale, 0).unwrap();

        let preview = |lease: SessionLease, world: &World, loot: &LootAuthority, tick: u32| {
            inspect_verified_ground_sword_targets(
                loot,
                &identity,
                PickupWorldTick {
                    world,
                    completed_tick: tick,
                    zones: &zones,
                },
                lease,
            )
        };
        let view = preview(lease(2), &world, &loot, world.tick).unwrap();
        assert_eq!(view.len(), 2);
        assert_eq!(
            view.iter().map(|t| t.selection).collect::<Vec<_>>(),
            vec![
                GroundSwordSelection {
                    ground_entity_id: first,
                    expected_item_id: rusty
                },
                GroundSwordSelection {
                    ground_entity_id: second,
                    expected_item_id: iron
                },
            ],
        );
        assert!(view.iter().all(|t| t.at == Point { x: 200.0, y: 200.0 }));
        assert!(view.iter().all(|t| t.completed_tick == world.tick));
        assert!(!view
            .iter()
            .any(|t| t.selection.ground_entity_id == gold_entity));
        assert!(!view
            .iter()
            .any(|t| t.selection.expected_item_id == corpse_sword));
        assert!(loot
            .visible_loot(2, world.fighter(2).unwrap(), ZoneId::Moonvale, 0)
            .unwrap()
            .iter()
            .any(|v| matches!(v.appearance, LootAppearance::Corpse { .. })));

        assert!(preview(lease(3), &world, &loot, world.tick)
            .unwrap()
            .is_empty());
        assert!(matches!(
            preview(SessionLease::new(2, 2).unwrap(), &world, &loot, world.tick),
            Err(PickupCommitError::UnverifiedSession)
        ));
        assert!(matches!(
            preview(lease(2), &world, &loot, world.tick.wrapping_add(1)),
            Err(PickupCommitError::StaleWorldTick)
        ));
        world.now_ms = f32::NAN;
        assert!(matches!(
            preview(lease(2), &world, &loot, world.tick),
            Err(PickupCommitError::InvalidWorldTime)
        ));
        world.now_ms = 0.0;
        assert!(matches!(
            preview(lease(4), &world, &loot, world.tick),
            Err(PickupCommitError::Loot(LootError::DeadPlayer))
        ));
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        let obtained = commit_verified_ground_sword_equip_checked(
            GroundSwordAuthority {
                path: &path,
                loot: &mut loot,
                magic: &magic,
                identity: &identity,
                tick: PickupWorldTick {
                    world: &world,
                    completed_tick: world.tick,
                    zones: &zones,
                },
                operation: VerifiedLootOperation {
                    lease: lease(2),
                    sequence: 1,
                },
            },
            view[0].selection,
            |fighter, ground, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(ground.item.id, rusty);
                assert_eq!(ground.zone, zone);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(obtained.id, rusty);
        let after = preview(lease(2), &world, &loot, world.tick).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].selection.expected_item_id, iron);
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            rusty
        );
        assert!(matches!(
            commit_verified_ground_sword_equip_checked(
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones
                    },
                    operation: VerifiedLootOperation {
                        lease: lease(1),
                        sequence: 1
                    },
                },
                view[0].selection,
                |_, _, _| panic!("stale item target must be rejected"),
            ),
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn four_parallel_verified_sword_claims_commit_exactly_one_winner() {
        use crate::magic_checkpoint::load_joint;
        use std::sync::{Arc, Barrier, Mutex};

        // This test executes four concurrent Rust threads, not four QUIC
        // connections. The complete shared state is behind the same exclusive
        // lock required of Core 8A/8B/8C's future authoritative operation.
        struct Authority {
            world: World,
            zones: ZoneAuthority,
            identity: SessionIdentityRegistry,
            loot: LootAuthority,
            magic: MagicAuthority,
        }
        let mut world = World::new(800.0, 600.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for (id, x) in [(1, 180.0), (2, 191.0), (3, 202.0), (4, 213.0)] {
            assert!(world.add_player_at(id, x, 200.0, 0.0));
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
        }
        let item_id = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let entity_id = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, item_id, 0)
            .unwrap();
        let path = checkpoint_path();
        let authority = Arc::new(Mutex::new(Authority {
            world,
            zones,
            identity,
            loot,
            magic: MagicAuthority::new(),
        }));
        let start = Arc::new(Barrier::new(4));

        // Deliberately vary scheduling: no particular actor should be granted
        // the item merely because of their numeric ID or thread spawn order.
        let completed = std::thread::scope(|scope| {
            let mut handles = Vec::new();
            for id in [4_u32, 2, 1, 3] {
                let shared = Arc::clone(&authority);
                let race_start = Arc::clone(&start);
                let output_path = &path;
                handles.push(scope.spawn(move || {
                    race_start.wait();
                    let mut guard = shared.lock().unwrap();
                    let Authority {
                        world,
                        zones,
                        identity,
                        loot,
                        magic,
                    } = &mut *guard;
                    let result = commit_verified_ground_sword_equip_checked(
                        GroundSwordAuthority {
                            path: output_path,
                            loot,
                            magic,
                            identity,
                            tick: PickupWorldTick {
                                world,
                                completed_tick: world.tick,
                                zones,
                            },
                            operation: VerifiedLootOperation {
                                lease: lease(id),
                                sequence: 1,
                            },
                        },
                        GroundSwordSelection {
                            ground_entity_id: entity_id,
                            expected_item_id: item_id,
                        },
                        |fighter, drop, zone| {
                            // These checks demonstrate the authoritative
                            // provenance of callback input, not actual LOS.
                            assert_eq!(fighter.net_id, id);
                            assert_eq!(drop.entity_id, entity_id);
                            assert_eq!(drop.item.id, item_id);
                            assert_eq!(drop.zone, zone);
                            Ok(())
                        },
                    );
                    (id, result)
                }));
            }
            handles
                .into_iter()
                .map(|handle| handle.join().expect("contest thread panicked"))
                .collect::<Vec<_>>()
        });

        let mut winner = None;
        let mut loser_count = 0;
        for (id, result) in completed {
            match result {
                Ok(sword) => {
                    assert!(
                        winner.replace(id).is_none(),
                        "more than one claimed the sword"
                    );
                    assert_eq!(sword.id, item_id);
                }
                Err(PickupCommitError::Loot(LootError::NotFound)) => loser_count += 1,
                Err(error) => panic!("unexpected contest failure: {error:?}"),
            }
        }
        assert_eq!(loser_count, 3);
        let winner = winner.expect("one verified player must win");
        let guard = authority.lock().unwrap();
        assert!(guard.loot.ground().is_empty());
        for id in 1..=4 {
            let equipment = guard.loot.inventory(id).unwrap();
            let character = CharacterId::new(u64::from(id)).unwrap();
            if id == winner {
                assert_eq!(
                    equipment.equipped(EquipmentSlot::MainHand).unwrap().id,
                    item_id
                );
                assert_eq!(guard.loot.committed_operation_sequence(character), Some(1));
            } else {
                assert_eq!(equipment.stack_count(), 0);
                assert_eq!(guard.loot.committed_operation_sequence(character), None);
            }
        }
        assert!(path.exists(), "only winning transfer should checkpoint");
        let (mut recovered, recovered_magic) = load_joint(&path).unwrap();
        assert!(recovered.ground().is_empty());
        let mut physical_count = 0;
        for id in 1..=4 {
            let character = CharacterId::new(u64::from(id)).unwrap();
            let owned = recovered.parked_inventory(character).unwrap();
            physical_count += owned
                .backpack()
                .iter()
                .filter(|stack| stack.id == item_id)
                .count();
            if owned
                .equipped(EquipmentSlot::MainHand)
                .is_some_and(|stack| stack.id == item_id)
            {
                physical_count += 1;
                assert_eq!(id, winner);
            }
        }
        assert_eq!(physical_count, 1, "checkpoint duplicated or lost the sword");
        assert_eq!(
            recovered.committed_operation_sequence(CharacterId::new(u64::from(winner)).unwrap()),
            Some(1)
        );
        // Simulate the server crash AFTER the durable commit but BEFORE any
        // pickup ACK reached the four contenders. All four reconnect with
        // verified, fresh lease generations and replay their original exact
        // (ground entity, physical ItemId, sequence=1) intent. No retry can
        // mint a new sword, claim a previous winner's sword, consume a losing
        // player's operation watermark, or rewrite the committed checkpoint.
        let durable_before_retries = fs::read(&path).unwrap();
        let mut reconnect_identity = SessionIdentityRegistry::new();
        for id in 1..=4 {
            let reconnect_lease = SessionLease::new(id, 2).unwrap();
            reconnect_identity
                .bind_verified(reconnect_lease, CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            recovered
                .resume_inventory(&reconnect_identity, reconnect_lease)
                .unwrap();
        }
        let before_retries = recovered.export_state().unwrap();
        for id in [winner, 1, 2, 3, 4] {
            // The winner is retried twice; every losing actor still points to
            // the same physically removed original ground entity.
            let reconnect_lease = SessionLease::new(id, 2).unwrap();
            let result = commit_verified_ground_sword_equip_checked(
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut recovered,
                    magic: &recovered_magic,
                    identity: &reconnect_identity,
                    tick: PickupWorldTick {
                        world: &guard.world,
                        completed_tick: guard.world.tick,
                        zones: &guard.zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: reconnect_lease,
                        sequence: 1,
                    },
                },
                GroundSwordSelection {
                    ground_entity_id: entity_id,
                    expected_item_id: item_id,
                },
                |_, _, _| -> Result<(), PickupCommitError> {
                    panic!("stale post-crash pickup must not reach geometry or commit");
                },
            );
            if id == winner {
                assert!(matches!(
                    result,
                    Err(PickupCommitError::Loot(LootError::ReplayOperation))
                ));
            } else {
                assert!(matches!(
                    result,
                    Err(PickupCommitError::Loot(LootError::NotFound))
                ));
            }
            assert_eq!(recovered.export_state().unwrap(), before_retries);
            assert_eq!(fs::read(&path).unwrap(), durable_before_retries);
        }
        for id in 1..=4 {
            let character = CharacterId::new(u64::from(id)).unwrap();
            assert_eq!(
                recovered.committed_operation_sequence(character),
                (id == winner).then_some(1)
            );
            let owned = recovered.inventory(id).unwrap();
            assert_eq!(
                owned.equipped(EquipmentSlot::MainHand).map(|x| x.id),
                (id == winner).then_some(item_id)
            );
        }
        let _ = fs::remove_file(path);
    }

    #[test]
    fn recovered_exact_pickup_rejects_old_ground_entity_after_same_sword_redrop() {
        use crate::magic_checkpoint::load_joint;

        // Same physical sword returns to the exact world coordinate under a
        // NEW ground entity. After durable recovery, an unspent old pickup
        // sequence must not mistake the old object for the new one.
        // This is a local prototype checkpoint test, not a global writer.
        let mut world = World::new(800.0, 600.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for id in 1..=2 {
            assert!(world.add_player_at(id, 200.0, 200.0, 0.0));
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
        }
        let item_id = loot.grant(2, ItemKind::IronSword, 1).unwrap();
        let first_ground = loot
            .drop_backpack(2, world.fighter(2).unwrap(), ZoneId::Moonvale, item_id, 0)
            .unwrap();
        let old_selection = GroundSwordSelection {
            ground_entity_id: first_ground,
            expected_item_id: item_id,
        };
        let path = checkpoint_path();
        let magic = MagicAuthority::new();
        macro_rules! authority {
            ($loot:expr, $magic:expr, $identity:expr, $actor:expr, $gen:expr, $seq:expr) => {
                GroundSwordAuthority {
                    path: &path,
                    loot: $loot,
                    magic: $magic,
                    identity: $identity,
                    tick: PickupWorldTick {
                        world: &world,
                        completed_tick: world.tick,
                        zones: &zones,
                    },
                    operation: VerifiedLootOperation {
                        lease: SessionLease::new($actor, $gen).unwrap(),
                        sequence: $seq,
                    },
                }
            };
        }
        let acquired = commit_verified_ground_sword_equip_checked(
            authority!(&mut loot, &magic, &identity, 2, 1, 1),
            old_selection,
            |fighter, ground, zone| {
                assert_eq!(fighter.net_id, 2);
                assert_eq!(ground.entity_id, first_ground);
                assert_eq!(ground.item.id, item_id);
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(acquired.id, item_id);
        let new_selection = commit_verified_equipped_sword_drop_checked(
            authority!(&mut loot, &magic, &identity, 2, 1, 2),
            item_id,
            |fighter, ground, zone| {
                assert_eq!((ground.at.x, ground.at.y), (fighter.x, fighter.y));
                assert_eq!(ground.item.id, item_id);
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            },
        )
        .unwrap();
        assert_ne!(new_selection.ground_entity_id, first_ground);
        assert_eq!(new_selection.expected_item_id, item_id);
        assert!(!loot.ground().contains_key(&first_ground));
        assert_eq!(loot.ground().len(), 1);
        assert_eq!(
            loot.ground()[&new_selection.ground_entity_id].at,
            crate::loot::Point { x: 200.0, y: 200.0 }
        );

        // Crash/reconnect after both durable commits, retaining the current
        // checkpoint bytes. All future requests use fresh verified leases.
        let durable_before_recovery = fs::read(&path).unwrap();
        let (mut recovered, recovered_magic) = load_joint(&path).unwrap();
        let mut reconnected = SessionIdentityRegistry::new();
        for id in 1..=2 {
            let fresh = SessionLease::new(id, 2).unwrap();
            reconnected
                .bind_verified(fresh, CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            recovered.resume_inventory(&reconnected, fresh).unwrap();
        }
        assert_eq!(recovered.ground().len(), 1);
        assert!(!recovered.ground().contains_key(&first_ground));
        assert_eq!(
            recovered.ground()[&new_selection.ground_entity_id].item.id,
            item_id
        );
        let before_denials = recovered.export_state().unwrap();

        // Player1 has an unspent sequence, yet their old exact entity is
        // gone. Player2's original sequence is already committed. A forged
        // item ID on the NEW entity is also denied, even with fresh sequence.
        for (actor, sequence, selected, expected) in [
            (1, 1, old_selection, LootError::NotFound),
            (2, 1, old_selection, LootError::ReplayOperation),
            (
                1,
                1,
                GroundSwordSelection {
                    ground_entity_id: new_selection.ground_entity_id,
                    expected_item_id: item_id + 100,
                },
                LootError::NotFound,
            ),
        ] {
            let result = commit_verified_ground_sword_equip_checked(
                authority!(
                    &mut recovered,
                    &recovered_magic,
                    &reconnected,
                    actor,
                    2,
                    sequence
                ),
                selected,
                |_, _, _| -> Result<(), PickupCommitError> {
                    panic!("stale/forged recovered click must not reach Physics or commit");
                },
            );
            match (result, expected) {
                (Err(PickupCommitError::Loot(LootError::NotFound)), LootError::NotFound)
                | (
                    Err(PickupCommitError::Loot(LootError::ReplayOperation)),
                    LootError::ReplayOperation,
                ) => {}
                (actual, expected) => panic!("expected {expected:?}, got {actual:?}"),
            }
            assert_eq!(recovered.export_state().unwrap(), before_denials);
            assert_eq!(fs::read(&path).unwrap(), durable_before_recovery);
        }

        // A freshly selected entity must still be claimable by the other
        // verified player exactly once, conserving original physical ItemId.
        let obtained = commit_verified_ground_sword_equip_checked(
            authority!(&mut recovered, &recovered_magic, &reconnected, 1, 2, 1),
            new_selection,
            |fighter, ground, zone| {
                assert_eq!(fighter.net_id, 1);
                assert_eq!(ground.entity_id, new_selection.ground_entity_id);
                assert_eq!(ground.item.id, item_id);
                assert_eq!(zone, ZoneId::Moonvale);
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(obtained.id, item_id);
        assert!(recovered.ground().is_empty());
        assert!(recovered
            .inventory(2)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            recovered
                .inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert_eq!(
            recovered.committed_operation_sequence(CharacterId::new(1).unwrap()),
            Some(1)
        );
        assert_eq!(
            recovered.committed_operation_sequence(CharacterId::new(2).unwrap()),
            Some(2)
        );
        let (reopened, _) = load_joint(&path).unwrap();
        assert!(reopened.ground().is_empty());
        assert_eq!(
            reopened
                .parked_inventory(CharacterId::new(1).unwrap())
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            item_id
        );
        assert!(reopened
            .parked_inventory(CharacterId::new(2).unwrap())
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn alpha_reused_session_cannot_steal_previous_characters_sword() {
        use crate::magic_checkpoint::load_joint;

        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 215.0, 200.0, 0.0));
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();

        let old_character = CharacterId::new(202).unwrap();
        let new_character = CharacterId::new(303).unwrap();
        let old_lease = lease(2);
        let replacement_lease = SessionLease::new(2, 2).unwrap();
        let restored_lease = SessionLease::new(2, 3).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(1), CharacterId::new(101).unwrap())
            .unwrap();
        identity.bind_verified(old_lease, old_character).unwrap();

        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let first_sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let first_entity = loot
            .drop_backpack(
                1,
                world.fighter(1).unwrap(),
                ZoneId::Moonvale,
                first_sword,
                0,
            )
            .unwrap();
        let second_sword = loot.grant(1, ItemKind::IronSword, 1).unwrap();
        let second_entity = loot
            .drop_backpack(
                1,
                world.fighter(1).unwrap(),
                ZoneId::Moonvale,
                second_sword,
                0,
            )
            .unwrap();
        let path = checkpoint_path();
        let magic = MagicAuthority::new();

        macro_rules! pickup {
            ($lease:expr, $sequence:expr, $entity:expr, $item:expr) => {
                commit_verified_ground_sword_equip_checked(
                    GroundSwordAuthority {
                        path: &path,
                        loot: &mut loot,
                        magic: &magic,
                        identity: &identity,
                        tick: PickupWorldTick {
                            world: &world,
                            completed_tick: world.tick,
                            zones: &zones,
                        },
                        operation: VerifiedLootOperation {
                            lease: $lease,
                            sequence: $sequence,
                        },
                    },
                    GroundSwordSelection {
                        ground_entity_id: $entity,
                        expected_item_id: $item,
                    },
                    |fighter, ground, zone| {
                        // Test fixture: verify authoritative argument provenance;
                        // real Core 8C must call current Physics LOS and fence it.
                        assert_eq!(fighter.net_id, 2);
                        assert_eq!(ground.zone, zone);
                        assert_eq!(ground.at.x, 200.0);
                        assert_eq!(ground.at.y, 200.0);
                        Ok(())
                    },
                )
            };
        }
        assert_eq!(
            pickup!(old_lease, 1, first_entity, first_sword).unwrap().id,
            first_sword
        );
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            first_sword
        );
        assert_eq!(loot.committed_operation_sequence(old_character), Some(1));

        // Exact old lease parks the sword; reused numeric fighter ID must be
        // independently admitted to a different *character* and empty hands.
        loot.park_inventory(&identity, old_lease).unwrap();
        assert_eq!(identity.release_session(old_lease), Some(old_character));
        assert!(world.remove_player(2));
        assert!(world.add_player_at(2, 215.0, 200.0, 0.0));
        identity
            .bind_verified(replacement_lease, new_character)
            .unwrap();
        loot.register(2).unwrap();
        assert!(loot
            .inventory(2)
            .unwrap()
            .equipped(EquipmentSlot::MainHand)
            .is_none());
        assert_eq!(
            loot.parked_inventory(old_character)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            first_sword
        );

        // A late packet from the previous epoch must not steal another sword
        // or consume the new character's command sequence.
        assert!(matches!(
            pickup!(old_lease, 2, second_entity, second_sword),
            Err(PickupCommitError::UnverifiedSession)
        ));
        assert!(loot.ground().contains_key(&second_entity));
        assert_eq!(loot.committed_operation_sequence(new_character), None);
        assert_eq!(
            pickup!(replacement_lease, 1, second_entity, second_sword)
                .unwrap()
                .id,
            second_sword
        );
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            second_sword
        );
        assert_eq!(loot.committed_operation_sequence(new_character), Some(1));

        // Reconnected first character gets *only their original sword*, not
        // the second character's newly acquired weapon, even with same ID 2.
        loot.park_inventory(&identity, replacement_lease).unwrap();
        assert_eq!(
            identity.release_session(replacement_lease),
            Some(new_character)
        );
        assert!(world.remove_player(2));
        assert!(world.add_player_at(2, 215.0, 200.0, 0.0));
        identity
            .bind_verified(restored_lease, old_character)
            .unwrap();
        loot.resume_inventory(&identity, restored_lease).unwrap();
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            first_sword
        );
        assert_eq!(
            loot.parked_inventory(new_character)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            second_sword
        );
        assert_eq!(loot.committed_operation_sequence(old_character), Some(1));
        assert!(matches!(
            pickup!(old_lease, 2, second_entity, second_sword),
            Err(PickupCommitError::UnverifiedSession)
        ));

        // Force one complete trusted checkpoint and verify its parked recovery
        // keeps each sword in exactly one character's equipment, no ground copy.
        let bytes = bundle(&loot, &identity, &magic).unwrap();
        atomic_write(&path, &bytes).unwrap();
        let (recovered, _) = load_joint(&path).unwrap();
        assert_eq!(
            recovered
                .parked_inventory(old_character)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            first_sword
        );
        assert_eq!(
            recovered
                .parked_inventory(new_character)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            second_sword
        );
        assert_eq!(
            recovered.committed_operation_sequence(old_character),
            Some(1)
        );
        assert_eq!(
            recovered.committed_operation_sequence(new_character),
            Some(1)
        );
        assert!(recovered.ground().is_empty());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn world_p0_greyhaven_four_distinct_sockets_accept_real_ground_item_positions() {
        use crate::loot::{GroundDrop, Point, PICKUP_REACH};
        use crate::magic_checkpoint::load_joint;
        use std::collections::BTreeSet;

        // Test-only physical-item projection of World #493's four immutable
        // Blacksmith sockets. The strings are World socket IDs, NOT item IDs;
        // Core 8B must still mint and durably assign canonical item IDs.
        let sockets = [
            ("greyhaven-rack-1", 3740.0_f32),
            ("greyhaven-rack-2", 3780.0),
            ("greyhaven-rack-3", 3820.0),
            ("greyhaven-rack-4", 3860.0),
        ];
        let mut world = World::new(8192.0, 8192.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for (idx, (_, x)) in sockets.iter().enumerate() {
            let player = (idx + 1) as u32;
            assert!(world.add_player_at(player, *x, 4088.0, 0.0));
            zones.register(player).unwrap();
            identity
                .bind_verified(lease(player), CharacterId::new(u64::from(player)).unwrap())
                .unwrap();
            loot.register(player).unwrap();
            assert!(loot.inventory(player).unwrap().backpack().is_empty());
            assert!(loot
                .inventory(player)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .is_none());
        }

        // An isolated, trusted snapshot fixture projects FOUR distinct physical
        // item instances at the authored sockets; this is NOT a live rack
        // allocator and intentionally does not provide any respawn hook.
        let mut fixture = loot.export_state().unwrap();
        fixture.next_id = 1_000;
        for (idx, (socket_name, x)) in sockets.iter().enumerate() {
            assert!(socket_name.starts_with("greyhaven-rack-"));
            let item_id = 101 + idx as u64;
            let entity_id = 201 + idx as u64;
            assert!(fixture
                .ground
                .insert(
                    entity_id,
                    GroundDrop {
                        entity_id,
                        zone: ZoneId::Moonvale,
                        at: Point { x: *x, y: 4038.0 },
                        expires_at_ms: crate::loot::GROUND_DECAY_MS,
                        item: ItemStack {
                            id: item_id,
                            kind: ItemKind::RustySword,
                            amount: 1,
                        },
                    },
                )
                .is_none());
            let actor = world.fighter((idx + 1) as u32).unwrap();
            let dx = actor.x - x;
            let dy = actor.y - 4038.0;
            assert_eq!(dy, 50.0);
            assert!(dx.mul_add(dx, dy * dy) <= PICKUP_REACH * PICKUP_REACH);
        }
        loot = LootAuthority::restore_state(fixture).unwrap();
        let magic = MagicAuthority::new();
        let path = checkpoint_path();
        let op = |id, seq| VerifiedLootOperation {
            lease: lease(id),
            sequence: seq,
        };
        let tick = || PickupWorldTick {
            world: &world,
            completed_tick: world.tick,
            zones: &zones,
        };

        // All 12 other-player sword intents fail *before* geometry validation:
        // World #493 has 40 horizontal and 50 vertical unit offsets.
        // This test uses Items' existing authoritative reach of 56 units;
        // Physics/Core must separately approve and enforce their current
        // complete same-tick LOS window for production.
        for viewer in 1_u32..=4 {
            for target in 1_u32..=4 {
                if viewer == target {
                    continue;
                }
                let wrong_socket = GroundSwordSelection {
                    ground_entity_id: 200 + u64::from(target),
                    expected_item_id: 100 + u64::from(target),
                };
                assert!(matches!(
                    commit_verified_ground_sword_equip_checked(
                        GroundSwordAuthority {
                            path: &path,
                            loot: &mut loot,
                            magic: &magic,
                            identity: &identity,
                            tick: tick(),
                            operation: op(viewer, 1),
                        },
                        wrong_socket,
                        |_, _, _| panic!("out-of-reach selection must not reach Physics"),
                    ),
                    Err(PickupCommitError::Loot(LootError::OutOfReach))
                ));
                assert_eq!(
                    loot.committed_operation_sequence(CharacterId::new(u64::from(viewer)).unwrap()),
                    None
                );
            }
        }
        assert!(!path.exists());
        for id in 1_u32..=4 {
            let item = commit_verified_ground_sword_equip_checked(
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: tick(),
                    operation: op(id, 1),
                },
                GroundSwordSelection {
                    ground_entity_id: 200 + u64::from(id),
                    expected_item_id: 100 + u64::from(id),
                },
                |fighter, ground, zone| {
                    assert_eq!(fighter.net_id, id);
                    assert_eq!(ground.entity_id, 200 + u64::from(id));
                    assert_eq!(ground.item.id, 100 + u64::from(id));
                    assert_eq!(ground.zone, zone);
                    // Synthetic fixture prerequisite only, not a Physics
                    // #494 real window or Core epoch/LOS authority.
                    Ok(())
                },
            )
            .unwrap();
            assert_eq!(item.id, 100 + u64::from(id));
        }
        assert!(loot.ground().is_empty());
        let unique = (1..=4)
            .map(|id| {
                loot.inventory(id)
                    .unwrap()
                    .equipped(EquipmentSlot::MainHand)
                    .unwrap()
                    .id
            })
            .collect::<BTreeSet<_>>();
        assert_eq!(unique, BTreeSet::from([101, 102, 103, 104]));
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 1);

        // After a valid drop, an adjacent player can take the SAME physical
        // sword identity; the first owner cannot keep phantom equipped gear.
        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            tick(),
            op(1, 2),
            VerifiedEquipmentAction::Unequip {
                slot: EquipmentSlot::MainHand,
            },
        )
        .unwrap();
        let drop = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            tick(),
            op(1, 3),
            VerifiedEquipmentAction::Drop {
                item_id: 101,
                amount: 1,
            },
        )
        .unwrap();
        let dropped_entity = match drop {
            EquipmentActionResult::Dropped { entity_id } => entity_id,
            _ => panic!("expected a physical sword on the ground"),
        };
        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            tick(),
            op(2, 2),
            VerifiedEquipmentAction::Unequip {
                slot: EquipmentSlot::MainHand,
            },
        )
        .unwrap();
        assert_eq!(
            commit_verified_ground_sword_equip_checked(
                GroundSwordAuthority {
                    path: &path,
                    loot: &mut loot,
                    magic: &magic,
                    identity: &identity,
                    tick: tick(),
                    operation: op(2, 3),
                },
                GroundSwordSelection {
                    ground_entity_id: dropped_entity,
                    expected_item_id: 101,
                },
                |fighter, ground, zone| {
                    assert_eq!(fighter.net_id, 2);
                    assert_eq!(ground.item.id, 101);
                    assert_eq!(ground.zone, zone);
                    Ok(())
                },
            )
            .unwrap()
            .id,
            101
        );
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 0);
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            101
        );
        assert_eq!(loot.inventory(2).unwrap().backpack()[0].id, 102);

        let (restored, _) = load_joint(&path).unwrap();
        let mut ids = BTreeSet::new();
        for id in 1_u32..=4 {
            let inventory = restored
                .parked_inventory(CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            for stack in inventory.backpack() {
                assert!(ids.insert(stack.id));
            }
            if let Some(stack) = inventory.equipped(EquipmentSlot::MainHand) {
                assert!(ids.insert(stack.id));
            }
        }
        assert_eq!(ids, BTreeSet::from([101, 102, 103, 104]));
        assert!(restored.ground().is_empty());
        assert_eq!(
            restored.committed_operation_sequence(CharacterId::new(2).unwrap()),
            Some(3)
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn four_player_ground_swords_equip_without_duplication_or_partial_commit() {
        use crate::magic_checkpoint::load_joint;

        let mut world = World::new(800.0, 600.0);
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for (id, x) in [(1, 200.0), (2, 215.0), (3, 228.0), (4, 240.0)] {
            assert!(world.add_player_at(id, x, 200.0, 0.0));
            zones.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
            loot.register(id).unwrap();
            assert_eq!(loot.inventory(id).unwrap().stack_count(), 0);
        }
        let mut swords = Vec::new();
        for kind in [
            ItemKind::RustySword,
            ItemKind::IronSword,
            ItemKind::RustySword,
            ItemKind::IronSword,
        ] {
            let id = loot.grant(1, kind, 1).unwrap();
            let entity = loot
                .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, id, 0)
                .unwrap();
            swords.push((id, entity));
        }
        assert_eq!(loot.ground().len(), 4);
        let magic = MagicAuthority::new();
        let path = checkpoint_path();
        let tick = || PickupWorldTick {
            world: &world,
            completed_tick: world.tick,
            zones: &zones,
        };
        let operation = |actor, sequence| VerifiedLootOperation {
            lease: lease(actor),
            sequence,
        };
        let (sword_one, rack_one) = swords[0];
        let winning = commit_verified_ground_sword_equip(
            &path,
            &mut loot,
            &magic,
            &identity,
            tick(),
            operation(2, 1),
            rack_one,
        )
        .unwrap();
        assert_eq!(winning.id, sword_one);
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::MainHand)
                .unwrap()
                .id,
            sword_one
        );
        assert!(!loot.ground().contains_key(&rack_one));

        // A simultaneous contender serialized after the winner never sees a
        // second sword; its operation receipt does not advance.
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                tick(),
                operation(3, 1),
                rack_one
            ),
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(3).unwrap()),
            None
        );

        // Trying a second weapon with a full MainHand must not remove rack stock.
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                tick(),
                operation(2, 2),
                swords[1].1
            ),
            Err(PickupCommitError::Loot(LootError::SlotOccupied))
        ));
        assert!(loot.ground().contains_key(&swords[1].1));
        assert_eq!(
            loot.committed_operation_sequence(CharacterId::new(2).unwrap()),
            Some(1)
        );

        // Failed disk write cannot publish an unequipped backpack or partial transfer.
        let bad_path = PathBuf::from("/nonexistent-myaso-items2b-alpha-rack-dir/item.bin");
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &bad_path,
                &mut loot,
                &magic,
                &identity,
                tick(),
                operation(3, 1),
                swords[1].1
            ),
            Err(PickupCommitError::Io(_))
        ));
        assert!(loot.ground().contains_key(&swords[1].1));
        assert_eq!(loot.inventory(3).unwrap().stack_count(), 0);

        for (actor, (item_id, entity)) in [(3, swords[1]), (4, swords[2]), (1, swords[3])] {
            assert_eq!(
                commit_verified_ground_sword_equip(
                    &path,
                    &mut loot,
                    &magic,
                    &identity,
                    tick(),
                    operation(actor, 1),
                    entity
                )
                .unwrap()
                .id,
                item_id
            );
        }
        assert!(loot.ground().is_empty());
        let mut observed = std::collections::BTreeSet::new();
        for actor in 1..=4 {
            let owned = loot.inventory(actor).unwrap();
            assert!(owned.backpack().is_empty());
            let item = owned.equipped(EquipmentSlot::MainHand).unwrap();
            assert!(observed.insert(item.id));
        }
        assert_eq!(observed.len(), 4);
        assert_eq!(observed, swords.iter().map(|(id, _)| *id).collect());

        let (restored, _) = load_joint(&path).unwrap();
        for actor in 1..=4 {
            assert_eq!(
                restored
                    .parked_inventory(CharacterId::new(u64::from(actor)).unwrap())
                    .unwrap()
                    .equipped(EquipmentSlot::MainHand)
                    .unwrap()
                    .id,
                loot.inventory(actor)
                    .unwrap()
                    .equipped(EquipmentSlot::MainHand)
                    .unwrap()
                    .id
            );
        }
        assert!(matches!(
            commit_verified_ground_sword_equip(
                &path,
                &mut loot,
                &magic,
                &identity,
                tick(),
                operation(2, 1),
                rack_one
            ),
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn naked_player_equip_unequip_drop_other_player_pickup_and_equip_is_durable() {
        use crate::magic_checkpoint::load_joint;

        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 218.0, 200.0, 0.0));
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let one = CharacterId::new(1).unwrap();
        let two = CharacterId::new(2).unwrap();
        identity.bind_verified(lease(1), one).unwrap();
        identity.bind_verified(lease(2), two).unwrap();

        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 0);
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::Body)
            .is_none());
        assert!(loot
            .inventory(2)
            .unwrap()
            .equipped(EquipmentSlot::Body)
            .is_none());

        // Server-only item creation; no starter gear is minted during spawn.
        let armor = loot.grant(1, ItemKind::ChainmailArmor, 1).unwrap();
        let shield = loot.grant(1, ItemKind::WoodenShield, 1).unwrap();
        let magic = MagicAuthority::new();
        let path = checkpoint_path();
        let equip_armor = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 1,
            },
            VerifiedEquipmentAction::Equip {
                item_id: armor,
                slot: EquipmentSlot::Body,
            },
        )
        .unwrap();
        assert_eq!(
            equip_armor,
            EquipmentActionResult::Equipped {
                item_id: armor,
                slot: EquipmentSlot::Body
            }
        );
        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 2,
            },
            VerifiedEquipmentAction::Equip {
                item_id: shield,
                slot: EquipmentSlot::OffHand,
            },
        )
        .unwrap();
        assert_eq!(loot.inventory(1).unwrap().stack_count(), 2);
        assert!(loot.inventory(1).unwrap().backpack().is_empty());

        // Explicit unequip precedes dropping gear; item identity is conserved.
        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 3,
            },
            VerifiedEquipmentAction::Unequip {
                slot: EquipmentSlot::Body,
            },
        )
        .unwrap();
        let dropped = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 4,
            },
            VerifiedEquipmentAction::Drop {
                item_id: armor,
                amount: 1,
            },
        )
        .unwrap();
        let entity = match dropped {
            EquipmentActionResult::Dropped { entity_id } => entity_id,
            _ => panic!("expected physical ground drop"),
        };
        assert_eq!(loot.ground()[&entity].item.id, armor);
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::Body)
            .is_none());

        let taken = commit_verified_pickup(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(2),
                sequence: 1,
            },
            VerifiedPickupSelection::Ground {
                entity_id: entity,
                amount: 1,
            },
        )
        .unwrap();
        assert_eq!(taken.id, armor);
        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(2),
                sequence: 2,
            },
            VerifiedEquipmentAction::Equip {
                item_id: armor,
                slot: EquipmentSlot::Body,
            },
        )
        .unwrap();
        assert!(!loot.ground().contains_key(&entity));
        assert_eq!(
            loot.inventory(2)
                .unwrap()
                .equipped(EquipmentSlot::Body)
                .unwrap()
                .id,
            armor
        );
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::OffHand)
                .unwrap()
                .id,
            shield
        );

        let (persisted, _) = load_joint(&path).unwrap();
        assert_eq!(
            persisted
                .parked_inventory(two)
                .unwrap()
                .equipped(EquipmentSlot::Body)
                .unwrap()
                .id,
            armor
        );
        assert_eq!(
            persisted
                .parked_inventory(one)
                .unwrap()
                .equipped(EquipmentSlot::OffHand)
                .unwrap()
                .id,
            shield
        );
        assert_eq!(persisted.committed_operation_sequence(one), Some(4));
        assert_eq!(persisted.committed_operation_sequence(two), Some(2));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn forged_equipment_actor_wrong_slot_and_failed_write_cannot_change_gear() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(11).unwrap();
        identity.bind_verified(lease(1), character).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let helmet = loot.grant(1, ItemKind::IronHelmet, 1).unwrap();
        let magic = MagicAuthority::new();
        let path = checkpoint_path();
        let action = VerifiedEquipmentAction::Equip {
            item_id: helmet,
            slot: EquipmentSlot::Head,
        };
        let mismatched = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: SessionLease::new(1, 2).unwrap(),
                sequence: 7,
            },
            action,
        );
        assert!(matches!(
            mismatched,
            Err(PickupCommitError::UnverifiedSession)
        ));
        let wrong_slot = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 7,
            },
            VerifiedEquipmentAction::Equip {
                item_id: helmet,
                slot: EquipmentSlot::Feet,
            },
        );
        assert!(matches!(
            wrong_slot,
            Err(PickupCommitError::Loot(LootError::WrongSlot))
        ));
        let nonexistent_parent = path.with_extension("not-a-real-dir").join("state.bin");
        let failed_write = commit_verified_equipment(
            &nonexistent_parent,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 7,
            },
            action,
        );
        assert!(matches!(
            failed_write,
            Err(PickupCommitError::Io(CheckpointError::Io(_)))
        ));
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::Head)
            .is_none());
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].id, helmet);
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert!(!path.exists());

        commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 7,
            },
            action,
        )
        .unwrap();
        assert_eq!(
            loot.inventory(1)
                .unwrap()
                .equipped(EquipmentSlot::Head)
                .unwrap()
                .id,
            helmet
        );
        let replay = commit_verified_equipment(
            &path,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(1),
                sequence: 7,
            },
            VerifiedEquipmentAction::Unequip {
                slot: EquipmentSlot::Head,
            },
        );
        assert!(matches!(
            replay,
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));
        assert!(loot
            .inventory(1)
            .unwrap()
            .equipped(EquipmentSlot::Head)
            .is_some());
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn typed_ground_pickup_preserves_magic_and_rejects_replay_after_recovery() {
        use crate::magic::{Lesson, LessonAward, LessonSource, Rune};
        use crate::magic_checkpoint::load_joint;
        use std::num::NonZeroU64;

        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 210.0, 200.0, 0.0);
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let winner = CharacterId::new(202).unwrap();
        identity
            .bind_verified(lease(1), CharacterId::new(101).unwrap())
            .unwrap();
        identity.bind_verified(lease(2), winner).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let gold = loot.grant(1, ItemKind::Gold, 9).unwrap();
        let ground = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, gold, 0)
            .unwrap();
        let mut magic = MagicAuthority::new();
        magic
            .grant_lesson(LessonAward {
                receipt: NonZeroU64::new(1).unwrap(),
                character: winner,
                source: LessonSource::NpcTeacher,
                lesson: Lesson::Rune(Rune::Fire),
            })
            .unwrap();
        let checkpoint = checkpoint_path();
        let op = VerifiedLootOperation {
            lease: lease(2),
            sequence: 7,
        };
        let pick = VerifiedPickupSelection::Ground {
            entity_id: ground,
            amount: 3,
        };
        let tick = PickupWorldTick {
            world: &world,
            completed_tick: world.tick,
            zones: &zones,
        };
        let taken =
            commit_verified_pickup(&checkpoint, &mut loot, &magic, &identity, tick, op, pick)
                .unwrap();
        assert_eq!(taken.amount, 3);
        assert_eq!(loot.ground()[&ground].item.amount, 6);
        assert_eq!(loot.inventory(2).unwrap().backpack()[0].id, taken.id);
        assert_eq!(loot.committed_operation_sequence(winner), Some(7));

        let (stored_loot, stored_magic) = load_joint(&checkpoint).unwrap();
        assert!(stored_magic.knows_rune(winner, Rune::Fire));
        assert_eq!(stored_loot.ground()[&ground].item.amount, 6);
        assert_eq!(
            stored_loot.parked_inventory(winner).unwrap().backpack()[0].id,
            taken.id
        );
        assert_eq!(stored_loot.committed_operation_sequence(winner), Some(7));
        let replay = commit_verified_pickup(
            &checkpoint,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            op,
            pick,
        );
        assert!(matches!(
            replay,
            Err(PickupCommitError::Loot(LootError::ReplayOperation))
        ));
        assert_eq!(loot.ground()[&ground].item.amount, 6);
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn typed_pickup_rejects_stale_session_world_and_mismatched_zone() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 210.0, 200.0, 0.0);
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(202).unwrap();
        identity.bind_verified(lease(2), character).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(2).unwrap();
        let magic = MagicAuthority::new();
        let checkpoint = checkpoint_path();
        let request = VerifiedPickupSelection::Ground {
            entity_id: 88,
            amount: 1,
        };
        let operation = VerifiedLootOperation {
            lease: lease(2),
            sequence: 1,
        };

        assert!(matches!(
            commit_verified_pickup(
                &checkpoint,
                &mut loot,
                &magic,
                &identity,
                PickupWorldTick {
                    world: &world,
                    completed_tick: world.tick + 1,
                    zones: &zones
                },
                operation,
                request,
            ),
            Err(PickupCommitError::StaleWorldTick)
        ));
        assert!(matches!(
            commit_verified_pickup(
                &checkpoint,
                &mut loot,
                &magic,
                &identity,
                PickupWorldTick {
                    world: &world,
                    completed_tick: world.tick,
                    zones: &zones
                },
                VerifiedLootOperation {
                    lease: SessionLease::new(2, 2).unwrap(),
                    sequence: 1
                },
                request,
            ),
            Err(PickupCommitError::UnverifiedSession)
        ));
        world.now_ms = f32::MAX;
        assert!(matches!(
            commit_verified_pickup(
                &checkpoint,
                &mut loot,
                &magic,
                &identity,
                PickupWorldTick {
                    world: &world,
                    completed_tick: world.tick,
                    zones: &zones
                },
                operation,
                request,
            ),
            Err(PickupCommitError::InvalidWorldTime)
        ));
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert!(!checkpoint.exists());
    }

    #[test]
    fn typed_pickup_failed_checkpoint_does_not_publish_item_or_watermark() {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 210.0, 200.0, 0.0);
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(202).unwrap();
        identity
            .bind_verified(lease(1), CharacterId::new(101).unwrap())
            .unwrap();
        identity.bind_verified(lease(2), character).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let id = loot.grant(1, ItemKind::Gold, 2).unwrap();
        let ground = loot
            .drop_backpack(1, world.fighter(1).unwrap(), ZoneId::Moonvale, id, 0)
            .unwrap();
        let magic = MagicAuthority::new();
        let checkpoint = checkpoint_path();
        let missing = checkpoint.with_extension("missing-parent").join("state");
        let op = VerifiedLootOperation {
            lease: lease(2),
            sequence: 9,
        };
        let selection = VerifiedPickupSelection::Ground {
            entity_id: ground,
            amount: 2,
        };
        let result = commit_verified_pickup(
            &missing,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            op,
            selection,
        );
        assert!(matches!(
            result,
            Err(PickupCommitError::Io(CheckpointError::Io(_)))
        ));
        assert!(loot.inventory(2).unwrap().backpack().is_empty());
        assert_eq!(loot.ground()[&ground].item.amount, 2);
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert!(!missing.exists());

        let item = commit_verified_pickup(
            &checkpoint,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            op,
            selection,
        )
        .unwrap();
        assert_eq!(item.amount, 2);
        assert!(!loot.ground().contains_key(&ground));
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn two_looters_cannot_claim_same_corpse_item_and_recovery_keeps_winner() {
        use crate::magic_checkpoint::load_joint;
        use crate::simulation::Action;

        // Offline domain fixture: the actual Combat World/HP transaction is
        // not integrated here. Only the typed pickup gate is under test.
        let mut world = World::new(800.0, 600.0);
        for (id, x, y) in [(1, 200.0, 200.0), (2, 210.0, 200.0), (3, 220.0, 200.0)] {
            assert!(world.add_player_at(id, x, y, 0.0));
        }
        let mut zones = ZoneAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut loot = LootAuthority::new();
        for id in 1..=3 {
            zones.register(id).unwrap();
            loot.register(id).unwrap();
            identity
                .bind_verified(lease(id), CharacterId::new(u64::from(id)).unwrap())
                .unwrap();
        }

        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let mut victim = world.fighter(1).unwrap().clone();
        victim.action = Action::Dead;
        victim.hp = 0.0;
        let corpse = loot.death(1, &victim, ZoneId::Moonvale, 0).unwrap();
        assert_eq!(loot.corpses()[&corpse].items[0].id, sword);
        let selection = VerifiedPickupSelection::Corpse {
            selection: CorpseItemRef {
                corpse_id: corpse,
                item_id: sword,
            },
            amount: 1,
        };
        let magic = MagicAuthority::new();
        let checkpoint = checkpoint_path();
        let winner = CharacterId::new(2).unwrap();
        let other = CharacterId::new(3).unwrap();

        let taken = commit_verified_pickup(
            &checkpoint,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(2),
                sequence: 1,
            },
            selection,
        )
        .unwrap();
        assert_eq!(taken.id, sword);
        assert!(loot.corpses()[&corpse].items.is_empty());

        let loser = commit_verified_pickup(
            &checkpoint,
            &mut loot,
            &magic,
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(3),
                sequence: 1,
            },
            selection,
        );
        assert!(matches!(
            loser,
            Err(PickupCommitError::Loot(LootError::NotFound))
        ));
        assert_eq!(loot.committed_operation_sequence(winner), Some(1));
        assert_eq!(loot.committed_operation_sequence(other), None);
        assert!(loot.inventory(3).unwrap().backpack().is_empty());

        let (stored, _) = load_joint(&checkpoint).unwrap();
        assert!(stored.corpses()[&corpse].items.is_empty());
        assert_eq!(
            stored.parked_inventory(winner).unwrap().backpack()[0].id,
            sword
        );
        assert!(stored
            .parked_inventory(other)
            .unwrap()
            .backpack()
            .is_empty());
        assert_eq!(stored.committed_operation_sequence(other), None);
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn distant_looter_cannot_consume_corpse_item_or_operation_sequence() {
        use crate::simulation::Action;

        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.add_player_at(2, 500.0, 500.0, 0.0);
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        zones.register(2).unwrap();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(22).unwrap();
        identity
            .bind_verified(lease(1), CharacterId::new(11).unwrap())
            .unwrap();
        identity.bind_verified(lease(2), character).unwrap();
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let sword = loot.grant(1, ItemKind::RustySword, 1).unwrap();
        let mut victim = world.fighter(1).unwrap().clone();
        victim.action = Action::Dead;
        victim.hp = 0.0;
        let corpse = loot.death(1, &victim, ZoneId::Moonvale, 0).unwrap();
        let checkpoint = checkpoint_path();
        let result = commit_verified_pickup(
            &checkpoint,
            &mut loot,
            &MagicAuthority::new(),
            &identity,
            PickupWorldTick {
                world: &world,
                completed_tick: world.tick,
                zones: &zones,
            },
            VerifiedLootOperation {
                lease: lease(2),
                sequence: 42,
            },
            VerifiedPickupSelection::Corpse {
                selection: CorpseItemRef {
                    corpse_id: corpse,
                    item_id: sword,
                },
                amount: 1,
            },
        );
        assert!(matches!(
            result,
            Err(PickupCommitError::Loot(LootError::OutOfReach))
        ));
        assert_eq!(loot.corpses()[&corpse].items[0].id, sword);
        assert!(loot.inventory(2).unwrap().backpack().is_empty());
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert!(!checkpoint.exists());
    }

    #[test]
    fn replay_sequence_is_rejected_even_after_disk_recovery() {
        let mut loot = LootAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(888).unwrap();
        identity.bind_verified(lease(1), character).unwrap();
        loot.register(1).unwrap();
        let path = checkpoint_path();
        let operation = VerifiedLootOperation {
            lease: lease(1),
            sequence: 21,
        };
        let item_id = transact_operation(&path, &mut loot, &identity, operation, |staged| {
            staged.grant(1, ItemKind::Gold, 5)
        })
        .unwrap();
        assert_eq!(loot.committed_operation_sequence(character), Some(21));
        let replay = transact_operation(&path, &mut loot, &identity, operation, |staged| {
            staged.grant(1, ItemKind::Gold, 5)
        });
        assert!(matches!(
            replay,
            Err(TransactionError::Loot(LootError::ReplayOperation))
        ));
        let mut recovered = load_quiescent(&path).unwrap();
        assert_eq!(recovered.committed_operation_sequence(character), Some(21));
        assert_eq!(identity.release_session(lease(1)), Some(character));
        let reconnect = SessionLease::new(2, 1).unwrap();
        identity.bind_verified(reconnect, character).unwrap();
        recovered.resume_inventory(&identity, reconnect).unwrap();
        let replay_after_recovery = transact_operation(
            &path,
            &mut recovered,
            &identity,
            VerifiedLootOperation {
                lease: reconnect,
                sequence: 21,
            },
            |staged| staged.grant(2, ItemKind::Gold, 5),
        );
        assert!(matches!(
            replay_after_recovery,
            Err(TransactionError::Loot(LootError::ReplayOperation))
        ));
        assert_eq!(recovered.inventory(2).unwrap().backpack()[0].id, item_id);
        assert_eq!(recovered.inventory(2).unwrap().backpack().len(), 1);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn failed_mutations_do_not_advance_committed_sequence() {
        let mut loot = LootAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(889).unwrap();
        identity.bind_verified(lease(1), character).unwrap();
        loot.register(1).unwrap();
        let path = checkpoint_path();
        let operation = VerifiedLootOperation {
            lease: lease(1),
            sequence: 8,
        };
        let rejected: Result<u64, TransactionError> =
            transact_operation(&path, &mut loot, &identity, operation, |_staged| {
                Err(LootError::InvalidStack)
            });
        assert!(matches!(
            rejected,
            Err(TransactionError::Loot(LootError::InvalidStack))
        ));
        assert_eq!(loot.committed_operation_sequence(character), None);
        let invalid_path = path.with_extension("missing-parent").join("file.bin");
        let rejected_write =
            transact_operation(&invalid_path, &mut loot, &identity, operation, |staged| {
                staged.grant(1, ItemKind::Gold, 2)
            });
        assert!(matches!(
            rejected_write,
            Err(TransactionError::Checkpoint(CheckpointError::Io(_)))
        ));
        assert_eq!(loot.committed_operation_sequence(character), None);
        let item_id = transact_operation(&path, &mut loot, &identity, operation, |staged| {
            staged.grant(1, ItemKind::Gold, 2)
        })
        .unwrap();
        assert_eq!(item_id, 1);
        assert_eq!(loot.committed_operation_sequence(character), Some(8));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn live_mutation_saves_offline_character_recovery_copy() {
        let mut loot = LootAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let character = CharacterId::new(100).unwrap();
        identity.bind_verified(lease(1), character).unwrap();
        loot.register(1).unwrap();
        let path = checkpoint_path();
        let id = transact_verified(&path, &mut loot, &identity, |staged| {
            staged.grant(1, ItemKind::Gold, 17)
        })
        .unwrap();
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].id, id);
        assert!(loot.parked_inventory(character).is_none());

        let recovered = load_quiescent(&path).unwrap();
        assert!(recovered.inventory(1).is_none());
        assert_eq!(
            recovered.parked_inventory(character).unwrap().backpack()[0].id,
            id
        );
        assert_eq!(
            recovered.parked_inventory(character).unwrap().backpack()[0].amount,
            17
        );
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn rejected_action_and_io_failure_never_publish_or_advance_ids() {
        let mut loot = LootAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(1), CharacterId::new(101).unwrap())
            .unwrap();
        loot.register(1).unwrap();
        let path = checkpoint_path();

        let rejected: Result<(), TransactionError> =
            transact_verified(&path, &mut loot, &identity, |staged| {
                staged.grant(1, ItemKind::Gold, 5)?;
                Err(LootError::InvalidStack)
            });
        assert!(matches!(
            rejected,
            Err(TransactionError::Loot(LootError::InvalidStack))
        ));
        assert!(loot.inventory(1).unwrap().backpack().is_empty());
        assert!(!path.exists());

        let missing = path.with_extension("missing-parent").join("state");
        let failure = transact_verified(&missing, &mut loot, &identity, |staged| {
            staged.grant(1, ItemKind::Gold, 5)
        });
        assert!(matches!(
            failure,
            Err(TransactionError::Checkpoint(CheckpointError::Io(_)))
        ));
        assert!(loot.inventory(1).unwrap().backpack().is_empty());
        assert!(!missing.exists());

        let committed = transact_verified(&path, &mut loot, &identity, |staged| {
            staged.grant(1, ItemKind::Gold, 5)
        })
        .unwrap();
        assert_eq!(committed, 1);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn unverified_or_inconsistent_sessions_cannot_commit() {
        let mut loot = LootAuthority::new();
        loot.register(1).unwrap();
        let no_identity = SessionIdentityRegistry::new();
        let path = checkpoint_path();
        let rejected = transact_verified(&path, &mut loot, &no_identity, |staged| {
            staged.grant(1, ItemKind::Gold, 2)
        });
        assert!(matches!(
            rejected,
            Err(TransactionError::UnverifiedOwnership)
        ));
        assert!(loot.inventory(1).unwrap().backpack().is_empty());
        assert!(!path.exists());

        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(2), CharacterId::new(22).unwrap())
            .unwrap();
        let rejected = transact_verified(&path, &mut loot, &identity, |staged| {
            staged.grant(1, ItemKind::Gold, 3)
        });
        assert!(matches!(
            rejected,
            Err(TransactionError::UnverifiedOwnership)
        ));
        assert!(loot.inventory(1).unwrap().backpack().is_empty());
        assert!(!path.exists());
    }

    #[test]
    fn free_for_all_ground_pickup_is_saved_once_and_stale_retry_fails() {
        let mut loot = LootAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        identity
            .bind_verified(lease(1), CharacterId::new(1).unwrap())
            .unwrap();
        identity
            .bind_verified(lease(2), CharacterId::new(2).unwrap())
            .unwrap();
        loot.register(1).unwrap();
        loot.register(2).unwrap();
        let path = checkpoint_path();
        let drop_id = transact_verified(&path, &mut loot, &identity, |staged| {
            let item_id = staged.grant(1, ItemKind::Gold, 9)?;
            staged.drop_backpack(1, &fighter(1), ZoneId::Moonvale, item_id, 10)
        })
        .unwrap();
        let taken: ItemStack = transact_verified(&path, &mut loot, &identity, |staged| {
            staged.take_ground(2, &fighter(2), ZoneId::Moonvale, drop_id, 11)
        })
        .unwrap();
        assert_eq!(taken.amount, 9);
        assert!(!loot.ground().contains_key(&drop_id));

        let again = transact_verified(&path, &mut loot, &identity, |staged| {
            staged.take_ground(1, &fighter(1), ZoneId::Moonvale, drop_id, 12)
        });
        assert!(matches!(
            again,
            Err(TransactionError::Loot(LootError::NotFound))
        ));
        let restored = load_quiescent(&path).unwrap();
        assert!(!restored.ground().contains_key(&drop_id));
        assert_eq!(
            restored
                .parked_inventory(CharacterId::new(2).unwrap())
                .unwrap()
                .backpack()[0]
                .id,
            taken.id
        );
        let _ = fs::remove_file(&path);
    }
}
