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
