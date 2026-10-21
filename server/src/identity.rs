//! Dormant identity/persistence wire contract and session fencing primitives.
//!
//! No live connection uses this module yet. Authentication and durable storage
//! MUST be integrated before a network request can select a CharacterId or
//! activate a session. A checksum detects accidental corruption, not forgery.

use std::{collections::BTreeMap, num::NonZeroU64};

const RECORD_MAGIC: [u8; 4] = *b"MYCH";
const RECORD_VERSION: u8 = 1;
pub const CHARACTER_RECORD_BYTES: usize = 36;

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct CharacterId(u128);

impl CharacterId {
    pub fn new(id: u128) -> Option<Self> {
        (id != 0).then_some(Self(id))
    }

    pub fn get(self) -> u128 {
        self.0
    }
}

/// Persist this record atomically before allowing its generation to drive a
/// live connection. CharacterId must be resolved by trusted authentication,
/// never accepted directly from a browser packet.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CharacterRecord {
    pub character_id: CharacterId,
    pub session_generation: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CharacterRecordError {
    InvalidLength,
    InvalidMagic,
    UnsupportedVersion(u8),
    NonZeroReserved,
    InvalidCharacterId,
    ChecksumMismatch,
    GenerationExhausted,
}

impl CharacterRecord {
    pub fn new(character_id: CharacterId) -> Self {
        Self {
            character_id,
            session_generation: 0,
        }
    }

    /// Prepare an epoch transition. This is not a durable commit: the caller
    /// must write, fsync and atomically publish the returned record first.
    pub fn next_generation(self) -> Result<Self, CharacterRecordError> {
        let session_generation = self
            .session_generation
            .checked_add(1)
            .ok_or(CharacterRecordError::GenerationExhausted)?;
        Ok(Self {
            session_generation,
            ..self
        })
    }

    pub fn encode(self) -> [u8; CHARACTER_RECORD_BYTES] {
        let mut bytes = [0_u8; CHARACTER_RECORD_BYTES];
        bytes[..4].copy_from_slice(&RECORD_MAGIC);
        bytes[4] = RECORD_VERSION;
        bytes[8..24].copy_from_slice(&self.character_id.get().to_le_bytes());
        bytes[24..32].copy_from_slice(&self.session_generation.to_le_bytes());
        let checksum = fnv1a32(&bytes[..32]);
        bytes[32..36].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, CharacterRecordError> {
        if bytes.len() != CHARACTER_RECORD_BYTES {
            return Err(CharacterRecordError::InvalidLength);
        }
        if !bytes.starts_with(&RECORD_MAGIC) {
            return Err(CharacterRecordError::InvalidMagic);
        }
        if bytes[4] != RECORD_VERSION {
            return Err(CharacterRecordError::UnsupportedVersion(bytes[4]));
        }
        if bytes[5..8].iter().any(|&byte| byte != 0) {
            return Err(CharacterRecordError::NonZeroReserved);
        }
        let actual_checksum = u32::from_le_bytes(bytes[32..36].try_into().expect("length checked"));
        if actual_checksum != fnv1a32(&bytes[..32]) {
            return Err(CharacterRecordError::ChecksumMismatch);
        }
        let id = u128::from_le_bytes(bytes[8..24].try_into().expect("length checked"));
        let character_id = CharacterId::new(id).ok_or(CharacterRecordError::InvalidCharacterId)?;
        let session_generation =
            u64::from_le_bytes(bytes[24..32].try_into().expect("length checked"));
        Ok(Self {
            character_id,
            session_generation,
        })
    }
}

/// FNV is deliberately a non-cryptographic corruption check. Authentication
/// and integrity of persistence media are separate integration requirements.
fn fnv1a32(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5_u32, |hash, &byte| {
        (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193)
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SessionLease {
    character_id: CharacterId,
    generation: u64,
    connection_id: NonZeroU64,
}

impl SessionLease {
    pub fn character_id(self) -> CharacterId {
        self.character_id
    }

    pub fn generation(self) -> u64 {
        self.generation
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LeaseError {
    UncommittedGeneration,
    StaleOrDuplicateGeneration,
    ConnectionAlreadyActive,
}

#[derive(Clone, Copy, Debug)]
struct LeaseSlot {
    generation: u64,
    active_connection: Option<NonZeroU64>,
}

/// A connection fence only. A disconnected character retains its high-water
/// generation in memory so that replay cannot reuse an old committed epoch.
/// Crash/restart protection depends on loading an atomically persisted record.
#[derive(Default, Debug)]
pub struct SessionLeaseRegistry {
    slots: BTreeMap<CharacterId, LeaseSlot>,
}

impl SessionLeaseRegistry {
    /// The supplied record must already have been durably committed by a
    /// trusted authentication/storage layer. This method cannot verify that.
    pub fn activate_committed(
        &mut self,
        committed: CharacterRecord,
        connection_id: NonZeroU64,
    ) -> Result<SessionLease, LeaseError> {
        if committed.session_generation == 0 {
            return Err(LeaseError::UncommittedGeneration);
        }
        if self
            .slots
            .values()
            .any(|slot| slot.active_connection == Some(connection_id))
        {
            return Err(LeaseError::ConnectionAlreadyActive);
        }
        if self
            .slots
            .get(&committed.character_id)
            .is_some_and(|slot| committed.session_generation <= slot.generation)
        {
            return Err(LeaseError::StaleOrDuplicateGeneration);
        }
        let lease = SessionLease {
            character_id: committed.character_id,
            generation: committed.session_generation,
            connection_id,
        };
        self.slots.insert(
            committed.character_id,
            LeaseSlot {
                generation: committed.session_generation,
                active_connection: Some(connection_id),
            },
        );
        Ok(lease)
    }

    pub fn is_current(&self, lease: SessionLease) -> bool {
        self.slots.get(&lease.character_id).is_some_and(|slot| {
            slot.generation == lease.generation
                && slot.active_connection == Some(lease.connection_id)
        })
    }

    /// A delayed disconnect from a superseded connection must never evict
    /// its successor. Preserve high-water generation after disconnect.
    pub fn release(&mut self, lease: SessionLease) -> bool {
        if !self.is_current(lease) {
            return false;
        }
        if let Some(slot) = self.slots.get_mut(&lease.character_id) {
            slot.active_connection = None;
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn character(n: u128) -> CharacterId {
        CharacterId::new(n).expect("nonzero ID")
    }

    fn connection(n: u64) -> NonZeroU64 {
        NonZeroU64::new(n).expect("nonzero connection ID")
    }

    #[test]
    fn versioned_record_round_trips_and_preserves_all_identity_bits() {
        let record = CharacterRecord {
            character_id: character(0x1234_5678_90ab_cdef_0011_2233_4455_6677),
            session_generation: u64::MAX - 1,
        };
        let bytes = record.encode();
        assert_eq!(bytes.len(), CHARACTER_RECORD_BYTES);
        assert_eq!(&bytes[..4], b"MYCH");
        assert_eq!(bytes[4], RECORD_VERSION);
        assert_eq!(&bytes[8..24], &record.character_id.get().to_le_bytes());
        assert_eq!(CharacterRecord::decode(&bytes), Ok(record));
        assert_eq!(
            CharacterRecord::decode(&bytes[..35]),
            Err(CharacterRecordError::InvalidLength)
        );
        let mut extra = bytes.to_vec();
        extra.push(0);
        assert_eq!(
            CharacterRecord::decode(&extra),
            Err(CharacterRecordError::InvalidLength)
        );
    }

    #[test]
    fn damaged_unknown_or_zero_identity_records_fail_closed() {
        let good = CharacterRecord::new(character(42)).encode();
        let mut bad = good;
        bad[0] ^= 1;
        assert_eq!(
            CharacterRecord::decode(&bad),
            Err(CharacterRecordError::InvalidMagic)
        );
        bad = good;
        bad[4] = 2;
        assert_eq!(
            CharacterRecord::decode(&bad),
            Err(CharacterRecordError::UnsupportedVersion(2))
        );
        bad = good;
        bad[7] = 1;
        assert_eq!(
            CharacterRecord::decode(&bad),
            Err(CharacterRecordError::NonZeroReserved)
        );
        bad = good;
        bad[8] ^= 1;
        assert_eq!(
            CharacterRecord::decode(&bad),
            Err(CharacterRecordError::ChecksumMismatch)
        );
        bad = good;
        bad[8..24].fill(0);
        let checksum = fnv1a32(&bad[..32]);
        bad[32..36].copy_from_slice(&checksum.to_le_bytes());
        assert_eq!(
            CharacterRecord::decode(&bad),
            Err(CharacterRecordError::InvalidCharacterId)
        );
        assert!(CharacterId::new(0).is_none());
    }

    #[test]
    fn generation_advances_and_never_wraps() {
        let initial = CharacterRecord::new(character(9));
        assert_eq!(initial.session_generation, 0);
        let first = initial.next_generation().expect("first");
        assert_eq!(first.session_generation, 1);
        let restored = CharacterRecord::decode(&first.encode()).expect("restored committed state");
        assert_eq!(
            restored
                .next_generation()
                .expect("second")
                .session_generation,
            2
        );
        let exhausted = CharacterRecord {
            session_generation: u64::MAX,
            ..initial
        };
        assert_eq!(
            exhausted.next_generation(),
            Err(CharacterRecordError::GenerationExhausted)
        );
    }

    #[test]
    fn fencing_rejects_duplicate_stale_and_released_generations() {
        let mut registry = SessionLeaseRegistry::default();
        let original = CharacterRecord::new(character(7));
        assert_eq!(
            registry.activate_committed(original, connection(1)),
            Err(LeaseError::UncommittedGeneration)
        );
        let first_record = original.next_generation().expect("epoch one");
        let first = registry
            .activate_committed(first_record, connection(1))
            .expect("first");
        assert!(registry.is_current(first));
        assert_eq!(
            registry.activate_committed(first_record, connection(2)),
            Err(LeaseError::StaleOrDuplicateGeneration)
        );
        let second_record = first_record.next_generation().expect("epoch two");
        let second = registry
            .activate_committed(second_record, connection(2))
            .expect("takeover");
        assert!(!registry.is_current(first));
        assert!(!registry.release(first));
        assert!(registry.is_current(second));
        assert!(registry.release(second));
        assert!(!registry.is_current(second));
        assert_eq!(
            registry.activate_committed(second_record, connection(3)),
            Err(LeaseError::StaleOrDuplicateGeneration)
        );
        let third = registry
            .activate_committed(
                second_record.next_generation().expect("third"),
                connection(3),
            )
            .expect("third");
        assert!(registry.is_current(third));
    }

    #[test]
    fn one_connection_cannot_claim_two_characters() {
        let mut registry = SessionLeaseRegistry::default();
        let first = CharacterRecord::new(character(1))
            .next_generation()
            .expect("epoch one");
        let second = CharacterRecord::new(character(2))
            .next_generation()
            .expect("epoch one");
        let first_lease = registry
            .activate_committed(first, connection(51))
            .expect("first");
        assert_eq!(
            registry.activate_committed(second, connection(51)),
            Err(LeaseError::ConnectionAlreadyActive)
        );
        assert!(registry.is_current(first_lease));
        assert!(registry.activate_committed(second, connection(52)).is_ok());
    }
}
