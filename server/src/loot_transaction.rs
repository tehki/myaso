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
use crate::loot::{LootAuthority, LootError, LootStateSnapshot, ParkedInventory};
use crate::loot_persistence::{save_quiescent, CheckpointError};

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::{CharacterId, SessionLease};
    use crate::loot::{ItemKind, ItemStack};
    use crate::loot_persistence::load_quiescent;
    use crate::simulation::World;
    use crate::zone::ZoneId;
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
