use myaso_server::snapshot::{
    decode_snapshot, encode_snapshot_current, SnapshotDecodeError, SnapshotRecord,
    SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION, SNAPSHOT_FIELD_FACING,
    SNAPSHOT_FIELD_POSITION, SNAPSHOT_FIELD_WIDE_POSITION, SNAPSHOT_FULL_FIELDS,
};

fn record(mask: u8, x: u16, y: u16) -> SnapshotRecord {
    SnapshotRecord {
        net_id: 1,
        mask,
        x,
        y,
        facing: 16384,
        hp: 66,
        guard: 75,
        action: 1,
        flags: 2,
    }
}

#[test]
fn encoding_three_matches_cross_language_compact_position_fixture() {
    let encoded: Vec<u8> = include_str!("../../tests/fixtures/m21-snapshot-u12-position-v1.hex")
        .trim()
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            u8::from_str_radix(std::str::from_utf8(pair).expect("fixture must be utf8"), 16)
                .expect("fixture must be hex")
        })
        .collect();
    assert_eq!(encoded.len(), 24);
    let decoded = decode_snapshot(&encoded).expect("M21 fixture must decode");
    assert_eq!(
        decoded.encoding,
        SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    );
    assert_eq!(decoded.records[0].x, 400);
    assert_eq!(decoded.records[0].y, 800);
}

#[test]
fn compact_positions_stay_within_four_wire_units() {
    for position in [0, 1, 3, 4, 7, 8, 32759, 32763] {
        let encoded = encode_snapshot_current(
            1,
            u16::MAX,
            1,
            false,
            &[record(SNAPSHOT_FIELD_POSITION, position, position)],
            1100,
        );
        assert_eq!(encoded.len(), 19);
        let decoded = decode_snapshot(&encoded).expect("compact position packet must decode");
        assert!(decoded.records[0].x.abs_diff(position) <= 4);
        assert!(decoded.records[0].y.abs_diff(position) <= 4);
    }
}

#[test]
fn wide_position_fallback_preserves_custom_world_coordinates() {
    let encoded = encode_snapshot_current(
        8,
        7,
        1235,
        false,
        &[record(SNAPSHOT_FULL_FIELDS, 40000, 800)],
        1100,
    );
    assert_eq!(encoded.len(), 25);
    let decoded = decode_snapshot(&encoded).expect("wide position packet must decode");
    assert_ne!(decoded.records[0].mask & SNAPSHOT_FIELD_WIDE_POSITION, 0);
    assert_eq!(decoded.records[0].x, 40000);
    assert_eq!(decoded.records[0].y, 800);
}

#[test]
fn wide_position_marker_without_position_fails_closed() {
    let mut encoded: Vec<u8> =
        include_str!("../../tests/fixtures/m21-snapshot-u12-position-v1.hex")
            .trim()
            .as_bytes()
            .chunks_exact(2)
            .map(|pair| {
                u8::from_str_radix(std::str::from_utf8(pair).expect("fixture must be utf8"), 16)
                    .expect("fixture must be hex")
            })
            .collect();
    encoded[15] = SNAPSHOT_FIELD_FACING | SNAPSHOT_FIELD_WIDE_POSITION;
    assert_eq!(
        decode_snapshot(&encoded),
        Err(SnapshotDecodeError::InvalidPositionEncoding)
    );
}
