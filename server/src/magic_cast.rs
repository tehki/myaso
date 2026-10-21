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
use crate::simulation::{Action, Fighter, World};
use crate::zone::{ZoneAuthority, ZoneId};
use std::path::Path;

#[derive(Debug)]
pub enum CastError {
    UnverifiedSession,
    StaleWorldTick,
    MissingWorldFighter,
    InvalidWorldTime,
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
    if fighter.action != Action::Idle
        || !fighter.hp.is_finite()
        || fighter.hp <= 0.0
        || loot.is_dead(session)
    {
        return Err(CastError::CombatLocked);
    }
    let (width, height) = zone.bounds();
    if !fighter.x.is_finite()
        || !fighter.y.is_finite()
        || !fighter.facing.is_finite()
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
    staged_magic
        .stage_ember_intent(
            character,
            op.sequence,
            zone,
            fighter.x,
            fighter.y,
            fighter.facing,
        )
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

/// Non-activated adapter for an authenticated, serialized World writer.
/// The operation lease and sequence must be minted/validated by Core, and the
/// World must be the exact same completed authoritative tick as the inventory
/// and zone snapshot. No client-supplied Fighter, position or heading is used.
#[derive(Clone, Copy)]
pub struct WorldEmberCostTick<'a> {
    pub operation: VerifiedLootOperation,
    pub world: &'a World,
    pub completed_tick: u32,
}

/// Record a durable Ember cost + pending intent using the actual World Fighter.
/// A resource receipt is NOT a spell hit, Combat receipt or projectile event.
/// This adapter cannot itself prove a world lock, event provenance or durable
/// Combat effect atomicity; Core 8B/8C integration remains a release blocker.
pub fn commit_world_ember_cost(
    path: &Path,
    loot: &mut LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    tick: WorldEmberCostTick<'_>,
) -> Result<EmberCostReceipt, CastError> {
    if tick.completed_tick == 0 || tick.world.tick != tick.completed_tick {
        return Err(CastError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite()
        || tick.world.now_ms < 0.0
        || tick.world.now_ms >= u64::MAX as f32
    {
        return Err(CastError::InvalidWorldTime);
    }
    let fighter = tick
        .world
        .fighter(tick.operation.lease.server_session())
        .ok_or(CastError::MissingWorldFighter)?;
    commit_ember_cost(path, loot, magic, identity, zones, tick.operation, fighter)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::SessionLease;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonAward, LessonSource, Rune};
    use crate::magic_checkpoint::{
        inspect_joint_ember_recovery_holds, load_joint, load_joint_without_pending_ember,
        transact_world_teacher_lesson, EmberRecoveryHold, WorldTeacherTick,
    };
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
    fn npc_world_lesson_paid_cast_real_knockdown_and_restart_keep_one_outcome() {
        use crate::magic_combat_interrupt::{
            record_world_ember_combat_interruption, WorldCombatInterruption,
        };
        use crate::magic_teacher::{TeacherAuthority, TeacherId, TeacherSpawn};
        use crate::simulation::InputIntent;
        use crate::zone::Position;

        let (mut loot, _, identity, mut zones, character) = setup();
        let mut magic = MagicAuthority::new();
        stock(&mut loot, 2);
        zones.register(2).unwrap();
        let mut teachers = TeacherAuthority::new();
        for (id, lesson) in [
            (301, Lesson::Rune(Rune::Fire)),
            (302, Lesson::Spell(Spell::Ember)),
        ] {
            teachers
                .register_trusted(TeacherSpawn {
                    id: TeacherId::new(id).unwrap(),
                    zone: ZoneId::Moonvale,
                    at: Position { x: 200.0, y: 200.0 },
                    lesson,
                })
                .unwrap();
        }

        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        world.step();
        let checkpoint = path();
        let lease = op(45).lease;
        for teacher in [301, 302] {
            transact_world_teacher_lesson(
                &checkpoint,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher: TeacherId::new(teacher).unwrap(),
                    world: &world,
                    completed_tick: world.tick,
                },
            )
            .unwrap();
        }
        assert!(magic.knows_rune(character, Rune::Fire));
        assert!(magic.knows_spell(character, Spell::Ember));
        assert_eq!(magic.mana(character), 100);

        let receipt = commit_world_ember_cost(
            &checkpoint,
            &mut loot,
            &mut magic,
            &identity,
            &zones,
            WorldEmberCostTick {
                operation: op(45),
                world: &world,
                completed_tick: world.tick,
            },
        )
        .unwrap();
        assert_eq!(receipt.mana_spent, 15);
        assert_eq!(receipt.sulfur_ash_spent, 1);
        assert_eq!(magic.mana(character), 85);
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 1);
        assert_eq!(
            inspect_joint_ember_recovery_holds(&checkpoint).unwrap().len(),
            1
        );

        assert!(world.add_player_at(2, 242.0, 200.0, std::f32::consts::PI));
        assert!(world.set_input(
            2,
            InputIntent {
                kick: true,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        for _ in 0..7 {
            world.step_by(35.0);
            if world.fighter(1).unwrap().action == Action::Knockdown {
                break;
            }
        }
        assert_eq!(world.fighter(1).unwrap().action, Action::Knockdown);
        let result = record_world_ember_combat_interruption(
            &checkpoint,
            &loot,
            &mut magic,
            &identity,
            &zones,
            WorldCombatInterruption {
                lease,
                sequence: 45,
                world: &world,
                completed_tick: world.tick,
            },
        );
        assert!(matches!(result, Ok(crate::magic::EmberEffectStatus::Interrupted)));
        assert!(inspect_joint_ember_recovery_holds(&checkpoint)
            .unwrap()
            .is_empty());
        let (restored_loot, restored_magic) =
            load_joint_without_pending_ember(&checkpoint).unwrap();
        assert_eq!(restored_magic.mana(character), 85);
        assert!(restored_magic.knows_rune(character, Rune::Fire));
        assert!(restored_magic.knows_spell(character, Spell::Ember));
        assert_eq!(restored_magic.pending_ember_intents().count(), 0);
        assert_eq!(restored_magic.resolved_ember_intents().count(), 1);
        assert_eq!(restored_loot.committed_operation_sequence(character), Some(45));
        assert_eq!(
            restored_loot.parked_inventory(character).unwrap().backpack()[0].amount,
            1
        );
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn world_tick_ember_spend_and_replay_survive_joint_recovery() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        stock(&mut loot, 3);
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.step();
        let checkpoint = path();
        let tick = WorldEmberCostTick {
            operation: op(45),
            world: &world,
            completed_tick: world.tick,
        };
        let receipt =
            commit_world_ember_cost(&checkpoint, &mut loot, &mut magic, &identity, &zones, tick)
                .unwrap();
        assert_eq!(receipt.mana_spent, 15);
        assert_eq!(receipt.sulfur_ash_spent, 1);
        assert_eq!(magic.mana(character), 85);
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 2);
        assert!(matches!(
            commit_world_ember_cost(&checkpoint, &mut loot, &mut magic, &identity, &zones, tick,),
            Err(CastError::Loot(LootError::ReplayOperation))
        ));
        let (recovered_loot, recovered_magic) = load_joint(&checkpoint).unwrap();
        assert_eq!(
            recovered_loot.committed_operation_sequence(character),
            Some(45)
        );
        assert_eq!(
            recovered_loot
                .parked_inventory(character)
                .unwrap()
                .backpack()[0]
                .amount,
            2
        );
        assert_eq!(recovered_magic.mana(character), 85);
        let intent = recovered_magic.pending_ember_intents().next().unwrap();
        assert_eq!(intent.origin_x(), 200.0);
        assert_eq!(intent.origin_y(), 200.0);
        assert_eq!(intent.sequence, 45);
        assert_eq!(recovered_magic.pending_ember_intents().count(), 1);
        assert_eq!(
            inspect_joint_ember_recovery_holds(&checkpoint).unwrap(),
            vec![EmberRecoveryHold {
                character,
                sequence: 45,
                zone: ZoneId::Moonvale,
            }]
        );
        assert!(matches!(
            load_joint_without_pending_ember(&checkpoint),
            Err(JointCheckpointError::UnreconciledEmberEffects)
        ));
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 2);
        let _ = fs::remove_file(&checkpoint);
    }

    #[test]
    fn world_tick_ember_rejects_stale_world_time_and_unverified_actor_without_spending() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        stock(&mut loot, 2);
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.step();
        let checkpoint = path();
        for tick_number in [0, world.tick + 1] {
            assert!(matches!(
                commit_world_ember_cost(
                    &checkpoint,
                    &mut loot,
                    &mut magic,
                    &identity,
                    &zones,
                    WorldEmberCostTick {
                        operation: op(12),
                        world: &world,
                        completed_tick: tick_number,
                    },
                ),
                Err(CastError::StaleWorldTick)
            ));
        }
        let mut empty_world = World::new(800.0, 600.0);
        empty_world.step();
        assert!(matches!(
            commit_world_ember_cost(
                &checkpoint,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                WorldEmberCostTick {
                    operation: op(12),
                    world: &empty_world,
                    completed_tick: empty_world.tick,
                },
            ),
            Err(CastError::MissingWorldFighter)
        ));
        for invalid_time in [-1.0, f32::NAN, f32::INFINITY, f32::MAX] {
            let mut invalid_world = world.clone();
            invalid_world.now_ms = invalid_time;
            assert!(matches!(
                commit_world_ember_cost(
                    &checkpoint,
                    &mut loot,
                    &mut magic,
                    &identity,
                    &zones,
                    WorldEmberCostTick {
                        operation: op(12),
                        world: &invalid_world,
                        completed_tick: invalid_world.tick,
                    },
                ),
                Err(CastError::InvalidWorldTime)
            ));
        }
        assert!(matches!(
            commit_world_ember_cost(
                &checkpoint,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                WorldEmberCostTick {
                    operation: VerifiedLootOperation {
                        lease: SessionLease::new(1, 2).unwrap(),
                        sequence: 12,
                    },
                    world: &world,
                    completed_tick: world.tick,
                },
            ),
            Err(CastError::UnverifiedSession)
        ));
        assert!(!checkpoint.exists());
        assert_eq!(magic.mana(character), 100);
        assert_eq!(loot.inventory(1).unwrap().backpack()[0].amount, 2);
        assert_eq!(loot.committed_operation_sequence(character), None);
        assert_eq!(magic.pending_ember_intents().count(), 0);
    }

    #[test]
    fn world_tick_ember_requires_physical_spellbook_and_reagent() {
        let (mut loot, mut magic, identity, zones, character) = setup();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.step();
        let checkpoint = path();
        let tick = WorldEmberCostTick {
            operation: op(30),
            world: &world,
            completed_tick: world.tick,
        };
        assert!(matches!(
            commit_world_ember_cost(&checkpoint, &mut loot, &mut magic, &identity, &zones, tick,),
            Err(CastError::Magic(MagicError::MissingSpellbook))
        ));
        stock(&mut loot, 1);
        let receipt =
            commit_world_ember_cost(&checkpoint, &mut loot, &mut magic, &identity, &zones, tick)
                .unwrap();
        assert_eq!(receipt.sequence, 30);
        assert!(matches!(
            commit_world_ember_cost(
                &checkpoint,
                &mut loot,
                &mut magic,
                &identity,
                &zones,
                WorldEmberCostTick {
                    operation: op(31),
                    ..tick
                },
            ),
            Err(CastError::Magic(MagicError::MissingReagent))
        ));
        assert_eq!(magic.mana(character), 85);
        assert_eq!(loot.committed_operation_sequence(character), Some(30));
        assert_eq!(magic.pending_ember_intents().count(), 1);
        let _ = fs::remove_file(&checkpoint);
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
        assert_eq!(recovered_magic.pending_ember_intents().count(), 2);
        let intents: Vec<_> = recovered_magic.pending_ember_intents().collect();
        assert_eq!(intents[0].sequence, 10);
        assert_eq!(intents[1].sequence, 11);
        assert_eq!(intents[0].origin_x(), 200.0);
        assert_eq!(intents[0].origin_y(), 200.0);
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
        assert_eq!(magic.pending_ember_intents().count(), 0);
    }
}
