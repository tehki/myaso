use myaso_server::snapshot::{
    decode_snapshot, SnapshotDecodeError, SnapshotRecord,
    SNAPSHOT_ENCODING_VARINT_IDS, SNAPSHOT_FIELD_REMOVED, SNAPSHOT_HEADER_BYTES,
    SNAPSHOT_PACKET_TYPE,
};

fn record(net_id: u32, mask: u8) -> SnapshotRecord {
    SnapshotRecord {
        net_id,
        mask,
        x: 400,
        y: 800,
        facing: 16384,
        hp: 66,
        guard: 75,
        action: 1,
        flags: 2,
    }
}

fn from_hex(value: &str) -> Vec<u8> {
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            u8::from_str_radix(std::str::from_utf8(pair).expect("fixture must be utf8"), 16)
                .expect("fixture must be hex")
        })
        .collect()
}
#[test]
fn compact_encoding_matches_the_cross_language_fixture() {
    let fixture = from_hex(include_str!("../../tests/fixtures/m19-snapshot-varint-v1.hex").trim());
    let decoded = decode_snapshot(&fixture).expect("compact fixture must decode");
    assert_eq!(decoded.encoding, SNAPSHOT_ENCODING_VARINT_IDS);
    assert_eq!(decoded.records.len(), 1);
    assert_eq!(decoded.records[0].net_id, 1);
    assert_eq!(decoded.records[0].x, 400);
    assert_eq!(decoded.records[0].action, 1);
}
#[test]
fn compact_encoding_round_trips_uint32_varint_boundaries() {
    let ids = [0, 127, 128, 16_383, 16_384, 0x0fff_ffff, u32::MAX];
    let records: Vec<_> = ids
        .into_iter()
        .map(|net_id| record(net_id, SNAPSHOT_FIELD_REMOVED))
        .collect();
    let mut encoded = vec![0; SNAPSHOT_HEADER_BYTES];
    encoded[0] = myaso_server::PROTOCOL_VERSION;
    encoded[1] = SNAPSHOT_PACKET_TYPE;
    encoded[3] = SNAPSHOT_ENCODING_VARINT_IDS;
    encoded[4..6].copy_from_slice(&9_u16.to_le_bytes());
    encoded[6..8].copy_from_slice(&8_u16.to_le_bytes());
    encoded[8..12].copy_from_slice(&456_u32.to_le_bytes());
    encoded[12..14].copy_from_slice(&(records.len() as u16).to_le_bytes());
    for record in &records {
        let mut value = record.net_id;
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            encoded.push(byte);
            if value == 0 {
                break;
            }
        }
        encoded.push(record.mask);
    }
    assert_eq!(encoded.len(), 39);

    let decoded = decode_snapshot(&encoded).expect("boundary packet must decode");
    let decoded_ids: Vec<_> = decoded.records.iter().map(|record| record.net_id).collect();
    assert_eq!(decoded_ids, ids);
    assert!(decoded
        .records
        .iter()
        .all(|record| record.mask == SNAPSHOT_FIELD_REMOVED));
}

fn compact_packet(varint_and_mask: &[u8]) -> Vec<u8> {
    let mut bytes = vec![0; SNAPSHOT_HEADER_BYTES];
    bytes[0] = myaso_server::PROTOCOL_VERSION;
    bytes[1] = SNAPSHOT_PACKET_TYPE;
    bytes[3] = SNAPSHOT_ENCODING_VARINT_IDS;
    bytes[4..6].copy_from_slice(&1_u16.to_le_bytes());
    bytes[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    bytes[8..12].copy_from_slice(&1_u32.to_le_bytes());
    bytes[12..14].copy_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(varint_and_mask);
    bytes
}

#[test]
fn compact_decoder_rejects_unknown_and_noncanonical_varints() {
    let mut unknown = compact_packet(&[1, SNAPSHOT_FIELD_REMOVED]);
    unknown[3] = 9;
    assert_eq!(
        decode_snapshot(&unknown),
        Err(SnapshotDecodeError::UnsupportedEncoding(9))
    );

    let noncanonical = compact_packet(&[0x80, 0x00, SNAPSHOT_FIELD_REMOVED]);
    assert_eq!(
        decode_snapshot(&noncanonical),
        Err(SnapshotDecodeError::InvalidVarint)
    );

    let truncated = compact_packet(&[0x80]);
    assert_eq!(
        decode_snapshot(&truncated),
        Err(SnapshotDecodeError::TruncatedRecord)
    );

    let overflow = compact_packet(&[0xff, 0xff, 0xff, 0xff, 0x10, SNAPSHOT_FIELD_REMOVED]);
    assert_eq!(
        decode_snapshot(&overflow),
        Err(SnapshotDecodeError::InvalidVarint)
    );
}
