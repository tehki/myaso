//! First Playable P0: dormant read-only proof for a CURRENT committed rack
//! sword pickup before any future authoritative observer/ACK envelope.
//!
//! A persisted historical receipt is not evidence the sword is STILL held.
//! This module requires both an exact C3e journal receipt AND the item's
//! latest mutation watermark and exact equipped owner. It never writes state.
//! The worker/zone, physical sword target and logged-in character MUST be
//! verified independently by Core 8A/8C before any caller may use this view.
//! No live net handler, gameplay feature or independent item writer exists.

use crate::{
    identity::CharacterId,
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::{ItemId, ItemLocation, OwnershipOp, OwnershipReceipt, OwnershipTxnId},
    legacy_gear_preflight::LegacyEquipmentSlot,
};

#[derive(Debug)]
pub enum PickupProofError {
    NotGroundSource,
    MissingCommittedReceipt,
    HistoricalReceiptNoLongerCurrent,
    WrongCurrentLocation,
    Journal(ItemJournalError),
}

impl From<ItemJournalError> for PickupProofError {
    fn from(value: ItemJournalError) -> Self {
        Self::Journal(value)
    }
}

/// An immutable read-only projection of ONE receipt and CURRENT item owner.
/// Private fields prevent an arbitrary request from constructing a plausible
/// accepted pickup projection outside this module.
///
/// This is NOT a player permission, world ownership fence, wire protocol,
/// durable cross-zone transaction, or ACK that has been emitted to clients.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CommittedPickupView {
    request_id: OwnershipTxnId,
    item_id: ItemId,
    owner: CharacterId,
    location: ItemLocation,
    journal_sequence: u64,
}

impl CommittedPickupView {
    pub fn request_id(self) -> OwnershipTxnId {
        self.request_id
    }

    pub fn item_id(self) -> ItemId {
        self.item_id
    }

    pub fn owner(self) -> CharacterId {
        self.owner
    }

    pub fn location(self) -> ItemLocation {
        self.location
    }

    pub fn journal_sequence(self) -> u64 {
        self.journal_sequence
    }
}

/// Fail closed unless an immutable exact committed rack→MainHand operation
/// also represents the latest known item state.
///
/// `from_ground` and `owner` must come from a trusted authoritative
/// server view (8A/8C), NEVER directly from a packet. MainHand code 0
/// is still subject to #432 shared identity/slot approval.
pub fn current_committed_rack_pickup(
    journal: &DurableItemJournal,
    request_id: OwnershipTxnId,
    item_id: ItemId,
    from_ground: ItemLocation,
    owner: CharacterId,
) -> Result<CommittedPickupView, PickupProofError> {
    if !matches!(from_ground, ItemLocation::Ground { .. }) {
        return Err(PickupProofError::NotGroundSource);
    }
    let location = ItemLocation::Equipped {
        character_id: owner,
        slot: LegacyEquipmentSlot::MainHand.proposed_core_slot(),
    };
    let exact_operation = [OwnershipOp::Move {
        item: item_id,
        from: from_ground,
        to: location,
    }];
    let receipt: OwnershipReceipt = journal
        .verified_receipt(request_id, &exact_operation)?
        .ok_or(PickupProofError::MissingCommittedReceipt)?;
    // This projection only represents ONE sword per single atomic pickup.
    if receipt.operation_count != 1 {
        return Err(PickupProofError::MissingCommittedReceipt);
    }
    if journal.last_mutation_sequence(item_id) != Some(receipt.sequence) {
        return Err(PickupProofError::HistoricalReceiptNoLongerCurrent);
    }
    if journal.location(item_id) != Some(location) {
        return Err(PickupProofError::WrongCurrentLocation);
    }
    Ok(CommittedPickupView {
        request_id,
        item_id,
        owner,
        location,
        journal_sequence: receipt.sequence,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::item_ownership::{OwnershipError, ZoneId};
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-c3q-ack-proof-{}-{stamp}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn open(&self) -> DurableItemJournal {
            DurableItemJournal::open(&self.0).unwrap()
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn item(n: u128) -> ItemId {
        ItemId::new(n).unwrap()
    }
    fn txn(n: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(n).unwrap()
    }
    fn owner(n: u128) -> CharacterId {
        CharacterId::new(n).unwrap()
    }
    fn rack(n: i32) -> ItemLocation {
        ItemLocation::Ground {
            zone_id: ZoneId::new(1).unwrap(),
            x_cm: 371_000 + n * 35,
            y_cm: 385_000,
        }
    }
    fn equip(n: u128) -> ItemLocation {
        ItemLocation::Equipped {
            character_id: owner(n),
            slot: 0,
        }
    }

    fn seed(journal: &mut DurableItemJournal) {
        let batch: Vec<_> = (0..4)
            .map(|n| OwnershipOp::Create {
                item: item(201 + n as u128),
                at: rack(n),
            })
            .collect();
        journal.apply(txn(100), &batch).unwrap();
    }

    #[test]
    fn no_receipt_and_wrong_source_never_produce_positive_pickup_view() {
        let root = Root::new();
        let mut journal = root.open();
        seed(&mut journal);
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(101), item(201), rack(0), owner(1)),
            Err(PickupProofError::MissingCommittedReceipt)
        ));
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(101), item(201), equip(1), owner(1)),
            Err(PickupProofError::NotGroundSource)
        ));
        assert_eq!(journal.location(item(201)), Some(rack(0)));
    }

    #[test]
    fn exact_committed_pickup_produces_current_read_only_owner_view_after_reopen() {
        let root = Root::new();
        let mut journal = root.open();
        seed(&mut journal);
        let ops = [OwnershipOp::Move {
            item: item(201),
            from: rack(0),
            to: equip(1),
        }];
        let committed = journal.apply(txn(101), &ops).unwrap();
        let view = current_committed_rack_pickup(&journal, txn(101), item(201), rack(0), owner(1))
            .unwrap();
        assert_eq!(view.request_id(), txn(101));
        assert_eq!(view.item_id(), item(201));
        assert_eq!(view.owner(), owner(1));
        assert_eq!(view.location(), equip(1));
        assert_eq!(view.journal_sequence(), committed.sequence);
        assert_eq!(journal.apply(txn(101), &ops).unwrap(), committed);

        // Unrelated sword activity cannot invalidate this item's watermark.
        journal
            .apply(
                txn(102),
                &[OwnershipOp::Move {
                    item: item(202),
                    from: rack(1),
                    to: equip(2),
                }],
            )
            .unwrap();
        assert_eq!(
            current_committed_rack_pickup(&journal, txn(101), item(201), rack(0), owner(1))
                .unwrap(),
            view
        );
        drop(journal);
        let restored = root.open();
        assert_eq!(
            current_committed_rack_pickup(&restored, txn(101), item(201), rack(0), owner(1))
                .unwrap(),
            view
        );
    }

    #[test]
    fn double_click_loser_wrong_owner_and_reused_request_cannot_forge_ack() {
        let root = Root::new();
        let mut journal = root.open();
        seed(&mut journal);
        journal
            .apply(
                txn(111),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: rack(0),
                    to: equip(1),
                }],
            )
            .unwrap();
        assert!(matches!(
            journal.apply(
                txn(112),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: rack(0),
                    to: equip(2),
                }]
            ),
            Err(ItemJournalError::InvalidTransaction(
                OwnershipError::ExpectedLocationMismatch
            ))
        ));
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(112), item(201), rack(0), owner(2)),
            Err(PickupProofError::MissingCommittedReceipt)
        ));
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(111), item(201), rack(0), owner(2)),
            Err(PickupProofError::Journal(
                ItemJournalError::InvalidTransaction(OwnershipError::ConflictingReplay)
            ))
        ));
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(111), item(202), rack(1), owner(1)),
            Err(PickupProofError::Journal(
                ItemJournalError::InvalidTransaction(OwnershipError::ConflictingReplay)
            ))
        ));
    }

    /// A real OS-process crash after fsynced pickup but before sending any
    /// browser ACK must not remint the sword or allow another player to win.
    /// This exercises the actual local C3e journal, not network transport or
    /// a multi-host authority.
    #[cfg(unix)]
    #[test]
    fn sigkill_after_pickup_commit_before_ack_preserves_one_winner() {
        use std::{
            process::Command,
            thread,
            time::{Duration, Instant},
        };

        let root = Root::new();
        let ready = root.0.with_extension("pickup-committed-ready");
        let mut writer = root.open();
        seed(&mut writer);
        drop(writer);

        let mut child = Command::new(std::env::current_exe().expect("test executable"))
            .arg("--ignored")
            .arg("--exact")
            .arg("alpha_pickup_ack_proof::tests::subprocess_pickup_before_ack")
            .arg("--nocapture")
            .env("MYASO_C3Q_CRASH_ROOT", &root.0)
            .env("MYASO_C3Q_CRASH_READY", &ready)
            .spawn()
            .expect("launch separate pickup writer");

        let deadline = Instant::now() + Duration::from_secs(10);
        let mut committed = false;
        while Instant::now() < deadline {
            if ready.exists() {
                committed = true;
                break;
            }
            if child.try_wait().expect("poll child").is_some() {
                break;
            }
            thread::sleep(Duration::from_millis(20));
        }
        let lock_held = committed
            && matches!(
                DurableItemJournal::open(&root.0),
                Err(ItemJournalError::WriterBusy)
            );
        // The parent kills/reaps the subprocess even if readiness failed.
        let _ = child.kill();
        let _ = child.wait();
        assert!(committed, "child must commit item before simulated lost ACK");
        assert!(lock_held, "child was independently holding OS writer lock");

        let mut recovered = root.open();
        let correct = [OwnershipOp::Move {
            item: item(201),
            from: rack(0),
            to: equip(1),
        }];
        let receipt = recovered
            .verified_receipt(txn(1001), &correct)
            .unwrap()
            .expect("durable pickup receipt recovered after SIGKILL");
        assert_eq!(receipt.sequence, 2);
        assert_eq!(
            current_committed_rack_pickup(
                &recovered,
                txn(1001),
                item(201),
                rack(0),
                owner(1)
            )
            .unwrap()
            .journal_sequence(),
            receipt.sequence
        );
        assert_eq!(
            recovered.apply(txn(1001), &correct).unwrap(),
            receipt,
            "identical lost ACK retry must not mint a second pickup"
        );
        let losing_attempt = [OwnershipOp::Move {
            item: item(201),
            from: rack(0),
            to: equip(2),
        }];
        assert!(matches!(
            recovered.apply(txn(1002), &losing_attempt),
            Err(ItemJournalError::InvalidTransaction(
                OwnershipError::ExpectedLocationMismatch
            ))
        ));
        assert_eq!(
            recovered.verified_receipt(txn(1002), &losing_attempt).unwrap(),
            None,
            "losing rival must not acquire a committed receipt"
        );
        assert_eq!(recovered.item_count(), 4);
        assert_eq!(recovered.location(item(201)), Some(equip(1)));
        drop(recovered);
        let _ = fs::remove_file(ready);

        let verified_again = root.open();
        assert_eq!(verified_again.item_count(), 4);
        assert!(
            current_committed_rack_pickup(
                &verified_again,
                txn(1001),
                item(201),
                rack(0),
                owner(1)
            )
            .is_ok()
        );
    }

    #[cfg(unix)]
    #[test]
    #[ignore = "called by sigkill_after_pickup_commit_before_ack_preserves_one_winner"]
    fn subprocess_pickup_before_ack() {
        let (Some(root), Some(ready)) = (
            std::env::var_os("MYASO_C3Q_CRASH_ROOT"),
            std::env::var_os("MYASO_C3Q_CRASH_READY"),
        ) else {
            return;
        };
        let mut writer =
            DurableItemJournal::open(PathBuf::from(root)).expect("child exclusive writer");
        let receipt = writer
            .apply(
                txn(1001),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: rack(0),
                    to: equip(1),
                }],
            )
            .expect("child durably commits one sword pickup");
        assert_eq!(receipt.sequence, 2);
        fs::write(ready, b"pickup committed; ACK not sent").unwrap();
        // Deliberately keep the OS writer lock until the parent SIGKILLs us.
        loop {
            std::thread::park();
        }
    }

    #[test]
    fn historical_receipt_cannot_claim_current_equipment_after_drop_and_aba() {
        let root = Root::new();
        let mut journal = root.open();
        seed(&mut journal);
        journal
            .apply(
                txn(121),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: rack(0),
                    to: equip(1),
                }],
            )
            .unwrap();
        journal
            .apply(
                txn(122),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: equip(1),
                    to: rack(0),
                }],
            )
            .unwrap();
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(121), item(201), rack(0), owner(1)),
            Err(PickupProofError::HistoricalReceiptNoLongerCurrent)
        ));
        journal
            .apply(
                txn(123),
                &[OwnershipOp::Move {
                    item: item(201),
                    from: rack(0),
                    to: equip(1),
                }],
            )
            .unwrap();
        assert!(matches!(
            current_committed_rack_pickup(&journal, txn(121), item(201), rack(0), owner(1)),
            Err(PickupProofError::HistoricalReceiptNoLongerCurrent)
        ));
        assert!(
            current_committed_rack_pickup(&journal, txn(123), item(201), rack(0), owner(1)).is_ok()
        );
        drop(journal);
        let restored = root.open();
        assert!(matches!(
            current_committed_rack_pickup(&restored, txn(121), item(201), rack(0), owner(1)),
            Err(PickupProofError::HistoricalReceiptNoLongerCurrent)
        ));
        assert!(
            current_committed_rack_pickup(&restored, txn(123), item(201), rack(0), owner(1))
                .is_ok()
        );
    }
}
