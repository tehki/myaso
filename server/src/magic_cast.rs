//! Ember resource commit only: no projectile, hit or live cast protocol.
//! Called only from a trusted serialized world tick, never a client handler.
//! Requires a single world lock over combat, identity, loot and magic state.
//! On post-rename fsync errors, the disk/memory result is indeterminate until
//! reconciled; production must add a durable journal and effect coordination.
use crate::character_identity::{CharacterId, SessionIdentityRegistry};
use crate::loot::{LootAuthority, LootError};
use crate::loot_persistence::{atomic_write, CheckpointError};
use crate::loot_transaction::VerifiedLootOperation;
use crate::magic::{MagicAuthority, MagicError, Spell};
use crate::magic_checkpoint::{bundle, JointCheckpointError};
use crate::simulation::{Action, Fighter};
use crate::zone::{ZoneAuthority, ZoneId};
use std::path::Path;

#[derive(Debug)]
pub enum CastError {
    UnverifiedSession,
    WrongFighter,
    UnknownZone,
    CombatLocked,
    InvalidPosition,
    Loot(LootError),
    Magic(MagicError),
    Checkpoint(JointCheckpointError),
    Io(CheckpointError),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmberCostReceipt {
    pub character: CharacterId,
    pub sequence: u64,
    pub zone: ZoneId,
    pub mana_spent: u16,
    pub sulfur_ash_spent: u16,
}

/// Validates authoritative Fighter and Zone, then stages replay watermark,
/// physical reagent consumption and mana spend in one joint checkpoint.
/// Receipt records cost only; it is NOT proof of a projectile or damage.
/// Caller must not mutate any other world component while this executes.
pub fn commit_ember_cost(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    op: VerifiedLootOperation,
    fighter: &Fighter,
) -> Result<EmberCostReceipt, CastError> {
    let character = identity
        .resolve_session(op.lease)
        .ok_or(CastError::UnverifiedSession)?;
    let session = op.lease.server_session();
    if fighter.net_id != session {
        return Err(CastError::WrongFighter);
    }
    let zone = zones.zone_of(session).ok_or(CastError::UnknownZone)?;
    if fighter.action != Action::Idle || fighter.hp <= 0.0 || loot.is_dead(session) {
        return Err(CastError::CombatLocked);
    }
    let (width, height) = zone.bounds();
    if !fighter.x.is_finite()
        || !fighter.y.is_finite()
        || fighter.x < 18.0
        || fighter.y < 18.0
        || fighter.x > width - 18.0
        || fighter.y > height - 18.0
    {
        return Err(CastError::InvalidPosition);
    }
    let mut staged_loot =
        LootAuthority::restore_state(loot.export_state().map_err(CastError::Loot)?)
            .map_err(CastError::Loot)?;
    let mut staged_magic = magic.clone();
    staged_loot
        .record_operation(character, op.sequence)
        .map_err(CastError::Loot)?;
    let plan = staged_magic
        .preview_cast(op.lease, identity, &staged_loot, Spell::Ember)
        .map_err(CastError::Magic)?;
    staged_loot
        .consume_reagent(session, plan.reagent, plan.reagent_amount)
        .map_err(CastError::Loot)?;
    staged_magic
        .spend_mana(character, plan.mana_cost)
        .map_err(CastError::Magic)?;
    let bytes = bundle(&staged_loot, identity, &staged_magic).map_err(CastError::Checkpoint)?;
    atomic_write(path, &bytes).map_err(CastError::Io)?;
    *loot = staged_loot;
    *magic = staged_magic;
    Ok(EmberCostReceipt {
        character,
        sequence: op.sequence,
        zone,
        mana_spent: plan.mana_cost,
        sulfur_ash_spent: plan.reagent_amount,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::SessionLease;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonAward, LessonSource, Rune};
    use crate::magic_checkpoint::load_joint;
    use crate::simulation::World;
    use std::fs;
    use std::num::NonZeroU64;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQUENCE: AtomicU64 = AtomicU64::new(1);

    fn path() -> std::path::PathBuf {
        let index = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("myaso-ember-{}-{index}.bin", std::process::id()))
    }

    fn op(sequence: u64) -> VerifiedLootOperation {
        VerifiedLootOperation {
            lease: SessionLease::new(1, 1).unwrap(),
            sequence,
        }
    }

    fn actor() -> Fighter {
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.fighter(1).unwrap().clone()
    }

    fn setup() -> (
        LootAuthority,
        MagicAuthority,
        SessionIdentityRegistry,
        ZoneAuthority,
        CharacterId,
    ) {
        let mut loot = LootAuthority::new();
        let mut magic = MagicAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let mut zones = ZoneAuthority::new();
        let character = CharacterId::new(500).unwrap();
        identity.bind_verified(op(1).lease, character).unwrap();
        zones.register(1).unwrap();
        loot.register(1).unwrap();
        for (receipt, lesson) in [
            (1, Lesson::Rune(Rune::Fire)),
            (2, Lesson::Spell(Spell::Ember)),
        ] {
            magic
                .grant_lesson(LessonAward {
                    receipt: NonZeroU64::new(receipt).unwrap(),
                    character,
                    source: LessonSource::NpcTeacher,
                    lesson,
                })
                .unwrap();
        }
        (loot, magic, identity, zones, character)
    }

    fn stock(loot: &mut LootAuthority, quantity: u16) {
        let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
        loot.grant(1, ItemKind::SulfurAsh, quantity).unwrap();
    }

    #[test]
    fn ember_spend_and_replay_watermark_survive_joint_recovery() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        stock(&mut loot, 3);
        let file = path();
        let fighter = actor();
        for (sequence, expected) in [(10, 85), (11, 70)] {
            let receipt = commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(sequence),
                &fighter,
            )
            .unwrap();
            assert_eq!(receipt.mana_spent, 15);
            assert_eq!(receipt.sulfur_ash_spent, 1);
            assert_eq!(magic.mana(character), expected);
        }
        assert!(matches!(
            commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(11),
                &fighter,
            ),
            Err(CastError::Loot(LootError::ReplayOperation))
        ));
        let (recovered_loot, recovered_magic) = load_joint(&file).unwrap();
        assert_eq!(recovered_magic.mana(character), 70);
        assert_eq!(
            recovered_loot.committed_operation_sequence(character),
            Some(11)
        );
        assert_eq!(
            recovered_loot
                .parked_inventory(character)
                .unwrap()
                .backpack()[0]
                .amount,
            1
        );
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 1);
        let _ = fs::remove_file(&file);
    }

    #[test]
    fn invalid_actor_and_missing_spellbook_or_reagent_never_commit() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        let file = path();
        let mut wrong = actor();
        wrong.net_id = 99;
        assert!(matches!(
            commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(1),
                &wrong,
            ),
            Err(CastError::WrongFighter)
        ));
        let mut dead = actor();
        dead.action = Action::Dead;
        assert!(matches!(
            commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(1),
                &dead,
            ),
            Err(CastError::CombatLocked)
        ));
        assert!(matches!(
            commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(1),
                &actor(),
            ),
            Err(CastError::Magic(MagicError::MissingSpellbook))
        ));
        stock(&mut loot, 1);
        commit_ember_cost(
            &file,
            &mut loot,
            &mut magic,
            &identity,
            &zones,
            op(1),
            &actor(),
        )
        .unwrap();
        assert!(matches!(
            commit_ember_cost(
                &file,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(2),
                &actor(),
            ),
            Err(CastError::Magic(MagicError::MissingReagent))
        ));
        assert_eq!(magic.mana(character), 85);
        assert_eq!(loot.committed_operation_sequence(character), Some(1));
        let _ = fs::remove_file(&file);
    }

    #[test]
    fn failed_precommit_write_does_not_spend_mana_reagent_or_sequence() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        stock(&mut loot, 2);
        let file = path();
        let impossible = file.with_extension("no-parent").join("loot.bin");
        assert!(matches!(
            commit_ember_cost(
                &impossible,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                op(1),
                &actor(),
            ),
            Err(CastError::Io(CheckpointError::Io(_)))
        ));
        assert_eq!(magic.mana(character), 100);
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 2);
        assert!(!file.exists());
    }
}
