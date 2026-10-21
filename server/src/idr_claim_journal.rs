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
    _lock: File,
    records: BTreeMap<u128, Record>,
    head: u64,
    state: Projection,
    poisoned: bool,
}
impl OfflineClaimJournal {
    pub fn open(root: impl AsRef<Path>) -> Result<Self, ClaimJournalError> {
        let root = root.as_ref();
        fs::create_dir_all(root)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(root, fs::Permissions::from_mode(0o700))?;
        }
        let mut options = OpenOptions::new();
        options.create(true).read(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let lock = options.open(root.join(".identity-writer.lock"))?;
        if !exclusive_lock(&lock)? {
            return Err(ClaimJournalError::WriterBusy);
        }
        let mut out = Self {
            root: root.to_path_buf(),
            _lock: lock,
            records: BTreeMap::new(),
            head: 0,
            state: Projection::default(),
            poisoned: false,
        };
        let mut paths = Vec::new();
        for entry in fs::read_dir(root)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name
                .to_str()
                .ok_or(ClaimJournalError::Invalid("invalid filename"))?;
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
            paths.push((n, entry.path()));
        }
        paths.sort_by_key(|(n, _)| *n);
        if paths.len() > MAX_IDR_OFFLINE_EVENTS {
            return Err(ClaimJournalError::Capacity);
        }
        for (n, path) in paths {
            if out.head.checked_add(1) != Some(n) {
                return Err(ClaimJournalError::SequenceGap);
            }
            let mut bytes = Vec::new();
            File::open(path)?
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
        let final_path = self.root.join(filename(rec.sequence));
        if final_path.exists() {
            return Err(ClaimJournalError::Invalid("occupied sequence"));
        }
        let tmp = self.root.join(format!(
            ".staging-{}-{}",
            std::process::id(),
            TEMP.fetch_add(1, Ordering::Relaxed)
        ));
        let mut opts = OpenOptions::new();
        opts.create_new(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600);
        }
        let mut f = opts.open(&tmp)?;
        f.write_all(&encode(rec))?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, final_path)?;
        File::open(&self.root)?.sync_all()?;
        Ok(())
    }
    fn append(
        &mut self,
        event_id: u128,
        event: OfflineIdentityEvent,
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        if self.poisoned {
            return Err(ClaimJournalError::Poisoned);
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
        intent
            .bridge
            .preflight_offline_unverified_claim(
                intent.speaker,
                intent.lease,
                intent.leases,
                intent.observer,
                intent.name,
            )
            .map_err(ClaimJournalError::Untrusted)?;
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
    pub fn append_offline_tombstone(
        &mut self,
        subject: CharacterId,
        event_id: u128,
    ) -> Result<ClaimReceipt, ClaimJournalError> {
        self.append(event_id, OfflineIdentityEvent::Tombstone { subject })
    }
    pub fn observed_unverified_claim(
        &self,
        observer: CharacterId,
        subject: CharacterId,
    ) -> Option<&ObservedClaim> {
        self.state.claims.get(&(observer, subject))
    }
    pub fn retired(&self, subject: CharacterId) -> bool {
        self.state.retired.contains(&subject)
    }
    pub fn head(&self) -> u64 {
        self.head
    }
    pub fn verify_historical_event(
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
        fn open(&self) -> OfflineClaimJournal {
            OfflineClaimJournal::open(&self.0).unwrap()
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
            OfflineClaimJournal::open_with_minimum_head(&root.0, 2),
            Err(ClaimJournalError::RollbackSuspected)
        ));
        assert_eq!(
            OfflineClaimJournal::open_with_minimum_head(&root.0, 1)
                .unwrap()
                .head(),
            1
        );
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
            append(&mut j, &bridge, &leases, lease, (bob, 2, "Resurrect", 11)),
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
            append(&mut j, &bridge, &leases, lease, (bob, 2, "Resurrect", 13)),
            Err(ClaimJournalError::Retired)
        ));
        drop(j);
        let path = root.0.join(filename(2));
        let good = fs::read(&path).unwrap();
        let mut corrupt = good.clone();
        corrupt[32] ^= 4;
        fs::write(&path, &corrupt).unwrap();
        assert!(matches!(
            OfflineClaimJournal::open(&root.0),
            Err(ClaimJournalError::Invalid("MYID checksum"))
        ));
        fs::write(&path, &good).unwrap();
        assert_eq!(root.open().head(), 2);
        fs::remove_file(root.0.join(filename(1))).unwrap();
        assert!(matches!(
            OfflineClaimJournal::open(&root.0),
            Err(ClaimJournalError::SequenceGap)
        ));
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
