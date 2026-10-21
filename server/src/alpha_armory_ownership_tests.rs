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
/// Scratch-only TWO WRITER COUNTEREXAMPLE. This is deliberately NOT a valid
/// gameplay transaction or a candidate for production: it proves why Core
/// journal receipts and Items memory/checkpoints cannot both claim to own
/// live swords until one globally fenced committed writer is selected.
#[test]
fn actual_items_rack_source_proves_dual_writer_split_brain_requires_one_authority() {
    use crate::{
        alpha_armory_mapping_preflight::{
            preflight_greyhaven_rack_v1, ProposedRackSource, ProposedWorldToCentimeter,
            GREYHAVEN_RACK_V1,
        },
        alpha_current_rack_bindings::read_proposed_current_four_rack_items,
        legacy_gear_preflight::{LegacyDomain, LegacyImportPreflight, ProposedLegacyNamespaces},
        loot::{ItemKind, LootAuthority, ProposedRackSocket},
        simulation::World,
        zone::ZoneId as ItemsZoneId,
    };
    // Source: four genuine Items-domain grants and physically placed server
    // ground entities. Unlike synthetic manifest fixtures these IDs are read
    // back from actual LootAuthority ground objects after drop_backpack.
    let mut loot = LootAuthority::new();
    let mut seed_world = World::new(8192.0, 8192.0);
    for (i, (_, x, y)) in GREYHAVEN_RACK_V1.iter().enumerate() {
        let actor = (i + 1) as u32;
        assert!(seed_world.add_player_at(actor, *x as f32, *y as f32, 0.0));
        loot.register(actor).unwrap();
        let item = loot
            .grant(
                actor,
                if i % 2 == 0 {
                    ItemKind::RustySword
                } else {
                    ItemKind::IronSword
                },
                1,
            )
            .unwrap();
        loot.drop_backpack(
            actor,
            seed_world.fighter(actor).unwrap(),
            ItemsZoneId::Moonvale,
            item,
            1,
        )
        .unwrap();
    }
    let sockets = GREYHAVEN_RACK_V1.map(|(_, x, y)| ProposedRackSocket {
        at: crate::loot::Point {
            x: x as f32,
            y: y as f32,
        },
    });
    let original = loot
        .proposed_current_rack_swords(ItemsZoneId::Moonvale, sockets, 2)
        .unwrap();
    assert_eq!(original.iter().filter(|slot| slot.is_some()).count(), 4);
    let source = std::array::from_fn(|i| {
        let (socket_id, x, y) = GREYHAVEN_RACK_V1[i];
        let physical = original[i].expect("actual current ground sword");
        ProposedRackSource {
            socket_id,
            world_x: x,
            world_y: y,
            ground_entity_id: physical.ground_entity_id,
            legacy_item_id: physical.item_id,
        }
    });
    // Explicit collision-checked proposed namespace and rational transform
    // for fixture use only. x100 and ZoneId(1) are NOT approved runtime data.
    let namespaces = ProposedLegacyNamespaces::new([
        0x4D59_4153_0000_0001,
        0x4D59_4153_0000_0002,
        0x4D59_4153_0000_0003,
        0x4D59_4153_0000_0004,
        0x4D59_4153_0000_0005,
    ])
    .unwrap();
    let mut imported = LegacyImportPreflight::new(namespaces, []).unwrap();
    for s in source {
        imported
            .stage_owner(LegacyDomain::GroundEntity, s.ground_entity_id)
            .unwrap();
        imported
            .stage_owner(LegacyDomain::Item, s.legacy_item_id)
            .unwrap();
    }
    let mapping = ProposedWorldToCentimeter {
        zone: ZoneId::new(1).unwrap(),
        numerator_cm: 100,
        denominator_world_units: 1,
        offset_x_cm: 0,
        offset_y_cm: 0,
    };
    let canonical = preflight_greyhaven_rack_v1(source, &imported, mapping).unwrap();
    let root = IsolatedJournal::new();
    let mut journal = root.open();
    let created: Vec<_> = canonical
        .iter()
        .map(|row| OwnershipOp::Create {
            item: row.canonical_item,
            at: row.ground,
        })
        .collect();
    journal.apply(txn(90_000), &created).unwrap();
    let before =
        read_proposed_current_four_rack_items(&journal, source, &imported, mapping).unwrap();
    assert_eq!(
        before.slots().iter().filter(|slot| slot.is_some()).count(),
        4
    );
    for (i, row) in before.slots().into_iter().enumerate() {
        let core = row.unwrap();
        let physical = original[i].unwrap();
        assert_eq!(
            core.canonical_item(),
            imported.core_item(physical.item_id).unwrap()
        );
        assert_eq!(
            core.canonical_ground_entity(),
            imported
                .resolve_registered(LegacyDomain::GroundEntity, physical.ground_entity_id)
                .unwrap()
        );
    }

    // Counterexample, NOT a permitted production sequence: Core commits
    // owner #1's claim, but Items has not participated in that same writer.
    let first_core = before.slots()[0].unwrap();
    let core_pickup = [OwnershipOp::Move {
        item: first_core.canonical_item(),
        from: first_core.ground(),
        to: equipped(1),
    }];
    // EVEN the more stringent V2 single-record envelope+receipt cannot
    // fence a second, independent Items writer. The values here are only
    // explicitly synthetic World/session witnesses; the physical IDs are
    // derived from the actual Items ground and its checked namespace import.
    let proposed = crate::alpha_bound_pickup::ProposedRackPickupEnvelope {
        rack_socket: 1,
        ground_entity: first_core.canonical_ground_entity(),
        character: CharacterId::new(1).unwrap(),
        session_generation: 1,
        world_authority_epoch: 1,
        completed_world_tick: 1,
        world_map_revision: 1,
        observed_item_mutation_sequence: 1,
    };
    let committed = journal
        .apply_proposed_bound_rack_pickup(txn(90_001), core_pickup[0], proposed)
        .unwrap();
    assert_eq!(committed.sequence, 2);
    let initial_event = journal.proposed_bound_pickup_observer_page(0, 3).unwrap();
    assert_eq!(initial_event.events.len(), 1);
    assert_eq!(initial_event.events[0].transaction, txn(90_001));
    assert_eq!(initial_event.events[0].envelope, proposed);
    assert_eq!(initial_event.events[0].operation, core_pickup[0]);
    assert!(
        read_proposed_current_four_rack_items(&journal, source, &imported, mapping)
            .unwrap()
            .slots()[0]
            .is_none()
    );

    // Items still advertises the *same* ground instance as available. Both
    // reads are internally valid but globally contradictory; reading both
    // independently is not one ownership transaction.
    let stale_items = loot
        .proposed_current_rack_swords(ItemsZoneId::Moonvale, sockets, 3)
        .unwrap();
    assert_eq!(stale_items[0], original[0]);

    // If another Items path separately moves the physical sword to actor #2,
    // each ledger now independently claims a DIFFERENT owner for the SAME ID.
    let mut pickup_world = World::new(8192.0, 8192.0);
    assert!(pickup_world.add_player_at(2, 3740.0, 4088.0, 0.0));
    let obtained = loot
        .take_ground(
            2,
            pickup_world.fighter(2).unwrap(),
            ItemsZoneId::Moonvale,
            original[0].unwrap().ground_entity_id,
            3,
        )
        .unwrap();
    assert_eq!(obtained.id, original[0].unwrap().item_id);
    assert_eq!(
        loot.inventory(2)
            .unwrap()
            .backpack()
            .iter()
            .filter(|s| s.id == obtained.id)
            .count(),
        1
    );
    assert_eq!(
        journal.location(first_core.canonical_item()),
        Some(equipped(1))
    );
    assert!(loot
        .proposed_current_rack_swords(ItemsZoneId::Moonvale, sockets, 4)
        .unwrap()[0]
        .is_none());

    // Stronger negative control: both stores can persist and independently
    // reopen the contradictory ownership histories. A restart alone cannot
    // reconcile two writers or infer the missing cross-store transaction.
    use crate::character_identity::{
        CharacterId as LegacyCharacterId, SessionIdentityRegistry, SessionLease,
    };
    let mut identities = SessionIdentityRegistry::new();
    for actor in 1..=4 {
        let lease = SessionLease::new(actor, 1).unwrap();
        let character = LegacyCharacterId::new(u64::from(actor)).unwrap();
        identities.bind_verified(lease, character).unwrap();
        loot.park_inventory(&identities, lease).unwrap();
    }
    let legacy_checkpoint = root.0.with_extension("items-mywld03-separate-checkpoint");
    crate::loot_persistence::save_quiescent(&legacy_checkpoint, &loot).unwrap();
    drop(journal);
    let recovered_items = crate::loot_persistence::load_quiescent(&legacy_checkpoint).unwrap();
    let recovered_core = root.open();
    // V2 is locally durable and internally consistent even while the other
    // autonomous writer owns the same physical imported sword differently.
    // This is precisely why neither independent success licenses live ACK.
    let recovered_event = recovered_core
        .proposed_bound_pickup_observer_page(0, 2)
        .unwrap();
    assert_eq!(recovered_event.events.len(), 1);
    assert_eq!(recovered_event.events[0], initial_event.events[0]);
    assert_eq!(
        recovered_core
            .verified_bound_rack_pickup(txn(90_001), core_pickup[0], proposed)
            .unwrap(),
        Some(committed)
    );
    assert_eq!(
        recovered_items
            .parked_inventory(LegacyCharacterId::new(2).unwrap())
            .unwrap()
            .backpack()
            .iter()
            .filter(|stack| stack.id == original[0].unwrap().item_id)
            .count(),
        1,
        "legacy storage durably claims same sword for character #2"
    );
    assert_eq!(
        recovered_core.location(first_core.canonical_item()),
        Some(equipped(1)),
        "Core journal durably claims same sword for character #1"
    );
    assert_eq!(recovered_core.item_count(), 4);
    std::fs::remove_file(&legacy_checkpoint).unwrap();
    assert_eq!(
        recovered_items
            .proposed_current_rack_swords(ItemsZoneId::Moonvale, sockets, 4)
            .unwrap()
            .iter()
            .filter(|slot| slot.is_some())
            .count(),
        3
    );

    // These facts together are unacceptable for release; there is no
    // implied reconciliation, signed client ACK or single-writer proof here.
    // One canonical atomic owner+receipt+outbox commit is a hard P0 gate.
}
