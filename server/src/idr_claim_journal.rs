//! DORMANT OFFLINE IDR: one locked, crash-durable log of UNVERIFIED
//! observer claims and server-only actor tombstones. NOT a live evidence
//! authority, true-name store, authenticated wire, or item writer.
//! FNV checksum detects corruption, NOT forgery/rollback.

use crate::{
    canonical_idr_bridge::{CanonicalIdrBridge, CanonicalIdrError},
    identity::{CharacterId, SessionLease, SessionLeaseRegistry},
    identity_disguise::valid_name,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

#[cfg(unix)]
unsafe extern "C" {
    fn flock(fd: std::os::raw::c_int, operation: std::os::raw::c_int) -> std::os::raw::c_int;
}
#[cfg(target_os = "linux")]
unsafe extern "C" {
    fn openat(
        dirfd: std::os::raw::c_int,
        path: *const std::os::raw::c_char,
        flags: std::os::raw::c_int,
        mode: std::os::raw::c_uint,
    ) -> std::os::raw::c_int;
    fn renameat2(
        olddirfd: std::os::raw::c_int,
        oldpath: *const std::os::raw::c_char,
        newdirfd: std::os::raw::c_int,
        newpath: *const std::os::raw::c_char,
        flags: std::os::raw::c_uint,
    ) -> std::os::raw::c_int;
    fn unlinkat(
        dirfd: std::os::raw::c_int,
        path: *const std::os::raw::c_char,
        flags: std::os::raw::c_int,
    ) -> std::os::raw::c_int;
}
fn exclusive_lock(file: &File) -> io::Result<bool> {
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        // SAFETY: File owns the descriptor for the entire call and writer life.
        if unsafe { flock(file.as_raw_fd(), 2 | 4) } == 0 {
            Ok(true)
        } else {
            let e = io::Error::last_os_error();
            if e.kind() == io::ErrorKind::WouldBlock {
                Ok(false)
            } else {
                Err(e)
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = file;
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Unix lock required",
        ))
    }
}

/// This dormant local MYID store is Linux-only until another platform has
/// an independently reviewed NOFOLLOW + exclusive-lock storage path.
/// Linux O_NOFOLLOW: refuse symlink final components even if an attacker
/// replaces them after our metadata preflight and before open().
#[cfg(target_os = "linux")]
const LINUX_O_NOFOLLOW: i32 = 0o400000;
#[cfg(target_os = "linux")]
const LINUX_O_DIRECTORY: i32 = 0o200000;
#[cfg(target_os = "linux")]
const LINUX_O_CLOEXEC: i32 = 0o2000000;
#[cfg(target_os = "linux")]
const LINUX_O_CREAT: i32 = 0o100;
#[cfg(target_os = "linux")]
const LINUX_O_EXCL: i32 = 0o200;
#[cfg(target_os = "linux")]
const LINUX_RENAME_NOREPLACE: u32 = 1;

/// All MYID entry names are generated locally, single path components.
/// Kernel openat/renameat2 bind writes and publication to the already
/// validated journal directory descriptor, not a mutable root pathname.
#[cfg(target_os = "linux")]
fn anchored_create_new(dir: &File, name: &str) -> Result<File, ClaimJournalError> {
    use std::{
        ffi::CString,
        os::fd::{AsRawFd, FromRawFd},
    };
    let path = CString::new(name).map_err(|_| ClaimJournalError::Invalid("bad MYID filename"))?;
    if name.contains('/') || name == "." || name == ".." {
        return Err(ClaimJournalError::Invalid(
            "MYID entry not single component",
        ));
    }
    // SAFETY: both the already-open dirfd and NUL-terminated path remain
    // valid across this syscall; successful raw fd is uniquely owned by File.
    let fd = unsafe {
        openat(
            dir.as_raw_fd(),
            path.as_ptr(),
            1 | LINUX_O_CREAT | LINUX_O_EXCL | LINUX_O_NOFOLLOW | LINUX_O_CLOEXEC,
            0o600,
        )
    };
    if fd < 0 {
        return Err(ClaimJournalError::Io(io::Error::last_os_error()));
    }
    // SAFETY: newly created fd is returned by openat, not used elsewhere.
    let file = unsafe { File::from_raw_fd(fd) };
    check_regular_owned_storage_file(&file)?;
    Ok(file)
}

#[cfg(target_os = "linux")]
fn anchored_rename_noreplace(
    dir: &File,
    source: &str,
    target: &str,
) -> Result<(), ClaimJournalError> {
    use std::{ffi::CString, os::fd::AsRawFd};
    if source.contains('/') || target.contains('/') {
        return Err(ClaimJournalError::Invalid(
            "MYID rename includes path traversal",
        ));
    }
    let from = CString::new(source).map_err(|_| ClaimJournalError::Invalid("bad staging name"))?;
    let to = CString::new(target).map_err(|_| ClaimJournalError::Invalid("bad event name"))?;
    // SAFETY: pinned directory descriptor and both NUL-terminated names
    // survive the call. NOREPLACE prevents overwriting a competing commit.
    if unsafe {
        renameat2(
            dir.as_raw_fd(),
            from.as_ptr(),
            dir.as_raw_fd(),
            to.as_ptr(),
            LINUX_RENAME_NOREPLACE,
        )
    } != 0
    {
        return Err(ClaimJournalError::Io(io::Error::last_os_error()));
    }
    Ok(())
}

/// Linux pinned-inode lookup for a single canonical event name or lock.
/// `O_NOFOLLOW` prevents final-component symlink redirection even when
/// directory contents change after enumeration.
#[cfg(target_os = "linux")]
fn anchored_open_existing(dir: &File, name: &str) -> Result<File, ClaimJournalError> {
    use std::{
        ffi::CString,
        os::fd::{AsRawFd, FromRawFd},
    };
    if name.contains('/') || name == "." || name == ".." {
        return Err(ClaimJournalError::Invalid(
            "MYID lookup includes path traversal",
        ));
    }
    let path =
        CString::new(name).map_err(|_| ClaimJournalError::Invalid("bad MYID lookup name"))?;
    // SAFETY: pin and CString remain valid; returned descriptor is uniquely
    // owned by the newly-created File, if the syscall succeeds.
    let fd = unsafe {
        openat(
            dir.as_raw_fd(),
            path.as_ptr(),
            LINUX_O_NOFOLLOW | LINUX_O_CLOEXEC,
            0,
        )
    };
    if fd < 0 {
        return Err(ClaimJournalError::Io(io::Error::last_os_error()));
    }
    let file = unsafe { File::from_raw_fd(fd) };
    check_regular_owned_storage_file(&file)?;
    Ok(file)
}

#[cfg(target_os = "linux")]
fn anchored_open_writer_lock(dir: &File) -> Result<File, ClaimJournalError> {
    use std::{
        ffi::CString,
        os::fd::{AsRawFd, FromRawFd},
    };
    let name = CString::new(".identity-writer.lock").expect("constant lock name");
    // Open/create and lock the SAME pinned root, never an independently
    // resolved path after the trusted directory has been validated.
    let fd = unsafe {
        openat(
            dir.as_raw_fd(),
            name.as_ptr(),
            2 | LINUX_O_CREAT | LINUX_O_NOFOLLOW | LINUX_O_CLOEXEC,
            0o600,
        )
    };
    if fd < 0 {
        return Err(ClaimJournalError::Io(io::Error::last_os_error()));
    }
    let file = unsafe { File::from_raw_fd(fd) };
    check_regular_owned_storage_file(&file)?;
    Ok(file)
}

#[cfg(target_os = "linux")]
fn pinned_directory_entries(dir: &File) -> Result<Vec<String>, ClaimJournalError> {
    use std::os::fd::AsRawFd;
    // Linux procfs resolves /proc/self/fd/N to the open directory inode,
    // even if its original pathname is renamed/replaced. Never use entry
    // paths below: event opens are always openat(dirfd, literal filename).
    let proc_fd = format!("/proc/self/fd/{}", dir.as_raw_fd());
    let mut names = Vec::new();
    for entry in fs::read_dir(proc_fd)? {
        let entry = entry?;
        if entry.file_type()?.is_symlink() {
            return Err(ClaimJournalError::Invalid(
                "MYID directory contains linked storage",
            ));
        }
        let name = entry.file_name();
        names.push(
            name.into_string()
                .map_err(|_| ClaimJournalError::Invalid("invalid filename"))?,
        );
        if names.len() > MAX_IDR_OFFLINE_EVENTS + 2 {
            return Err(ClaimJournalError::Capacity);
        }
    }
    Ok(names)
}

#[cfg(target_os = "linux")]
fn anchored_unlink(dir: &File, name: &str) -> Result<(), ClaimJournalError> {
    use std::{ffi::CString, os::fd::AsRawFd};
    if name.contains('/') {
        return Err(ClaimJournalError::Invalid(
            "MYID unlink includes path traversal",
        ));
    }
    let path = CString::new(name).map_err(|_| ClaimJournalError::Invalid("bad staging name"))?;
    // SAFETY: pinned directory descriptor + NUL-terminated filename valid.
    if unsafe { unlinkat(dir.as_raw_fd(), path.as_ptr(), 0) } != 0 {
        return Err(ClaimJournalError::Io(io::Error::last_os_error()));
    }
    Ok(())
}

#[cfg(unix)]
fn check_regular_owned_storage_file(file: &File) -> Result<(), ClaimJournalError> {
    use std::os::unix::fs::MetadataExt;
    let meta = file.metadata()?;
    if !meta.is_file() || meta.nlink() != 1 || meta.mode() & 0o077 != 0 {
        return Err(ClaimJournalError::Invalid(
            "MYID lock/event must be a private regular file with one link",
        ));
    }
    Ok(())
}

const MAGIC: &[u8; 4] = b"MYID";
const LEN: usize = 256;
const MAX_NAME_BYTES: usize = 160;
pub const MAX_IDR_OFFLINE_EVENTS: usize = 8192;
static TEMP: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum ClaimJournalError {
    Io(io::Error),
    WriterBusy,
    Invalid(&'static str),
    SequenceGap,
    RollbackSuspected,
    Capacity,
    ConflictingReplay,
    StaleGeneration,
    StaleAppearance,
    Retired,
    Untrusted(CanonicalIdrError),
    Poisoned,
}
impl From<io::Error> for ClaimJournalError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OfflineIdentityEvent {
    Claim {
        speaker: CharacterId,
        observer: CharacterId,
        session_generation: u64,
        appearance_epoch: u64,
        name: String,
    },
    Tombstone {
        subject: CharacterId,
    },
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Record {
    sequence: u64,
    event_id: u128,
    event: OfflineIdentityEvent,
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ClaimReceipt {
    pub sequence: u64,
    pub event_id: u128,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ObservedClaim {
    pub name: String,
    pub session_generation: u64,
    pub appearance_epoch: u64,
    pub sequence: u64,
}
/// One strictly typed OFFLINE claim proposal; never use directly from a
/// browser packet. The current canonical lease is checked at append time.
pub struct OfflineClaimIntent<'a> {
    pub bridge: &'a CanonicalIdrBridge,
    pub leases: &'a SessionLeaseRegistry,
    pub speaker: CharacterId,
    pub lease: SessionLease,
    pub observer: CharacterId,
    pub appearance_epoch: u64,
    pub name: &'a str,
    pub event_id: u128,
}

/// DORMANT current-viewer read context. Both actor leases must have been
/// authenticated/activated by Core; packet-provided IDs are never trusted.
pub struct CurrentClaimRead<'a> {
    pub bridge: &'a CanonicalIdrBridge,
    pub leases: &'a SessionLeaseRegistry,
    pub observer: CharacterId,
    pub observer_lease: SessionLease,
    pub speaker: CharacterId,
    pub speaker_lease: SessionLease,
}

/// A public-facing projection may say Unknown or Claimed ONLY. Historical
/// event IDs and canonical actor IDs are intentionally absent. It is not
/// evidence of a true name, controller type or current World visibility.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CurrentClaimView {
    Unknown,
    Claimed { display_claim: String },
}

#[derive(Default, Clone)]
struct Projection {
    claims: BTreeMap<(CharacterId, CharacterId), ObservedClaim>,
    generation: BTreeMap<CharacterId, u64>,
    appearance: BTreeMap<CharacterId, u64>,
    retired: BTreeSet<CharacterId>,
}
impl Projection {
    fn apply(&mut self, r: &Record) -> Result<(), ClaimJournalError> {
        match &r.event {
            OfflineIdentityEvent::Claim {
                speaker,
                observer,
                session_generation,
                appearance_epoch,
                name,
            } => {
                if self.retired.contains(speaker) || self.retired.contains(observer) {
                    return Err(ClaimJournalError::Retired);
                }
                if *session_generation < self.generation.get(speaker).copied().unwrap_or(0) {
                    return Err(ClaimJournalError::StaleGeneration);
                }
                if *appearance_epoch < self.appearance.get(speaker).copied().unwrap_or(0) {
                    return Err(ClaimJournalError::StaleAppearance);
                }
                self.generation.insert(*speaker, *session_generation);
                if self
                    .appearance
                    .insert(*speaker, *appearance_epoch)
                    .is_some_and(|old| old < *appearance_epoch)
                {
                    self.claims.retain(|(_, subject), _| subject != speaker);
                }
                self.claims.insert(
                    (*observer, *speaker),
                    ObservedClaim {
                        name: name.clone(),
                        session_generation: *session_generation,
                        appearance_epoch: *appearance_epoch,
                        sequence: r.sequence,
                    },
                );
            }
            OfflineIdentityEvent::Tombstone { subject } => {
                if !self.retired.insert(*subject) {
                    return Err(ClaimJournalError::Retired);
                }
                self.claims
                    .retain(|(viewer, observed), _| viewer != subject && observed != subject);
                self.generation.remove(subject);
                self.appearance.remove(subject);
            }
        }
        Ok(())
    }
}

fn hash(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5_u32, |a, b| {
        (a ^ u32::from(*b)).wrapping_mul(0x0100_0193)
    })
}
fn filename(n: u64) -> String {
    format!("{n:020}.myid")
}
fn validate(event: &OfflineIdentityEvent) -> Result<(), ClaimJournalError> {
    if let OfflineIdentityEvent::Claim {
        speaker,
        observer,
        session_generation,
        appearance_epoch,
        name,
    } = event
    {
        if speaker == observer
            || *session_generation == 0
            || *appearance_epoch == 0
            || name.len() > MAX_NAME_BYTES
            || !valid_name(name)
        {
            return Err(ClaimJournalError::Invalid("invalid unverified claim"));
        }
    }
    Ok(())
}
fn encode(r: &Record) -> [u8; LEN] {
    let mut b = [0_u8; LEN];
    b[0..4].copy_from_slice(MAGIC);
    b[4] = 1;
    b[8..16].copy_from_slice(&r.sequence.to_le_bytes());
    b[16..32].copy_from_slice(&r.event_id.to_le_bytes());
    match &r.event {
        OfflineIdentityEvent::Claim {
            speaker,
            observer,
            session_generation,
            appearance_epoch,
            name,
        } => {
            b[5] = 1;
            b[32..48].copy_from_slice(&speaker.get().to_le_bytes());
            b[48..64].copy_from_slice(&observer.get().to_le_bytes());
            b[64..72].copy_from_slice(&session_generation.to_le_bytes());
            b[72..80].copy_from_slice(&appearance_epoch.to_le_bytes());
            b[80..82].copy_from_slice(&(name.len() as u16).to_le_bytes());
            b[82..82 + name.len()].copy_from_slice(name.as_bytes());
        }
        OfflineIdentityEvent::Tombstone { subject } => {
            b[5] = 2;
            b[32..48].copy_from_slice(&subject.get().to_le_bytes());
        }
    }
    let checksum = hash(&b[..252]);
    b[252..256].copy_from_slice(&checksum.to_le_bytes());
    b
}
fn decode(b: &[u8]) -> Result<Record, ClaimJournalError> {
    if b.len() != LEN || &b[..4] != MAGIC || b[4] != 1 {
        return Err(ClaimJournalError::Invalid("invalid MYID header"));
    }
    if b[6..8].iter().chain(&b[242..252]).any(|x| *x != 0) {
        return Err(ClaimJournalError::Invalid("MYID reserved bytes"));
    }
    if hash(&b[..252]) != u32::from_le_bytes(b[252..256].try_into().unwrap()) {
        return Err(ClaimJournalError::Invalid("MYID checksum"));
    }
    let sequence = u64::from_le_bytes(b[8..16].try_into().unwrap());
    let event_id = u128::from_le_bytes(b[16..32].try_into().unwrap());
    let subject = CharacterId::new(u128::from_le_bytes(b[32..48].try_into().unwrap()))
        .ok_or(ClaimJournalError::Invalid("zero subject"))?;
    if sequence == 0 || event_id == 0 {
        return Err(ClaimJournalError::Invalid("zero event or sequence"));
    }
    let observer_id = u128::from_le_bytes(b[48..64].try_into().unwrap());
    let generation = u64::from_le_bytes(b[64..72].try_into().unwrap());
    let epoch = u64::from_le_bytes(b[72..80].try_into().unwrap());
    let size = usize::from(u16::from_le_bytes(b[80..82].try_into().unwrap()));
    if size > MAX_NAME_BYTES {
        return Err(ClaimJournalError::Invalid("claim oversized"));
    }
    let event = match b[5] {
        1 => {
            let observer =
                CharacterId::new(observer_id).ok_or(ClaimJournalError::Invalid("zero observer"))?;
            if b[82 + size..242].iter().any(|&x| x != 0) {
                return Err(ClaimJournalError::Invalid("claim padding"));
            }
            let name = std::str::from_utf8(&b[82..82 + size])
                .map_err(|_| ClaimJournalError::Invalid("claim UTF8"))?;
            OfflineIdentityEvent::Claim {
                speaker: subject,
                observer,
                session_generation: generation,
                appearance_epoch: epoch,
                name: name.to_owned(),
            }
        }
        2 if observer_id == 0
            && generation == 0
            && epoch == 0
            && size == 0
            && b[82..242].iter().all(|&x| x == 0) =>
        {
            OfflineIdentityEvent::Tombstone { subject }
        }
        _ => return Err(ClaimJournalError::Invalid("invalid MYID event kind")),
    };
    validate(&event)?;
    Ok(Record {
        sequence,
        event_id,
        event,
    })
}

/// Exactly one local Unix writer with immutable fsynced event files. No
/// globally trusted lineage, anti-rollback authority, verified-evidence
/// opcode, or live integration is claimed.
pub struct OfflineClaimJournal {
    root: PathBuf,
    root_dir: File,
    _lock: File,
    records: BTreeMap<u128, Record>,
    head: u64,
    state: Projection,
    poisoned: bool,
}
impl OfflineClaimJournal {
    /// Local offline fence against an active writer's POSIX lock inode
    /// being unlinked/replaced (which permits a second different flock)
    /// or against replacement of its journal directory path. This pins
    /// filesystem identity, NOT a cross-host epoch or atomic openat2 path.
    fn ensure_writer_anchor(&self) -> Result<(), ClaimJournalError> {
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::MetadataExt;
            let pinned_dir = self.root_dir.metadata()?;
            let named_dir = fs::symlink_metadata(&self.root)?;
            if !named_dir.is_dir()
                || pinned_dir.dev() != named_dir.dev()
                || pinned_dir.ino() != named_dir.ino()
            {
                return Err(ClaimJournalError::Invalid(
                    "MYID writer lock/directory binding changed",
                ));
            }
            let pinned_lock = self._lock.metadata()?;
            let named_lock = match fs::symlink_metadata(self.root.join(".identity-writer.lock")) {
                Ok(meta) => meta,
                Err(e) if e.kind() == io::ErrorKind::NotFound => {
                    return Err(ClaimJournalError::Invalid(
                        "MYID writer lock/directory binding changed",
                    ));
                }
                Err(e) => return Err(ClaimJournalError::Io(e)),
            };
            if !named_lock.is_file()
                || pinned_lock.dev() != named_lock.dev()
                || pinned_lock.ino() != named_lock.ino()
                || pinned_lock.nlink() != 1
                || named_lock.nlink() != 1
                || named_lock.mode() & 0o077 != 0
            {
                return Err(ClaimJournalError::Invalid(
                    "MYID writer lock/directory binding changed",
                ));
            }
            Ok(())
        }
        #[cfg(not(target_os = "linux"))]
        {
            Err(ClaimJournalError::Io(io::Error::new(
                io::ErrorKind::Unsupported,
                "MYID local writer anchor requires Linux",
            )))
        }
    }

    pub fn open(root: impl AsRef<Path>) -> Result<Self, ClaimJournalError> {
        Self::open_with_pinned_hook(root, || {})
    }

    /// Test interleaving hook is always a no-op in live code. Allows a
    /// deterministic root-path replacement after FD pin but before lock
    /// acquisition and recovery in an OFFLINE adversarial unit test.
    fn open_with_pinned_hook(
        root: impl AsRef<Path>,
        after_root_pinned: impl FnOnce(),
    ) -> Result<Self, ClaimJournalError> {
        let root = root.as_ref();
        fs::create_dir_all(root)?;
        // Reject a linked root BEFORE chmod: set_permissions follows a
        // symlink and could otherwise change an unrelated private directory.
        let root_meta = fs::symlink_metadata(root)?;
        if root_meta.file_type().is_symlink() || !root_meta.is_dir() {
            return Err(ClaimJournalError::Invalid(
                "MYID root must be a real directory, not a symlink",
            ));
        }
        // Pin the ACTUAL directory inode and chmod through that FD, not
        // a second path traversal that an attacker could replace.
        // Keep declarations portable: the unsupported-platform branch
        // returns before any attempt to use an uninitialized directory.
        let root_dir: File;
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
            let dir = OpenOptions::new()
                .read(true)
                .custom_flags(LINUX_O_NOFOLLOW | LINUX_O_DIRECTORY)
                .open(root)?;
            let pinned = dir.metadata()?;
            if !pinned.is_dir()
                || pinned.ino() != root_meta.ino()
                || pinned.dev() != root_meta.dev()
            {
                return Err(ClaimJournalError::Invalid(
                    "MYID root changed during opening",
                ));
            }
            dir.set_permissions(fs::Permissions::from_mode(0o700))?;
            root_dir = dir;
        }
        #[cfg(not(target_os = "linux"))]
        return Err(ClaimJournalError::Io(io::Error::new(
            io::ErrorKind::Unsupported,
            "MYID root pinning requires Linux",
        )));
        after_root_pinned();
        // The lock is acquired IN the pinned verified root, regardless of
        // whether its pathname is rebound between validation and opening.
        let lock: File;
        #[cfg(target_os = "linux")]
        {
            lock = anchored_open_writer_lock(&root_dir)?;
        }
        #[cfg(not(target_os = "linux"))]
        {
            return Err(ClaimJournalError::Io(io::Error::new(
                io::ErrorKind::Unsupported,
                "MYID pinned writer acquisition requires Linux",
            )));
        }
        if !exclusive_lock(&lock)? {
            return Err(ClaimJournalError::WriterBusy);
        }
        let mut out = Self {
            root: root.to_path_buf(),
            root_dir,
            _lock: lock,
            records: BTreeMap::new(),
            head: 0,
            state: Projection::default(),
            poisoned: false,
        };
        let mut paths = Vec::new();
        for name in pinned_directory_entries(&out.root_dir)? {
            if name == ".identity-writer.lock" || name.starts_with(".staging-") {
                continue;
            }
            if name.len() != 25
                || !name.ends_with(".myid")
                || !name[..20].bytes().all(|x| x.is_ascii_digit())
            {
                return Err(ClaimJournalError::Invalid("unknown file in MYID store"));
            }
            let n: u64 = name[..20]
                .parse()
                .map_err(|_| ClaimJournalError::Invalid("sequence overflow"))?;
            paths.push((n, name));
        }
        paths.sort_by_key(|(n, _)| *n);
        if paths.len() > MAX_IDR_OFFLINE_EVENTS {
            return Err(ClaimJournalError::Capacity);
        }
        for (n, name) in paths {
            if out.head.checked_add(1) != Some(n) {
                return Err(ClaimJournalError::SequenceGap);
            }
            let mut bytes = Vec::new();
            anchored_open_existing(&out.root_dir, &name)?
                .take(LEN as u64 + 1)
                .read_to_end(&mut bytes)?;
            let rec = decode(&bytes)?;
            if rec.sequence != n || out.records.contains_key(&rec.event_id) {
                return Err(ClaimJournalError::Invalid("event/sequence mismatch"));
            }
            out.state.apply(&rec)?;
            out.records.insert(rec.event_id, rec);
            out.head = n;
        }
        // The caller cannot adopt claims from an old moved directory as
        // CURRENT merely because that inode was valid at its earlier path.
        out.ensure_writer_anchor()?;
        Ok(out)
    }
    /// A trusted coordinator may supply a minimum durable sequence from an
    /// independently protected monotonic source. THIS MODULE DOES NOT OWN
    /// OR AUTHENTICATE THAT SOURCE. Zero permits bootstrap; a previous
    /// snapshot with a lower head must fail closed rather than mint beliefs.
    pub fn open_with_minimum_head(
        root: impl AsRef<Path>,
        externally_protected_floor: u64,
    ) -> Result<Self, ClaimJournalError> {
        let store = Self::open(root)?;
        if store.head < externally_protected_floor {
            return Err(ClaimJournalError::RollbackSuspected);
        }
        Ok(store)
    }

    fn persist(&self, rec: &Record) -> Result<(), ClaimJournalError> {
        self.persist_after_preflight(rec, || {})
    }

    /// The closure is a no-op in regular execution. A deliberately adversarial
    /// UNIT TEST uses it to rebind the journal pathname AFTER validation but
    /// BEFORE creation, proving the actual create/rename are dirfd-relative.
    fn persist_after_preflight(
        &self,
        rec: &Record,
        after_anchor_check: impl FnOnce(),
    ) -> Result<(), ClaimJournalError> {
        self.ensure_writer_anchor()?;
        after_anchor_check();
        let final_name = filename(rec.sequence);
        let tmp_name = format!(
            ".staging-{}-{}",
            std::process::id(),
            TEMP.fetch_add(1, Ordering::Relaxed)
        );

        #[cfg(target_os = "linux")]
        {
            let result = (|| {
                let mut file = anchored_create_new(&self.root_dir, &tmp_name)?;
                file.write_all(&encode(rec))?;
                file.sync_all()?;
                drop(file);
                // Both names resolve under the original pinned directory.
                // NOREPLACE refuses an already committed numbered event.
                anchored_rename_noreplace(&self.root_dir, &tmp_name, &final_name)?;
                self.root_dir.sync_all()?;
                // If the named lock/root changed during a write, caller
                // poisons the writer and never acknowledges this commit.
                self.ensure_writer_anchor()
            })();
            if result.is_err() {
                // Best-effort cleanup only the staging entry in the PINNED
                // directory; never unlink another directory's same name.
                let _ = anchored_unlink(&self.root_dir, &tmp_name);
            }
            result
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = (final_name, tmp_name, rec);
            Err(ClaimJournalError::Io(io::Error::new(
                io::ErrorKind::Unsupported,
                "MYID pinned-dirfd commit requires Linux",
            )))
        }
    }
    fn append(
        &mut self,
        event_id: u128,
        event: OfflineIdentityEvent,
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        if self.poisoned {
            return Err(ClaimJournalError::Poisoned);
        }
        if let Err(err) = self.ensure_writer_anchor() {
            self.poisoned = true;
            return Err(err);
        }
        if event_id == 0 {
            return Err(ClaimJournalError::Invalid("zero event ID"));
        }
        validate(&event)?;
        if let Some(old) = self.records.get(&event_id) {
            return if old.event == event {
                Ok(ClaimReceipt {
                    sequence: old.sequence,
                    event_id,
                })
            } else {
                Err(ClaimJournalError::ConflictingReplay)
            };
        }
        if self.records.len() >= MAX_IDR_OFFLINE_EVENTS {
            return Err(ClaimJournalError::Capacity);
        }
        let n = self
            .head
            .checked_add(1)
            .ok_or(ClaimJournalError::SequenceGap)?;
        let rec = Record {
            sequence: n,
            event_id,
            event,
        };
        let mut proposed = self.state.clone();
        proposed.apply(&rec)?; // MUST validate before publishing anything.
        if let Err(err) = self.persist(&rec) {
            self.poisoned = true;
            return Err(err);
        }
        self.state = proposed;
        self.records.insert(event_id, rec);
        self.head = n;
        Ok(ClaimReceipt {
            sequence: n,
            event_id,
        })
    }

    /// Requires an EXISTING, currently activated canonical Core8B lease and
    /// a known listener. Does not create Verified evidence or network ACK.
    pub fn append_unverified_claim(
        &mut self,
        intent: OfflineClaimIntent<'_>,
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        let actual_epoch = intent
            .bridge
            .preflight_offline_unverified_claim(
                intent.speaker,
                intent.lease,
                intent.leases,
                intent.observer,
                intent.name,
            )
            .map_err(ClaimJournalError::Untrusted)?;
        if intent.appearance_epoch != actual_epoch {
            return Err(ClaimJournalError::StaleAppearance);
        }
        self.append(
            intent.event_id,
            OfflineIdentityEvent::Claim {
                speaker: intent.speaker,
                observer: intent.observer,
                session_generation: intent.lease.generation(),
                appearance_epoch: intent.appearance_epoch,
                name: intent.name.to_owned(),
            },
        )
    }

    /// Trusted server-only revocation in this OFFLINE prototype. There is
    /// deliberately no client or public action that calls this method.
    #[cfg(test)]
    pub(crate) fn append_offline_tombstone(
        &mut self,
        subject: CharacterId,
        event_id: u128,
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        self.append(event_id, OfflineIdentityEvent::Tombstone { subject })
    }
    /// This is the ONLY offline claim projection suitable for future
    /// viewer-facing adapter review. Check BOTH current canonical leases,
    /// current subject generation and server-owned appearance epoch on EVERY
    /// read. A historical fsynced claim stays on disk but becomes Unknown
    /// after source reconnect, disguise change or tombstone. No direct
    /// `Verified` output is possible, and no live packet is emitted.
    pub fn read_claim_for_current_viewer(
        &self,
        read: CurrentClaimRead<'_>,
    ) -> Result<CurrentClaimView, ClaimJournalError> {
        if self.poisoned {
            return Err(ClaimJournalError::Poisoned);
        }
        let actual_epoch = read
            .bridge
            .preflight_current_claim_read(
                read.observer,
                read.observer_lease,
                read.speaker,
                read.speaker_lease,
                read.leases,
            )
            .map_err(ClaimJournalError::Untrusted)?;
        if self.state.retired.contains(&read.speaker) || self.state.retired.contains(&read.observer)
        {
            return Ok(CurrentClaimView::Unknown);
        }
        match self.state.claims.get(&(read.observer, read.speaker)) {
            Some(claim)
                if claim.session_generation == read.speaker_lease.generation()
                    && claim.appearance_epoch == actual_epoch =>
            {
                Ok(CurrentClaimView::Claimed {
                    display_claim: claim.name.clone(),
                })
            }
            _ => Ok(CurrentClaimView::Unknown),
        }
    }

    /// HISTORICAL INSPECTION ONLY. This unchecked local record is NOT a
    /// current authenticated observer view, verified identity or subscriber
    /// message. Use read_claim_for_current_viewer for a gated offline view.
    #[cfg(test)]
    pub(crate) fn observed_unverified_claim(
        &self,
        observer: CharacterId,
        subject: CharacterId,
    ) -> Option<&ObservedClaim> {
        self.state.claims.get(&(observer, subject))
    }
    #[cfg(test)]
    pub(crate) fn retired(&self, subject: CharacterId) -> bool {
        self.state.retired.contains(&subject)
    }
    pub fn head(&self) -> u64 {
        self.head
    }
    #[cfg(test)]
    pub(crate) fn verify_historical_event(
        &self,
        event_id: u128,
        event: &OfflineIdentityEvent,
    ) -> Result<Option<ClaimReceipt>, ClaimJournalError> {
        if self.poisoned {
            return Err(ClaimJournalError::Poisoned);
        }
        match self.records.get(&event_id) {
            None => Ok(None),
            Some(r) if &r.event == event => Ok(Some(ClaimReceipt {
                sequence: r.sequence,
                event_id,
            })),
            Some(_) => Err(ClaimJournalError::ConflictingReplay),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        identity::{CharacterRecord, SessionLeaseRegistry},
        identity_disguise::Certainty,
    };
    use std::{
        num::NonZeroU64,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    fn actor(n: u128) -> CharacterId {
        CharacterId::new(n).unwrap()
    }
    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let dir = std::env::temp_dir().join(format!(
                "myaso-idr-offline-{}-{time}-{}",
                std::process::id(),
                TEMP.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&dir).unwrap();
            Self(dir)
        }
        fn with_bounded_writer_handoff(
            mut attempt: impl FnMut() -> Result<OfflineClaimJournal, ClaimJournalError>,
        ) -> Result<OfflineClaimJournal, ClaimJournalError> {
            // TEST FIXTURE ONLY: a recently dropped writer may retain a
            // brief POSIX descriptor teardown/scheduling window in parallel
            // tests. Never turn this into a production lock retry or accept
            // a second live writer. ALL other errors return immediately.
            let deadline = std::time::Instant::now() + Duration::from_millis(500);
            loop {
                match attempt() {
                    Err(ClaimJournalError::WriterBusy) if std::time::Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    result => return result,
                }
            }
        }

        fn try_open(&self) -> Result<OfflineClaimJournal, ClaimJournalError> {
            Self::with_bounded_writer_handoff(|| OfflineClaimJournal::open(&self.0))
        }

        fn open(&self) -> OfflineClaimJournal {
            self.try_open()
                .expect("one offline IDR writer after bounded test handoff")
        }

        fn open_with_minimum(&self, floor: u64) -> Result<OfflineClaimJournal, ClaimJournalError> {
            Self::with_bounded_writer_handoff(|| {
                OfflineClaimJournal::open_with_minimum_head(&self.0, floor)
            })
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn fixture(
        generation: u64,
        conn: u64,
    ) -> (CanonicalIdrBridge, SessionLeaseRegistry, SessionLease) {
        let mut leases = SessionLeaseRegistry::default();
        let lease = leases
            .activate_committed(
                CharacterRecord {
                    character_id: actor(0x1234_0000_0000_0001_u128),
                    session_generation: generation,
                },
                NonZeroU64::new(conn).unwrap(),
            )
            .unwrap();
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(
                actor(0x1234_0000_0000_0001),
                lease,
                &leases,
                "Aldric",
                "hooded-figure",
            )
            .unwrap();
        bridge
            .register_trusted_sentinel(actor(0x1234_0000_0000_0002), "Guardian", "hooded-figure")
            .unwrap();
        bridge
            .register_trusted_sentinel(actor(0x1234_0000_0000_0003), "Lookout", "hooded-figure")
            .unwrap();
        (bridge, leases, lease)
    }
    fn append(
        journal: &mut OfflineClaimJournal,
        bridge: &CanonicalIdrBridge,
        leases: &SessionLeaseRegistry,
        lease: SessionLease,
        observed: (CharacterId, u64, &str, u128),
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        let (observer, epoch, label, event_id) = observed;
        journal.append_unverified_claim(OfflineClaimIntent {
            bridge,
            leases,
            speaker: actor(0x1234_0000_0000_0001),
            lease,
            observer,
            appearance_epoch: epoch,
            name: label,
            event_id,
        })
    }

    fn claim_view(
        journal: &OfflineClaimJournal,
        bridge: &CanonicalIdrBridge,
        leases: &SessionLeaseRegistry,
        viewer: SessionLease,
        source: SessionLease,
    ) -> Result<CurrentClaimView, ClaimJournalError> {
        journal.read_claim_for_current_viewer(CurrentClaimRead {
            bridge,
            leases,
            observer: viewer.character_id(),
            observer_lease: viewer,
            speaker: source.character_id(),
            speaker_lease: source,
        })
    }

    #[test]
    fn current_claim_read_checks_both_actors_leases_and_source_generation_after_reconnect() {
        let root = Root::new();
        let source = actor(0x1234_0000_0000_0001);
        let viewer = actor(0x1234_0000_0000_0004);
        let sentinel = actor(0x1234_0000_0000_0002);
        let mut leases = SessionLeaseRegistry::default();
        let source_first = leases
            .activate_committed(
                CharacterRecord {
                    character_id: source,
                    session_generation: 1,
                },
                NonZeroU64::new(111).unwrap(),
            )
            .unwrap();
        let viewer_first = leases
            .activate_committed(
                CharacterRecord {
                    character_id: viewer,
                    session_generation: 1,
                },
                NonZeroU64::new(112).unwrap(),
            )
            .unwrap();
        let sentinel_fake = leases
            .activate_committed(
                CharacterRecord {
                    character_id: sentinel,
                    session_generation: 1,
                },
                NonZeroU64::new(113).unwrap(),
            )
            .unwrap();
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(source, source_first, &leases, "Aldric", "hooded-figure")
            .unwrap();
        bridge
            .register_authenticated_player(viewer, viewer_first, &leases, "Elara", "hooded-figure")
            .unwrap();
        bridge
            .register_trusted_sentinel(sentinel, "Sentinel", "hooded-figure")
            .unwrap();
        let mut journal = root.open();
        assert_eq!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_first).unwrap(),
            CurrentClaimView::Unknown,
        );
        journal
            .append_unverified_claim(OfflineClaimIntent {
                bridge: &bridge,
                leases: &leases,
                speaker: source,
                lease: source_first,
                observer: viewer,
                appearance_epoch: 1,
                name: "Tomas",
                event_id: 1001,
            })
            .unwrap();
        assert_eq!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_first).unwrap(),
            CurrentClaimView::Claimed {
                display_claim: "Tomas".to_string()
            },
        );
        assert!(
            matches!(
                claim_view(&journal, &bridge, &leases, sentinel_fake, source_first),
                Err(ClaimJournalError::Untrusted(_)),
            ),
            "NPC controller cannot borrow an authenticated player slot"
        );
        drop(journal);
        let mut journal = root.open();
        assert_eq!(journal.head(), 1);
        assert_eq!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_first).unwrap(),
            CurrentClaimView::Claimed {
                display_claim: "Tomas".to_string()
            },
        );
        // A different authenticated viewer never inherits the first
        // viewer's historical record, even with the same physical source.
        let newcomer = actor(0x1234_0000_0000_0005);
        let new_viewer = leases
            .activate_committed(
                CharacterRecord {
                    character_id: newcomer,
                    session_generation: 1,
                },
                NonZeroU64::new(114).unwrap(),
            )
            .unwrap();
        bridge
            .register_authenticated_player(newcomer, new_viewer, &leases, "Yara", "hooded-figure")
            .unwrap();
        assert_eq!(
            claim_view(&journal, &bridge, &leases, new_viewer, source_first).unwrap(),
            CurrentClaimView::Unknown,
        );

        let source_second = leases
            .activate_committed(
                CharacterRecord {
                    character_id: source,
                    session_generation: 2,
                },
                NonZeroU64::new(115).unwrap(),
            )
            .unwrap();
        assert!(
            matches!(
                claim_view(&journal, &bridge, &leases, viewer_first, source_first),
                Err(ClaimJournalError::Untrusted(_)),
            ),
            "stale original source lease is never current"
        );
        assert!(
            matches!(
                claim_view(&journal, &bridge, &leases, viewer_first, source_second),
                Err(ClaimJournalError::Untrusted(_)),
            ),
            "bridge needs authenticated canonical source generation refresh"
        );
        bridge
            .resume_authenticated_player(source, source_second, &leases)
            .unwrap();
        assert_eq!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_second).unwrap(),
            CurrentClaimView::Unknown,
            "fsynced historical claim cannot become current after subject reconnect",
        );
        assert_eq!(
            journal
                .observed_unverified_claim(viewer, source)
                .unwrap()
                .name,
            "Tomas",
            "history is still present but must not leak as current",
        );
        let historical = OfflineIdentityEvent::Claim {
            speaker: source,
            observer: viewer,
            session_generation: 1,
            appearance_epoch: 1,
            name: "Tomas".to_owned(),
        };
        assert_eq!(
            journal.verify_historical_event(1001, &historical).unwrap(),
            Some(ClaimReceipt {
                sequence: 1,
                event_id: 1001
            }),
            "historical committed receipt is NOT a current-view authorization",
        );
        assert!(matches!(
            journal.verify_historical_event(
                1001,
                &OfflineIdentityEvent::Claim {
                    speaker: source,
                    observer: viewer,
                    session_generation: 1,
                    appearance_epoch: 1,
                    name: "Impostor".to_owned()
                }
            ),
            Err(ClaimJournalError::ConflictingReplay)
        ));
        journal
            .append_unverified_claim(OfflineClaimIntent {
                bridge: &bridge,
                leases: &leases,
                speaker: source,
                lease: source_second,
                observer: viewer,
                appearance_epoch: 1,
                name: "Tomas Again",
                event_id: 1002,
            })
            .unwrap();
        assert_eq!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_second).unwrap(),
            CurrentClaimView::Claimed {
                display_claim: "Tomas Again".to_string()
            },
        );

        // A disconnected observer cannot consume historical identity data.
        assert!(leases.release(viewer_first));
        assert!(matches!(
            claim_view(&journal, &bridge, &leases, viewer_first, source_second),
            Err(ClaimJournalError::Untrusted(_))
        ));
    }

    #[test]
    fn current_claim_read_denies_appearance_aba_and_tombstone_without_erasing_history() {
        let root = Root::new();
        let source = actor(0x1234_0000_0000_0001);
        let viewer = actor(0x1234_0000_0000_0004);
        let mut leases = SessionLeaseRegistry::default();
        let s = leases
            .activate_committed(
                CharacterRecord {
                    character_id: source,
                    session_generation: 1,
                },
                NonZeroU64::new(121).unwrap(),
            )
            .unwrap();
        let v = leases
            .activate_committed(
                CharacterRecord {
                    character_id: viewer,
                    session_generation: 1,
                },
                NonZeroU64::new(122).unwrap(),
            )
            .unwrap();
        let mut bridge = CanonicalIdrBridge::default();
        bridge
            .register_authenticated_player(source, s, &leases, "Aldric", "hooded-figure")
            .unwrap();
        bridge
            .register_authenticated_player(viewer, v, &leases, "Yara", "hooded-figure")
            .unwrap();
        let mut j = root.open();
        j.append_unverified_claim(OfflineClaimIntent {
            bridge: &bridge,
            leases: &leases,
            speaker: source,
            lease: s,
            observer: viewer,
            appearance_epoch: 1,
            name: "Tomas",
            event_id: 1101,
        })
        .unwrap();
        assert!(matches!(
            claim_view(&j, &bridge, &leases, v, s).unwrap(),
            CurrentClaimView::Claimed { .. },
        ));
        bridge
            .advance_server_appearance_for_claim_journal_test(source)
            .unwrap();
        assert_eq!(j.head(), 1);
        assert_eq!(
            claim_view(&j, &bridge, &leases, v, s).unwrap(),
            CurrentClaimView::Unknown,
            "local server-side disguise transition hides still-fsynced old belief",
        );
        j.append_unverified_claim(OfflineClaimIntent {
            bridge: &bridge,
            leases: &leases,
            speaker: source,
            lease: s,
            observer: viewer,
            appearance_epoch: 2,
            name: "New Face",
            event_id: 1102,
        })
        .unwrap();
        assert_eq!(
            claim_view(&j, &bridge, &leases, v, s).unwrap(),
            CurrentClaimView::Claimed {
                display_claim: "New Face".to_string()
            },
        );
        j.append_offline_tombstone(source, 1103).unwrap();
        assert_eq!(
            claim_view(&j, &bridge, &leases, v, s).unwrap(),
            CurrentClaimView::Unknown
        );
        drop(j);
        let j = root.open();
        assert_eq!(j.head(), 3);
        assert_eq!(
            claim_view(&j, &bridge, &leases, v, s).unwrap(),
            CurrentClaimView::Unknown
        );
        assert!(j.retired(source));
        assert!(j.observed_unverified_claim(viewer, source).is_none());
    }

    #[test]
    fn two_observers_replay_exact_claim_after_restart_but_never_verify_it() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let mut journal = root.open();
        let bob = actor(0x1234_0000_0000_0002);
        let cara = actor(0x1234_0000_0000_0003);
        let first = append(&mut journal, &bridge, &leases, lease, (bob, 1, "Tomas", 77)).unwrap();
        assert_eq!(first.sequence, 1);
        assert_eq!(
            append(&mut journal, &bridge, &leases, lease, (bob, 1, "Tomas", 77)).unwrap(),
            first
        );
        assert_eq!(
            journal.head(),
            1,
            "lost ACK replay cannot add a second record"
        );
        assert_eq!(
            journal
                .observed_unverified_claim(bob, lease.character_id())
                .unwrap()
                .name,
            "Tomas"
        );
        assert!(journal
            .observed_unverified_claim(cara, lease.character_id())
            .is_none());
        assert!(matches!(
            append(
                &mut journal,
                &bridge,
                &leases,
                lease,
                (cara, 1, "Tomas", 77)
            ),
            Err(ClaimJournalError::ConflictingReplay)
        ));
        let second = append(
            &mut journal,
            &bridge,
            &leases,
            lease,
            (cara, 1, "Fake Name", 78),
        )
        .unwrap();
        assert_eq!(second.sequence, 2);
        assert_ne!(
            journal.observed_unverified_claim(bob, lease.character_id()),
            journal.observed_unverified_claim(cara, lease.character_id())
        );
        assert_eq!(
            bridge
                .observe_for_current_player(lease.character_id(), lease, &leases, bob)
                .unwrap()
                .certainty,
            Certainty::Unknown,
            "durable claim does not invent a verification"
        );
        drop(journal);
        let mut recovered = root.open();
        assert_eq!(recovered.head(), 2);
        assert_eq!(
            recovered
                .observed_unverified_claim(bob, lease.character_id())
                .unwrap()
                .sequence,
            1
        );
        assert_eq!(
            recovered
                .observed_unverified_claim(cara, lease.character_id())
                .unwrap()
                .sequence,
            2
        );
        assert_eq!(
            append(
                &mut recovered,
                &bridge,
                &leases,
                lease,
                (bob, 1, "Tomas", 77)
            )
            .unwrap(),
            first
        );
        assert!(matches!(
            append(
                &mut recovered,
                &bridge,
                &leases,
                lease,
                (bob, 1, "Aldric", 77)
            ),
            Err(ClaimJournalError::ConflictingReplay)
        ));
        assert_eq!(recovered.head(), 2);
    }

    #[test]
    fn newer_generation_and_appearance_fence_old_packets_and_invalidate_old_observations() {
        let root = Root::new();
        let (mut bridge, mut leases, first_lease) = fixture(1, 51);
        let bob = actor(0x1234_0000_0000_0002);
        let cara = actor(0x1234_0000_0000_0003);
        let mut j = root.open();
        append(&mut j, &bridge, &leases, first_lease, (bob, 1, "Marta", 1)).unwrap();
        let second_lease = leases
            .activate_committed(
                CharacterRecord {
                    character_id: first_lease.character_id(),
                    session_generation: 2,
                },
                NonZeroU64::new(52).unwrap(),
            )
            .unwrap();
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                first_lease,
                (cara, 1, "Forged", 2)
            ),
            Err(ClaimJournalError::Untrusted(_))
        ));
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                second_lease,
                (cara, 1, "Forged", 2)
            ),
            Err(ClaimJournalError::Untrusted(_))
        ));
        bridge
            .resume_authenticated_player(first_lease.character_id(), second_lease, &leases)
            .unwrap();
        // A caller-proposed FUTURE appearance must NOT be able to advance
        // the persisted subject epoch or erase existing observer knowledge.
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                second_lease,
                (cara, 2, "Fake Future Face", 3),
            ),
            Err(ClaimJournalError::StaleAppearance)
        ));
        assert_eq!(j.head(), 1);
        assert!(j
            .observed_unverified_claim(bob, first_lease.character_id())
            .is_some());
        // The only permitted epoch advance comes from server-owned IDR
        // subject state. In production World8C+Physics must authorize this.
        bridge
            .advance_server_appearance_for_claim_journal_test(first_lease.character_id())
            .unwrap();
        append(
            &mut j,
            &bridge,
            &leases,
            second_lease,
            (cara, 2, "New Face", 3),
        )
        .unwrap();
        assert!(
            j.observed_unverified_claim(bob, first_lease.character_id())
                .is_none(),
            "new appearance invalidates a non-witness claim"
        );
        assert_eq!(
            j.observed_unverified_claim(cara, first_lease.character_id())
                .unwrap()
                .appearance_epoch,
            2
        );
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                second_lease,
                (bob, 1, "Old Face", 4)
            ),
            Err(ClaimJournalError::StaleAppearance)
        ));
        assert_eq!(j.head(), 2);
        drop(j);
        let mut recovered = root.open();
        assert!(matches!(
            append(
                &mut recovered,
                &bridge,
                &leases,
                second_lease,
                (bob, 1, "Old Face", 5)
            ),
            Err(ClaimJournalError::StaleAppearance)
        ));
        assert!(recovered
            .observed_unverified_claim(bob, first_lease.character_id())
            .is_none());
    }

    #[test]
    fn rollback_of_valid_older_snapshot_needs_externally_protected_head_floor() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let bob = actor(0x1234_0000_0000_0002);
        let cara = actor(0x1234_0000_0000_0003);
        let mut j = root.open();
        append(&mut j, &bridge, &leases, lease, (bob, 1, "Marta", 1)).unwrap();
        append(&mut j, &bridge, &leases, lease, (cara, 1, "Elara", 2)).unwrap();
        assert_eq!(j.head(), 2);
        drop(j);

        // Adversary restores a previously valid prefix without corrupting
        // any record: checksum + contiguous sequence CANNOT detect it.
        fs::remove_file(root.0.join(filename(2))).unwrap();
        assert_eq!(root.open().head(), 1);
        assert!(matches!(
            root.open_with_minimum(2),
            Err(ClaimJournalError::RollbackSuspected)
        ));
        assert_eq!(root.open_with_minimum(1).unwrap().head(), 1);
        // A stale/forged floor is not trustworthy; future Core authority
        // must durably protect this monotonic value OUTSIDE these files.
    }

    #[test]
    fn persistent_tombstone_corruption_and_missing_sequence_fail_closed() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let bob = actor(0x1234_0000_0000_0002);
        let mut j = root.open();
        append(&mut j, &bridge, &leases, lease, (bob, 1, "Anyone", 9)).unwrap();
        let tomb = j
            .append_offline_tombstone(lease.character_id(), 10)
            .unwrap();
        assert_eq!(tomb.sequence, 2);
        assert!(j
            .observed_unverified_claim(bob, lease.character_id())
            .is_none());
        assert!(j.retired(lease.character_id()));
        assert_eq!(
            j.append_offline_tombstone(lease.character_id(), 10)
                .unwrap(),
            tomb
        );
        assert!(matches!(
            append(&mut j, &bridge, &leases, lease, (bob, 1, "Resurrect", 11)),
            Err(ClaimJournalError::Retired)
        ));
        drop(j);
        let mut j = root.open();
        assert!(j.retired(lease.character_id()));
        assert_eq!(j.head(), 2);
        assert!(j
            .observed_unverified_claim(bob, lease.character_id())
            .is_none());
        assert!(matches!(
            append(&mut j, &bridge, &leases, lease, (bob, 1, "Resurrect", 13)),
            Err(ClaimJournalError::Retired)
        ));
        drop(j);
        let path = root.0.join(filename(2));
        let good = fs::read(&path).unwrap();
        let mut corrupt = good.clone();
        corrupt[32] ^= 4;
        fs::write(&path, &corrupt).unwrap();
        assert!(matches!(
            root.try_open(),
            Err(ClaimJournalError::Invalid("MYID checksum"))
        ));
        fs::write(&path, &good).unwrap();
        // Explicitly close the recovered writer before intentionally
        // damaging the underlying directory. Avoid relying on the drop
        // timing of a temporary expression within assert_eq! on CI.
        let intact = root.open();
        assert_eq!(intact.head(), 2);
        drop(intact);
        fs::remove_file(root.0.join(filename(1))).unwrap();
        match root.try_open() {
            Err(ClaimJournalError::SequenceGap) => {}
            Ok(_) => panic!("missing first MYID record unexpectedly recovered"),
            Err(other) => panic!("expected sequence-gap denial, got {other:?}"),
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linked_root_and_writer_lock_never_redirect_identity_store_or_chmod_victim() {
        use std::os::unix::{fs::symlink, fs::PermissionsExt};
        let source = Root::new();
        let external = Root::new();
        // Repointing a supposed MYID directory to another directory must
        // deny before chmod, lock creation or any event operation.
        let linked_root = source.0.join("linked-idr-root");
        fs::set_permissions(&external.0, fs::Permissions::from_mode(0o755)).unwrap();
        symlink(&external.0, &linked_root).unwrap();
        assert!(matches!(
            OfflineClaimJournal::open(&linked_root),
            Err(ClaimJournalError::Invalid(
                "MYID root must be a real directory, not a symlink"
            ))
        ));
        assert_eq!(
            fs::metadata(&external.0).unwrap().permissions().mode() & 0o777,
            0o755,
            "denied root symlink must never chmod external directory",
        );

        // A malicious alternate lock symlink must fail rather than locking
        // and possibly writing the unrelated victim; no writer admitted.
        let victim = external.0.join("other-account-private.txt");
        fs::write(&victim, b"DO_NOT_TOUCH").unwrap();
        fs::set_permissions(&victim, fs::Permissions::from_mode(0o600)).unwrap();
        symlink(&victim, source.0.join(".identity-writer.lock")).unwrap();
        assert!(OfflineClaimJournal::open(&source.0).is_err());
        assert_eq!(fs::read(&victim).unwrap(), b"DO_NOT_TOUCH");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linked_or_permission_weak_record_is_not_replayed_as_a_real_identity_event() {
        use std::os::unix::{fs::symlink, fs::PermissionsExt};
        let root = Root::new();
        let external = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let mut journal = root.open();
        append(
            &mut journal,
            &bridge,
            &leases,
            lease,
            (actor(0x1234_0000_0000_0002), 1, "Tomas", 100),
        )
        .unwrap();
        drop(journal);
        let original = root.0.join(filename(1));
        let authentic = fs::read(&original).unwrap();

        // A valid original MYID record through a symlink remains forbidden.
        let victim = external.0.join("actual-record.myid");
        fs::write(&victim, &authentic).unwrap();
        fs::set_permissions(&victim, fs::Permissions::from_mode(0o600)).unwrap();
        fs::remove_file(&original).unwrap();
        symlink(&victim, &original).unwrap();
        assert!(matches!(
            root.try_open(),
            Err(ClaimJournalError::Invalid(
                "MYID directory contains linked storage"
            ))
        ));
        assert_eq!(fs::read(&victim).unwrap(), authentic);

        // Even a second hardlink to a regular, byte-valid record is refused;
        // an alternate path could otherwise mutate the same inode.
        fs::remove_file(&original).unwrap();
        fs::hard_link(&victim, &original).unwrap();
        assert!(matches!(
            root.try_open(),
            Err(ClaimJournalError::Invalid(
                "MYID lock/event must be a private regular file with one link"
            ))
        ));
        fs::remove_file(&original).unwrap();
        fs::write(&original, &authentic).unwrap();
        fs::set_permissions(&original, fs::Permissions::from_mode(0o644)).unwrap();
        assert!(matches!(
            root.try_open(),
            Err(ClaimJournalError::Invalid(
                "MYID lock/event must be a private regular file with one link"
            ))
        ));

        // Only one owner-private original regular file may recover.
        fs::set_permissions(&original, fs::Permissions::from_mode(0o600)).unwrap();
        let recovered = root.open();
        assert_eq!(recovered.head(), 1);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn directory_rebind_after_root_pin_cannot_move_recovered_identity_to_new_path() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let observer = actor(0x1234_0000_0000_0002);
        let mut j = root.open();
        append(&mut j, &bridge, &leases, lease, (observer, 1, "Tomas", 501)).unwrap();
        drop(j);

        let moved = root.0.with_extension("pinned-recovery-original");
        // The hook runs AFTER the real O_DIRECTORY|O_NOFOLLOW pin but
        // BEFORE acquiring the lock or listing MYID event names.
        let open_result = OfflineClaimJournal::open_with_pinned_hook(&root.0, || {
            fs::rename(&root.0, &moved).unwrap();
            fs::create_dir(&root.0).unwrap();
        });
        assert!(matches!(
            open_result,
            Err(ClaimJournalError::Invalid(
                "MYID writer lock/directory binding changed"
            ))
        ));
        assert!(
            !root.0.join(".identity-writer.lock").exists(),
            "replaced path did not receive a misdirected lock"
        );
        assert!(
            !root.0.join(filename(1)).exists(),
            "replacement directory did not inherit private identity data"
        );
        assert!(moved.join(".identity-writer.lock").is_file());
        assert!(moved.join(filename(1)).is_file());
        // Once opened by its ACTUAL new name, the same original committed
        // claim is still recovered exactly once.
        let restored =
            Root::with_bounded_writer_handoff(|| OfflineClaimJournal::open(&moved)).unwrap();
        assert_eq!(restored.head(), 1);
        assert_eq!(
            restored
                .observed_unverified_claim(observer, lease.character_id())
                .unwrap()
                .name,
            "Tomas",
        );
        drop(restored);
        fs::remove_dir_all(moved).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn directory_rebind_between_preflight_and_create_writes_only_into_pinned_root() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let observer = actor(0x1234_0000_0000_0002);
        let mut writer = root.open();
        append(
            &mut writer,
            &bridge,
            &leases,
            lease,
            (observer, 1, "Tomas", 301),
        )
        .unwrap();

        let moved = root.0.with_extension("pinned-dirfd-old-root");
        let target = Record {
            sequence: 2,
            event_id: 302,
            event: OfflineIdentityEvent::Claim {
                speaker: lease.character_id(),
                observer,
                session_generation: 1,
                appearance_epoch: 1,
                name: "Pinned Only".to_owned(),
            },
        };
        // Deterministically rename the journal AFTER the production anchor
        // preflight but BEFORE openat. Path-based OpenOptions would write
        // under the replacement root. Dirfd-relative creation MUST NOT.
        let outcome = writer.persist_after_preflight(&target, || {
            fs::rename(&root.0, &moved).unwrap();
            fs::create_dir(&root.0).unwrap();
        });
        assert!(matches!(
            outcome,
            Err(ClaimJournalError::Invalid(
                "MYID writer lock/directory binding changed"
            ))
        ));
        assert!(!root.0.join(filename(2)).exists());
        assert!(!root.0.join(".identity-writer.lock").exists());
        assert!(moved.join(filename(2)).exists());
        assert_eq!(fs::read(moved.join(filename(2))).unwrap(), encode(&target));
        assert_eq!(writer.head(), 1, "no uncommitted ACK/sequence advance");
        drop(writer);

        // Crash/reopen of the *original moved* directory replays both
        // committed files exactly once. A successful caller ACK was never
        // issued for the second record; this is a historical recovery event.
        let recovered =
            Root::with_bounded_writer_handoff(|| OfflineClaimJournal::open(&moved)).unwrap();
        assert_eq!(recovered.head(), 2);
        assert_eq!(
            recovered
                .observed_unverified_claim(observer, lease.character_id())
                .unwrap()
                .name,
            "Pinned Only"
        );
        drop(recovered);
        fs::remove_dir_all(moved).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn pinned_rename_noreplace_preserves_existing_commit_and_cleans_staging() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let observer = actor(0x1234_0000_0000_0002);
        let mut writer = root.open();
        append(
            &mut writer,
            &bridge,
            &leases,
            lease,
            (observer, 1, "Tomas", 401),
        )
        .unwrap();
        let first_path = root.0.join(filename(1));
        let committed = fs::read(&first_path).unwrap();
        let conflicting = Record {
            sequence: 1,
            event_id: 402,
            event: OfflineIdentityEvent::Claim {
                speaker: lease.character_id(),
                observer,
                session_generation: 1,
                appearance_epoch: 1,
                name: "Replacement Forbidden".to_owned(),
            },
        };
        assert!(matches!(
            writer.persist_after_preflight(&conflicting, || {}),
            Err(ClaimJournalError::Io(_))
        ));
        assert_eq!(fs::read(&first_path).unwrap(), committed);
        assert_eq!(writer.head(), 1);
        let entries: Vec<_> = fs::read_dir(&root.0)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        assert!(
            entries.iter().all(|name| !name.starts_with(".staging-")),
            "refused overwrite must clean up only its original staged entry"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn unlinked_and_recreated_writer_lock_does_not_let_original_writer_append() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let mut first = root.open();
        let observer = actor(0x1234_0000_0000_0002);
        append(
            &mut first,
            &bridge,
            &leases,
            lease,
            (observer, 1, "Tomas", 100),
        )
        .unwrap();
        assert_eq!(first.head(), 1);

        // POSIX flock binds to an OPEN INODE. Unlinking its directory entry
        // and recreating a fresh same-name lock can allow another process
        // to acquire an independent lock while the first writer lives.
        fs::remove_file(root.0.join(".identity-writer.lock")).unwrap();
        let second = OfflineClaimJournal::open(&root.0).unwrap();
        assert_eq!(second.head(), 1);
        assert_eq!(
            second.head(),
            first.head(),
            "a second unrelated lock can reopen the same historical head",
        );

        assert!(matches!(
            append(
                &mut first,
                &bridge,
                &leases,
                lease,
                (observer, 1, "Danger", 101)
            ),
            Err(ClaimJournalError::Invalid(
                "MYID writer lock/directory binding changed"
            ))
        ));
        assert_eq!(first.head(), 1);
        assert!(!root.0.join(filename(2)).exists());
        assert!(matches!(
            append(
                &mut first,
                &bridge,
                &leases,
                lease,
                (observer, 1, "Denied", 102)
            ),
            Err(ClaimJournalError::Poisoned)
        ));
        drop(second);
        drop(first);
        assert_eq!(root.open().head(), 1, "no competing first-writer ACK");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn renamed_and_rebound_journal_root_cannot_redirect_old_writer_commit() {
        let root = Root::new();
        let (bridge, leases, lease) = fixture(1, 51);
        let mut j = root.open();
        let observer = actor(0x1234_0000_0000_0002);
        append(&mut j, &bridge, &leases, lease, (observer, 1, "Tomas", 201)).unwrap();
        let moved = root.0.with_extension("renamed-writer-root");
        fs::rename(&root.0, &moved).unwrap();
        fs::create_dir(&root.0).unwrap();
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                lease,
                (observer, 1, "No Rebind", 202)
            ),
            Err(ClaimJournalError::Invalid(
                "MYID writer lock/directory binding changed"
            ))
        ));
        assert_eq!(j.head(), 1);
        assert!(!root.0.join(filename(2)).exists());
        assert!(!moved.join(filename(2)).exists());
        assert_eq!(fs::read(moved.join(filename(1))).unwrap().len(), LEN);
        drop(j);
        fs::remove_dir_all(moved).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn sigkill_after_commit_before_observer_ack_recovers_one_unverified_claim() {
        use std::{process::Command, thread, time::Instant};
        let root = Root::new();
        let ready = root.0.join(".child-ready");
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--ignored",
                "--exact",
                "idr_claim_journal::tests::subprocess_commit_before_ack",
                "--nocapture",
            ])
            .env("MYASO_IDR_CHILD_DIR", &root.0)
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut committed = false;
        while Instant::now() < deadline {
            if ready.exists() {
                committed = true;
                break;
            }
            if child.try_wait().unwrap().is_some() {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        let busy = committed
            && matches!(
                OfflineClaimJournal::open(&root.0),
                Err(ClaimJournalError::WriterBusy)
            );
        let _ = child.kill();
        let _ = child.wait();
        assert!(
            committed && busy,
            "must fsync event before SIGKILL while owning writer lock"
        );
        fs::remove_file(ready).unwrap(); // observer-delivery marker is NOT a canonical record
        let (bridge, leases, lease) = fixture(1, 51);
        let observer = actor(0x1234_0000_0000_0002);
        let mut j = root.open();
        assert_eq!(j.head(), 1);
        assert_eq!(
            j.observed_unverified_claim(observer, lease.character_id())
                .unwrap()
                .name,
            "Marta"
        );
        let receipt = append(&mut j, &bridge, &leases, lease, (observer, 1, "Marta", 100)).unwrap();
        assert_eq!(receipt.sequence, 1);
        assert_eq!(
            j.head(),
            1,
            "retry after lost ACK must not mint duplicate evidence"
        );
        assert!(matches!(
            append(
                &mut j,
                &bridge,
                &leases,
                lease,
                (observer, 1, "Counterfeit", 100)
            ),
            Err(ClaimJournalError::ConflictingReplay)
        ));
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "only launched by SIGKILL recovery parent"]
    fn subprocess_commit_before_ack() {
        let Some(root) = std::env::var_os("MYASO_IDR_CHILD_DIR") else {
            return;
        };
        let (bridge, leases, lease) = fixture(1, 51);
        let mut j = OfflineClaimJournal::open(&root).unwrap();
        append(
            &mut j,
            &bridge,
            &leases,
            lease,
            (actor(0x1234_0000_0000_0002), 1, "Marta", 100),
        )
        .unwrap();
        fs::write(
            PathBuf::from(root).join(".child-ready"),
            b"fsynced but no ACK",
        )
        .unwrap();
        loop {
            std::thread::park();
        }
    }
}
