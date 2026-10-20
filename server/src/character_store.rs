//! Dormant, single-writer, crash-consistent local character-record store.
//!
//! All paths are derived from trusted server-side CharacterIds, never from
//! remote requests. This is NOT a distributed CAS database, authentication,
//! inventory storage or a live reconnect implementation. The owner MUST
//! serialize writers and protect this directory from untrusted processes.

use crate::identity::{CharacterId, CharacterRecord, CharacterRecordError, CHARACTER_RECORD_BYTES};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT_STAGE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum CharacterStoreError {
    Io(io::Error),
    AlreadyExists,
    Missing,
    Conflict,
    InvalidRecord(CharacterRecordError),
}

impl From<io::Error> for CharacterStoreError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<CharacterRecordError> for CharacterStoreError {
    fn from(error: CharacterRecordError) -> Self {
        Self::InvalidRecord(error)
    }
}

/// Blocking I/O; future Tokio integration must use a dedicated storage
/// executor, not the 60 Hz game clock. Multiple processes must not write the
/// same directory: use a transactional database for cross-host authority.
#[derive(Debug)]
pub struct CharacterRecordStore {
    root: PathBuf,
}

impl CharacterRecordStore {
    /// The server must supply a private, trusted directory, never a client
    /// path. This method does not verify directory ownership or permissions.
    pub fn open(root: impl AsRef<Path>) -> Result<Self, CharacterStoreError> {
        fs::create_dir_all(root.as_ref())?;
        if !fs::metadata(root.as_ref())?.is_dir() {
            return Err(CharacterStoreError::Io(io::Error::new(
                io::ErrorKind::InvalidInput,
                "character store root must be a directory",
            )));
        }
        Ok(Self {
            root: root.as_ref().to_path_buf(),
        })
    }

    fn record_path(&self, id: CharacterId) -> PathBuf {
        self.root.join(format!("{:032x}.mych", id.get()))
    }

    pub fn load(&self, id: CharacterId) -> Result<CharacterRecord, CharacterStoreError> {
        let mut file = match File::open(self.record_path(id)) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Err(CharacterStoreError::Missing);
            }
            Err(error) => return Err(error.into()),
        };
        // Bound corrupt/untrusted on-disk records to 37 bytes before decode.
        let mut bytes = Vec::with_capacity(CHARACTER_RECORD_BYTES + 1);
        Read::by_ref(&mut file)
            .take((CHARACTER_RECORD_BYTES + 1) as u64)
            .read_to_end(&mut bytes)?;
        let record = CharacterRecord::decode(&bytes)?;
        if record.character_id != id {
            return Err(CharacterStoreError::Conflict);
        }
        Ok(record)
    }

    /// Provision a never-before-seen trusted server-issued ID. A same-dir
    /// hard link publishes the already-synced staged record without ever
    /// replacing an existing identity file.
    pub fn create(&mut self, id: CharacterId) -> Result<CharacterRecord, CharacterStoreError> {
        let record = CharacterRecord::new(id);
        let stage = self.stage(record)?;
        match fs::hard_link(&stage.path, self.record_path(id)) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                return Err(CharacterStoreError::AlreadyExists);
            }
            Err(error) => return Err(error.into()),
        }
        drop(stage);
        sync_directory(&self.root)?;
        Ok(record)
    }

    /// Require a caller-supplied expected complete record and increment the
    /// generation without wraparound. The caller must not activate a lease
    /// until this method returns Ok. A crash leaves either old or new record
    /// visible; disk or directory sync errors can leave an *uncertain* commit,
    /// so the caller must reload from storage before any retry.
    ///
    /// In-memory &mut serialization is NOT a cross-process CAS: DO NOT use
    /// this for shared multi-worker/network-filesystem production authority.
    pub fn advance_generation(
        &mut self,
        expected: CharacterRecord,
    ) -> Result<CharacterRecord, CharacterStoreError> {
        let current = self.load(expected.character_id)?;
        if current != expected {
            return Err(CharacterStoreError::Conflict);
        }
        let next = current.next_generation()?;
        let stage = self.stage(next)?;
        fs::rename(&stage.path, self.record_path(next.character_id))?;
        // Rename published the file even if the following fsync fails.
        // The caller must regard such an error as an uncertain commit.
        drop(stage);
        sync_directory(&self.root)?;
        Ok(next)
    }

    fn stage(&self, record: CharacterRecord) -> Result<StagedFile, CharacterStoreError> {
        let nonce = NEXT_STAGE.fetch_add(1, Ordering::Relaxed);
        let clock = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| io::Error::other("system time predates Unix epoch"))?
            .as_nanos();
        let path = self.root.join(format!(
            ".{:032x}.pending-{}-{clock}-{nonce}",
            record.character_id.get(),
            std::process::id()
        ));
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        let staged = StagedFile { path };
        file.write_all(&record.encode())?;
        file.sync_all()?;
        drop(file);
        Ok(staged)
    }
}

struct StagedFile {
    path: PathBuf,
}

impl Drop for StagedFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// Linux/POSIX deployment requires syncing the containing directory after
/// link/rename. On platforms that cannot sync directories, fail closed.
fn sync_directory(root: &Path) -> Result<(), io::Error> {
    File::open(root)?.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let count = NEXT_STAGE.fetch_add(1, Ordering::Relaxed);
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("valid clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-c2b-test-{}-{stamp}-{count}",
                std::process::id()
            ));
            fs::create_dir(&path).expect("private test directory");
            Self(path)
        }

        fn store(&self) -> CharacterRecordStore {
            CharacterRecordStore::open(&self.0).expect("open test store")
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn character(n: u128) -> CharacterId {
        CharacterId::new(n).expect("nonzero character")
    }

    #[test]
    fn identity_survives_close_restart_and_generation_advance() {
        let root = TestDirectory::new();
        let id = character(0x1111_2222_3333_4444_5555_6666_7777_8888);
        let mut store = root.store();
        let initial = store.create(id).expect("create identity");
        assert_eq!(initial.session_generation, 0);
        let first = store
            .advance_generation(initial)
            .expect("first committed epoch");
        let second = store
            .advance_generation(first)
            .expect("second committed epoch");
        assert_eq!(second.session_generation, 2);
        drop(store);

        let restored = root.store();
        assert_eq!(restored.load(id).expect("load after restart"), second);
        assert_eq!(restored.load(id).expect("repeat load"), second);
    }

    #[test]
    fn duplicate_provisioning_and_stale_generation_fail_closed() {
        let root = TestDirectory::new();
        let id = character(100);
        let mut store = root.store();
        assert!(matches!(store.load(id), Err(CharacterStoreError::Missing)));
        let initial = store.create(id).expect("provision");
        assert!(matches!(
            store.create(id),
            Err(CharacterStoreError::AlreadyExists)
        ));
        let first = store.advance_generation(initial).expect("commit");
        assert!(matches!(
            store.advance_generation(initial),
            Err(CharacterStoreError::Conflict)
        ));

        // Another store handle that loaded stale state observes the commit
        // before making a new transition; this is not a multi-process lock.
        let mut reopened = root.store();
        assert!(matches!(
            reopened.advance_generation(initial),
            Err(CharacterStoreError::Conflict)
        ));
        assert_eq!(reopened.load(id).expect("still first"), first);
    }

    #[test]
    fn wrong_identity_and_corrupted_or_truncated_records_never_restore() {
        let root = TestDirectory::new();
        let id = character(123);
        let other = character(124);
        let mut store = root.store();
        let _ = store.create(id).expect("create");
        assert!(matches!(
            store.load(other),
            Err(CharacterStoreError::Missing)
        ));

        fs::write(store.record_path(id), CharacterRecord::new(other).encode())
            .expect("inject conflicting valid record");
        assert!(matches!(store.load(id), Err(CharacterStoreError::Conflict)));

        fs::write(store.record_path(id), [0_u8; 7]).expect("inject truncation");
        assert!(matches!(
            store.load(id),
            Err(CharacterStoreError::InvalidRecord(
                CharacterRecordError::InvalidLength
            ))
        ));

        fs::write(store.record_path(id), [0_u8; CHARACTER_RECORD_BYTES + 1])
            .expect("inject oversized record");
        assert!(matches!(
            store.load(id),
            Err(CharacterStoreError::InvalidRecord(
                CharacterRecordError::InvalidLength
            ))
        ));
    }

    #[test]
    fn orphaned_unpublished_stage_does_not_replace_committed_record() {
        let root = TestDirectory::new();
        let id = character(987);
        let mut store = root.store();
        let initial = store.create(id).expect("create");
        let first = store.advance_generation(initial).expect("commit first");
        fs::write(root.0.join(".987.pending-interrupted"), b"partial").expect("simulate orphan");
        let restored = root.store().load(id).expect("canonical record");
        assert_eq!(restored, first);
    }

    #[test]
    fn each_identity_has_an_independent_durable_record() {
        let root = TestDirectory::new();
        let mut store = root.store();
        let one = store.create(character(1)).expect("first identity");
        let two = store.create(character(2)).expect("second identity");
        let advanced = store.advance_generation(one).expect("advance first");
        assert_eq!(store.load(character(1)).expect("first"), advanced);
        assert_eq!(store.load(character(2)).expect("second"), two);
    }
}
