//! X1 review-only real Rust fixtures for legacy Magic -> canonical Core8B.
use myaso_server::{
    identity::{CharacterId, CharacterRecord, SessionLeaseRegistry},
    item_ownership::ItemId,
    legacy_identity_import::{
        character_db_key, item_db_key, parse_character_db_key, parse_item_db_key,
        positive_pg_bigint, CharacterImportMap, ImportError, ItemImportMap, LegacyKey,
    },
};
use std::num::NonZeroU64;

fn legacy(ns: u64, id: u64) -> LegacyKey {
    LegacyKey::new(ns, id).expect("fixture uses nonzero legacy IDs")
}

fn character(id: u128) -> CharacterId {
    CharacterId::new(id).expect("canonical character must be nonzero")
}

fn item(id: u128) -> ItemId {
    ItemId::new(id).expect("physical item must be nonzero")
}

#[test]
fn rejects_untrusted_zero_namespaces_and_ids_before_lookup() {
    assert_eq!(LegacyKey::new(0, 1), None);
    assert_eq!(LegacyKey::new(1, 0), None);
    assert!(CharacterId::new(0).is_none());
    assert!(ItemId::new(0).is_none());
    assert_eq!(legacy(3, u64::MAX).local_id(), u64::MAX);
    assert_eq!(legacy(3, u64::MAX).namespace(), 3);
}

#[test]
fn separate_legacy_sources_can_share_local_number_not_canonical_character() {
    let mut map = CharacterImportMap::default();
    let a = legacy(1, 77);
    let b = legacy(2, 77);
    let top = character(0xFABC_0000_0000_0001_0000_0000_0000_0001);
    let other = character(0xFABC_0000_0000_0002_0000_0000_0000_0001);
    assert_eq!(map.stage_batch(&[(a, top), (b, other)]), Ok(2));
    assert_eq!(map.canonical_for(a), Some(top));
    assert_eq!(map.canonical_for(b), Some(other));
    assert_eq!(map.legacy_for(top), Some(a));
    assert_eq!(map.len(), 2);
    assert_eq!(map.stage_batch(&[(a, top), (b, other)]), Ok(0)); // replay
}

#[test]
fn conflicting_source_mapping_aborts_entire_batch_without_partial_publish() {
    let mut map = CharacterImportMap::default();
    let original = legacy(10, 500);
    let occupied = character(5000);
    assert_eq!(map.stage_batch(&[(original, occupied)]), Ok(1));
    let first_new = legacy(10, 501);
    assert_eq!(
        map.stage_batch(&[(first_new, character(5001)), (original, character(5002)),]),
        Err(ImportError::ConflictingLegacyId)
    );
    assert_eq!(map.len(), 1);
    assert_eq!(map.canonical_for(first_new), None);
    assert_eq!(map.canonical_for(original), Some(occupied));
}

#[test]
fn conflicting_canonical_mapping_aborts_entire_batch_including_new_items() {
    let mut map = ItemImportMap::default();
    let source = legacy(6, 55);
    let canonical = item(0x12_0000_0000_0000_0000_0000_0000_0001);
    assert_eq!(map.stage_batch(&[(source, canonical)]), Ok(1));
    let new_source = legacy(6, 56);
    let attacker = legacy(6, 57);
    assert_eq!(
        map.stage_batch(&[
            (new_source, item(0x12_0000_0000_0000_0000_0000_0000_0002)),
            (attacker, canonical),
        ]),
        Err(ImportError::CanonicalIdAlreadyAllocated)
    );
    assert_eq!(map.len(), 1);
    assert_eq!(map.canonical_for(new_source), None);
    assert_eq!(map.legacy_for(canonical), Some(source));
}

#[test]
fn candidate_batch_must_be_one_to_one_even_before_any_previous_state() {
    let mut map = CharacterImportMap::default();
    let key_a = legacy(1, 1);
    let key_b = legacy(1, 2);
    let same_character = character(u128::MAX);
    assert_eq!(
        map.stage_batch(&[(key_a, same_character), (key_b, same_character)]),
        Err(ImportError::CanonicalIdAlreadyAllocated)
    );
    assert!(map.is_empty());
    assert_eq!(
        map.stage_batch(&[(key_a, same_character), (key_a, character(42))]),
        Err(ImportError::ConflictingLegacyId)
    );
    assert!(map.is_empty());
}

#[test]
fn canonical_id_round_trip_uses_full_big_endian_16_bytes_not_legacy_cast() {
    let full = 0xFEDC_BA98_7654_3210_0123_4567_89AB_CDEFu128;
    let character = character(full);
    let item = item(full);
    assert_eq!(character_db_key(character), full.to_be_bytes());
    assert_eq!(item_db_key(item), full.to_be_bytes());
    assert_eq!(
        parse_character_db_key(character_db_key(character)),
        Some(character)
    );
    assert_eq!(parse_item_db_key(item_db_key(item)), Some(item));
    assert_eq!(parse_character_db_key([0; 16]), None);
    assert_eq!(parse_item_db_key([0; 16]), None);
    assert_eq!(character_db_key(character)[0], 0xFE);
    // CharacterRecord's MYCH persistence uses LE, not the DB's BE index.
    let record = CharacterRecord::new(character);
    assert_eq!(&record.encode()[8..24], &full.to_le_bytes());
    assert_ne!(&record.encode()[8..24], &character_db_key(character));
}

#[test]
fn positive_signed_pg_bigint_rejects_zero_and_unsigned_overflow() {
    assert_eq!(positive_pg_bigint(0), None);
    assert_eq!(positive_pg_bigint(1), Some(1));
    assert_eq!(positive_pg_bigint(i64::MAX as u64), Some(i64::MAX));
    assert_eq!(positive_pg_bigint(i64::MAX as u64 + 1), None);
    assert_eq!(positive_pg_bigint(u64::MAX), None);
}

#[test]
fn import_staging_does_not_mint_or_activate_a_persistent_session() {
    let mut import = CharacterImportMap::default();
    let canonical = character(0xABCD_0000_0000_0000_0000_0000_0000_0001);
    assert_eq!(import.stage_batch(&[(legacy(3, 9), canonical)]), Ok(1));
    let uncommitted = CharacterRecord::new(canonical);
    let mut registry = SessionLeaseRegistry::default();
    assert!(registry
        .activate_committed(uncommitted, NonZeroU64::new(11).unwrap())
        .is_err());
    assert_eq!(import.canonical_for(legacy(3, 9)), Some(canonical));
}

fn fixture_maps() -> (CharacterImportMap, ItemImportMap) {
    let mut characters = CharacterImportMap::default();
    let mut items = ItemImportMap::default();
    characters
        .stage_batch(&[
            (
                legacy(10, 1),
                character(0xAAAA_0000_0000_0000_0000_0000_0000_0001),
            ),
            (
                legacy(10, 2),
                character(0xAAAA_0000_0000_0000_0000_0000_0000_0002),
            ),
        ])
        .unwrap();
    items
        .stage_batch(&[
            (
                legacy(20, 101),
                item(0xBBBB_0000_0000_0000_0000_0000_0000_0001),
            ),
            (
                legacy(20, 102),
                item(0xBBBB_0000_0000_0000_0000_0000_0000_0002),
            ),
            (
                legacy(20, 103),
                item(0xBBBB_0000_0000_0000_0000_0000_0000_0003),
            ),
        ])
        .unwrap();
    (characters, items)
}

#[test]
fn carried_stack_preflight_maps_full_ids_and_preserves_quantity_without_minting() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_stacks, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let rows = resolve_carried_stacks(
        &characters,
        &items,
        &[
            LegacyCarriedStack {
                owner: legacy(10, 1),
                item: legacy(20, 101),
                slot: CarriedSlot::Backpack,
                amount: u16::MAX,
            },
            LegacyCarriedStack {
                owner: legacy(10, 2),
                item: legacy(20, 102),
                slot: CarriedSlot::Equipped(1),
                amount: 1,
            },
        ],
    )
    .unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(
        rows[0].owner,
        character(0xAAAA_0000_0000_0000_0000_0000_0000_0001)
    );
    assert_eq!(
        rows[0].item,
        item(0xBBBB_0000_0000_0000_0000_0000_0000_0001)
    );
    assert_eq!(rows[0].amount, u16::MAX);
    assert_eq!(rows[1].slot, CarriedSlot::Equipped(1));
    assert_eq!(characters.len(), 2); // read-only lookup; NO admission or mutation
    assert_eq!(items.len(), 3);
}

#[test]
fn orphan_character_or_item_aborts_whole_carried_preflight() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_stacks, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let valid = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Backpack,
        amount: 5,
    };
    assert_eq!(
        resolve_carried_stacks(
            &characters,
            &items,
            &[
                valid,
                LegacyCarriedStack {
                    owner: legacy(10, 999),
                    item: legacy(20, 102),
                    ..valid
                },
            ]
        ),
        Err(CarriedImportError::UnmappedOwner)
    );
    assert_eq!(
        resolve_carried_stacks(
            &characters,
            &items,
            &[
                valid,
                LegacyCarriedStack {
                    item: legacy(20, 999),
                    ..valid
                },
            ]
        ),
        Err(CarriedImportError::UnmappedItem)
    );
    assert_eq!(characters.len(), 2);
    assert_eq!(items.len(), 3);
}

#[test]
fn double_location_same_item_is_rejected_even_between_owners() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_stacks, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    assert_eq!(
        resolve_carried_stacks(
            &characters,
            &items,
            &[
                LegacyCarriedStack {
                    owner: legacy(10, 1),
                    item: legacy(20, 101),
                    slot: CarriedSlot::Backpack,
                    amount: 1,
                },
                LegacyCarriedStack {
                    owner: legacy(10, 2),
                    item: legacy(20, 101),
                    slot: CarriedSlot::Equipped(1),
                    amount: 1,
                },
            ]
        ),
        Err(CarriedImportError::DuplicatePhysicalItem)
    );
}

#[test]
fn equipment_slot_collision_is_rejected_per_character_only() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_stacks, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let first = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Equipped(1),
        amount: 1,
    };
    let second = LegacyCarriedStack {
        item: legacy(20, 102),
        ..first
    };
    assert_eq!(
        resolve_carried_stacks(&characters, &items, &[first, second]),
        Err(CarriedImportError::DuplicateEquipmentSlot)
    );
    let other_character = LegacyCarriedStack {
        owner: legacy(10, 2),
        ..second
    };
    let accepted = resolve_carried_stacks(&characters, &items, &[first, other_character]).unwrap();
    assert_eq!(accepted.len(), 2);
}

#[test]
fn zero_amount_and_oversized_carried_batches_fail_closed() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_stacks, CarriedImportError, CarriedSlot, LegacyCarriedStack,
        MAX_CARRIED_REFERENCE_BATCH,
    };
    let (characters, items) = fixture_maps();
    let valid = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Backpack,
        amount: 2,
    };
    assert_eq!(
        resolve_carried_stacks(
            &characters,
            &items,
            &[LegacyCarriedStack { amount: 0, ..valid }]
        ),
        Err(CarriedImportError::InvalidStackAmount)
    );
    assert_eq!(
        resolve_carried_stacks(
            &characters,
            &items,
            &vec![valid; MAX_CARRIED_REFERENCE_BATCH + 1]
        ),
        Err(CarriedImportError::TooManyReferences)
    );
}

#[test]
fn full_carried_manifest_rejects_cross_partition_duplicate_item() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_manifest, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let a = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Backpack,
        amount: 4,
    };
    let b = LegacyCarriedStack {
        owner: legacy(10, 2),
        slot: CarriedSlot::Equipped(2),
        ..a
    };
    assert_eq!(
        resolve_carried_manifest(&characters, &items, &[&[a], &[b]]),
        Err(CarriedImportError::DuplicatePhysicalItem)
    );
    assert_eq!(items.len(), 3);
}

#[test]
fn full_carried_manifest_rejects_cross_partition_equipment_collision() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_manifest, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let a = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Equipped(1),
        amount: 1,
    };
    let b = LegacyCarriedStack {
        item: legacy(20, 102),
        ..a
    };
    assert_eq!(
        resolve_carried_manifest(&characters, &items, &[&[a], &[b]]),
        Err(CarriedImportError::DuplicateEquipmentSlot)
    );
    let other_owner = LegacyCarriedStack {
        owner: legacy(10, 2),
        ..b
    };
    let accepted = resolve_carried_manifest(&characters, &items, &[&[a], &[other_owner]]).unwrap();
    assert_eq!(accepted.len(), 2);
    assert_eq!(
        accepted[0].item,
        item(0xBBBB_0000_0000_0000_0000_0000_0000_0001)
    );
    assert_eq!(
        accepted[1].item,
        item(0xBBBB_0000_0000_0000_0000_0000_0000_0002)
    );
}

#[test]
fn full_manifest_missing_mapping_cannot_publish_first_valid_partition() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_manifest, CarriedImportError, CarriedSlot, LegacyCarriedStack,
    };
    let (characters, items) = fixture_maps();
    let valid = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Backpack,
        amount: 1,
    };
    let orphan = LegacyCarriedStack {
        owner: legacy(10, 2),
        item: legacy(20, 999),
        slot: CarriedSlot::Backpack,
        amount: 1,
    };
    assert_eq!(
        resolve_carried_manifest(&characters, &items, &[&[valid], &[orphan]]),
        Err(CarriedImportError::UnmappedItem)
    );
    assert_eq!(characters.len(), 2);
    assert_eq!(items.len(), 3);
}

#[test]
fn full_manifest_rejects_too_many_partitions_or_total_entries_before_allocating() {
    use myaso_server::legacy_identity_import::{
        resolve_carried_manifest, CarriedImportError, CarriedSlot, LegacyCarriedStack,
        MAX_CARRIED_MANIFEST_PARTITIONS, MAX_CARRIED_MANIFEST_ROWS, MAX_CARRIED_REFERENCE_BATCH,
    };
    let (characters, items) = fixture_maps();
    let valid = LegacyCarriedStack {
        owner: legacy(10, 1),
        item: legacy(20, 101),
        slot: CarriedSlot::Backpack,
        amount: 1,
    };
    let one = [valid];
    let too_many_partitions = vec![one.as_slice(); MAX_CARRIED_MANIFEST_PARTITIONS + 1];
    assert_eq!(
        resolve_carried_manifest(&characters, &items, &too_many_partitions),
        Err(CarriedImportError::TooManyReferences)
    );
    let full = vec![valid; MAX_CARRIED_REFERENCE_BATCH];
    let enough_partitions: Vec<&[LegacyCarriedStack]> =
        vec![full.as_slice(); MAX_CARRIED_MANIFEST_ROWS / MAX_CARRIED_REFERENCE_BATCH + 1];
    assert_eq!(
        resolve_carried_manifest(&characters, &items, &enough_partitions),
        Err(CarriedImportError::TooManyReferences)
    );
}
