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
