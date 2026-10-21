//! P0 First Playable Alpha contract fixture for Core 8B's EXISTING journal.
//! Not a live rack, authenticated pickup, range/LOS, observer replication,
//! sword type, or an approved MainHand slot mapping. World/Magic/Core 8A/8C
//! must supply those independently before the real City -> Armory -> PvP run.

use crate::{
    identity::CharacterId,
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::{ItemId, ItemLocation, OwnershipError, OwnershipOp, OwnershipTxnId, ZoneId},
};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Barrier, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

struct IsolatedJournal(PathBuf);
impl IsolatedJournal {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "myaso-c3o-alpha-armory-{}-{}-{}",
            std::process::id(),
            stamp,
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).expect("fresh isolated root");
        Self(path)
    }

    fn open(&self) -> DurableItemJournal {
        // Test-only handoff: Rust's parallel subprocess acceptance exercises
        // actual POSIX flock while fork/exec and descriptor teardown race.
        // Give a *recently released* writer a bounded OS scheduling window.
        // The real DurableItemJournal::open remains fail-fast and exclusive.
        let deadline = Instant::now() + Duration::from_millis(500);
        loop {
            match DurableItemJournal::open(&self.0) {
                Ok(writer) => return writer,
                Err(ItemJournalError::WriterBusy) if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(5));
                }
                Err(error) => {
                    panic!("one local authoritative writer must become available: {error:?}")
                }
            }
        }
    }
}
impl Drop for IsolatedJournal {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn id(raw: u128) -> ItemId {
    ItemId::new(raw).unwrap()
}
fn character(raw: u128) -> CharacterId {
    CharacterId::new(raw).unwrap()
}
fn txn(raw: u128) -> OwnershipTxnId {
    OwnershipTxnId::new(raw).unwrap()
}
fn rack(index: i32) -> ItemLocation {
    // Provisional server-owned rack in one zone: no browser-provided position.
    ItemLocation::Ground {
        zone_id: ZoneId::new(1).unwrap(),
        x_cm: 371_000 + 35 * index,
        y_cm: 385_000,
    }
}
fn equipped(owner: u128) -> ItemLocation {
    // Magic #424 MYWLD003 MainHand is slot 0, NOT OffHand's slot 1.
    // This remains a proposed fixture mapping until P0 #432 sign-off.
    ItemLocation::Equipped {
        character_id: character(owner),
        slot: 0,
    }
}
fn inventory(owner: u128) -> ItemLocation {
    ItemLocation::Inventory(character(owner))
}
fn four_server_authored_swords(journal: &mut DurableItemJournal) {
    let operations: Vec<_> = (0..4)
        .map(|index| OwnershipOp::Create {
            item: id(201 + index as u128),
            at: rack(index),
        })
        .collect();
    let receipt = journal
        .apply(txn(100), &operations)
        .expect("single durable four-sword world mint");
    assert_eq!(receipt.sequence, 1);
    assert_eq!(receipt.operation_count, 4);
    assert_eq!(journal.item_count(), 4);
    for index in 0..4 {
        assert_eq!(journal.location(id(201 + index as u128)), Some(rack(index)));
    }
}

#[test]
fn live_first_writer_still_denies_concurrent_second_handle_immediately() {
    let root = IsolatedJournal::new();
    let writer = root.open();
    assert!(matches!(
        DurableItemJournal::open(&root.0),
        Err(ItemJournalError::WriterBusy)
    ));
    drop(writer);
    let recovered = root.open();
    assert_eq!(recovered.item_count(), 0);
}

#[test]
fn four_rack_swords_equip_drop_transfer_recover_without_clone_or_false_ack() {
    let root = IsolatedJournal::new();
    let mut journal = root.open();
    four_server_authored_swords(&mut journal);

    // Players initially have no equipment. No implicit starter weapon.
    for owner in 1..=4 {
        assert_ne!(journal.location(id(200 + owner)), Some(equipped(owner)));
    }

    let first_pickup = [OwnershipOp::Move {
        item: id(201),
        from: rack(0),
        to: equipped(1),
    }];
    let accepted = journal.apply(txn(101), &first_pickup).unwrap();
    assert_eq!(accepted.sequence, 2);
    assert_eq!(journal.location(id(201)), Some(equipped(1)));
    assert_eq!(
        journal.verified_receipt(txn(101), &first_pickup).unwrap(),
        Some(accepted)
    );
    assert_eq!(journal.apply(txn(101), &first_pickup).unwrap(), accepted);
    assert!(matches!(
        journal.apply(
            txn(101),
            &[OwnershipOp::Move {
                item: id(201),
                from: rack(0),
                to: equipped(2),
            }]
        ),
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::ConflictingReplay
        ))
    ));

    // Two-click loser cannot equip, cannot manufacture a successful receipt.
    let denied = [OwnershipOp::Move {
        item: id(201),
        from: rack(0),
        to: equipped(2),
    }];
    assert!(matches!(
        journal.apply(txn(102), &denied),
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::ExpectedLocationMismatch
        ))
    ));
    assert_eq!(journal.verified_receipt(txn(102), &denied).unwrap(), None);
    assert_eq!(journal.location(id(201)), Some(equipped(1)));

    // All four real item IDs stay distinct and conserved for four players.
    for index in 1..4 {
        let owner = index as u128 + 1;
        let operation = [OwnershipOp::Move {
            item: id(201 + index as u128),
            from: rack(index),
            to: equipped(owner),
        }];
        journal.apply(txn(103 + index as u128), &operation).unwrap();
        assert_eq!(
            journal.location(id(201 + index as u128)),
            Some(equipped(owner))
        );
    }
    assert_eq!(journal.item_count(), 4);

    // Drop is world-visible in the ownership truth, not reminted as a new ID.
    let drop_op = [OwnershipOp::Move {
        item: id(201),
        from: equipped(1),
        to: rack(4),
    }];
    let drop_receipt = journal.apply(txn(108), &drop_op).unwrap();
    assert_eq!(journal.location(id(201)), Some(rack(4)));
    assert_ne!(journal.location(id(201)), Some(equipped(1)));

    // Player 2 has a sword already. Picking another into MainHand must fail;
    // retrieving it into inventory preserves identity without ghost equipment.
    assert!(matches!(
        journal.apply(
            txn(109),
            &[OwnershipOp::Move {
                item: id(201),
                from: rack(4),
                to: equipped(2)
            }]
        ),
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::EquipmentSlotOccupied
        ))
    ));
    let second_pickup = [OwnershipOp::Move {
        item: id(201),
        from: rack(4),
        to: inventory(2),
    }];
    let transfer_receipt = journal.apply(txn(110), &second_pickup).unwrap();
    assert_eq!(journal.location(id(201)), Some(inventory(2)));
    assert_eq!(journal.location(id(202)), Some(equipped(2)));
    assert_eq!(journal.item_count(), 4);
    drop(journal);

    // New trusted local writer replays committed history after crash/restart.
    let mut restored = root.open();
    assert_eq!(restored.item_count(), 4);
    assert_eq!(restored.location(id(201)), Some(inventory(2)));
    assert_eq!(restored.location(id(202)), Some(equipped(2)));
    assert_eq!(restored.location(id(203)), Some(equipped(3)));
    assert_eq!(restored.location(id(204)), Some(equipped(4)));
    assert_eq!(
        restored
            .apply(txn(108), &drop_op)
            .expect("historical ACK retry"),
        drop_receipt
    );
    assert_eq!(
        restored
            .apply(txn(110), &second_pickup)
            .expect("historical receipt"),
        transfer_receipt
    );
    assert!(matches!(
        restored.apply(
            txn(111),
            &[OwnershipOp::Create {
                item: id(201),
                at: rack(0)
            }]
        ),
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::ItemAlreadyExists
        ))
    ));
    assert_eq!(restored.item_count(), 4);
}

#[test]
fn two_independent_intents_for_same_rack_sword_have_one_commit_winner() {
    let root = IsolatedJournal::new();
    let mut initial = root.open();
    four_server_authored_swords(&mut initial);
    let journal = Arc::new(Mutex::new(initial));
    let start = Arc::new(Barrier::new(3));
    let mut workers = Vec::new();
    for (owner, request) in [(1_u128, 501_u128), (2, 502)] {
        let journal = Arc::clone(&journal);
        let start = Arc::clone(&start);
        workers.push(std::thread::spawn(move || {
            let ops = [OwnershipOp::Move {
                item: id(201),
                from: rack(0),
                to: equipped(owner),
            }];
            start.wait();
            let result = journal.lock().unwrap().apply(txn(request), &ops);
            (owner, request, ops, result)
        }));
    }
    start.wait();
    let results: Vec<_> = workers.into_iter().map(|w| w.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|v| v.3.is_ok()).count(), 1);
    let winner = results.iter().find(|v| v.3.is_ok()).unwrap();
    let loser = results.iter().find(|v| v.3.is_err()).unwrap();
    assert_eq!(winner.3.as_ref().unwrap().sequence, 2);
    assert!(matches!(
        loser.3,
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::ExpectedLocationMismatch
        ))
    ));
    let guard = journal.lock().unwrap();
    assert_eq!(guard.item_count(), 4);
    assert_eq!(guard.location(id(201)), Some(equipped(winner.0)));
    assert_eq!(
        guard.verified_receipt(txn(loser.1), &loser.2).unwrap(),
        None
    );
    drop(guard);
    drop(journal);
    let reopened = root.open();
    assert_eq!(reopened.item_count(), 4);
    assert_eq!(reopened.location(id(201)), Some(equipped(winner.0)));
}
