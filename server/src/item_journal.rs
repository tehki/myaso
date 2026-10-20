//! Dormant local write-ahead item journal with exactly-once replay semantics.
//!
//! Single writer, trusted directory, local atomic hard-link + directory fsync
//! only. No cross-process locking, distributed CAS, game-server integration,
//! item authorization, shared-store safety, or production rollout is implied.

use crate::{
    identity::CharacterId,
    item_ownership::{
        CorpseId, ItemId, ItemLocation, ItemOwnershipLedger, OwnershipError, OwnershipOp,
        OwnershipReceipt, OwnershipTxnId, ZoneId, MAX_OWNERSHIP_OPS,
    },
};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const MAGIC: &[u8; 4] = b"MYTX";
const VERSION: u8 = 1;
const HEADER_BYTES: usize = 36;
const LOCATION_BYTES: usize = 26;
const OP_BYTES: usize = 1 + 16 + 2 * LOCATION_BYTES;
const CHECKSUM_BYTES: usize = 4;
const MAX_RECORD_BYTES: usize = HEADER_BYTES + OP_BYTES * MAX_OWNERSHIP_OPS + CHECKSUM_BYTES;
static NEXT_PENDING: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum ItemJournalError {
    Io(io::Error),
    InvalidRecord(&'static str),
    InvalidSequence,
    InvalidTransaction(OwnershipError),
    Poisoned,
}

impl From<io::Error> for ItemJournalError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

#[derive(Debug)]
struct JournalRecord {
    sequence: u64,
    transaction: OwnershipTxnId,
    operations: Vec<OwnershipOp>,
}

fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5_u32, |acc, &byte| {
        (acc ^ u32::from(byte)).wrapping_mul(0x0100_0193)
    })
}

fn encode_location(location: Option<ItemLocation>, output: &mut Vec<u8>) {
    let mut bytes = [0_u8; LOCATION_BYTES];
    match location {
        None => {}
        Some(ItemLocation::Inventory(character)) => {
            bytes[0] = 1;
            bytes[1..17].copy_from_slice(&character.get().to_le_bytes());
        }
        Some(ItemLocation::Equipped { character_id, slot }) => {
            bytes[0] = 2;
            bytes[1..17].copy_from_slice(&character_id.get().to_le_bytes());
            bytes[17] = slot;
        }
        Some(ItemLocation::Corpse(corpse)) => {
            bytes[0] = 3;
            bytes[1..17].copy_from_slice(&corpse.get().to_le_bytes());
        }
        Some(ItemLocation::Ground {
            zone_id,
            x_cm,
            y_cm,
        }) => {
            bytes[0] = 4;
            bytes[1..9].copy_from_slice(&zone_id.get().to_le_bytes());
            bytes[18..22].copy_from_slice(&x_cm.to_le_bytes());
            bytes[22..26].copy_from_slice(&y_cm.to_le_bytes());
        }
    }
    output.extend_from_slice(&bytes);
}

fn decode_location(bytes: &[u8]) -> Result<Option<ItemLocation>, ItemJournalError> {
    if bytes.len() != LOCATION_BYTES {
        return Err(ItemJournalError::InvalidRecord("bad location length"));
    }
    let id = u128::from_le_bytes(bytes[1..17].try_into().expect("length checked"));
    let slot = bytes[17];
    let x_cm = i32::from_le_bytes(bytes[18..22].try_into().expect("length checked"));
    let y_cm = i32::from_le_bytes(bytes[22..26].try_into().expect("length checked"));
    let unused = slot == 0 && x_cm == 0 && y_cm == 0;
    match bytes[0] {
        0 if bytes.iter().all(|&b| b == 0) => Ok(None),
        1 if unused => CharacterId::new(id)
            .map(ItemLocation::Inventory)
            .map(Some)
            .ok_or(ItemJournalError::InvalidRecord(
                "invalid inventory character",
            )),
        2 if x_cm == 0 && y_cm == 0 => CharacterId::new(id)
            .map(|character_id| ItemLocation::Equipped { character_id, slot })
            .map(Some)
            .ok_or(ItemJournalError::InvalidRecord(
                "invalid equipment character",
            )),
        3 if unused => CorpseId::new(id)
            .map(ItemLocation::Corpse)
            .map(Some)
            .ok_or(ItemJournalError::InvalidRecord("invalid corpse ID")),
        4 if slot == 0 && id <= u64::MAX as u128 => ZoneId::new(id as u64)
            .map(|zone_id| ItemLocation::Ground {
                zone_id,
                x_cm,
                y_cm,
            })
            .map(Some)
            .ok_or(ItemJournalError::InvalidRecord("invalid zone ID")),
        _ => Err(ItemJournalError::InvalidRecord("invalid location fields")),
    }
}

fn encode(record: &JournalRecord) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(HEADER_BYTES + record.operations.len() * OP_BYTES + 4);
    bytes.extend_from_slice(MAGIC);
    bytes.extend_from_slice(&[VERSION, 0, 0, 0]);
    bytes.extend_from_slice(&record.sequence.to_le_bytes());
    bytes.extend_from_slice(&record.transaction.get().to_le_bytes());
    bytes.extend_from_slice(&(record.operations.len() as u16).to_le_bytes());
    bytes.extend_from_slice(&[0, 0]);
    for &op in &record.operations {
        let (kind, from, to) = match op {
            OwnershipOp::Create { at, .. } => (1, None, Some(at)),
            OwnershipOp::Move { from, to, .. } => (2, Some(from), Some(to)),
            OwnershipOp::Destroy { from, .. } => (3, Some(from), None),
        };
        bytes.push(kind);
        bytes.extend_from_slice(&op.item().get().to_le_bytes());
        encode_location(from, &mut bytes);
        encode_location(to, &mut bytes);
    }
    let sum = checksum(&bytes);
    bytes.extend_from_slice(&sum.to_le_bytes());
    bytes
}

fn decode(bytes: &[u8]) -> Result<JournalRecord, ItemJournalError> {
    if bytes.len() < HEADER_BYTES + CHECKSUM_BYTES || bytes.len() > MAX_RECORD_BYTES {
        return Err(ItemJournalError::InvalidRecord(
            "record size outside bounds",
        ));
    }
    if &bytes[..4] != MAGIC {
        return Err(ItemJournalError::InvalidRecord("invalid magic"));
    }
    if bytes[4] != VERSION
        || bytes[5..8].iter().any(|&x| x != 0)
        || bytes[34..36].iter().any(|&x| x != 0)
    {
        return Err(ItemJournalError::InvalidRecord(
            "unsupported version/reserved bits",
        ));
    }
    let sequence = u64::from_le_bytes(bytes[8..16].try_into().expect("length checked"));
    let id = u128::from_le_bytes(bytes[16..32].try_into().expect("length checked"));
    let transaction =
        OwnershipTxnId::new(id).ok_or(ItemJournalError::InvalidRecord("zero transaction id"))?;
    let count = u16::from_le_bytes(bytes[32..34].try_into().expect("length checked")) as usize;
    if sequence == 0 || count == 0 || count > MAX_OWNERSHIP_OPS {
        return Err(ItemJournalError::InvalidRecord("invalid sequence/count"));
    }
    if bytes.len() != HEADER_BYTES + count * OP_BYTES + CHECKSUM_BYTES {
        return Err(ItemJournalError::InvalidRecord("unexpected record length"));
    }
    let end = bytes.len() - CHECKSUM_BYTES;
    let expected = u32::from_le_bytes(bytes[end..].try_into().expect("length checked"));
    if checksum(&bytes[..end]) != expected {
        return Err(ItemJournalError::InvalidRecord("checksum mismatch"));
    }
    let mut operations = Vec::with_capacity(count);
    for op_bytes in bytes[HEADER_BYTES..end].chunks_exact(OP_BYTES) {
        let kind = op_bytes[0];
        let raw_item = u128::from_le_bytes(op_bytes[1..17].try_into().expect("length checked"));
        let item = ItemId::new(raw_item).ok_or(ItemJournalError::InvalidRecord("zero item id"))?;
        let from = decode_location(&op_bytes[17..17 + LOCATION_BYTES])?;
        let to = decode_location(&op_bytes[17 + LOCATION_BYTES..])?;
        let op = match (kind, from, to) {
            (1, None, Some(at)) => OwnershipOp::Create { item, at },
            (2, Some(from), Some(to)) => OwnershipOp::Move { item, from, to },
            (3, Some(from), None) => OwnershipOp::Destroy { item, from },
            _ => {
                return Err(ItemJournalError::InvalidRecord(
                    "bad operation type/locations",
                ))
            }
        };
        operations.push(op);
    }
    Ok(JournalRecord {
        sequence,
        transaction,
        operations,
    })
}

fn canonical_name(sequence: u64) -> String {
    format!("{sequence:020}.mytx")
}

fn sync_directory(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

struct PendingFile(PathBuf);
impl Drop for PendingFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

/// Fail-closed on any malformed canonical record or sequence gap. Dot-prefixed
/// interrupted staging files are not authoritative. No networking or gameplay
/// subsystem invokes this journal until durable multi-worker storage exists.
#[derive(Debug)]
pub struct DurableItemJournal {
    root: PathBuf,
    ledger: ItemOwnershipLedger,
    poisoned: bool,
}

impl DurableItemJournal {
    pub fn open(root: impl AsRef<Path>) -> Result<Self, ItemJournalError> {
        fs::create_dir_all(root.as_ref())?;
        let root = root.as_ref().to_path_buf();
        let mut indexed = Vec::new();
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            let name = entry.file_name();
            let name = name
                .to_str()
                .ok_or(ItemJournalError::InvalidRecord("non-UTF8 filename"))?;
            if name.starts_with(".pending-") {
                continue;
            }
            if name.len() != 25 || !name.ends_with(".mytx") {
                return Err(ItemJournalError::InvalidRecord("unexpected journal file"));
            }
            let digits = &name[..20];
            if !digits.bytes().all(|digit| digit.is_ascii_digit()) {
                return Err(ItemJournalError::InvalidRecord(
                    "noncanonical sequence filename",
                ));
            }
            let sequence = digits
                .parse::<u64>()
                .map_err(|_| ItemJournalError::InvalidRecord("sequence overflow"))?;
            if sequence == 0 || canonical_name(sequence) != name || !entry.file_type()?.is_file() {
                return Err(ItemJournalError::InvalidRecord("invalid journal entry"));
            }
            indexed.push((sequence, entry.path()));
        }
        indexed.sort_unstable_by_key(|(sequence, _)| *sequence);
        let mut ledger = ItemOwnershipLedger::default();
        let mut previous = 0_u64;
        for (sequence, path) in indexed {
            if previous.checked_add(1) != Some(sequence) {
                return Err(ItemJournalError::InvalidSequence);
            }
            let mut bytes = Vec::new();
            Read::by_ref(&mut File::open(&path)?)
                .take((MAX_RECORD_BYTES + 1) as u64)
                .read_to_end(&mut bytes)?;
            let record = decode(&bytes)?;
            if record.sequence != sequence {
                return Err(ItemJournalError::InvalidSequence);
            }
            let (preview, replay) = ledger
                .preview(record.transaction, &record.operations)
                .map_err(ItemJournalError::InvalidTransaction)?;
            if replay || preview.sequence != sequence {
                return Err(ItemJournalError::InvalidSequence);
            }
            let receipt = ledger
                .apply(record.transaction, &record.operations)
                .map_err(ItemJournalError::InvalidTransaction)?;
            if receipt.sequence != sequence {
                return Err(ItemJournalError::InvalidSequence);
            }
            previous = sequence;
        }
        Ok(Self {
            root,
            ledger,
            poisoned: false,
        })
    }

    pub fn location(&self, item: ItemId) -> Option<ItemLocation> {
        self.ledger.location(item)
    }

    pub fn item_count(&self) -> usize {
        self.ledger.item_count()
    }

    /// Last durable sequence touching this item, reconstructed on restart.
    /// Read-only: unrelated item transactions do not advance this watermark.
    pub fn last_mutation_sequence(&self, item: ItemId) -> Option<u64> {
        self.ledger.last_mutation_sequence(item)
    }

    /// Read-only proof that an exact transaction batch has been committed.
    /// Missing IDs return None and conflicting ID reuse fails closed.
    /// This never writes a journal record or consumes a new sequence.
    pub fn verified_receipt(
        &self,
        transaction: OwnershipTxnId,
        operations: &[OwnershipOp],
    ) -> Result<Option<OwnershipReceipt>, ItemJournalError> {
        if self.poisoned {
            return Err(ItemJournalError::Poisoned);
        }
        self.ledger
            .committed_receipt(transaction, operations)
            .map_err(ItemJournalError::InvalidTransaction)
    }

    pub fn apply(
        &mut self,
        transaction: OwnershipTxnId,
        operations: &[OwnershipOp],
    ) -> Result<OwnershipReceipt, ItemJournalError> {
        if self.poisoned {
            return Err(ItemJournalError::Poisoned);
        }
        let (receipt, replay) = self
            .ledger
            .preview(transaction, operations)
            .map_err(ItemJournalError::InvalidTransaction)?;
        if replay {
            return Ok(receipt);
        }
        let record = JournalRecord {
            sequence: receipt.sequence,
            transaction,
            operations: operations.to_vec(),
        };
        let bytes = encode(&record);
        let clock = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| ItemJournalError::InvalidRecord("clock before epoch"))?
            .as_nanos();
        let nonce = NEXT_PENDING.fetch_add(1, Ordering::Relaxed);
        let stage = PendingFile(
            self.root
                .join(format!(".pending-{}-{clock}-{nonce}", std::process::id())),
        );

        // If any step fails, disable all further writes on this instance.
        // Especially after publish, a failed directory sync can mean the
        // transaction may be committed: reload before any retry.
        let persisted: Result<(), io::Error> = (|| {
            let mut options = OpenOptions::new();
            options.create_new(true).write(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&stage.0)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            drop(file);
            fs::hard_link(&stage.0, self.root.join(canonical_name(receipt.sequence)))?;
            sync_directory(&self.root)?;
            Ok(())
        })();
        if let Err(error) = persisted {
            self.poisoned = true;
            return Err(ItemJournalError::Io(error));
        }
        drop(stage);
        self.ledger.apply(transaction, operations).map_err(|err| {
            self.poisoned = true;
            ItemJournalError::InvalidTransaction(err)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let nonce = NEXT_PENDING.fetch_add(1, Ordering::Relaxed);
            let clock = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-item-journal-{}-{clock}-{nonce}",
                std::process::id()
            ));
            fs::create_dir(&path).expect("private test directory");
            Self(path)
        }
        fn open(&self) -> DurableItemJournal {
            DurableItemJournal::open(&self.0).expect("open journal")
        }
        fn record(&self, seq: u64) -> PathBuf {
            self.0.join(canonical_name(seq))
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn item(n: u128) -> ItemId {
        ItemId::new(n).expect("item")
    }
    fn txn(n: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(n).expect("txn")
    }
    fn character(n: u128) -> CharacterId {
        CharacterId::new(n).expect("char")
    }
    fn corpse(n: u128) -> CorpseId {
        CorpseId::new(n).expect("corpse")
    }
    fn inv(n: u128) -> ItemLocation {
        ItemLocation::Inventory(character(n))
    }
    fn equipped(n: u128) -> ItemLocation {
        ItemLocation::Equipped {
            character_id: character(n),
            slot: 3,
        }
    }
    fn ground() -> ItemLocation {
        ItemLocation::Ground {
            zone_id: ZoneId::new(8).expect("zone"),
            x_cm: -290,
            y_cm: 177,
        }
    }

    #[test]
    fn versioned_codec_covers_all_location_variants_and_rejects_tampering() {
        let record = JournalRecord {
            sequence: 7,
            transaction: txn(100),
            operations: vec![
                OwnershipOp::Create {
                    item: item(1),
                    at: inv(1),
                },
                OwnershipOp::Move {
                    item: item(2),
                    from: equipped(1),
                    to: ItemLocation::Corpse(corpse(45)),
                },
                OwnershipOp::Move {
                    item: item(3),
                    from: inv(1),
                    to: ground(),
                },
                OwnershipOp::Destroy {
                    item: item(4),
                    from: ground(),
                },
            ],
        };
        let bytes = encode(&record);
        let restored = decode(&bytes).expect("round trip");
        assert_eq!(restored.sequence, 7);
        assert_eq!(restored.transaction, txn(100));
        assert_eq!(restored.operations, record.operations);
        let mut changed = bytes.clone();
        changed[HEADER_BYTES + 2] ^= 1;
        assert!(matches!(
            decode(&changed),
            Err(ItemJournalError::InvalidRecord(_))
        ));
        assert!(matches!(
            decode(&bytes[..bytes.len() - 1]),
            Err(ItemJournalError::InvalidRecord(_))
        ));
        changed = bytes.clone();
        changed[4] = 99;
        assert!(matches!(
            decode(&changed),
            Err(ItemJournalError::InvalidRecord(_))
        ));
        changed = bytes.clone();
        changed[5] = 1;
        assert!(matches!(
            decode(&changed),
            Err(ItemJournalError::InvalidRecord(_))
        ));
    }

    #[test]
    fn full_loot_death_and_idempotency_survive_restart() {
        let root = Root::new();
        let mut store = root.open();
        let initial = [
            OwnershipOp::Create {
                item: item(1),
                at: equipped(1),
            },
            OwnershipOp::Create {
                item: item(2),
                at: inv(1),
            },
            OwnershipOp::Create {
                item: item(3),
                at: inv(1),
            },
        ];
        store.apply(txn(1), &initial).expect("create items");
        let death = [
            OwnershipOp::Move {
                item: item(1),
                from: equipped(1),
                to: ItemLocation::Corpse(corpse(8)),
            },
            OwnershipOp::Move {
                item: item(2),
                from: inv(1),
                to: ground(),
            },
            OwnershipOp::Move {
                item: item(3),
                from: inv(1),
                to: ItemLocation::Corpse(corpse(8)),
            },
        ];
        let receipt = store.apply(txn(2), &death).expect("durable death");
        assert_eq!(receipt.sequence, 2);
        drop(store);
        let mut recovered = root.open();
        assert_eq!(recovered.item_count(), 3);
        assert_eq!(
            recovered.location(item(1)),
            Some(ItemLocation::Corpse(corpse(8)))
        );
        assert_eq!(recovered.location(item(2)), Some(ground()));
        assert_eq!(
            recovered.apply(txn(2), &death).expect("exact replay"),
            receipt
        );
        assert!(matches!(
            recovered.apply(txn(2), &initial),
            Err(ItemJournalError::InvalidTransaction(
                OwnershipError::ConflictingReplay
            ))
        ));
        assert!(!root.record(3).exists());
    }

    #[test]
    fn two_looters_and_invalid_death_batch_never_duplicate() {
        let root = Root::new();
        let mut store = root.open();
        let at = ItemLocation::Corpse(corpse(5));
        store
            .apply(txn(1), &[OwnershipOp::Create { item: item(5), at }])
            .expect("create");
        let looter = [OwnershipOp::Move {
            item: item(5),
            from: at,
            to: inv(1),
        }];
        store.apply(txn(2), &looter).expect("first");
        assert!(matches!(
            store.apply(
                txn(3),
                &[OwnershipOp::Move {
                    item: item(5),
                    from: at,
                    to: inv(2)
                }]
            ),
            Err(ItemJournalError::InvalidTransaction(
                OwnershipError::ExpectedLocationMismatch
            ))
        ));
        assert!(!root.record(3).exists());
        let restored = root.open();
        assert_eq!(restored.location(item(5)), Some(inv(1)));
    }

    #[test]
    fn destroyed_item_identity_cannot_be_reissued_after_restart() {
        let root = Root::new();
        let mut journal = root.open();
        journal
            .apply(
                txn(1),
                &[OwnershipOp::Create {
                    item: item(77),
                    at: inv(1),
                }],
            )
            .expect("create");
        journal
            .apply(
                txn(2),
                &[OwnershipOp::Destroy {
                    item: item(77),
                    from: inv(1),
                }],
            )
            .expect("destroy");
        drop(journal);
        let mut restarted = root.open();
        assert_eq!(restarted.location(item(77)), None);
        assert!(matches!(
            restarted.apply(
                txn(3),
                &[OwnershipOp::Create {
                    item: item(77),
                    at: inv(2)
                }]
            ),
            Err(ItemJournalError::InvalidTransaction(
                OwnershipError::ItemAlreadyExists
            ))
        ));
        assert!(!root.record(3).exists());
    }

    #[test]
    fn orphan_stage_ignored_but_tampered_canonical_record_fails_closed() {
        let root = Root::new();
        let mut store = root.open();
        store
            .apply(
                txn(1),
                &[OwnershipOp::Create {
                    item: item(4),
                    at: inv(4),
                }],
            )
            .expect("create");
        fs::write(root.0.join(".pending-simulated-power-loss"), b"partial").expect("orphan stage");
        assert_eq!(root.open().location(item(4)), Some(inv(4)));
        fs::write(root.record(1), b"partially-written-canonical").expect("simulate damage");
        assert!(matches!(
            DurableItemJournal::open(&root.0),
            Err(ItemJournalError::InvalidRecord(_))
        ));
    }

    #[test]
    fn missing_or_reordered_commits_abort_replay() {
        let root = Root::new();
        let mut store = root.open();
        store
            .apply(
                txn(1),
                &[OwnershipOp::Create {
                    item: item(5),
                    at: inv(1),
                }],
            )
            .expect("one");
        store
            .apply(
                txn(2),
                &[OwnershipOp::Move {
                    item: item(5),
                    from: inv(1),
                    to: inv(2),
                }],
            )
            .expect("two");
        fs::remove_file(root.record(1)).expect("remove first");
        assert!(matches!(
            DurableItemJournal::open(&root.0),
            Err(ItemJournalError::InvalidSequence)
        ));
    }

    #[test]
    fn crash_after_publishing_before_memory_apply_replays_transaction_once() {
        let root = Root::new();
        let operations = vec![OwnershipOp::Create {
            item: item(9),
            at: inv(9),
        }];
        let bytes = encode(&JournalRecord {
            sequence: 1,
            transaction: txn(9),
            operations: operations.clone(),
        });
        fs::write(root.record(1), bytes).expect("simulate durable publish before in-memory apply");
        let mut reopened = root.open();
        assert_eq!(reopened.location(item(9)), Some(inv(9)));
        assert_eq!(
            reopened.apply(txn(9), &operations).expect("retry").sequence,
            1
        );
        assert!(!root.record(2).exists());
    }

    #[cfg(unix)]
    #[test]
    fn new_transaction_files_have_owner_only_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let root = Root::new();
        root.open()
            .apply(
                txn(1),
                &[OwnershipOp::Create {
                    item: item(1),
                    at: inv(1),
                }],
            )
            .expect("commit");
        let mode = fs::metadata(root.record(1))
            .expect("metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
