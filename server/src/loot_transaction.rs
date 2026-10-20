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
    CorpseItemRef, ItemStack, LootAuthority, LootError, LootStateSnapshot, ParkedInventory,
};
use crate::loot_persistence::{atomic_write, save_quiescent, CheckpointError};
use crate::magic::MagicAuthority;
use crate::magic_checkpoint::{bundle, JointCheckpointError};
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

/// Stage one mutation, validate the whole resulting loot world, save an
/// authenticated-character-keyed recovery copy, THEN publish the live copy.
///
/// This method does not lock anything. The caller MUST serialize it with all
/// world actions, session binding changes, combat deaths, and disconnects.
/// Action closures must have no effects outside the staged LootAuthority,
/// including messages, remote writes or player mutations in other services.
/// This is a stepping stone, not a safe live per-action protocol.
pub fn transact_verified<T, F>(
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

/// Stage and checkpoint both the committed sequence and the loot mutation.
/// A lower or equal sequence is rejected, including after checkpoint recovery.
/// The caller must serialize actions and binding changes under one world lock.
pub fn transact_operation<T, F>(
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
    Loot(LootError),
    JointCheckpoint(JointCheckpointError),
    Io(CheckpointError),
}

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
pub fn commit_verified_pickup(
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
        assert!(matches!(loser, Err(PickupCommitError::Loot(LootError::NotFound))));
        assert_eq!(loot.committed_operation_sequence(winner), Some(1));
        assert_eq!(loot.committed_operation_sequence(other), None);
        assert!(loot.inventory(3).unwrap().backpack().is_empty());

        let (stored, _) = load_joint(&checkpoint).unwrap();
        assert!(stored.corpses()[&corpse].items.is_empty());
        assert_eq!(stored.parked_inventory(winner).unwrap().backpack()[0].id, sword);
        assert!(stored.parked_inventory(other).unwrap().backpack().is_empty());
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
        identity.bind_verified(lease(1), CharacterId::new(11).unwrap()).unwrap();
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
        assert!(matches!(result, Err(PickupCommitError::Loot(LootError::OutOfReach))));
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
