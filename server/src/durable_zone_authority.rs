//! Dormant C4b: crash-recoverable local zone authority with OS writer lock.
//!
//! This is NOT distributed CAS: lock guarantees apply only to cooperating
//! processes on a filesystem with reliable local advisory locking, hard-link,
//! atomic create and file/directory sync semantics. No network partitions,
//! shared NFS, worker identity auth or live world integration are supported.

use crate::{
    identity::CharacterId,
    zone_lease::{
        AuthorityError, AuthorityLease, HandoffTicket, OwnedEntity, WorkerId, ZoneKey,
        ZoneLeaseRegistry,
    },
};
use std::{
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    num::NonZeroU128,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

// Rust's std File::try_lock is not stable until 1.89; the server's MSRV is
// 1.88. Use a narrowly scoped POSIX advisory lock on supported Unix hosts.
#[cfg(unix)]
unsafe extern "C" {
    fn flock(fd: std::os::raw::c_int, operation: std::os::raw::c_int) -> std::os::raw::c_int;
}

#[cfg(unix)]
fn try_exclusive_os_lock(file: &File) -> io::Result<bool> {
    use std::os::fd::AsRawFd;
    // POSIX flock constants: exclusive=2, nonblocking=4. Linux local
    // filesystems and cooperating processes are the only supported model.
    // SAFETY: file owns a valid descriptor throughout this foreign call.
    let result = unsafe { flock(file.as_raw_fd(), 2 | 4) };
    if result == 0 {
        Ok(true)
    } else {
        let error = io::Error::last_os_error();
        if error.kind() == io::ErrorKind::WouldBlock {
            Ok(false)
        } else {
            Err(error)
        }
    }
}

#[cfg(unix)]
fn release_os_lock(file: &File) -> io::Result<()> {
    use std::os::fd::AsRawFd;
    // POSIX flock LOCK_UN=8. The file descriptor is still open here.
    // SAFETY: file owns a valid descriptor throughout this foreign call.
    let result = unsafe { flock(file.as_raw_fd(), 8) };
    if result == 0 { Ok(()) } else { Err(io::Error::last_os_error()) }
}

#[cfg(not(unix))]
fn try_exclusive_os_lock(_file: &File) -> io::Result<bool> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "local zone locks require Unix"))
}

#[cfg(not(unix))]
fn release_os_lock(_file: &File) -> io::Result<()> {
    Ok(())
}

const MAGIC: [u8; 4] = *b"MYZA";
const VERSION: u8 = 1;
const RECORD_BYTES: usize = 96;
static NEXT_STAGE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum DurableAuthorityError {
    Busy,
    Io(io::Error),
    InvalidRecord(&'static str),
    InvalidSequence,
    InvalidTransition(AuthorityError),
    Poisoned,
    OperationReused,
}

impl From<io::Error> for DurableAuthorityError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
enum Action {
    Register = 1,
    Prepare = 2,
    Commit = 3,
    Abort = 4,
    Retire = 5,
}
impl Action {
    fn parse(code: u8) -> Result<Self, DurableAuthorityError> {
        match code {
            1 => Ok(Self::Register),
            2 => Ok(Self::Prepare),
            3 => Ok(Self::Commit),
            4 => Ok(Self::Abort),
            5 => Ok(Self::Retire),
            _ => Err(DurableAuthorityError::InvalidRecord(
                "unknown authority action",
            )),
        }
    }
}
#[derive(Clone, Copy, Debug)]
struct Event {
    sequence: u64,
    action: Action,
    entity: OwnedEntity,
    worker: WorkerId,
    zone: ZoneKey,
    epoch: u64,
    target_worker: Option<WorkerId>,
    target_zone: Option<ZoneKey>,
    operation: Option<NonZeroU128>,
}
impl Event {
    fn from_lease(sequence: u64, action: Action, lease: AuthorityLease) -> Self {
        Self {
            sequence,
            action,
            entity: lease.entity(),
            worker: lease.worker(),
            zone: lease.zone(),
            epoch: lease.epoch(),
            target_worker: None,
            target_zone: None,
            operation: None,
        }
    }

    fn from_ticket(sequence: u64, action: Action, ticket: HandoffTicket) -> Self {
        let mut event = Self::from_lease(sequence, action, ticket.source());
        let (target_worker, target_zone) = ticket.destination();
        event.target_worker = Some(target_worker);
        event.target_zone = Some(target_zone);
        event.operation = Some(ticket.operation());
        event
    }

    fn matches_lease(self, lease: AuthorityLease) -> bool {
        self.entity == lease.entity()
            && self.worker == lease.worker()
            && self.zone == lease.zone()
            && self.epoch == lease.epoch()
    }

    fn matches_ticket(self, ticket: HandoffTicket) -> bool {
        let (worker, zone) = ticket.destination();
        self.matches_lease(ticket.source())
            && self.target_worker == Some(worker)
            && self.target_zone == Some(zone)
            && self.operation == Some(ticket.operation())
    }

    fn encode(self) -> [u8; RECORD_BYTES] {
        let mut bytes = [0_u8; RECORD_BYTES];
        bytes[..4].copy_from_slice(&MAGIC);
        bytes[4] = VERSION;
        bytes[8..16].copy_from_slice(&self.sequence.to_le_bytes());
        bytes[16] = self.action as u8;
        let (entity_kind, entity_id) = match self.entity {
            OwnedEntity::Character(id) => (1_u8, id.get()),
            OwnedEntity::GroundItem(id) => (2_u8, id.get()),
        };
        bytes[17] = entity_kind;
        bytes[20..36].copy_from_slice(&entity_id.to_le_bytes());
        bytes[36..44].copy_from_slice(&self.worker.get().to_le_bytes());
        bytes[44..52].copy_from_slice(&self.zone.get().to_le_bytes());
        bytes[52..60].copy_from_slice(&self.epoch.to_le_bytes());
        bytes[60..68].copy_from_slice(&self.target_worker.map_or(0, WorkerId::get).to_le_bytes());
        bytes[68..76].copy_from_slice(&self.target_zone.map_or(0, ZoneKey::get).to_le_bytes());
        bytes[76..92].copy_from_slice(&self.operation.map_or(0, NonZeroU128::get).to_le_bytes());
        let checksum = fnv32(&bytes[..92]);
        bytes[92..96].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    fn decode(bytes: &[u8]) -> Result<Self, DurableAuthorityError> {
        if bytes.len() != RECORD_BYTES {
            return Err(DurableAuthorityError::InvalidRecord("bad record length"));
        }
        if bytes[..4] != MAGIC
            || bytes[4] != VERSION
            || bytes[5..8].iter().any(|&b| b != 0)
            || bytes[18..20].iter().any(|&b| b != 0)
        {
            return Err(DurableAuthorityError::InvalidRecord(
                "magic, version or reserved bits",
            ));
        }
        let expected = u32::from_le_bytes(bytes[92..96].try_into().expect("size"));
        if fnv32(&bytes[..92]) != expected {
            return Err(DurableAuthorityError::InvalidRecord("checksum mismatch"));
        }
        let sequence = u64::from_le_bytes(bytes[8..16].try_into().expect("size"));
        let action = Action::parse(bytes[16])?;
        let id = u128::from_le_bytes(bytes[20..36].try_into().expect("size"));
        let entity = match bytes[17] {
            1 => OwnedEntity::Character(
                CharacterId::new(id)
                    .ok_or(DurableAuthorityError::InvalidRecord("zero character"))?,
            ),
            2 => OwnedEntity::ground_item(id)
                .ok_or(DurableAuthorityError::InvalidRecord("zero item"))?,
            _ => return Err(DurableAuthorityError::InvalidRecord("unknown entity kind")),
        };
        let number = |range: std::ops::Range<usize>| {
            u64::from_le_bytes(bytes[range].try_into().expect("size"))
        };
        let worker = WorkerId::new(number(36..44))
            .ok_or(DurableAuthorityError::InvalidRecord("zero owner worker"))?;
        let zone = ZoneKey::new(number(44..52))
            .ok_or(DurableAuthorityError::InvalidRecord("zero owner zone"))?;
        let epoch = number(52..60);
        let target_worker = WorkerId::new(number(60..68));
        let target_zone = ZoneKey::new(number(68..76));
        let raw_op = u128::from_le_bytes(bytes[76..92].try_into().expect("size"));
        let operation = NonZeroU128::new(raw_op);
        let is_transfer = matches!(action, Action::Prepare | Action::Commit | Action::Abort);
        if sequence == 0
            || epoch == 0
            || (if is_transfer {
                target_worker.is_none() || target_zone.is_none() || operation.is_none()
            } else {
                target_worker.is_some() || target_zone.is_some() || operation.is_some()
            })
        {
            return Err(DurableAuthorityError::InvalidRecord(
                "missing/unexpected fields",
            ));
        }
        if action == Action::Register && epoch != 1 {
            return Err(DurableAuthorityError::InvalidRecord(
                "registration epoch not one",
            ));
        }
        let event = Self {
            sequence,
            action,
            entity,
            worker,
            zone,
            epoch,
            target_worker,
            target_zone,
            operation,
        };
        if event.encode() != bytes {
            return Err(DurableAuthorityError::InvalidRecord(
                "noncanonical encoding",
            ));
        }
        Ok(event)
    }
}

fn fnv32(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5_u32, |hash, &byte| {
        (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193)
    })
}
fn canonical_name(sequence: u64) -> String {
    format!("{sequence:020}.myza")
}
fn sync_dir(root: &Path) -> io::Result<()> {
    File::open(root)?.sync_all()
}
struct Stage(PathBuf);
impl Drop for Stage {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn apply_event(
    registry: &mut ZoneLeaseRegistry,
    event: Event,
) -> Result<(), DurableAuthorityError> {
    match event.action {
        Action::Register => {
            let lease = registry
                .register(event.entity, event.worker, event.zone)
                .map_err(DurableAuthorityError::InvalidTransition)?;
            if !event.matches_lease(lease) {
                return Err(DurableAuthorityError::InvalidRecord(
                    "registration mismatch",
                ));
            }
        }
        Action::Prepare => {
            let source =
                registry
                    .current(event.entity)
                    .ok_or(DurableAuthorityError::InvalidRecord(
                        "prepare missing source",
                    ))?;
            if !event.matches_lease(source) {
                return Err(DurableAuthorityError::InvalidRecord("prepare stale lease"));
            }
            let ticket = registry
                .prepare(
                    source,
                    event.target_worker.expect("decoded transfer"),
                    event.target_zone.expect("decoded transfer"),
                    event.operation.expect("decoded transfer"),
                )
                .map_err(DurableAuthorityError::InvalidTransition)?;
            if !event.matches_ticket(ticket) {
                return Err(DurableAuthorityError::InvalidRecord("prepare mismatch"));
            }
        }
        Action::Commit | Action::Abort => {
            let ticket =
                registry
                    .pending(event.entity)
                    .ok_or(DurableAuthorityError::InvalidRecord(
                        "unprepared commit/abort",
                    ))?;
            if !event.matches_ticket(ticket) {
                return Err(DurableAuthorityError::InvalidRecord(
                    "commit/abort mismatch",
                ));
            }
            if event.action == Action::Commit {
                registry
                    .commit(ticket)
                    .map_err(DurableAuthorityError::InvalidTransition)?;
            } else {
                registry
                    .abort(ticket)
                    .map_err(DurableAuthorityError::InvalidTransition)?;
            }
        }
        Action::Retire => {
            let lease = registry
                .current(event.entity)
                .ok_or(DurableAuthorityError::InvalidRecord("retire missing lease"))?;
            if !event.matches_lease(lease) {
                return Err(DurableAuthorityError::InvalidRecord("retire stale lease"));
            }
            registry
                .retire(lease)
                .map_err(DurableAuthorityError::InvalidTransition)?;
        }
    }
    Ok(())
}

/// Local durable authority, held exclusively by ONE cooperating OS process.
/// `try_lock` is OS-enforced on a local filesystem. The lock is released on
/// process death, so clean/warm takeover can replay committed epochs.
/// A replicated database/consensus system is still required across hosts.
#[derive(Debug)]
pub struct DurableZoneAuthority {
    root: PathBuf,
    _writer_lock: File,
    registry: ZoneLeaseRegistry,
    operation_ids: BTreeSet<NonZeroU128>,
    sequence: u64,
    poisoned: bool,
}

impl Drop for DurableZoneAuthority {
    fn drop(&mut self) {
        // Release immediately on normal shutdown. The operating system also
        // releases this advisory lock when the owning process terminates.
        let _ = release_os_lock(&self._writer_lock);
    }
}

impl DurableZoneAuthority {
    pub fn open(root: impl AsRef<Path>) -> Result<Self, DurableAuthorityError> {
        fs::create_dir_all(root.as_ref())?;
        let root = root.as_ref().to_path_buf();
        let mut lock_options = OpenOptions::new();
        lock_options.read(true).write(true).create(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            lock_options.mode(0o600);
        }
        let lock = lock_options.open(root.join(".zone-authority.lock"))?;
        match try_exclusive_os_lock(&lock) {
            Ok(true) => {}
            Ok(false) => return Err(DurableAuthorityError::Busy),
            Err(error) => return Err(DurableAuthorityError::Io(error)),
        }
        let mut commits = Vec::new();
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name
                .to_str()
                .ok_or(DurableAuthorityError::InvalidRecord("non-UTF8 name"))?;
            if name == ".zone-authority.lock" || name.starts_with(".pending-zone-") {
                continue;
            }
            if name.len() != 25
                || !name.ends_with(".myza")
                || !name[..20].bytes().all(|b| b.is_ascii_digit())
            {
                return Err(DurableAuthorityError::InvalidRecord("unexpected file"));
            }
            let sequence = name[..20]
                .parse::<u64>()
                .map_err(|_| DurableAuthorityError::InvalidRecord("invalid sequence"))?;
            if sequence == 0 || canonical_name(sequence) != name || !entry.file_type()?.is_file() {
                return Err(DurableAuthorityError::InvalidRecord(
                    "noncanonical journal file",
                ));
            }
            commits.push((sequence, entry.path()));
        }
        commits.sort_unstable_by_key(|x| x.0);
        let mut sequence = 0_u64;
        let mut registry = ZoneLeaseRegistry::new();
        let mut operation_ids = BTreeSet::new();
        for (number, path) in commits {
            if sequence.checked_add(1) != Some(number) {
                return Err(DurableAuthorityError::InvalidSequence);
            }
            let mut bytes = Vec::new();
            Read::by_ref(&mut File::open(path)?)
                .take((RECORD_BYTES + 1) as u64)
                .read_to_end(&mut bytes)?;
            let event = Event::decode(&bytes)?;
            if event.sequence != number {
                return Err(DurableAuthorityError::InvalidSequence);
            }
            if event.action == Action::Prepare
                && !operation_ids.insert(event.operation.expect("validated transfer"))
            {
                return Err(DurableAuthorityError::InvalidRecord("reused operation ID"));
            }
            apply_event(&mut registry, event)?;
            sequence = number;
        }
        Ok(Self {
            root,
            _writer_lock: lock,
            registry,
            operation_ids,
            sequence,
            poisoned: false,
        })
    }

    pub fn current(&self, entity: OwnedEntity) -> Option<AuthorityLease> {
        if self.poisoned {
            None
        } else {
            self.registry.current(entity)
        }
    }
    pub fn can_mutate(&self, lease: AuthorityLease) -> bool {
        !self.poisoned && self.registry.can_mutate(lease)
    }
    pub fn pending(&self, entity: OwnedEntity) -> Option<HandoffTicket> {
        if self.poisoned {
            None
        } else {
            self.registry.pending(entity)
        }
    }
    pub fn sequence(&self) -> u64 {
        self.sequence
    }

    /// Stage the entire next in-memory state, durably publish one event,
    /// then atomically swap that state. No world update before fsync.
    fn persist<T>(
        &mut self,
        next: ZoneLeaseRegistry,
        event: Event,
        result: T,
    ) -> Result<T, DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        let number = self
            .sequence
            .checked_add(1)
            .ok_or(DurableAuthorityError::InvalidSequence)?;
        if event.sequence != number {
            return Err(DurableAuthorityError::InvalidSequence);
        }
        let clock = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| DurableAuthorityError::InvalidRecord("clock before Unix epoch"))?
            .as_nanos();
        let nonce = NEXT_STAGE.fetch_add(1, Ordering::Relaxed);
        let stage = Stage(self.root.join(format!(
            ".pending-zone-{}-{clock}-{nonce}",
            std::process::id()
        )));
        let bytes = event.encode();
        let committed: io::Result<()> = (|| {
            let mut opts = OpenOptions::new();
            opts.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                opts.mode(0o600);
            }
            let mut file = opts.open(&stage.0)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            drop(file);
            fs::hard_link(&stage.0, self.root.join(canonical_name(number)))?;
            sync_dir(&self.root)?;
            Ok(())
        })();
        if let Err(e) = committed {
            self.poisoned = true;
            return Err(DurableAuthorityError::Io(e));
        }
        drop(stage);
        self.registry = next;
        self.sequence = number;
        Ok(result)
    }

    pub fn register(
        &mut self,
        entity: OwnedEntity,
        worker: WorkerId,
        zone: ZoneKey,
    ) -> Result<AuthorityLease, DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        let mut next = self.registry.clone();
        let lease = next
            .register(entity, worker, zone)
            .map_err(DurableAuthorityError::InvalidTransition)?;
        let event = Event::from_lease(self.sequence.saturating_add(1), Action::Register, lease);
        self.persist(next, event, lease)
    }
    pub fn prepare(
        &mut self,
        source: AuthorityLease,
        target_worker: WorkerId,
        target_zone: ZoneKey,
        operation: NonZeroU128,
    ) -> Result<HandoffTicket, DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        // Repeated exact prepare is an idempotent read, not a new event.
        if let Some(previous) = self.registry.pending(source.entity()) {
            let (worker, zone) = previous.destination();
            if previous.source() == source
                && worker == target_worker
                && zone == target_zone
                && previous.operation() == operation
            {
                return Ok(previous);
            }
        }
        let mut next = self.registry.clone();
        let ticket = next
            .prepare(source, target_worker, target_zone, operation)
            .map_err(DurableAuthorityError::InvalidTransition)?;
        if self.operation_ids.contains(&operation) {
            return Err(DurableAuthorityError::OperationReused);
        }
        let committed = self.persist(
            next,
            Event::from_ticket(self.sequence.saturating_add(1), Action::Prepare, ticket),
            ticket,
        )?;
        self.operation_ids.insert(operation);
        Ok(committed)
    }
    pub fn commit(
        &mut self,
        ticket: HandoffTicket,
    ) -> Result<AuthorityLease, DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        if self.registry.pending(ticket.source().entity()).is_none() {
            // A confirmed repeated ACK is safe only while that exact new
            // lease remains current. Never create a second commit record.
            let mut cloned = self.registry.clone();
            let receipt = cloned
                .commit(ticket)
                .map_err(DurableAuthorityError::InvalidTransition)?;
            return Ok(receipt);
        }
        let mut next = self.registry.clone();
        let lease = next
            .commit(ticket)
            .map_err(DurableAuthorityError::InvalidTransition)?;
        let event = Event::from_ticket(self.sequence.saturating_add(1), Action::Commit, ticket);
        self.persist(next, event, lease)
    }
    pub fn abort(&mut self, ticket: HandoffTicket) -> Result<(), DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        let mut next = self.registry.clone();
        next.abort(ticket)
            .map_err(DurableAuthorityError::InvalidTransition)?;
        let event = Event::from_ticket(self.sequence.saturating_add(1), Action::Abort, ticket);
        self.persist(next, event, ())
    }
    pub fn retire(&mut self, lease: AuthorityLease) -> Result<(), DurableAuthorityError> {
        if self.poisoned {
            return Err(DurableAuthorityError::Poisoned);
        }
        let mut next = self.registry.clone();
        next.retire(lease)
            .map_err(DurableAuthorityError::InvalidTransition)?;
        let event = Event::from_lease(self.sequence.saturating_add(1), Action::Retire, lease);
        self.persist(next, event, ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let counter = NEXT_STAGE.fetch_add(1, Ordering::Relaxed);
            let clock = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-c4b-{}-{clock}-{counter}",
                std::process::id()
            ));
            fs::create_dir(&path).expect("root");
            Self(path)
        }
        fn open(&self) -> DurableZoneAuthority {
            DurableZoneAuthority::open(&self.0).expect("open")
        }
        fn record(&self, sequence: u64) -> PathBuf {
            self.0.join(canonical_name(sequence))
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn entity(n: u128) -> OwnedEntity {
        OwnedEntity::Character(CharacterId::new(n).expect("character"))
    }
    fn item(n: u128) -> OwnedEntity {
        OwnedEntity::ground_item(n).expect("item")
    }
    fn worker(n: u64) -> WorkerId {
        WorkerId::new(n).expect("worker")
    }
    fn zone(n: u64) -> ZoneKey {
        ZoneKey::new(n).expect("zone")
    }
    fn op(n: u128) -> NonZeroU128 {
        NonZeroU128::new(n).expect("op")
    }

    #[test]
    fn restart_recovers_committed_owner_epoch_and_invalidates_source() {
        let root = Root::new();
        let mut first = root.open();
        let source = first
            .register(entity(1), worker(1), zone(1))
            .expect("register");
        let ticket = first
            .prepare(source, worker(2), zone(3), op(77))
            .expect("prepare");
        assert!(!first.can_mutate(source));
        let successor = first.commit(ticket).expect("commit");
        assert_eq!(successor.epoch(), 2);
        drop(first);
        let after = root.open();
        assert_eq!(after.current(entity(1)), Some(successor));
        assert!(!after.can_mutate(source));
        assert!(after.can_mutate(successor));
        assert_eq!(after.sequence(), 3);
    }

    #[test]
    fn interrupted_prepare_restart_stays_frozen_until_abort() {
        let root = Root::new();
        let mut initial = root.open();
        let source = initial
            .register(entity(1), worker(1), zone(1))
            .expect("register");
        let ticket = initial
            .prepare(source, worker(2), zone(2), op(1))
            .expect("prepare");
        drop(initial);
        let mut restored = root.open();
        assert!(!restored.can_mutate(source));
        assert_eq!(restored.pending(entity(1)), Some(ticket));
        restored.abort(ticket).expect("abort");
        assert!(restored.can_mutate(source));
        assert_eq!(restored.sequence(), 3);
    }

    #[test]
    fn committed_transfer_retry_after_restart_never_spends_new_epoch() {
        let root = Root::new();
        let mut journal = root.open();
        let source = journal
            .register(item(10), worker(1), zone(1))
            .expect("register");
        let t = journal
            .prepare(source, worker(2), zone(2), op(5))
            .expect("prepare");
        let new = journal.commit(t).expect("commit");
        drop(journal);
        let mut restored = root.open();
        assert_eq!(restored.commit(t).expect("idempotent ACK"), new);
        assert_eq!(restored.sequence(), 3);
        assert_eq!(restored.current(item(10)), Some(new));
    }

    #[test]
    fn commit_published_before_ack_replays_as_exactly_one_new_owner() {
        let root = Root::new();
        let mut original = root.open();
        let source = original
            .register(item(42), worker(1), zone(1))
            .expect("register");
        let prepared = original
            .prepare(source, worker(2), zone(2), op(420))
            .expect("prepare");
        drop(original);

        // Simulate a process dying after publishing the canonical commit but
        // before applying it in memory or acknowledging the new worker.
        let event = Event::from_ticket(3, Action::Commit, prepared);
        fs::write(root.record(3), event.encode()).expect("simulate committed event");
        let mut recovered = root.open();
        let new = recovered.current(item(42)).expect("durable successor");
        assert_eq!(new.worker(), worker(2));
        assert_eq!(new.zone(), zone(2));
        assert_eq!(new.epoch(), 2);
        assert!(!recovered.can_mutate(source));
        assert!(recovered.can_mutate(new));
        assert_eq!(recovered.commit(prepared).expect("ACK retry"), new);
        assert_eq!(recovered.sequence(), 3);
        assert!(!root.record(4).exists());
    }

    #[test]
    fn operation_id_reuse_after_abort_or_restart_fails_closed() {
        let root = Root::new();
        let mut store = root.open();
        let one = store.register(item(111), worker(1), zone(1)).expect("one");
        let two = store.register(item(222), worker(1), zone(1)).expect("two");
        let ticket = store
            .prepare(one, worker(2), zone(2), op(900))
            .expect("prepare");
        store.abort(ticket).expect("abort");
        assert!(matches!(
            store.prepare(two, worker(3), zone(3), op(900)),
            Err(DurableAuthorityError::OperationReused)
        ));
        assert_eq!(store.sequence(), 4);
        drop(store);
        let mut restarted = root.open();
        assert!(matches!(
            restarted.prepare(two, worker(3), zone(3), op(900)),
            Err(DurableAuthorityError::OperationReused)
        ));
        assert!(restarted.can_mutate(two));
        assert_eq!(restarted.sequence(), 4);
    }

    #[test]
    fn two_independent_instances_cannot_hold_one_writer_lock() {
        let root = Root::new();
        let first = root.open();
        assert!(matches!(
            DurableZoneAuthority::open(&root.0),
            Err(DurableAuthorityError::Busy)
        ));
        drop(first);
        assert!(DurableZoneAuthority::open(&root.0).is_ok());
    }

    #[test]
    fn canonical_corruption_and_missing_commit_fail_closed() {
        let root = Root::new();
        let mut store = root.open();
        store
            .register(item(1), worker(1), zone(1))
            .expect("register");
        store
            .register(item(2), worker(1), zone(2))
            .expect("register");
        drop(store);
        fs::remove_file(root.record(1)).expect("create sequence gap");
        assert!(matches!(
            DurableZoneAuthority::open(&root.0),
            Err(DurableAuthorityError::InvalidSequence)
        ));
        fs::write(root.record(1), b"garbage").expect("corrupt canonical");
        assert!(matches!(
            DurableZoneAuthority::open(&root.0),
            Err(DurableAuthorityError::InvalidRecord(_))
        ));
    }

    #[test]
    fn orphan_stage_ignored_but_unprepared_commit_fails_closed() {
        let root = Root::new();
        let mut original = root.open();
        let lease = original
            .register(item(1), worker(1), zone(1))
            .expect("register");
        drop(original);
        fs::write(root.0.join(".pending-zone-power-loss"), b"partial").expect("orphan");
        assert!(root.open().can_mutate(lease));
        let forged = Event::from_lease(2, Action::Register, lease);
        let mut illegal = Event {
            action: Action::Commit,
            ..forged
        };
        illegal.target_worker = Some(worker(2));
        illegal.target_zone = Some(zone(2));
        illegal.operation = Some(op(2));
        fs::write(root.record(2), illegal.encode()).expect("inject orphan commit");
        assert!(matches!(
            DurableZoneAuthority::open(&root.0),
            Err(DurableAuthorityError::InvalidRecord(_))
        ));
    }

    #[test]
    fn dead_entity_ids_remain_retired_after_restart() {
        let root = Root::new();
        let mut store = root.open();
        let lease = store
            .register(item(10), worker(1), zone(1))
            .expect("register");
        store.retire(lease).expect("retire");
        drop(store);
        let mut recovered = root.open();
        assert!(!recovered.can_mutate(lease));
        assert_eq!(recovered.current(item(10)), None);
        assert!(matches!(
            recovered.register(item(10), worker(1), zone(1)),
            Err(DurableAuthorityError::InvalidTransition(
                AuthorityError::EntityAlreadyRegistered
            ))
        ));
    }

    #[test]
    fn transfer_conflicts_do_not_create_phantom_commits() {
        let root = Root::new();
        let mut journal = root.open();
        let source = journal
            .register(entity(7), worker(1), zone(1))
            .expect("register");
        let ticket = journal
            .prepare(source, worker(2), zone(2), op(1))
            .expect("prepare");
        assert!(matches!(
            journal.prepare(source, worker(3), zone(3), op(1)),
            Err(DurableAuthorityError::InvalidTransition(
                AuthorityError::TransferConflict
            ))
        ));
        assert_eq!(journal.sequence(), 2);
        journal.commit(ticket).expect("commit");
        assert_eq!(journal.sequence(), 3);
    }

    #[cfg(unix)]
    #[test]
    fn new_local_authority_records_are_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let root = Root::new();
        let mut journal = root.open();
        journal
            .register(item(22), worker(1), zone(1))
            .expect("register");
        let mode = fs::metadata(root.record(1))
            .expect("metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn separate_process_cannot_claim_same_directory() {
        let root = Root::new();
        let _guard = root.open();
        let status = Command::new(std::env::current_exe().expect("test binary"))
            .arg("--ignored")
            .arg("--exact")
            .arg("durable_zone_authority::tests::subprocess_lock_probe")
            .arg("--nocapture")
            .env("MYASO_ZONE_LOCK_PROBE_PATH", &root.0)
            .status()
            .expect("launch process");
        assert!(status.success());
    }

    #[test]
    #[ignore = "only run explicitly from parent subprocess-lock test"]
    fn subprocess_lock_probe() {
        let root = match std::env::var_os("MYASO_ZONE_LOCK_PROBE_PATH") {
            Some(path) => PathBuf::from(path),
            None => return,
        };
        assert!(matches!(
            DurableZoneAuthority::open(&root),
            Err(DurableAuthorityError::Busy)
        ));
    }
}
