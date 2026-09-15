use myaso_server::snapshot::{
    decode_snapshot, encode_snapshot_current, SnapshotRecord,
    SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING, SNAPSHOT_FIELD_FACING, SNAPSHOT_FULL_FIELDS,
};

fn record(net_id: u32, mask: u8, facing: u16) -> SnapshotRecord {
    SnapshotRecord {
        net_id,
        mask,
        x: 400,
        y: 800,
        facing,
        hp: 66,
        guard: 75,
        action: 1,
        flags: 2,
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[test]
fn current_encoding_matches_cross_language_compact_facing_fixture() {
    let encoded = encode_snapshot_current(
        7,
        6,
        1234,
        false,
        &[record(1, SNAPSHOT_FULL_FIELDS, 16384)],
        1100,
    );
    let expected = include_str!("../../tests/fixtures/m20-snapshot-u8-facing-v1.hex").trim();
    assert_eq!(hex(&encoded), expected);
    assert_eq!(encoded.len(), 25);

    let decoded = decode_snapshot(&encoded).expect("M20 fixture must decode");
    assert_eq!(decoded.encoding, SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING);
    assert_eq!(decoded.records[0].facing, 16448);
    assert!(decoded.records[0].facing.abs_diff(16384) <= 128);
}

#[test]
fn compact_facing_stays_within_half_step_error() {
    for facing in [0, 1, 128, 129, 16384, 32768, 65407, u16::MAX] {
        let encoded = encode_snapshot_current(
            1,
            u16::MAX,
            1,
            false,
            &[record(1, SNAPSHOT_FIELD_FACING, facing)],
            1100,
        );
        assert_eq!(encoded.len(), 17);
        let decoded = decode_snapshot(&encoded).expect("compact facing packet must decode");
        assert!(decoded.records[0].facing.abs_diff(facing) <= 128);
    }
}
