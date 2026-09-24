use myaso_server::snapshot::{
    encode_snapshot_current, snapshot_byte_composition, SnapshotRecord, SNAPSHOT_FIELD_ACTION,
    SNAPSHOT_FIELD_FACING, SNAPSHOT_FIELD_POSITION, SNAPSHOT_FIELD_REMOVED, SNAPSHOT_FIELD_VITALS,
    SNAPSHOT_FULL_FIELDS, SNAPSHOT_HEADER_BYTES,
};

fn record(net_id: u32, mask: u8) -> SnapshotRecord {
    SnapshotRecord {
        net_id,
        mask,
        x: 10,
        y: 20,
        facing: 30,
        hp: 90,
        guard: 80,
        action: 2,
        flags: 1,
    }
}

#[test]
fn byte_composition_exactly_matches_encoded_snapshot_length() {
    let records = [
        record(1, SNAPSHOT_FULL_FIELDS),
        record(2, SNAPSHOT_FIELD_POSITION),
        record(3, SNAPSHOT_FIELD_FACING | SNAPSHOT_FIELD_VITALS),
        record(4, SNAPSHOT_FIELD_REMOVED),
    ];
    let composition = snapshot_byte_composition(&records);
    let encoded = encode_snapshot_current(7, 6, 123, false, &records, 1100);

    assert_eq!(composition.header, SNAPSHOT_HEADER_BYTES);
    assert_eq!(composition.net_ids, 4);
    assert_eq!(composition.masks, 4);
    // V6 keeps V5 local-cell position encoding and additionally packs the
    // common action/flags pair into one byte.
    assert_eq!(composition.position, 5);
    assert_eq!(composition.facing, 2);
    assert_eq!(composition.vitals, 4);
    assert_eq!(composition.action, 1);
    assert_eq!(composition.total_bytes(), 34);
    assert_eq!(composition.total_bytes(), encoded.len());

    assert_eq!(SNAPSHOT_FIELD_ACTION, 1 << 3);
}
