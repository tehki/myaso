//! Offline-only ONE-source migration review. Do NOT use this projection as
//! current 8C/Physics evidence or to authorize a live rack pickup. The Items
//! MYASOL03 checkpoint is rollbackable; one global item writer remains P0.

use std::path::Path;

use crate::{
    alpha_armory_mapping_preflight::{
        preflight_greyhaven_rack_v1, ProposedRackProjection, ProposedRackSource,
        ProposedWorldToCentimeter, RackPreflightError, GREYHAVEN_RACK_V1,
    },
    legacy_gear_preflight::LegacyImportPreflight,
    loot::{ItemKind, Point, ProposedRackSocket},
    loot_persistence::{read_quiescent_four_rack_checkpoint, CheckpointError},
    zone::ZoneId as ItemsZoneId,
};

/// Exactly four current-looking swords in ONE validated, bounded, but
/// unauthenticated and replayable legacy checkpoint. No writer is touched.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfflineQuiescentRackReview {
    pub checkpoint_length: usize,
    /// Existing legacy FNV checksum is NOT a MAC, signature, or anti-rollback.
    pub unkeyed_legacy_checksum: u64,
    /// Caller observation time is NOT a trusted completed World tick.
    pub caller_observation_time_ms: u64,
    pub proposed_core_swords: [ProposedRackProjection; 4],
    pub legacy_item_kinds: [ItemKind; 4],
}

#[derive(Debug)]
pub enum OfflineRackReviewError {
    Checkpoint(CheckpointError),
    /// All four physical rack sockets must contain a single real sword.
    /// Never synthesize a missing source sword to satisfy alpha acceptance.
    MissingSword {
        socket: u8,
    },
    CorePreflight(RackPreflightError),
}

/// Read one full Items MYASOL03 checkpoint exactly once, then project all
/// four ORIGINAL World-authored Greyhaven rack sockets from that same
/// internally coherent decoded snapshot. The untrusted caller cannot inject
/// a separate per-socket item/ground-entity list.
///
/// A complete collision-checked imported registry and EXPLICIT, externally
/// approved zone/transform are still required to obtain proposed typed u128
/// Core identities. An empty/mismatched checkpoint fails before producing any
/// partial proposed import. No Core or Items item changes are made here.
/// A previously valid checkpoint replay may still pass! Never use for a live
/// pickup, live initial ownership mint, ACK or production migration.
pub fn review_offline_quiescent_greyhaven_rack(
    checkpoint_path: &Path,
    imported: &LegacyImportPreflight,
    proposed_mapping: ProposedWorldToCentimeter,
    caller_observation_time_ms: u64,
) -> Result<OfflineQuiescentRackReview, OfflineRackReviewError> {
    let sockets = GREYHAVEN_RACK_V1.map(|(_, x, y)| ProposedRackSocket {
        at: Point {
            x: x as f32,
            y: y as f32,
        },
    });
    let view = read_quiescent_four_rack_checkpoint(
        checkpoint_path,
        ItemsZoneId::Moonvale,
        sockets,
        caller_observation_time_ms,
    )
    .map_err(OfflineRackReviewError::Checkpoint)?;

    // A partial rack is a legitimate current world state, but cannot be
    // silently migrated as a *complete four-sword initialization manifest*.
    let mut source = Vec::with_capacity(4);
    let mut kinds = Vec::with_capacity(4);
    for (index, maybe_sword) in view.slots.into_iter().enumerate() {
        let physical = maybe_sword.ok_or(OfflineRackReviewError::MissingSword {
            socket: (index + 1) as u8,
        })?;
        let (socket_id, world_x, world_y) = GREYHAVEN_RACK_V1[index];
        source.push(ProposedRackSource {
            socket_id,
            world_x,
            world_y,
            ground_entity_id: physical.ground_entity_id,
            legacy_item_id: physical.item_id,
        });
        kinds.push(physical.kind);
    }

    let source: [ProposedRackSource; 4] = source
        .try_into()
        .map_err(|_| OfflineRackReviewError::MissingSword { socket: 4 })?;
    let kinds: [ItemKind; 4] = kinds
        .try_into()
        .map_err(|_| OfflineRackReviewError::MissingSword { socket: 4 })?;
    let proposed_core_swords = preflight_greyhaven_rack_v1(source, imported, proposed_mapping)
        .map_err(OfflineRackReviewError::CorePreflight)?;

    Ok(OfflineQuiescentRackReview {
        checkpoint_length: view.checkpoint_length,
        unkeyed_legacy_checksum: view.unkeyed_legacy_checksum,
        caller_observation_time_ms: view.caller_observation_time_ms,
        proposed_core_swords,
        legacy_item_kinds: kinds,
    })
}

/// A single LOCAL Core-journal head matched to one offline Items checkpoint.
/// The local journal is assumed to be the selected writer, not independently
/// verified against another machine, a signed 8C epoch or a live Items writer.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfflineCoreRackMatch {
    pub offline_source: OfflineQuiescentRackReview,
    pub local_journal_head: u64,
    pub local_item_mutation_sequences: [u64; 4],
}

#[derive(Debug)]
pub enum OfflineCoreRackMatchError {
    Source(OfflineRackReviewError),
    Journal(crate::item_journal::ItemJournalError),
    ItemAbsentOrMoved { socket: u8 },
    InconsistentLocalJournalHead,
    ChangedLocalJournalHead,
    ChangedItemRevision { socket: u8 },
}

/// Reconcile one ONE-file, historical Items read with the CURRENT exclusive
/// Core journal's four exact physical items and exact Ground locations,
/// without importing, minting, mutating or locking an autonomous second writer.
/// This rejects OLD checkpoint ghosts *once Core has moved the sword*.
/// It CANNOT reject an old-but-valid checkpoint if Core history has not
/// changed, prove a globally fenced writer, or authenticate actor/LOS.
/// Returned state is an offline review witness, NEVER a client ACK or live
/// rack-occupancy source.
pub fn review_offline_rack_against_existing_core(
    journal: &crate::item_journal::DurableItemJournal,
    checkpoint_path: &Path,
    imported: &LegacyImportPreflight,
    proposed_mapping: ProposedWorldToCentimeter,
    caller_observation_time_ms: u64,
) -> Result<OfflineCoreRackMatch, OfflineCoreRackMatchError> {
    let offline_source = review_offline_quiescent_greyhaven_rack(
        checkpoint_path,
        imported,
        proposed_mapping,
        caller_observation_time_ms,
    )
    .map_err(OfflineCoreRackMatchError::Source)?;
    let mut head = None;
    let mut revs = [0_u64; 4];
    for (index, row) in offline_source.proposed_core_swords.iter().enumerate() {
        let (current_head, mutation) = journal
            .checked_unique_ground_membership(row.canonical_item, row.ground)
            .map_err(OfflineCoreRackMatchError::Journal)?;
        if let Some(prior) = head {
            if prior != current_head {
                return Err(OfflineCoreRackMatchError::InconsistentLocalJournalHead);
            }
        } else {
            head = Some(current_head);
        }
        revs[index] = mutation.ok_or(OfflineCoreRackMatchError::ItemAbsentOrMoved {
            socket: (index + 1) as u8,
        })?;
    }
    Ok(OfflineCoreRackMatch {
        offline_source,
        local_journal_head: head.ok_or(OfflineCoreRackMatchError::InconsistentLocalJournalHead)?,
        local_item_mutation_sequences: revs,
    })
}

/// Pin an EXISTING local witness against the very same journal lineage.
/// Strictly deny even a sword that moved away and returned to its old rack:
/// its per-item mutation and canonical journal head have advanced (ABA).
/// An independent/new journal with cloned bytes can imitate this witness:
/// caller still must enforce sole globally fenced writer lineage.
pub fn recheck_original_offline_core_rack_match(
    journal: &crate::item_journal::DurableItemJournal,
    originally: &OfflineCoreRackMatch,
) -> Result<(), OfflineCoreRackMatchError> {
    for (index, row) in originally
        .offline_source
        .proposed_core_swords
        .iter()
        .enumerate()
    {
        let (head, current_revision) = journal
            .checked_unique_ground_membership(row.canonical_item, row.ground)
            .map_err(OfflineCoreRackMatchError::Journal)?;
        if head != originally.local_journal_head {
            return Err(OfflineCoreRackMatchError::ChangedLocalJournalHead);
        }
        let current_revision =
            current_revision.ok_or(OfflineCoreRackMatchError::ItemAbsentOrMoved {
                socket: (index + 1) as u8,
            })?;
        if current_revision != originally.local_item_mutation_sequences[index] {
            return Err(OfflineCoreRackMatchError::ChangedItemRevision {
                socket: (index + 1) as u8,
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        character_identity::{
            CharacterId as ItemsCharacterId, SessionIdentityRegistry, SessionLease,
        },
        item_ownership::ZoneId as CoreZoneId,
        legacy_gear_preflight::{LegacyDomain, LegacyMigrationError, ProposedLegacyNamespaces},
        loot::LootAuthority,
        loot_persistence::{save_quiescent, CheckpointError},
        simulation::World,
    };
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    struct Fixture {
        dir: PathBuf,
        checkpoint: PathBuf,
        actual_item_ids: [u64; 4],
        actual_ground_ids: [u64; 4],
        imported: LegacyImportPreflight,
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.dir);
        }
    }
    fn mapping() -> ProposedWorldToCentimeter {
        // Unapproved test-only conversion, NOT current 8C zone/World origin.
        ProposedWorldToCentimeter {
            zone: CoreZoneId::new(1).unwrap(),
            numerator_cm: 100,
            denominator_world_units: 1,
            offset_x_cm: 0,
            offset_y_cm: 0,
        }
    }
    /// TEST ONLY: a dropped POSIX writer may finish descriptor handoff just
    /// after a sibling test's close under high parallelism. Never change
    /// production `DurableItemJournal::open` single-writer fail-fast policy.
    fn open_test_only_journal(root: &std::path::Path) -> crate::item_journal::DurableItemJournal {
        use crate::item_journal::{DurableItemJournal, ItemJournalError};
        use std::{
            thread,
            time::{Duration, Instant},
        };
        let deadline = Instant::now() + Duration::from_millis(500);
        loop {
            match DurableItemJournal::open(root) {
                Ok(writer) => return writer,
                Err(ItemJournalError::WriterBusy) if Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(5));
                }
                Err(e) => panic!("test-only Core journal writer: {e:?}"),
            }
        }
    }

    fn fixture() -> Fixture {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "myaso-c3ad-quiescent-rack-{}-{stamp}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&dir).unwrap();
        let checkpoint = dir.join("actual-items-myasol03.chk");
        let mut loot = LootAuthority::new();
        let mut world = World::new(8192.0, 8192.0);
        for (i, (_, x, y)) in GREYHAVEN_RACK_V1.iter().enumerate() {
            let actor = (i + 1) as u32;
            assert!(world.add_player_at(actor, *x as f32, *y as f32, 0.0));
            loot.register(actor).unwrap();
            let sword = loot
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
                world.fighter(actor).unwrap(),
                ItemsZoneId::Moonvale,
                sword,
                1,
            )
            .unwrap();
        }
        let sockets = GREYHAVEN_RACK_V1.map(|(_, x, y)| ProposedRackSocket {
            at: Point {
                x: x as f32,
                y: y as f32,
            },
        });
        let actual = loot
            .proposed_current_rack_swords(ItemsZoneId::Moonvale, sockets, 2)
            .unwrap();
        let actual = actual.map(|row| row.expect("four original physically dropped swords"));
        let actual_item_ids = actual.map(|row| row.item_id);
        let actual_ground_ids = actual.map(|row| row.ground_entity_id);

        let namespaces = ProposedLegacyNamespaces::new([
            0x4D59_4153_0000_0001,
            0x4D59_4153_0000_0002,
            0x4D59_4153_0000_0003,
            0x4D59_4153_0000_0004,
            0x4D59_4153_0000_0005,
        ])
        .unwrap();
        let mut imported = LegacyImportPreflight::new(namespaces, []).unwrap();
        for row in actual {
            imported
                .stage_owner(LegacyDomain::GroundEntity, row.ground_entity_id)
                .unwrap();
            imported
                .stage_owner(LegacyDomain::Item, row.item_id)
                .unwrap();
        }
        let mut identities = SessionIdentityRegistry::new();
        for actor in 1..=4 {
            let lease = SessionLease::new(actor, 1).unwrap();
            identities
                .bind_verified(lease, ItemsCharacterId::new(u64::from(actor)).unwrap())
                .unwrap();
            loot.park_inventory(&identities, lease).unwrap();
        }
        save_quiescent(&checkpoint, &loot).unwrap();
        Fixture {
            dir,
            checkpoint,
            actual_item_ids,
            actual_ground_ids,
            imported,
        }
    }

    #[test]
    fn actual_quiescent_items_checkpoint_yields_one_complete_collision_checked_core_review() {
        let f = fixture();
        let proposal =
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 2)
                .unwrap();
        assert_eq!(proposal.proposed_core_swords.len(), 4);
        assert_eq!(proposal.caller_observation_time_ms, 2);
        assert!(proposal.checkpoint_length > 8);
        for (i, row) in proposal.proposed_core_swords.iter().enumerate() {
            assert_eq!(row.socket_id, GREYHAVEN_RACK_V1[i].0);
            assert_eq!(
                row.canonical_item,
                f.imported.core_item(f.actual_item_ids[i]).unwrap(),
            );
            assert_eq!(
                row.canonical_ground_entity,
                f.imported
                    .resolve_registered(LegacyDomain::GroundEntity, f.actual_ground_ids[i])
                    .unwrap()
            );
            assert_ne!(row.canonical_ground_entity, row.canonical_item.get());
            assert_eq!(
                proposal.legacy_item_kinds[i],
                if i % 2 == 0 {
                    ItemKind::RustySword
                } else {
                    ItemKind::IronSword
                }
            );
        }
        let second =
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 2)
                .unwrap();
        assert_eq!(
            proposal, second,
            "one immutable checkpoint must project deterministically"
        );
    }

    #[test]
    fn partial_absent_invalid_registry_and_bad_scale_never_publish_four_sword_proposal() {
        let f = fixture();
        let mut other_import = LegacyImportPreflight::new(
            ProposedLegacyNamespaces::new([
                0x4D59_4153_0000_0001,
                0x4D59_4153_0000_0002,
                0x4D59_4153_0000_0003,
                0x4D59_4153_0000_0004,
                0x4D59_4153_0000_0005,
            ])
            .unwrap(),
            [],
        )
        .unwrap();
        for i in 1..4 {
            other_import
                .stage_owner(LegacyDomain::GroundEntity, f.actual_ground_ids[i])
                .unwrap();
            other_import
                .stage_owner(LegacyDomain::Item, f.actual_item_ids[i])
                .unwrap();
        }
        assert!(matches!(
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &other_import, mapping(), 2),
            Err(OfflineRackReviewError::CorePreflight(
                RackPreflightError::Legacy(LegacyMigrationError::UnregisteredSourceIdentity)
            ))
        ));
        let mut wrong_scale = mapping();
        wrong_scale.numerator_cm = 0;
        assert!(matches!(
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, wrong_scale, 2),
            Err(OfflineRackReviewError::CorePreflight(
                RackPreflightError::InvalidScale
            ))
        ));

        // A VALID checkpoint later than its first physical pickup contains
        // only 3/4 rack swords. It must never fill the missing source slot.
        let mut state = crate::loot_persistence::load_quiescent(&f.checkpoint).unwrap();
        let mut world = World::new(8192.0, 8192.0);
        assert!(world.add_player_at(9, 3740.0, 4088.0, 0.0));
        state.register(9).unwrap();
        let first = state
            .proposed_current_rack_swords(
                ItemsZoneId::Moonvale,
                GREYHAVEN_RACK_V1.map(|(_, x, y)| ProposedRackSocket {
                    at: Point {
                        x: x as f32,
                        y: y as f32,
                    },
                }),
                3,
            )
            .unwrap()[0]
            .unwrap();
        let taken = state
            .take_ground(
                9,
                world.fighter(9).unwrap(),
                ItemsZoneId::Moonvale,
                first.ground_entity_id,
                3,
            )
            .unwrap();
        assert_eq!(taken.id, f.actual_item_ids[0]);

        // Remove active actor with its verified lease before writing a
        // legal quiescent checkpoint with the sword in its backpack.
        let mut identities = SessionIdentityRegistry::new();
        let lease = SessionLease::new(9, 1).unwrap();
        identities
            .bind_verified(lease, ItemsCharacterId::new(9).unwrap())
            .unwrap();
        state.park_inventory(&identities, lease).unwrap();
        let after_path = f.dir.join("after-pickup-myasol03.chk");
        save_quiescent(&after_path, &state).unwrap();
        assert!(matches!(
            review_offline_quiescent_greyhaven_rack(&after_path, &f.imported, mapping(), 4),
            Err(OfflineRackReviewError::MissingSword { socket: 1 })
        ));
        // Intentional adversarial replay: the OLD byte-valid checkpoint still
        // passes! This function must never claim anti-rollback/live authority.
        assert!(
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 4)
                .is_ok()
        );
    }

    #[test]
    fn corrupt_checkpoint_fails_before_source_registry_preflight() {
        let f = fixture();
        let mut bytes = fs::read(&f.checkpoint).unwrap();
        bytes[12] ^= 0x1;
        let corrupt = f.dir.join("corrupt.chk");
        fs::write(&corrupt, bytes).unwrap();
        assert!(matches!(
            review_offline_quiescent_greyhaven_rack(&corrupt, &f.imported, mapping(), 2),
            Err(OfflineRackReviewError::Checkpoint(CheckpointError::Corrupt))
        ));
    }

    #[test]
    fn same_ground_rack_socket_two_canonical_items_must_reject_entire_review_after_restart() {
        use crate::{
            item_journal::ItemJournalError,
            item_ownership::{ItemId, ItemLocation, OwnershipOp, OwnershipTxnId},
        };
        let f = fixture();
        let root = f.dir.join("one-core-writer-with-ambiguous-rack");
        let mut journal = open_test_only_journal(&root);
        let proposal =
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 2)
                .unwrap();
        let create: Vec<_> = proposal
            .proposed_core_swords
            .iter()
            .map(|row| OwnershipOp::Create {
                item: row.canonical_item,
                at: row.ground,
            })
            .collect();
        journal
            .apply(OwnershipTxnId::new(200).unwrap(), &create)
            .unwrap();

        let original = review_offline_rack_against_existing_core(
            &journal,
            &f.checkpoint,
            &f.imported,
            mapping(),
            2,
        )
        .unwrap();
        assert_eq!(original.local_item_mutation_sequences, [1; 4]);
        let first = proposal.proposed_core_swords[0];
        // A fifth canonical item of UNKNOWN item-kind occupies the exact same
        // authored rack point. Generic Core permits multiple Ground items.
        // The old matching-by-expected-ID alone incorrectly accepted 4/4.
        let fifth = ItemId::new((0xfeed_u128 << 64) | 55).unwrap();
        assert!(proposal
            .proposed_core_swords
            .iter()
            .all(|row| row.canonical_item != fifth));
        journal
            .apply(
                OwnershipTxnId::new(201).unwrap(),
                &[OwnershipOp::Create {
                    item: fifth,
                    at: first.ground,
                }],
            )
            .unwrap();
        assert_eq!(journal.item_count(), 5);
        assert_eq!(journal.location(first.canonical_item), Some(first.ground));
        assert_eq!(
            journal
                .checked_ground_membership(first.canonical_item, first.ground)
                .unwrap()
                .1,
            Some(1),
            "normal membership proves expected sword only, not rack exclusivity"
        );
        let ambiguous = review_offline_rack_against_existing_core(
            &journal,
            &f.checkpoint,
            &f.imported,
            mapping(),
            2,
        );
        assert!(matches!(
            ambiguous,
            Err(OfflineCoreRackMatchError::Journal(
                ItemJournalError::InvalidRecord("ambiguous physical rack ground occupancy")
            ))
        ));
        drop(journal);
        let mut journal = open_test_only_journal(&root);
        assert!(
            matches!(
                review_offline_rack_against_existing_core(
                    &journal,
                    &f.checkpoint,
                    &f.imported,
                    mapping(),
                    2
                ),
                Err(OfflineCoreRackMatchError::Journal(
                    ItemJournalError::InvalidRecord("ambiguous physical rack ground occupancy")
                ))
            ),
            "the ambiguous fifth owner survives local journal restart"
        );

        // Moving that fifth item completely away restores unique exact
        // rack occupancy, but never resurrects an earlier pinned head.
        let elsewhere = ItemLocation::Ground {
            zone_id: mapping().zone,
            x_cm: 1234,
            y_cm: 5678,
        };
        journal
            .apply(
                OwnershipTxnId::new(202).unwrap(),
                &[OwnershipOp::Move {
                    item: fifth,
                    from: first.ground,
                    to: elsewhere,
                }],
            )
            .unwrap();
        let current = review_offline_rack_against_existing_core(
            &journal,
            &f.checkpoint,
            &f.imported,
            mapping(),
            2,
        )
        .unwrap();
        assert_eq!(current.local_item_mutation_sequences, [1; 4]);
        assert_eq!(current.local_journal_head, 3);
        recheck_original_offline_core_rack_match(&journal, &current).unwrap();
        assert!(matches!(
            recheck_original_offline_core_rack_match(&journal, &original),
            Err(OfflineCoreRackMatchError::ChangedLocalJournalHead)
        ));
    }

    #[test]
    fn core_journal_reconciliation_denies_old_items_ghost_and_prior_aba_revision() {
        use crate::{
            alpha_bound_pickup::ProposedRackPickupEnvelope,
            identity::CharacterId,
            item_ownership::{ItemLocation, OwnershipOp, OwnershipTxnId},
        };
        let f = fixture();
        let root = f.dir.join("one-core-writer");
        let mut journal = open_test_only_journal(&root);
        let offline =
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 2)
                .unwrap();

        // The checkpoint alone can NEVER mint these swords. The fixture
        // deliberately stages the four Core items through the same sole
        // writer, to test subsequent READ-ONLY concordance.
        assert!(matches!(
            review_offline_rack_against_existing_core(
                &journal,
                &f.checkpoint,
                &f.imported,
                mapping(),
                2
            ),
            Err(OfflineCoreRackMatchError::ItemAbsentOrMoved { socket: 1 })
        ));
        let create: Vec<_> = offline
            .proposed_core_swords
            .iter()
            .map(|row| OwnershipOp::Create {
                item: row.canonical_item,
                at: row.ground,
            })
            .collect();
        let txn = |n| OwnershipTxnId::new(n).unwrap();
        journal.apply(txn(10), &create).unwrap();

        let baseline = review_offline_rack_against_existing_core(
            &journal,
            &f.checkpoint,
            &f.imported,
            mapping(),
            2,
        )
        .unwrap();
        assert_eq!(baseline.local_journal_head, 1);
        assert_eq!(baseline.local_item_mutation_sequences, [1; 4]);
        recheck_original_offline_core_rack_match(&journal, &baseline).unwrap();

        // Core V2 commits the EXACT real imported sword into another owner.
        // The unchanged Items checkpoint is still checksum-valid and STILL
        // says 4/4: this read-only cross-check must deny its ground ghost.
        let sword = baseline.offline_source.proposed_core_swords[0];
        let actor = CharacterId::new(123).unwrap();
        let equipped = ItemLocation::Equipped {
            character_id: actor,
            slot: 0,
        };
        journal
            .apply_proposed_bound_rack_pickup(
                txn(11),
                OwnershipOp::Move {
                    item: sword.canonical_item,
                    from: sword.ground,
                    to: equipped,
                },
                ProposedRackPickupEnvelope {
                    rack_socket: 1,
                    ground_entity: sword.canonical_ground_entity,
                    character: actor,
                    session_generation: 1,
                    world_authority_epoch: 1,
                    completed_world_tick: 1,
                    world_map_revision: 1,
                    observed_item_mutation_sequence: 1,
                },
            )
            .unwrap();
        assert_eq!(journal.item_count(), 4);
        assert_eq!(journal.location(sword.canonical_item), Some(equipped));
        assert!(
            review_offline_quiescent_greyhaven_rack(&f.checkpoint, &f.imported, mapping(), 3)
                .is_ok(),
            "old Items checkpoint remains valid, but is not current"
        );
        assert!(matches!(
            review_offline_rack_against_existing_core(
                &journal,
                &f.checkpoint,
                &f.imported,
                mapping(),
                3
            ),
            Err(OfflineCoreRackMatchError::ItemAbsentOrMoved { socket: 1 })
        ));
        assert!(matches!(
            recheck_original_offline_core_rack_match(&journal, &baseline),
            Err(OfflineCoreRackMatchError::ChangedLocalJournalHead)
        ));

        // ABA: original physical sword comes back to the EXACT same point.
        // A new offline matching review can describe current local state,
        // but must never resurrect the previously pinned pickup watermark.
        journal
            .apply(
                txn(12),
                &[OwnershipOp::Move {
                    item: sword.canonical_item,
                    from: equipped,
                    to: sword.ground,
                }],
            )
            .unwrap();
        let later = review_offline_rack_against_existing_core(
            &journal,
            &f.checkpoint,
            &f.imported,
            mapping(),
            4,
        )
        .unwrap();
        assert_eq!(later.local_journal_head, 3);
        assert_eq!(later.local_item_mutation_sequences, [3, 1, 1, 1]);
        assert_eq!(journal.item_count(), 4);
        assert!(matches!(
            recheck_original_offline_core_rack_match(&journal, &baseline),
            Err(OfflineCoreRackMatchError::ChangedLocalJournalHead)
        ));
        drop(journal);
        let reopened = open_test_only_journal(&root);
        assert!(matches!(
            recheck_original_offline_core_rack_match(&reopened, &baseline),
            Err(OfflineCoreRackMatchError::ChangedLocalJournalHead)
        ));
        recheck_original_offline_core_rack_match(&reopened, &later).unwrap();
        assert_eq!(reopened.location(sword.canonical_item), Some(sword.ground));
        assert_eq!(reopened.item_count(), 4);
    }
}
