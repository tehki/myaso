//! Experimental single-file joint recovery of loot AND earned magic.
//!
//! This is NOT integrated into the live multiplayer server. Caller must hold
//! one authoritative writer lock over combat, inventory, identity, and lesson
//! rewards, and independently verify eligibility of NPC/quest receipts.
//! A failed sync AFTER rename may leave disk ahead of memory: production
//! requires a journal/fencing and crash-reconciliation protocol.
//! Standalone MYASOL03 checkpoints must NEVER overwrite MYWLD002 bundles.
use std::fs;
use std::path::Path;

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::{LootAuthority, LootError};
use crate::loot_persistence::{
    atomic_write, checksum, decode, encode, CheckpointError, MAX_FILE_BYTES,
};
use crate::loot_transaction::{quiescent_verified, TransactionError};
use crate::magic::{
    EmberEffectStatus, LessonAward, MagicAuthority, MagicError, MagicSnapshotError,
};
use crate::magic_teacher::{TeacherAuthority, TeacherError, TeacherId, TeacherRequest};
use crate::simulation::World;
use crate::zone::ZoneAuthority;

const HEADER: &[u8; 8] = b"MYWLD003";
const MAGIC_MAX_BYTES: usize = 1024 * 1024;
const MAX_BUNDLE_BYTES: usize = MAX_FILE_BYTES + MAGIC_MAX_BYTES + 24;

#[derive(Debug)]
pub enum JointCheckpointError {
    Io(std::io::Error),
    Loot(LootError),
    Checkpoint(CheckpointError),
    Transaction(TransactionError),
    Magic(MagicError),
    MagicSnapshot(MagicSnapshotError),
    UnverifiedCharacter,
    StaleWorldTick,
    MissingWorldFighter,
    InvalidWorldTime,
    Teacher(TeacherError),
    WrongZone,
    Corrupt,
}

impl From<std::io::Error> for JointCheckpointError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<LootError> for JointCheckpointError {
    fn from(error: LootError) -> Self {
        Self::Loot(error)
    }
}

impl From<CheckpointError> for JointCheckpointError {
    fn from(error: CheckpointError) -> Self {
        Self::Checkpoint(error)
    }
}

impl From<TransactionError> for JointCheckpointError {
    fn from(error: TransactionError) -> Self {
        Self::Transaction(error)
    }
}

impl From<MagicError> for JointCheckpointError {
    fn from(error: MagicError) -> Self {
        Self::Magic(error)
    }
}

impl From<MagicSnapshotError> for JointCheckpointError {
    fn from(error: MagicSnapshotError) -> Self {
        Self::MagicSnapshot(error)
    }
}

impl From<TeacherError> for JointCheckpointError {
    fn from(error: TeacherError) -> Self {
        Self::Teacher(error)
    }
}

/// Ensure each pending Ember intent is backed by a committed operation in
/// the same loot state. A forged or partially persisted intent must never
/// become eligible for future Combat resolution after recovery.
fn verify_intent_watermarks(
    loot: &LootAuthority,
    magic: &MagicAuthority,
) -> Result<(), JointCheckpointError> {
    for intent in magic.all_ember_intents() {
        if loot
            .committed_operation_sequence(intent.character)
            .is_none_or(|committed| committed < intent.sequence)
        {
            return Err(JointCheckpointError::Corrupt);
        }
    }
    Ok(())
}

pub(crate) fn bundle(
    loot: &LootAuthority,
    identity: &SessionIdentityRegistry,
    magic: &MagicAuthority,
) -> Result<Vec<u8>, JointCheckpointError> {
    let projected = quiescent_verified(loot.export_state()?, identity)?;
    verify_intent_watermarks(&projected, magic)?;
    let loot_bytes = encode(&projected.export_state()?)?;
    let magic_bytes = magic.encode_progression()?;
    if loot_bytes.len() > MAX_FILE_BYTES || magic_bytes.len() > MAGIC_MAX_BYTES {
        return Err(JointCheckpointError::Corrupt);
    }
    let mut result = Vec::new();
    result.extend_from_slice(HEADER);
    result.extend_from_slice(&(loot_bytes.len() as u32).to_le_bytes());
    result.extend_from_slice(&(magic_bytes.len() as u32).to_le_bytes());
    result.extend_from_slice(&loot_bytes);
    result.extend_from_slice(&magic_bytes);
    let digest = checksum(&result);
    result.extend_from_slice(&digest.to_le_bytes());
    Ok(result)
}

fn unbundle(bytes: &[u8]) -> Result<(LootAuthority, MagicAuthority), JointCheckpointError> {
    if bytes.len() > MAX_BUNDLE_BYTES || bytes.len() < 24 {
        return Err(JointCheckpointError::Corrupt);
    }
    if &bytes[..HEADER.len()] != HEADER {
        return Err(JointCheckpointError::Corrupt);
    }
    let loot_length = u32::from_le_bytes(bytes[8..12].try_into().expect("fixed length")) as usize;
    let magic_length = u32::from_le_bytes(bytes[12..16].try_into().expect("fixed length")) as usize;
    if loot_length > MAX_FILE_BYTES
        || magic_length > MAGIC_MAX_BYTES
        || 16_usize
            .checked_add(loot_length)
            .and_then(|length| length.checked_add(magic_length))
            .and_then(|length| length.checked_add(8))
            != Some(bytes.len())
    {
        return Err(JointCheckpointError::Corrupt);
    }
    let payload_len = bytes.len() - 8;
    let stored = u64::from_le_bytes(bytes[payload_len..].try_into().expect("fixed length"));
    if stored != checksum(&bytes[..payload_len]) {
        return Err(JointCheckpointError::Corrupt);
    }
    let loot_end = 16 + loot_length;
    let loot = LootAuthority::restore_state(decode(&bytes[16..loot_end])?)?;
    let magic = MagicAuthority::decode_progression(&bytes[loot_end..payload_len])?;
    verify_intent_watermarks(&loot, &magic)?;
    Ok((loot, magic))
}

/// Save a complete verified world checkpoint: both physical items and
/// permanent character progression. Requires all active sessions to map
/// to independently authenticated characters; not live-handler wired.
pub fn save_joint(
    path: &Path,
    loot: &LootAuthority,
    identity: &SessionIdentityRegistry,
    magic: &MagicAuthority,
) -> Result<(), JointCheckpointError> {
    let bytes = bundle(loot, identity, magic)?;
    atomic_write(path, &bytes)?;
    Ok(())
}

/// Recover all-or-nothing. A malformed magic ledger never creates loot.
pub fn load_joint(path: &Path) -> Result<(LootAuthority, MagicAuthority), JointCheckpointError> {
    if fs::metadata(path)?.len() > MAX_BUNDLE_BYTES as u64 {
        return Err(JointCheckpointError::Corrupt);
    }
    let bytes = fs::read(path)?;
    unbundle(&bytes)
}

/// Server-internal staged lesson transaction. The trusted admission service
/// supplies the actual connection lease, and teacher/quest service confirms
/// that this character is eligible for this server-minted reward receipt.
///
/// A new lesson and its consumed receipt become visible in memory only after
/// a single combined loot+magic checkpoint succeeds. No player-facing API.
pub fn transact_lesson(
    path: &Path,
    loot: &LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    lease: SessionLease,
    award: LessonAward,
) -> Result<(), JointCheckpointError> {
    if identity.resolve_session(lease) != Some(award.character) {
        return Err(JointCheckpointError::UnverifiedCharacter);
    }
    let mut staged = magic.clone();
    staged.grant_lesson(award)?;
    let bytes = bundle(loot, identity, &staged)?;
    atomic_write(path, &bytes)?;
    *magic = staged;
    Ok(())
}

/// Trusted NPC lesson transaction. Server-owned manifest + Fighter + Zone
/// determine eligibility; the caller must serialize the authoritative tick.
/// The receipt is newly minted from the persisted, global receipt set.
pub fn transact_teacher_lesson(
    path: &Path,
    loot: &LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    teachers: &TeacherAuthority,
    request: TeacherRequest<'_>,
) -> Result<std::num::NonZeroU64, JointCheckpointError> {
    let (character, lesson) = teachers.authorize(request, identity, zones, loot)?;
    let mut staged = magic.clone();
    let receipt = staged.grant_npc_lesson(character, lesson)?;
    let bytes = bundle(loot, identity, &staged)?;
    atomic_write(path, &bytes)?;
    *magic = staged;
    Ok(receipt)
}

/// World-derived First Awakening lesson input. The caller must hold the same
/// serialized world-writer lock over World, identity, teacher manifest, and
/// joint checkpoint through the durable commit. This is not a client packet.
/// Core must eventually provide a verified world authority/epoch fence.
pub struct WorldTeacherTick<'a> {
    pub lease: SessionLease,
    pub teacher: TeacherId,
    pub world: &'a World,
    pub completed_tick: u32,
}

/// Stage a genuine server-owned teacher encounter against the actual Fighter
/// in the completed World tick, never against an externally built snapshot.
/// A trusted NPC manifest supplies lesson meaning, and the existing staged
/// joint checkpoint preserves lessons and receipts through recovery.
/// This experimental adapter has no live NPC spawn or client network handler.
pub fn transact_world_teacher_lesson(
    path: &Path,
    loot: &LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    teachers: &TeacherAuthority,
    tick: WorldTeacherTick<'_>,
) -> Result<std::num::NonZeroU64, JointCheckpointError> {
    if tick.completed_tick == 0 || tick.world.tick != tick.completed_tick {
        return Err(JointCheckpointError::StaleWorldTick);
    }
    if !tick.world.now_ms.is_finite() || tick.world.now_ms < 0.0 {
        return Err(JointCheckpointError::InvalidWorldTime);
    }
    let fighter = tick
        .world
        .fighter(tick.lease.server_session())
        .ok_or(JointCheckpointError::MissingWorldFighter)?;
    transact_teacher_lesson(
        path,
        loot,
        magic,
        identity,
        zones,
        teachers,
        TeacherRequest {
            lease: tick.lease,
            teacher: tick.teacher,
            fighter,
        },
    )
}

/// Persist an authoritative "NO EFFECT" decision before publishing it.
/// Interrupt/Cancel never applies damage; only a future Combat transaction
/// may mark an effect as actually applied, together with all world effects.
/// Requires a trusted serial world lock and a server-issued session lease.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmberNoEffectDecision {
    pub lease: SessionLease,
    pub sequence: u64,
    pub outcome: EmberEffectStatus,
}

pub fn resolve_ember_without_damage(
    path: &Path,
    loot: &LootAuthority,
    magic: &mut MagicAuthority,
    identity: &SessionIdentityRegistry,
    zones: &ZoneAuthority,
    decision: EmberNoEffectDecision,
) -> Result<(), JointCheckpointError> {
    let character = identity
        .resolve_session(decision.lease)
        .ok_or(JointCheckpointError::UnverifiedCharacter)?;
    let intent = magic
        .ember_intent(character, decision.sequence)
        .ok_or(MagicError::UnknownEffectIntent)?;
    if zones.zone_of(decision.lease.server_session()) != Some(intent.zone) {
        return Err(JointCheckpointError::WrongZone);
    }
    let mut staged = magic.clone();
    staged.resolve_ember_without_effect(character, decision.sequence, decision.outcome)?;
    let bytes = bundle(loot, identity, &staged)?;
    atomic_write(path, &bytes)?;
    *magic = staged;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonSource, Rune, Spell};
    use crate::zone::ZoneId;
    use std::num::NonZeroU64;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

    fn checkpoint_path() -> std::path::PathBuf {
        let number = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("myaso-magic-{}-{number}.bin", std::process::id()))
    }

    fn award(receipt: u64, character: CharacterId, lesson: Lesson) -> LessonAward {
        LessonAward {
            receipt: NonZeroU64::new(receipt).unwrap(),
            character,
            source: LessonSource::NpcTeacher,
            lesson,
        }
    }

    fn fixtures() -> (
        LootAuthority,
        MagicAuthority,
        SessionIdentityRegistry,
        CharacterId,
    ) {
        let mut loot = LootAuthority::new();
        let magic = MagicAuthority::new();
        let mut identity = SessionIdentityRegistry::new();
        let hero = CharacterId::new(700).unwrap();
        identity
            .bind_verified(SessionLease::new(1, 1).unwrap(), hero)
            .unwrap();
        loot.register(1).unwrap();
        (loot, magic, identity, hero)
    }

    #[test]
    fn world_teacher_tick_requires_fire_before_ember_and_persists_progression() {
        use crate::magic_teacher::{TeacherSpawn, TeacherId};
        use crate::simulation::World;
        use crate::zone::{Position, ZoneAuthority};

        let (loot, mut magic, identity, hero) = fixtures();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut teachers = TeacherAuthority::new();
        for (id, lesson) in [
            (200, Lesson::Rune(Rune::Fire)),
            (201, Lesson::Spell(Spell::Ember)),
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
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.step();
        let path = checkpoint_path();
        let lease = SessionLease::new(1, 1).unwrap();

        assert!(matches!(
            transact_world_teacher_lesson(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher: TeacherId::new(201).unwrap(),
                    world: &world,
                    completed_tick: world.tick,
                },
            ),
            Err(JointCheckpointError::Magic(MagicError::PrerequisiteMissing))
        ));
        assert!(!path.exists());
        assert_eq!(magic.mana(hero), 0);

        for (teacher_id, expected_receipt) in [(200, 1), (201, 2)] {
            let receipt = transact_world_teacher_lesson(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher: TeacherId::new(teacher_id).unwrap(),
                    world: &world,
                    completed_tick: world.tick,
                },
            )
            .unwrap();
            assert_eq!(receipt.get(), expected_receipt);
        }
        let (_, mut recovered) = load_joint(&path).unwrap();
        assert!(recovered.knows_rune(hero, Rune::Fire));
        assert!(recovered.knows_spell(hero, Spell::Ember));
        assert_eq!(recovered.mana(hero), 100);
        assert!(matches!(
            transact_world_teacher_lesson(
                &path,
                &loot,
                &mut recovered,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher: TeacherId::new(200).unwrap(),
                    world: &world,
                    completed_tick: world.tick,
                },
            ),
            Err(JointCheckpointError::Magic(MagicError::AlreadyKnown))
        ));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn world_teacher_tick_rejects_stale_forged_and_missing_authority() {
        use crate::magic_teacher::{TeacherSpawn, TeacherId};
        use crate::simulation::World;
        use crate::zone::{Position, ZoneAuthority};

        let (loot, mut magic, identity, hero) = fixtures();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut teachers = TeacherAuthority::new();
        let teacher = TeacherId::new(300).unwrap();
        teachers
            .register_trusted(TeacherSpawn {
                id: teacher,
                zone: ZoneId::Moonvale,
                at: Position { x: 200.0, y: 200.0 },
                lesson: Lesson::Rune(Rune::Fire),
            })
            .unwrap();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        world.step();
        let lease = SessionLease::new(1, 1).unwrap();
        let path = checkpoint_path();

        for (world_ref, completed_tick, used_lease) in [
            (&world, 0, lease),
            (&world, world.tick + 1, lease),
            (&world, world.tick, SessionLease::new(1, 2).unwrap()),
        ] {
            let rejected = transact_world_teacher_lesson(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease: used_lease,
                    teacher,
                    world: world_ref,
                    completed_tick,
                },
            );
            assert!(rejected.is_err());
        }
        let mut no_fighter = World::new(800.0, 600.0);
        no_fighter.step();
        assert!(matches!(
            transact_world_teacher_lesson(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher,
                    world: &no_fighter,
                    completed_tick: no_fighter.tick,
                },
            ),
            Err(JointCheckpointError::MissingWorldFighter)
        ));
        let mut invalid_time = world.clone();
        invalid_time.now_ms = f32::INFINITY;
        assert!(matches!(
            transact_world_teacher_lesson(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                &teachers,
                WorldTeacherTick {
                    lease,
                    teacher,
                    world: &invalid_time,
                    completed_tick: invalid_time.tick,
                },
            ),
            Err(JointCheckpointError::InvalidWorldTime)
        ));
        assert!(!magic.knows_rune(hero, Rune::Fire));
        assert!(!path.exists());
    }

    #[test]
    fn manifested_teacher_rewards_survive_joint_recovery_and_cannot_repeat() {
        use crate::magic_teacher::{TeacherId, TeacherSpawn};
        use crate::simulation::World;
        use crate::zone::{Position, ZoneAuthority, ZoneId};

        let (loot, mut magic, identity, hero) = fixtures();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut teachers = TeacherAuthority::new();
        teachers
            .register_trusted(TeacherSpawn {
                id: TeacherId::new(100).unwrap(),
                zone: ZoneId::Moonvale,
                at: Position { x: 200.0, y: 200.0 },
                lesson: Lesson::Rune(Rune::Fire),
            })
            .unwrap();
        teachers
            .register_trusted(TeacherSpawn {
                id: TeacherId::new(101).unwrap(),
                zone: ZoneId::Moonvale,
                at: Position { x: 210.0, y: 200.0 },
                lesson: Lesson::Spell(Spell::Ember),
            })
            .unwrap();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 200.0, 200.0, 0.0);
        let fighter = world.fighter(1).unwrap().clone();
        let path = checkpoint_path();
        let first = transact_teacher_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            &zones,
            &teachers,
            TeacherRequest {
                lease: SessionLease::new(1, 1).unwrap(),
                teacher: TeacherId::new(100).unwrap(),
                fighter: &fighter,
            },
        )
        .unwrap();
        assert_eq!(first.get(), 1);
        let second = transact_teacher_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            &zones,
            &teachers,
            TeacherRequest {
                lease: SessionLease::new(1, 1).unwrap(),
                teacher: TeacherId::new(101).unwrap(),
                fighter: &fighter,
            },
        )
        .unwrap();
        assert_eq!(second.get(), 2);
        let (_, mut recovered) = load_joint(&path).unwrap();
        assert!(recovered.knows_rune(hero, Rune::Fire));
        assert!(recovered.knows_spell(hero, Spell::Ember));
        assert!(matches!(
            transact_teacher_lesson(
                &path,
                &loot,
                &mut recovered,
                &identity,
                &zones,
                &teachers,
                TeacherRequest {
                    lease: SessionLease::new(1, 1).unwrap(),
                    teacher: TeacherId::new(100).unwrap(),
                    fighter: &fighter,
                },
            ),
            Err(JointCheckpointError::Magic(MagicError::AlreadyKnown))
        ));
        assert!(matches!(
            recovered.grant_lesson(award(1, hero, Lesson::Rune(Rune::Water))),
            Err(MagicError::DuplicateReward)
        ));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn forged_or_out_of_range_teacher_request_never_publishes() {
        use crate::magic_teacher::{TeacherId, TeacherSpawn};
        use crate::simulation::World;
        use crate::zone::{Position, ZoneAuthority, ZoneId};

        let (loot, mut magic, identity, hero) = fixtures();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let mut teachers = TeacherAuthority::new();
        teachers
            .register_trusted(TeacherSpawn {
                id: TeacherId::new(2).unwrap(),
                zone: ZoneId::Moonvale,
                at: Position { x: 200.0, y: 200.0 },
                lesson: Lesson::Rune(Rune::Fire),
            })
            .unwrap();
        let mut world = World::new(800.0, 600.0);
        world.add_player_at(1, 450.0, 450.0, 0.0);
        let player = world.fighter(1).unwrap().clone();
        let path = checkpoint_path();
        let denied = transact_teacher_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            &zones,
            &teachers,
            TeacherRequest {
                lease: SessionLease::new(1, 1).unwrap(),
                teacher: TeacherId::new(2).unwrap(),
                fighter: &player,
            },
        );
        assert!(matches!(
            denied,
            Err(JointCheckpointError::Teacher(TeacherError::TooFarAway))
        ));
        assert!(!magic.knows_rune(hero, Rune::Fire));
        assert!(!path.exists());
    }

    #[test]
    fn earned_fire_and_ember_survive_with_physical_items_and_receipts() {
        let (mut loot, mut magic, mut identity, hero) = fixtures();
        let book = loot.grant(1, ItemKind::Spellbook, 1).unwrap();
        loot.equip(1, book, EquipmentSlot::OffHand).unwrap();
        let reagent = loot.grant(1, ItemKind::SulfurAsh, 9).unwrap();
        let path = checkpoint_path();
        let first = award(1, hero, Lesson::Rune(Rune::Fire));
        transact_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            SessionLease::new(1, 1).unwrap(),
            first,
        )
        .unwrap();
        transact_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            SessionLease::new(1, 1).unwrap(),
            award(2, hero, Lesson::Spell(Spell::Ember)),
        )
        .unwrap();
        let (mut recovered_loot, mut recovered_magic) = load_joint(&path).unwrap();
        assert!(recovered_magic.knows_rune(hero, Rune::Fire));
        assert!(recovered_magic.knows_spell(hero, Spell::Ember));
        assert_eq!(recovered_magic.mana(hero), 100);
        assert_eq!(
            recovered_loot.parked_inventory(hero).unwrap().backpack()[0].id,
            reagent
        );
        assert_eq!(
            recovered_loot
                .parked_inventory(hero)
                .unwrap()
                .equipped(EquipmentSlot::OffHand)
                .unwrap()
                .id,
            book
        );
        assert_eq!(
            identity.release_session(SessionLease::new(1, 1).unwrap()),
            Some(hero)
        );
        identity
            .bind_verified(SessionLease::new(2, 1).unwrap(), hero)
            .unwrap();
        recovered_loot
            .resume_inventory(&identity, SessionLease::new(2, 1).unwrap())
            .unwrap();
        let replay = transact_lesson(
            &path,
            &recovered_loot,
            &mut recovered_magic,
            &identity,
            SessionLease::new(2, 1).unwrap(),
            first,
        );
        assert!(matches!(
            replay,
            Err(JointCheckpointError::Magic(MagicError::DuplicateReward))
        ));
        assert!(recovered_magic.knows_spell(hero, Spell::Ember));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn invalid_reward_and_failed_disk_write_do_not_publish_magic() {
        let (loot, mut magic, identity, hero) = fixtures();
        let path = checkpoint_path();
        let spoof = transact_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            SessionLease::new(9, 1).unwrap(),
            award(1, hero, Lesson::Rune(Rune::Fire)),
        );
        assert!(matches!(
            spoof,
            Err(JointCheckpointError::UnverifiedCharacter)
        ));
        assert!(!magic.knows_rune(hero, Rune::Fire));
        let bad = path.with_extension("missing-parent").join("world.bin");
        let failure = transact_lesson(
            &bad,
            &loot,
            &mut magic,
            &identity,
            SessionLease::new(1, 1).unwrap(),
            award(1, hero, Lesson::Rune(Rune::Fire)),
        );
        assert!(matches!(
            failure,
            Err(JointCheckpointError::Checkpoint(CheckpointError::Io(_)))
        ));
        assert!(!magic.knows_rune(hero, Rune::Fire));
        assert!(!bad.exists());
        assert!(!path.exists());
    }

    #[test]
    fn unmatched_ember_intent_cannot_enter_combined_checkpoint() {
        let (loot, mut magic, identity, hero) = fixtures();
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 8, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        assert!(matches!(
            bundle(&loot, &identity, &magic),
            Err(JointCheckpointError::Corrupt)
        ));
    }

    #[test]
    fn interrupt_checkpoint_keeps_cost_and_prevents_reactivation_after_restart() {
        let (mut loot, mut magic, identity, hero) = fixtures();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        loot.record_operation(hero, 50).unwrap();
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 50, ZoneId::Moonvale, 200.0, 200.0, 0.0)
            .unwrap();
        let path = checkpoint_path();
        save_joint(&path, &loot, &identity, &magic).unwrap();
        resolve_ember_without_damage(
            &path,
            &loot,
            &mut magic,
            &identity,
            &zones,
            EmberNoEffectDecision {
                lease: SessionLease::new(1, 1).unwrap(),
                sequence: 50,
                outcome: EmberEffectStatus::Interrupted,
            },
        )
        .unwrap();
        let (restored_loot, mut recovered_magic) = load_joint(&path).unwrap();
        assert_eq!(restored_loot.committed_operation_sequence(hero), Some(50));
        assert_eq!(recovered_magic.pending_ember_intents().count(), 0);
        assert_eq!(recovered_magic.resolved_ember_intents().count(), 1);
        assert_eq!(
            recovered_magic.ember_intent(hero, 50).unwrap().status,
            EmberEffectStatus::Interrupted
        );
        assert!(matches!(
            resolve_ember_without_damage(
                &path,
                &loot,
                &mut recovered_magic,
                &identity,
                &zones,
                EmberNoEffectDecision {
                    lease: SessionLease::new(1, 1).unwrap(),
                    sequence: 50,
                    outcome: EmberEffectStatus::Cancelled,
                },
            ),
            Err(JointCheckpointError::Magic(
                MagicError::EffectAlreadyResolved
            ))
        ));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn wrong_session_or_zone_refuses_resolution_without_disk_write() {
        let (mut loot, mut magic, identity, hero) = fixtures();
        loot.record_operation(hero, 51).unwrap();
        magic
            .grant_lesson(award(1, hero, Lesson::Rune(Rune::Fire)))
            .unwrap();
        magic
            .grant_lesson(award(2, hero, Lesson::Spell(Spell::Ember)))
            .unwrap();
        magic
            .stage_ember_intent(hero, 51, ZoneId::RedLionInn, 200.0, 200.0, 0.0)
            .unwrap();
        let mut zones = ZoneAuthority::new();
        zones.register(1).unwrap();
        let path = checkpoint_path();
        assert!(matches!(
            resolve_ember_without_damage(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                EmberNoEffectDecision {
                    lease: SessionLease::new(1, 2).unwrap(),
                    sequence: 51,
                    outcome: EmberEffectStatus::Interrupted,
                },
            ),
            Err(JointCheckpointError::UnverifiedCharacter)
        ));
        assert!(matches!(
            resolve_ember_without_damage(
                &path,
                &loot,
                &mut magic,
                &identity,
                &zones,
                EmberNoEffectDecision {
                    lease: SessionLease::new(1, 1).unwrap(),
                    sequence: 51,
                    outcome: EmberEffectStatus::Cancelled,
                },
            ),
            Err(JointCheckpointError::WrongZone)
        ));
        assert_eq!(magic.pending_ember_intents().count(), 1);
        assert!(!path.exists());
    }

    #[test]
    fn corrupt_joint_magic_and_legacy_loot_files_fail_closed() {
        let (loot, mut magic, identity, hero) = fixtures();
        let path = checkpoint_path();
        transact_lesson(
            &path,
            &loot,
            &mut magic,
            &identity,
            SessionLease::new(1, 1).unwrap(),
            award(1, hero, Lesson::Rune(Rune::Fire)),
        )
        .unwrap();
        let mut bytes = fs::read(&path).unwrap();
        let corrupt_index = bytes.len() - 13;
        bytes[corrupt_index] ^= 0x41;
        fs::write(&path, &bytes).unwrap();
        assert!(matches!(
            load_joint(&path),
            Err(JointCheckpointError::Corrupt)
        ));
        fs::write(&path, b"MYASOL03").unwrap();
        assert!(matches!(
            load_joint(&path),
            Err(JointCheckpointError::Corrupt)
        ));
        let _ = fs::remove_file(&path);
    }
}
