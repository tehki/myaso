//! Dormant durable ground-item zone transfer and arrival-proof contract.
//!
//! This is a single-authority, single-writer proof of cross-zone transaction
//! ordering. It DOES NOT transfer live simulation ownership between workers.
//! All requests must be produced by a trusted zone authority after verifying
//! character/session fencing, loot permissions and physics. A user-provided
//! GroundZoneTransfer is NOT proof of authorization.

use crate::{
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::{
        ItemId, ItemLocation, OwnershipError, OwnershipOp, OwnershipReceipt, OwnershipTxnId, ZoneId,
    },
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GroundPoint {
    pub zone_id: ZoneId,
    pub x_cm: i32,
    pub y_cm: i32,
}

impl GroundPoint {
    fn as_location(self) -> ItemLocation {
        ItemLocation::Ground {
            zone_id: self.zone_id,
            x_cm: self.x_cm,
            y_cm: self.y_cm,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GroundZoneTransfer {
    pub transaction: OwnershipTxnId,
    pub item: ItemId,
    pub source: GroundPoint,
    pub destination: GroundPoint,
}

impl GroundZoneTransfer {
    fn operation(self) -> OwnershipOp {
        OwnershipOp::Move {
            item: self.item,
            from: self.source.as_location(),
            to: self.destination.as_location(),
        }
    }

    fn validate(self) -> Result<(), TransferError> {
        if self.source.zone_id == self.destination.zone_id {
            return Err(TransferError::SameZone);
        }
        Ok(())
    }
}

/// The proof is constructed only after the journal returns a durable receipt.
/// It is NOT a portable cryptographic token, a client credential, or a
/// multi-worker authorization primitive.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GroundTransferProof {
    transfer: GroundZoneTransfer,
    receipt: OwnershipReceipt,
}

impl GroundTransferProof {
    pub fn transfer(self) -> GroundZoneTransfer {
        self.transfer
    }

    pub fn receipt(self) -> OwnershipReceipt {
        self.receipt
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArrivalStatus {
    /// A matching committed transfer exists and the item is still at target.
    Current,
    /// Transfer was committed, but a subsequent transaction moved the item.
    Superseded,
}

#[derive(Debug)]
pub enum TransferError {
    SameZone,
    NotCommitted,
    ReceiptMismatch,
    ConflictingTransaction(OwnershipError),
    Journal(ItemJournalError),
}

impl From<ItemJournalError> for TransferError {
    fn from(error: ItemJournalError) -> Self {
        Self::Journal(error)
    }
}

/// Both source and destination consult the SAME authoritative journal. A
/// remote worker must not treat this module as a distributed handoff protocol.
pub struct GroundTransferCoordinator<'a> {
    journal: &'a mut DurableItemJournal,
}

impl<'a> GroundTransferCoordinator<'a> {
    pub fn new(journal: &'a mut DurableItemJournal) -> Self {
        Self { journal }
    }

    /// One atomic, durable ownership move. The expected source position
    /// fences stale or competing source requests. The journal commits before
    /// this method can return its receipt.
    pub fn commit(
        &mut self,
        transfer: GroundZoneTransfer,
    ) -> Result<GroundTransferProof, TransferError> {
        transfer.validate()?;
        let receipt = self
            .journal
            .apply(transfer.transaction, &[transfer.operation()])?;
        Ok(GroundTransferProof { transfer, receipt })
    }

    /// Read only: never calls journal.apply. The target must not display or
    /// mutate the item as current until this check succeeds. A published but
    /// subsequently superseded transfer remains historical, not authoritative.
    pub fn confirm_arrival(
        &self,
        proof: GroundTransferProof,
    ) -> Result<ArrivalStatus, TransferError> {
        proof.transfer.validate()?;
        let exact = self
            .journal
            .verified_receipt(proof.transfer.transaction, &[proof.transfer.operation()])
            .map_err(|error| match error {
                ItemJournalError::InvalidTransaction(OwnershipError::ConflictingReplay) => {
                    TransferError::ConflictingTransaction(OwnershipError::ConflictingReplay)
                }
                other => TransferError::Journal(other),
            })?;
        match exact {
            None => Err(TransferError::NotCommitted),
            Some(receipt) if receipt != proof.receipt => Err(TransferError::ReceiptMismatch),
            Some(_) => {
                if self.journal.location(proof.transfer.item)
                    == Some(proof.transfer.destination.as_location())
                {
                    Ok(ArrivalStatus::Current)
                } else {
                    Ok(ArrivalStatus::Superseded)
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static NEXT_TEST: AtomicU64 = AtomicU64::new(0);

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let clock = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock")
                .as_nanos();
            let nonce = NEXT_TEST.fetch_add(1, Ordering::Relaxed);
            let root = std::env::temp_dir().join(format!(
                "myaso-c3c-zones-{}-{clock}-{nonce}",
                std::process::id()
            ));
            fs::create_dir(&root).expect("unique root");
            Self(root)
        }

        fn journal(&self) -> DurableItemJournal {
            DurableItemJournal::open(&self.0).expect("recover journal")
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn txn(id: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(id).expect("nonzero transaction")
    }

    fn item(id: u128) -> ItemId {
        ItemId::new(id).expect("nonzero item")
    }

    fn point(zone: u64, x: i32, y: i32) -> GroundPoint {
        GroundPoint {
            zone_id: ZoneId::new(zone).expect("nonzero zone"),
            x_cm: x,
            y_cm: y,
        }
    }

    fn transfer(
        t: u128,
        item_id: u128,
        source: GroundPoint,
        destination: GroundPoint,
    ) -> GroundZoneTransfer {
        GroundZoneTransfer {
            transaction: txn(t),
            item: item(item_id),
            source,
            destination,
        }
    }

    fn initial(root: &TestRoot, id: u128, where_at: GroundPoint) -> DurableItemJournal {
        let mut journal = root.journal();
        journal
            .apply(
                txn(1),
                &[OwnershipOp::Create {
                    item: item(id),
                    at: where_at.as_location(),
                }],
            )
            .expect("committed ground item");
        journal
    }

    #[test]
    fn cross_zone_commit_and_arrival_proof_survive_restart() {
        let root = TestRoot::new();
        let source = point(1, -700, 90);
        let destination = point(2, 500, -42);
        let command = transfer(2, 10, source, destination);
        let mut journal = initial(&root, 10, source);
        let proof = {
            let mut coordinator = GroundTransferCoordinator::new(&mut journal);
            let proof = coordinator.commit(command).expect("durable transfer");
            assert_eq!(proof.receipt().sequence, 2);
            assert_eq!(
                coordinator.confirm_arrival(proof).expect("confirmation"),
                ArrivalStatus::Current
            );
            proof
        };
        drop(journal);
        let mut recovered = root.journal();
        assert_eq!(
            recovered.location(item(10)),
            Some(destination.as_location())
        );
        let mut coordinator = GroundTransferCoordinator::new(&mut recovered);
        assert_eq!(
            coordinator.confirm_arrival(proof).expect("recover proof"),
            ArrivalStatus::Current
        );
        assert_eq!(
            coordinator.commit(command).expect("idempotent retry"),
            proof
        );
        assert_eq!(recovered.item_count(), 1);
    }

    #[test]
    fn competing_source_handoffs_never_duplicate_item() {
        let root = TestRoot::new();
        let source = point(1, 4, 5);
        let mut journal = initial(&root, 11, source);
        let first = transfer(2, 11, source, point(2, 6, 7));
        let second = transfer(3, 11, source, point(3, 8, 9));
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        let winning = coordinator.commit(first).expect("first source wins");
        assert!(matches!(
            coordinator.commit(second),
            Err(TransferError::Journal(
                ItemJournalError::InvalidTransaction(OwnershipError::ExpectedLocationMismatch)
            ))
        ));
        assert_eq!(
            coordinator
                .confirm_arrival(winning)
                .expect("current winner"),
            ArrivalStatus::Current
        );
        assert_eq!(journal.item_count(), 1);
    }

    #[test]
    fn destination_cannot_confirm_uncommitted_or_forged_proof() {
        let root = TestRoot::new();
        let source = point(1, 10, 10);
        let destination = point(2, 10, 20);
        let mut journal = initial(&root, 12, source);
        let transfer = transfer(2, 12, source, destination);
        let fictitious = GroundTransferProof {
            transfer,
            receipt: OwnershipReceipt {
                sequence: 2,
                operation_count: 1,
            },
        };
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        assert!(matches!(
            coordinator.confirm_arrival(fictitious),
            Err(TransferError::NotCommitted)
        ));
        let real = coordinator.commit(transfer).expect("commit");
        let malformed = GroundTransferProof {
            receipt: OwnershipReceipt {
                sequence: 99,
                operation_count: 1,
            },
            ..real
        };
        assert!(matches!(
            coordinator.confirm_arrival(malformed),
            Err(TransferError::ReceiptMismatch)
        ));
        assert_eq!(
            coordinator.confirm_arrival(real).expect("valid proof"),
            ArrivalStatus::Current
        );
    }

    #[test]
    fn conflicting_retry_cannot_retarget_committed_item() {
        let root = TestRoot::new();
        let source = point(1, 1, 1);
        let mut journal = initial(&root, 13, source);
        let committed = transfer(2, 13, source, point(2, 2, 2));
        let conflicting = transfer(2, 13, source, point(3, 3, 3));
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        let proof = coordinator.commit(committed).expect("commit");
        assert!(matches!(
            coordinator.commit(conflicting),
            Err(TransferError::Journal(
                ItemJournalError::InvalidTransaction(OwnershipError::ConflictingReplay)
            ))
        ));
        assert_eq!(
            coordinator.confirm_arrival(proof).expect("original"),
            ArrivalStatus::Current
        );
    }

    #[test]
    fn historical_proof_is_superseded_after_followup_zone_transfer() {
        let root = TestRoot::new();
        let source = point(1, 1, 2);
        let middle = point(2, -5, 6);
        let target = point(3, 7, -8);
        let mut journal = initial(&root, 14, source);
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        let first = coordinator
            .commit(transfer(2, 14, source, middle))
            .expect("first");
        let second = coordinator
            .commit(transfer(3, 14, middle, target))
            .expect("second");
        assert_eq!(
            coordinator.confirm_arrival(first).expect("old receipt"),
            ArrivalStatus::Superseded
        );
        assert_eq!(
            coordinator.confirm_arrival(second).expect("new receipt"),
            ArrivalStatus::Current
        );
        drop(coordinator);
        drop(journal);
        let mut restored = root.journal();
        let verifier = GroundTransferCoordinator::new(&mut restored);
        assert_eq!(
            verifier.confirm_arrival(first).expect("restored first"),
            ArrivalStatus::Superseded
        );
        assert_eq!(
            verifier.confirm_arrival(second).expect("restored second"),
            ArrivalStatus::Current
        );
    }

    #[test]
    fn same_zone_or_wrong_source_is_rejected_without_spending_sequence() {
        let root = TestRoot::new();
        let origin = point(1, 10, 10);
        let mut journal = initial(&root, 15, origin);
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        assert!(matches!(
            coordinator.commit(transfer(2, 15, origin, point(1, 40, 40))),
            Err(TransferError::SameZone)
        ));
        assert!(matches!(
            coordinator.commit(transfer(2, 15, point(99, 0, 0), point(2, 40, 40))),
            Err(TransferError::Journal(
                ItemJournalError::InvalidTransaction(OwnershipError::ExpectedLocationMismatch)
            ))
        ));
        let valid = coordinator
            .commit(transfer(2, 15, origin, point(2, 1, 1)))
            .expect("first valid");
        assert_eq!(valid.receipt().sequence, 2);
        assert_eq!(
            coordinator.confirm_arrival(valid).expect("arrival"),
            ArrivalStatus::Current
        );
    }

    #[test]
    fn phantom_ownership_on_corrupt_recovery_fails_closed() {
        let root = TestRoot::new();
        let source = point(1, 0, 0);
        let destination = point(2, 1, 1);
        let mut journal = initial(&root, 16, source);
        let mut coordinator = GroundTransferCoordinator::new(&mut journal);
        let committed = coordinator
            .commit(transfer(2, 16, source, destination))
            .expect("commit");
        assert_eq!(
            coordinator.confirm_arrival(committed).expect("live proof"),
            ArrivalStatus::Current
        );
        drop(coordinator);
        drop(journal);
        fs::write(
            root.0.join("00000000000000000002.mytx"),
            b"damaged committed record",
        )
        .expect("damage");
        assert!(matches!(
            DurableItemJournal::open(&root.0),
            Err(ItemJournalError::InvalidRecord(_))
        ));
    }
}
