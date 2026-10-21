//! First Playable P0: READ-ONLY (non-authoritative) current rack item
//! candidate mapping. An immutable preflight gives four reviewed locations,
//! while the local C3e journal determines which item identities remain there.
//! No new writer, actor, ItemKind, lease, epoch, signed world source, network
//! ACK, physical hit test or commit transaction is implemented here.

use crate::{
    alpha_armory_mapping_preflight::{
        preflight_greyhaven_rack_v1, ProposedRackSource, ProposedWorldToCentimeter,
        RackPreflightError,
    },
    item_journal::{DurableItemJournal, ItemJournalError},
    item_ownership::{ItemId, ItemLocation},
    legacy_gear_preflight::LegacyImportPreflight,
};

#[derive(Debug)]
pub enum RackBindingReadError {
    InvalidMapping(RackPreflightError),
    Journal(ItemJournalError),
}

impl From<RackPreflightError> for RackBindingReadError {
    fn from(error: RackPreflightError) -> Self {
        Self::InvalidMapping(error)
    }
}

impl From<ItemJournalError> for RackBindingReadError {
    fn from(error: ItemJournalError) -> Self {
        Self::Journal(error)
    }
}

/// Candidate from an exact reviewed source item still present at its proposed
/// rack Ground location. These private fields cannot certify item kind,
/// actual current ground-entity existence, signed authoring or 8C epoch.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CurrentRackCandidate {
    socket_id: &'static str,
    canonical_ground_entity: u128,
    canonical_item: ItemId,
    ground: ItemLocation,
    item_mutation_sequence: u64,
}

impl CurrentRackCandidate {
    pub fn socket_id(self) -> &'static str {
        self.socket_id
    }

    pub fn canonical_ground_entity(self) -> u128 {
        self.canonical_ground_entity
    }

    pub fn canonical_item(self) -> ItemId {
        self.canonical_item
    }

    pub fn ground(self) -> ItemLocation {
        self.ground
    }

    pub fn item_mutation_sequence(self) -> u64 {
        self.item_mutation_sequence
    }
}

/// ALL four slots share one committed *local journal* sequence, including
/// explicitly absent items. No cross-writer/world-epoch monotonicity inferred.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CurrentFourRackCandidates {
    journal_sequence: u64,
    slots: [Option<CurrentRackCandidate>; 4],
}

impl CurrentFourRackCandidates {
    pub fn journal_sequence(self) -> u64 {
        self.journal_sequence
    }

    /// None is an explicit currently absent/unequipped-from-rack slot,
    /// rather than permission to mint a replacement or claim deleted item.
    pub fn slots(self) -> [Option<CurrentRackCandidate>; 4] {
        self.slots
    }
}

/// Untrusted exact-click selector. This remains a read-only local-journal
/// preflight, NOT session/epoch/LOS authorization or a fenced item commit.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProposedExactRackSelection<'a> {
    pub socket_id: &'a str,
    pub canonical_ground_entity: u128,
    pub canonical_item: ItemId,
    pub observed_item_mutation_sequence: u64,
}

#[derive(Debug)]
pub enum ExactRackSelectionError {
    MappingOrJournal(RackBindingReadError),
    UnknownSocket,
    ItemAbsent,
    GroundEntityMismatch,
    PhysicalItemMismatch,
    StaleItemRevision,
}

/// Match all independently typed physical target fields against CURRENT
/// canonical journal state, never a nearest-item guess or historical receipt.
/// 56-world-unit pickup reach includes two adjacent swords at midpoints.
/// Returned candidates MUST be rechecked atomically with a future exclusive
/// writer/8C epoch/Physics commit; this API does not mutate or approve pickup.
pub fn preflight_exact_current_rack_selection(
    journal: &DurableItemJournal,
    source: [ProposedRackSource; 4],
    imported: &LegacyImportPreflight,
    mapping: ProposedWorldToCentimeter,
    selection: ProposedExactRackSelection<'_>,
) -> Result<CurrentRackCandidate, ExactRackSelectionError> {
    let current = read_proposed_current_four_rack_items(journal, source, imported, mapping)
        .map_err(ExactRackSelectionError::MappingOrJournal)?;
    let index = crate::alpha_armory_mapping_preflight::GREYHAVEN_RACK_V1
        .iter()
        .position(|(socket, _, _)| *socket == selection.socket_id)
        .ok_or(ExactRackSelectionError::UnknownSocket)?;
    let candidate = current.slots[index].ok_or(ExactRackSelectionError::ItemAbsent)?;
    if candidate.canonical_ground_entity != selection.canonical_ground_entity {
        return Err(ExactRackSelectionError::GroundEntityMismatch);
    }
    if candidate.canonical_item != selection.canonical_item {
        return Err(ExactRackSelectionError::PhysicalItemMismatch);
    }
    if selection.observed_item_mutation_sequence == 0
        || candidate.item_mutation_sequence != selection.observed_item_mutation_sequence
    {
        return Err(ExactRackSelectionError::StaleItemRevision);
    }
    Ok(candidate)
}

/// Offline, source-verified four-rack membership at ONE immutable local
/// C3e journal head. Re-checks each proposed canonical item ID and exact
/// Ground location against current journal owner, not a historical receipt.
///
/// Only a trusted server-authority caller may supply `source` from verified
/// checkpoint rows and `mapping` from approved 8C/World zone coordinates.
/// The code cannot enforce either origin or supply a signed writer lineage.
/// Do not present this result to a browser as an authenticated item list
/// until the exact ONE live writer, outbox and epoch are approved at #432.
pub fn read_proposed_current_four_rack_items(
    journal: &DurableItemJournal,
    source: [ProposedRackSource; 4],
    imported: &LegacyImportPreflight,
    mapping: ProposedWorldToCentimeter,
) -> Result<CurrentFourRackCandidates, RackBindingReadError> {
    let mapped = preflight_greyhaven_rack_v1(source, imported, mapping)?;
    let mut journal_sequence = None;
    let mut slots = [None; 4];
    for (i, candidate) in mapped.into_iter().enumerate() {
        let (sequence, mutation) =
            journal.checked_ground_membership(candidate.canonical_item, candidate.ground)?;
        if let Some(previous) = journal_sequence {
            if previous != sequence {
                return Err(RackBindingReadError::Journal(
                    ItemJournalError::InvalidSequence,
                ));
            }
        }
        journal_sequence = Some(sequence);
        if let Some(item_mutation_sequence) = mutation {
            slots[i] = Some(CurrentRackCandidate {
                socket_id: candidate.socket_id,
                canonical_ground_entity: candidate.canonical_ground_entity,
                canonical_item: candidate.canonical_item,
                ground: candidate.ground,
                item_mutation_sequence,
            });
        }
    }
    Ok(CurrentFourRackCandidates {
        journal_sequence: journal_sequence.unwrap_or(0),
        slots,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        alpha_armory_mapping_preflight::GREYHAVEN_RACK_V1,
        identity::CharacterId,
        item_ownership::{OwnershipOp, OwnershipTxnId, ZoneId},
        legacy_gear_preflight::{LegacyDomain, LegacyMigrationError, ProposedLegacyNamespaces},
    };
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "myaso-c3u-rack-{}-{stamp}-{}",
                std::process::id(),
                COUNTER.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn open(&self) -> DurableItemJournal {
            let deadline = Instant::now() + Duration::from_millis(500);
            loop {
                match DurableItemJournal::open(&self.0) {
                    Ok(journal) => return journal,
                    Err(ItemJournalError::WriterBusy) if Instant::now() < deadline => {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    Err(error) => panic!("test-only journal reopen failure: {error:?}"),
                }
            }
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn rows() -> [ProposedRackSource; 4] {
        std::array::from_fn(|n| {
            let (socket_id, world_x, world_y) = GREYHAVEN_RACK_V1[n];
            ProposedRackSource {
                socket_id,
                world_x,
                world_y,
                ground_entity_id: 201 + n as u64,
                legacy_item_id: 101 + n as u64,
            }
        })
    }

    fn registered() -> LegacyImportPreflight {
        let namespaces = ProposedLegacyNamespaces::new([
            0x4D59_4153_0000_0001,
            0x4D59_4153_0000_0002,
            0x4D59_4153_0000_0003,
            0x4D59_4153_0000_0004,
            0x4D59_4153_0000_0005,
        ])
        .unwrap();
        let mut imported = LegacyImportPreflight::new(namespaces, []).unwrap();
        for n in 0..4 {
            imported
                .stage_owner(LegacyDomain::GroundEntity, 201 + n)
                .unwrap();
            imported.stage_owner(LegacyDomain::Item, 101 + n).unwrap();
        }
        imported
    }

    fn cm_mapping() -> ProposedWorldToCentimeter {
        // TEST-ONLY x100 scale, not a reviewed world/8C production choice.
        ProposedWorldToCentimeter {
            zone: ZoneId::new(1).unwrap(),
            numerator_cm: 100,
            denominator_world_units: 1,
            offset_x_cm: 0,
            offset_y_cm: 0,
        }
    }

    fn txn(n: u128) -> OwnershipTxnId {
        OwnershipTxnId::new(n).unwrap()
    }
    fn hand(n: u128) -> ItemLocation {
        ItemLocation::Equipped {
            character_id: CharacterId::new(n).unwrap(),
            slot: 0,
        }
    }

    fn seed(
        journal: &mut DurableItemJournal,
        imported: &LegacyImportPreflight,
    ) -> [ItemLocation; 4] {
        let mapped = preflight_greyhaven_rack_v1(rows(), imported, cm_mapping()).unwrap();
        journal
            .apply(
                txn(1),
                &std::array::from_fn::<_, 4, _>(|i| OwnershipOp::Create {
                    item: mapped[i].canonical_item,
                    at: mapped[i].ground,
                }),
            )
            .unwrap();
        mapped.map(|row| row.ground)
    }

    #[test]
    fn four_real_reviewed_sockets_project_distinct_current_canonical_ground_items() {
        let root = Root::new();
        let mut journal = root.open();
        let imported = registered();
        let nothing =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        assert_eq!(nothing.journal_sequence(), 0);
        assert!(nothing.slots().iter().all(Option::is_none));
        let grounds = seed(&mut journal, &imported);
        let now = read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
            .unwrap();
        assert_eq!(now.journal_sequence(), 1);
        let items = now.slots().map(|x| x.unwrap());
        for (i, current) in items.into_iter().enumerate() {
            assert_eq!(current.socket_id(), GREYHAVEN_RACK_V1[i].0);
            assert_eq!(current.ground(), grounds[i]);
            assert_eq!(current.item_mutation_sequence(), 1);
            assert_eq!(
                current.canonical_item(),
                imported.core_item(101 + i as u64).unwrap()
            );
            assert_eq!(
                current.canonical_ground_entity(),
                imported
                    .resolve_registered(LegacyDomain::GroundEntity, 201 + i as u64)
                    .unwrap()
            );
            assert_ne!(
                current.canonical_item().get(),
                current.canonical_ground_entity()
            );
        }
        assert_eq!(journal.item_count(), 4);
    }

    #[test]
    fn pickup_drop_elsewhere_return_to_exact_rack_and_reopen_never_ghosts() {
        let root = Root::new();
        let imported = registered();
        let mut journal = root.open();
        let grounds = seed(&mut journal, &imported);
        let item = imported.core_item(101).unwrap();
        let before =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        journal
            .apply(
                txn(2),
                &[OwnershipOp::Move {
                    item,
                    from: grounds[0],
                    to: hand(1),
                }],
            )
            .unwrap();
        let picked =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        assert!(picked.slots()[0].is_none());
        assert!(picked.slots()[1..].iter().all(Option::is_some));
        assert!(picked.journal_sequence() > before.journal_sequence());
        // Original pickup success history remains, but source no longer owns the sword.
        let another_ground = cm_mapping().propose_ground(3720, 4000).unwrap();
        journal
            .apply(
                txn(3),
                &[OwnershipOp::Move {
                    item,
                    from: hand(1),
                    to: another_ground,
                }],
            )
            .unwrap();
        let dropped =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        assert!(dropped.slots()[0].is_none());
        journal
            .apply(
                txn(4),
                &[OwnershipOp::Move {
                    item,
                    from: another_ground,
                    to: grounds[0],
                }],
            )
            .unwrap();
        let returned =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        assert_eq!(returned.slots()[0].unwrap().canonical_item(), item);
        assert!(
            returned.slots()[0].unwrap().item_mutation_sequence()
                > before.slots()[0].unwrap().item_mutation_sequence()
        );
        assert_eq!(journal.item_count(), 4);
        drop(journal);
        let recovered = root.open();
        assert_eq!(
            read_proposed_current_four_rack_items(&recovered, rows(), &imported, cm_mapping())
                .unwrap(),
            returned
        );
    }

    #[test]
    fn false_socket_identity_and_stale_location_do_not_advertise_wrong_sword() {
        let root = Root::new();
        let mut journal = root.open();
        let imported = registered();
        seed(&mut journal, &imported);
        let mut forged = rows();
        forged[0].socket_id = "greyhaven-rack-2";
        assert!(matches!(
            read_proposed_current_four_rack_items(&journal, forged, &imported, cm_mapping()),
            Err(RackBindingReadError::InvalidMapping(
                RackPreflightError::UnexpectedSocketOrWorldPosition
            ))
        ));
        let mut duplicate = rows();
        duplicate[2].ground_entity_id = duplicate[0].ground_entity_id;
        assert!(matches!(
            read_proposed_current_four_rack_items(&journal, duplicate, &imported, cm_mapping()),
            Err(RackBindingReadError::InvalidMapping(
                RackPreflightError::DuplicateGroundEntity
            ))
        ));
        let mut nonexistent = rows();
        nonexistent[0].legacy_item_id = 999;
        assert!(matches!(
            read_proposed_current_four_rack_items(&journal, nonexistent, &imported, cm_mapping()),
            Err(RackBindingReadError::InvalidMapping(
                RackPreflightError::Legacy(LegacyMigrationError::UnregisteredSourceIdentity)
            ))
        ));
        let mut swapped = rows();
        swapped[0].legacy_item_id = 102;
        swapped[1].legacy_item_id = 101;
        let view =
            read_proposed_current_four_rack_items(&journal, swapped, &imported, cm_mapping())
                .unwrap();
        assert!(view.slots()[0].is_none());
        assert!(view.slots()[1].is_none());
        assert!(view.slots()[2].is_some());
        assert!(view.slots()[3].is_some());
        // Syntactically valid but WRONG world-origin transform cannot
        // claim any current rack item; arithmetic alone proves no authority.
        let incorrect = ProposedWorldToCentimeter {
            offset_x_cm: 5,
            ..cm_mapping()
        };
        let view =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, incorrect).unwrap();
        assert!(view.slots().iter().all(Option::is_none));
    }

    #[test]
    fn exact_click_rejects_neighbor_substitution_and_pickup_return_aba() {
        let root = Root::new();
        let imported = registered();
        let mut journal = root.open();
        let ground = seed(&mut journal, &imported);
        let current =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap();
        let candidates = current.slots().map(|slot| slot.unwrap());
        let select = |candidate: CurrentRackCandidate| ProposedExactRackSelection {
            socket_id: candidate.socket_id(),
            canonical_ground_entity: candidate.canonical_ground_entity(),
            canonical_item: candidate.canonical_item(),
            observed_item_mutation_sequence: candidate.item_mutation_sequence(),
        };
        for candidate in candidates {
            assert_eq!(
                preflight_exact_current_rack_selection(
                    &journal,
                    rows(),
                    &imported,
                    cm_mapping(),
                    select(candidate)
                )
                .unwrap(),
                candidate
            );
        }
        let first = candidates[0];
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                ProposedExactRackSelection {
                    socket_id: "unknown",
                    ..select(first)
                }
            ),
            Err(ExactRackSelectionError::UnknownSocket)
        ));
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                ProposedExactRackSelection {
                    canonical_ground_entity: candidates[1].canonical_ground_entity(),
                    ..select(first)
                }
            ),
            Err(ExactRackSelectionError::GroundEntityMismatch)
        ));
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                ProposedExactRackSelection {
                    canonical_item: candidates[1].canonical_item(),
                    ..select(first)
                }
            ),
            Err(ExactRackSelectionError::PhysicalItemMismatch)
        ));
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                ProposedExactRackSelection {
                    observed_item_mutation_sequence: 0,
                    ..select(first)
                }
            ),
            Err(ExactRackSelectionError::StaleItemRevision)
        ));
        journal
            .apply(
                txn(2),
                &[OwnershipOp::Move {
                    item: first.canonical_item(),
                    from: ground[0],
                    to: hand(9),
                }],
            )
            .unwrap();
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                select(first)
            ),
            Err(ExactRackSelectionError::ItemAbsent)
        ));
        journal
            .apply(
                txn(3),
                &[OwnershipOp::Move {
                    item: first.canonical_item(),
                    from: hand(9),
                    to: ground[0],
                }],
            )
            .unwrap();
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                select(first)
            ),
            Err(ExactRackSelectionError::StaleItemRevision)
        ));
        let after =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap()
                .slots()[0]
                .unwrap();
        assert!(after.item_mutation_sequence() > first.item_mutation_sequence());
        assert_eq!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                select(after)
            )
            .unwrap(),
            after
        );
        assert_eq!(journal.item_count(), 4);
    }

    #[test]
    fn unrelated_commit_preserves_item_revision_but_forged_source_fails_closed() {
        let root = Root::new();
        let imported = registered();
        let mut journal = root.open();
        let ground = seed(&mut journal, &imported);
        let first =
            read_proposed_current_four_rack_items(&journal, rows(), &imported, cm_mapping())
                .unwrap()
                .slots()[0]
                .unwrap();
        let selection = ProposedExactRackSelection {
            socket_id: first.socket_id(),
            canonical_ground_entity: first.canonical_ground_entity(),
            canonical_item: first.canonical_item(),
            observed_item_mutation_sequence: first.item_mutation_sequence(),
        };
        journal
            .apply(
                txn(2),
                &[OwnershipOp::Move {
                    item: imported.core_item(102).unwrap(),
                    from: ground[1],
                    to: hand(2),
                }],
            )
            .unwrap();
        assert_eq!(
            preflight_exact_current_rack_selection(
                &journal,
                rows(),
                &imported,
                cm_mapping(),
                selection
            )
            .unwrap(),
            first
        );
        let mut swapped = rows();
        swapped[0].legacy_item_id = 102;
        swapped[1].legacy_item_id = 101;
        assert!(matches!(
            preflight_exact_current_rack_selection(
                &journal,
                swapped,
                &imported,
                cm_mapping(),
                selection
            ),
            Err(ExactRackSelectionError::ItemAbsent)
        ));
        drop(journal);
        let recovered = root.open();
        assert_eq!(
            preflight_exact_current_rack_selection(
                &recovered,
                rows(),
                &imported,
                cm_mapping(),
                selection
            )
            .unwrap(),
            first
        );
    }
}
