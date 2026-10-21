//! C3z offline-only durable envelope+one canonical MYTX item move acceptance.
//! This uses synthetic context. No authenticated 8A handler, signed World
//! source, distributed epoch, LOS, outbox delivery or live sword pickup.

use crate::{
    alpha_bound_pickup::ProposedRackPickupEnvelope,
    identity::CharacterId,
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::{ItemId, ItemLocation, OwnershipError, OwnershipOp, OwnershipTxnId, ZoneId},
};
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
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "myaso-c3z-bound-record-{}-{stamp}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
        ));
        fs::create_dir(&dir).unwrap();
        Self(dir)
    }

    fn open(&self) -> DurableItemJournal {
        DurableItemJournal::open(&self.0).expect("sole canonical local writer")
    }

    fn record(&self, n: u64) -> PathBuf {
        self.0.join(format!("{n:020}.mytx"))
    }
}
impl Drop for Root {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn item() -> ItemId {
    ItemId::new((0xabc_u128 << 64) | 205).unwrap()
}
fn id(n: u128) -> OwnershipTxnId {
    OwnershipTxnId::new(n).unwrap()
}
fn owner() -> CharacterId {
    CharacterId::new((0x55_u128 << 64) | 10).unwrap()
}
fn rack() -> ItemLocation {
    ItemLocation::Ground {
        zone_id: ZoneId::new(15).unwrap(),
        x_cm: 374_000,
        y_cm: 403_800,
    }
}
fn moved_rack() -> ItemLocation {
    ItemLocation::Ground {
        zone_id: ZoneId::new(15).unwrap(),
        x_cm: 374_100,
        y_cm: 403_800,
    }
}
fn hand() -> ItemLocation {
    ItemLocation::Equipped {
        character_id: owner(),
        slot: 0,
    }
}
fn pickup() -> OwnershipOp {
    OwnershipOp::Move {
        item: item(),
        from: rack(),
        to: hand(),
    }
}
fn metadata(before: u64) -> ProposedRackPickupEnvelope {
    ProposedRackPickupEnvelope {
        rack_socket: 1,
        ground_entity: (0xdef_u128 << 64) | 206,
        character: owner(),
        session_generation: 12,
        world_authority_epoch: 7,
        completed_world_tick: 1234,
        world_map_revision: 17,
        observed_item_mutation_sequence: before,
    }
}
fn create(journal: &mut DurableItemJournal) {
    journal
        .apply(
            id(1),
            &[OwnershipOp::Create {
                item: item(),
                at: rack(),
            }],
        )
        .expect("authoritative synthetic original mint");
}

#[test]
fn v1_and_v2_same_exclusive_writer_survive_reopen_and_reject_downgrade() {
    let root = Root::new();
    let mut journal = root.open();
    create(&mut journal);
    let bound = metadata(1);
    let committed = journal
        .apply_proposed_bound_rack_pickup(id(2), pickup(), bound)
        .expect("same MYTX record must include original envelope");
    assert_eq!(committed.sequence, 2);
    assert_eq!(journal.item_count(), 1);
    assert_eq!(journal.location(item()), Some(hand()));
    assert_eq!(
        journal
            .verified_bound_rack_pickup(id(2), pickup(), bound)
            .unwrap(),
        Some(committed),
    );

    // Same transaction and operation with a different originally clicked
    // rack, ground entity, world tick, or active lease is NOT an ACK retry.
    for changed in [
        ProposedRackPickupEnvelope {
            rack_socket: 2,
            ..bound
        },
        ProposedRackPickupEnvelope {
            ground_entity: bound.ground_entity + 1,
            ..bound
        },
        ProposedRackPickupEnvelope {
            session_generation: 13,
            ..bound
        },
        ProposedRackPickupEnvelope {
            world_authority_epoch: 8,
            ..bound
        },
        ProposedRackPickupEnvelope {
            completed_world_tick: 1235,
            ..bound
        },
        ProposedRackPickupEnvelope {
            observed_item_mutation_sequence: 2,
            ..bound
        },
    ] {
        assert!(matches!(
            journal.verified_bound_rack_pickup(id(2), pickup(), changed),
            Err(ItemJournalError::BoundPickupMismatch)
        ));
        assert!(matches!(
            journal.apply_proposed_bound_rack_pickup(id(2), pickup(), changed),
            Err(ItemJournalError::BoundPickupMismatch)
        ));
    }
    assert!(matches!(
        journal.apply(id(2), &[pickup()]),
        Err(ItemJournalError::BoundPickupMismatch)
    ));
    assert_eq!(
        journal
            .apply_proposed_bound_rack_pickup(id(2), pickup(), bound)
            .unwrap(),
        committed
    );
    assert_eq!(journal.item_count(), 1);
    let old_bytes = fs::read(root.record(1)).unwrap();
    let bound_bytes = fs::read(root.record(2)).unwrap();
    assert_eq!(old_bytes[4], 1, "existing V1 stays unchanged");
    assert_eq!(bound_bytes[4], 2, "new metadata uses exactly one V2 record");
    assert_eq!(
        &bound_bytes[bound_bytes.len() - 4 - 80..bound_bytes.len() - 4],
        &bound.encode()
    );
    drop(journal);

    let mut reopened = root.open();
    assert_eq!(reopened.item_count(), 1);
    assert_eq!(reopened.location(item()), Some(hand()));
    assert_eq!(
        reopened
            .verified_bound_rack_pickup(id(2), pickup(), bound)
            .unwrap(),
        Some(committed)
    );
    assert_eq!(
        reopened
            .apply_proposed_bound_rack_pickup(id(2), pickup(), bound)
            .unwrap(),
        committed
    );
    assert!(matches!(
        reopened.apply(id(2), &[pickup()]),
        Err(ItemJournalError::BoundPickupMismatch)
    ));

    // Historical outcome remains durably true after legitimate subsequent
    // drop, but does not assert the previous player's CURRENT equipment.
    reopened
        .apply(
            id(3),
            &[OwnershipOp::Move {
                item: item(),
                from: hand(),
                to: rack(),
            }],
        )
        .unwrap();
    assert_eq!(
        reopened
            .verified_bound_rack_pickup(id(2), pickup(), bound)
            .unwrap(),
        Some(committed)
    );
    assert_eq!(reopened.location(item()), Some(rack()));
    assert_eq!(reopened.item_count(), 1);
}

#[test]
fn current_item_mutation_revision_must_match_before_first_bound_commit() {
    let root = Root::new();
    let mut journal = root.open();
    create(&mut journal);
    journal
        .apply(
            id(3),
            &[OwnershipOp::Move {
                item: item(),
                from: rack(),
                to: moved_rack(),
            }],
        )
        .unwrap();
    journal
        .apply(
            id(4),
            &[OwnershipOp::Move {
                item: item(),
                from: moved_rack(),
                to: rack(),
            }],
        )
        .unwrap();
    assert_eq!(journal.last_mutation_sequence(item()), Some(3));
    let head = journal.last_mutation_sequence(item());
    assert!(matches!(
        journal.apply_proposed_bound_rack_pickup(id(5), pickup(), metadata(1)),
        Err(ItemJournalError::InvalidBoundPickup(_))
    ));
    assert_eq!(journal.last_mutation_sequence(item()), head);
    assert_eq!(journal.location(item()), Some(rack()));
    assert_eq!(
        journal
            .verified_bound_rack_pickup(id(5), pickup(), metadata(1))
            .unwrap(),
        None
    );
    assert!(matches!(
        journal.apply_proposed_bound_rack_pickup(
            id(6),
            pickup(),
            ProposedRackPickupEnvelope {
                ground_entity: item().get(),
                ..metadata(3)
            }
        ),
        Err(ItemJournalError::InvalidBoundPickup(_))
    ));
    let receipt = journal
        .apply_proposed_bound_rack_pickup(id(7), pickup(), metadata(3))
        .unwrap();
    assert_eq!(receipt.sequence, 4);
    assert_eq!(journal.item_count(), 1);
}

#[test]
fn checksum_correct_but_semantically_corrupt_bound_envelope_aborts_recovery() {
    let root = Root::new();
    let mut journal = root.open();
    create(&mut journal);
    journal
        .apply_proposed_bound_rack_pickup(id(2), pickup(), metadata(1))
        .unwrap();
    drop(journal);
    let path = root.record(2);
    let mut bytes = fs::read(&path).unwrap();
    let metadata_start = bytes.len() - 4 - 80;
    // Corrupt the exact socket to impossible zero AND recompute the
    // unkeyed legacy checksum. Semantic validation must still reject it.
    bytes[metadata_start + 72] = 0;
    let sum = bytes[..bytes.len() - 4]
        .iter()
        .fold(0x811c_9dc5_u32, |acc, &b| {
            (acc ^ u32::from(b)).wrapping_mul(0x0100_0193)
        });
    let len = bytes.len();
    bytes[len - 4..].copy_from_slice(&sum.to_le_bytes());
    fs::write(path, bytes).unwrap();
    assert!(matches!(
        DurableItemJournal::open(&root.0),
        Err(ItemJournalError::InvalidBoundPickup(_))
    ));
}

#[test]
fn bound_transaction_cannot_alias_different_payload_or_same_item_double_winner() {
    let root = Root::new();
    let mut journal = root.open();
    create(&mut journal);
    let won = journal
        .apply_proposed_bound_rack_pickup(id(2), pickup(), metadata(1))
        .unwrap();
    assert_eq!(won.operation_count, 1);
    assert!(matches!(
        journal.apply_proposed_bound_rack_pickup(
            id(2),
            OwnershipOp::Move {
                item: item(),
                from: rack(),
                to: ItemLocation::Equipped {
                    character_id: CharacterId::new(2).unwrap(),
                    slot: 0,
                },
            },
            metadata(1)
        ),
        Err(ItemJournalError::InvalidBoundPickup(_))
    ));
    let losing = OwnershipOp::Move {
        item: item(),
        from: rack(),
        to: ItemLocation::Equipped {
            character_id: CharacterId::new(2).unwrap(),
            slot: 0,
        },
    };
    assert!(matches!(
        journal.apply(id(3), &[losing]),
        Err(ItemJournalError::InvalidTransaction(
            OwnershipError::ExpectedLocationMismatch
        ))
    ));
    assert_eq!(journal.item_count(), 1);
    assert_eq!(journal.location(item()), Some(hand()));
}

#[test]
fn observer_source_is_a_bounded_sequence_ordered_view_of_only_committed_v2() {
    use crate::item_journal::MAX_BOUND_PICKUP_OBSERVER_PAGE;

    let root = Root::new();
    let mut journal = root.open();
    assert_eq!(
        journal
            .proposed_bound_pickup_observer_page(0, 1)
            .unwrap()
            .journal_head,
        0
    );
    create(&mut journal); // V1 seq1 does not generate a pickup event.
    assert!(journal
        .proposed_bound_pickup_observer_page(0, 5)
        .unwrap()
        .events
        .is_empty());
    let first = journal
        .apply_proposed_bound_rack_pickup(id(2), pickup(), metadata(1))
        .unwrap();
    let original_event = journal
        .proposed_bound_pickup_observer_page(0, 1)
        .unwrap()
        .events[0];
    assert_eq!(original_event.journal_sequence, first.sequence);
    assert_eq!(original_event.transaction, id(2));
    assert_eq!(original_event.operation, pickup());
    assert_eq!(original_event.envelope, metadata(1));
    assert!(matches!(
        journal.proposed_bound_pickup_observer_page(0, 0),
        Err(ItemJournalError::InvalidRecord(_))
    ));
    assert!(matches!(
        journal.proposed_bound_pickup_observer_page(0, MAX_BOUND_PICKUP_OBSERVER_PAGE + 1),
        Err(ItemJournalError::InvalidRecord(_))
    ));

    journal
        .apply(
            id(3),
            &[OwnershipOp::Move {
                item: item(),
                from: hand(),
                to: rack(),
            }],
        )
        .unwrap(); // V1 seq3, no V2 event.
    let newer = journal
        .apply_proposed_bound_rack_pickup(id(4), pickup(), metadata(3))
        .unwrap(); // V2 seq4.
    assert_eq!(newer.sequence, 4);
    assert_eq!(
        journal
            .apply_proposed_bound_rack_pickup(id(4), pickup(), metadata(3))
            .unwrap(),
        newer,
        "identical retry cannot duplicate event or item commit"
    );
    let full = journal.proposed_bound_pickup_observer_page(0, 64).unwrap();
    assert_eq!(full.journal_head, 4);
    assert_eq!(full.events.len(), 2);
    assert_eq!(full.events[0], original_event);
    assert_eq!(full.events[1].journal_sequence, 4);
    assert_eq!(full.events[1].transaction, id(4));
    assert_eq!(full.events[1].envelope, metadata(3));
    assert_eq!(
        journal
            .proposed_bound_pickup_observer_page(0, 1)
            .unwrap()
            .events,
        vec![original_event]
    );
    assert_eq!(
        journal
            .proposed_bound_pickup_observer_page(2, 1)
            .unwrap()
            .events,
        vec![full.events[1]]
    );
    assert!(journal
        .proposed_bound_pickup_observer_page(4, 2)
        .unwrap()
        .events
        .is_empty());
    assert!(journal
        .proposed_bound_pickup_observer_page(u64::MAX, 1)
        .unwrap()
        .events
        .is_empty());

    // A V1 drop increments journal head but has no matching V2 pickup event.
    journal
        .apply(
            id(5),
            &[OwnershipOp::Move {
                item: item(),
                from: hand(),
                to: rack(),
            }],
        )
        .unwrap();
    assert_eq!(journal.location(item()), Some(rack()));
    let historical = journal.proposed_bound_pickup_observer_page(0, 64).unwrap();
    assert_eq!(historical.journal_head, 5);
    assert_eq!(historical.events, full.events);
    drop(journal);

    let journal = root.open(); // Same immutable source reconstructed from disk.
    assert_eq!(
        journal.proposed_bound_pickup_observer_page(0, 64).unwrap(),
        historical
    );
    assert_eq!(
        journal
            .proposed_bound_pickup_observer_page(2, 1)
            .unwrap()
            .events,
        vec![full.events[1]]
    );
    assert_eq!(journal.location(item()), Some(rack()));
    assert_ne!(
        journal.location(item()),
        Some(hand()),
        "historical event is not a currently equipped sword"
    );
}

#[cfg(unix)]
#[test]
fn sigkill_after_bound_commit_before_delivery_recovers_exact_event_source() {
    use std::{
        process::Command,
        thread,
        time::{Duration, Instant},
    };

    let root = Root::new();
    let ready = root.0.with_extension("v2-committed-no-delivery");
    {
        let mut seed_writer = root.open();
        create(&mut seed_writer);
    }

    let mut child = Command::new(std::env::current_exe().expect("test binary"))
        .arg("--ignored")
        .arg("--exact")
        .arg("alpha_bound_journal_tests::subprocess_bound_commit_before_delivery")
        .arg("--nocapture")
        .env("MYASO_C3AB_CRASH_ROOT", &root.0)
        .env("MYASO_C3AB_CRASH_READY", &ready)
        .spawn()
        .expect("spawn separate physical pickup journal writer");
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
        thread::sleep(Duration::from_millis(10));
    }
    let locked = committed
        && matches!(
            DurableItemJournal::open(&root.0),
            Err(ItemJournalError::WriterBusy)
        );
    let _ = child.kill();
    let _ = child.wait();
    assert!(
        committed,
        "child must publish durable bound V2 before crash"
    );
    assert!(locked, "the child held the EXCLUSIVE local writer lock");

    let mut recovered = root.open();
    let proof = recovered
        .verified_bound_rack_pickup(id(2), pickup(), metadata(1))
        .unwrap()
        .expect("same transaction and original envelope survive SIGKILL");
    assert_eq!(proof.sequence, 2);
    let page = recovered.proposed_bound_pickup_observer_page(0, 2).unwrap();
    assert_eq!(page.journal_head, 2);
    assert_eq!(page.events.len(), 1);
    assert_eq!(page.events[0].journal_sequence, proof.sequence);
    assert_eq!(page.events[0].transaction, id(2));
    assert_eq!(page.events[0].envelope, metadata(1));
    assert_eq!(page.events[0].operation, pickup());
    assert_eq!(
        recovered
            .apply_proposed_bound_rack_pickup(id(2), pickup(), metadata(1))
            .unwrap(),
        proof
    );
    assert_eq!(
        recovered.proposed_bound_pickup_observer_page(0, 2).unwrap(),
        page,
        "lost-ACK retry creates no second event or item owner"
    );
    assert!(matches!(
        recovered.apply_proposed_bound_rack_pickup(
            id(2),
            pickup(),
            ProposedRackPickupEnvelope {
                session_generation: 99,
                ..metadata(1)
            }
        ),
        Err(ItemJournalError::BoundPickupMismatch)
    ));
    assert_eq!(recovered.item_count(), 1);
    assert_eq!(recovered.location(item()), Some(hand()));
    drop(recovered);
    let _ = fs::remove_file(ready);
}

#[cfg(unix)]
#[test]
#[ignore = "subprocess helper launched by the SIGKILL bound outbox test"]
fn subprocess_bound_commit_before_delivery() {
    let (Some(root), Some(ready)) = (
        std::env::var_os("MYASO_C3AB_CRASH_ROOT"),
        std::env::var_os("MYASO_C3AB_CRASH_READY"),
    ) else {
        return;
    };
    let mut writer = DurableItemJournal::open(PathBuf::from(root)).expect("exclusive child writer");
    let proof = writer
        .apply_proposed_bound_rack_pickup(id(2), pickup(), metadata(1))
        .expect("atomic durable V2 publish BEFORE observer delivery");
    assert_eq!(proof.sequence, 2);
    fs::write(ready, b"MYTX V2 durable; observer NOT delivered").unwrap();
    loop {
        std::thread::park();
    }
}
