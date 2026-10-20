//! Experimental single-file joint recovery of loot AND earned magic.
//!
//! This is NOT integrated into the live multiplayer server. Caller must hold
//! one authoritative writer lock over combat, inventory, identity, and lesson
//! rewards, and independently verify eligibility of NPC/quest receipts.
//! A failed sync AFTER rename may leave disk ahead of memory: production
//! requires a journal/fencing and crash-reconciliation protocol.
//! Standalone MYASOL03 checkpoints must NEVER overwrite MYWLD001 bundles.
use std::fs;
use std::path::Path;

use crate::character_identity::{SessionIdentityRegistry, SessionLease};
use crate::loot::{LootAuthority, LootError};
use crate::loot_persistence::{
    atomic_write, checksum, decode, encode, CheckpointError, MAX_FILE_BYTES,
};
use crate::loot_transaction::{quiescent_verified, TransactionError};
use crate::magic::{LessonAward, MagicAuthority, MagicError, MagicSnapshotError};
use crate::magic_teacher::{TeacherAuthority, TeacherError, TeacherRequest};
use crate::zone::ZoneAuthority;

const HEADER: &[u8; 8] = b"MYWLD001";
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
    Teacher(TeacherError),
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

fn bundle(
    loot: &LootAuthority,
    identity: &SessionIdentityRegistry,
    magic: &MagicAuthority,
) -> Result<Vec<u8>, JointCheckpointError> {
    let projected = quiescent_verified(loot.export_state()?, identity)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::character_identity::CharacterId;
    use crate::loot::{EquipmentSlot, ItemKind};
    use crate::magic::{Lesson, LessonSource, Rune, Spell};
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
