use myaso_server::snapshot::{
    decode_snapshot, encode_snapshot_current, SnapshotRecord,
    SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING, SNAPSHOT_FIELD_FACING,
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

fn fixture_bytes() -> Vec<u8> {
    let hex = include_str!("../../tests/fixtures/m20-snapshot-u8-facing-v1.hex").trim();
    (0..hex.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&hex[index..index + 2], 16).expect("valid fixture hex"))
        .collect()
}

#[test]
fn historical_encoding_two_fixture_still_decodes() {
    let decoded = decode_snapshot(&fixture_bytes()).expect("M20 fixture must decode");
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
