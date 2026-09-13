use myaso_server::{
    simulation::{CombatEvent, InputIntent, World},
    snapshot::{
        apply_records, build_delta, decode_snapshot, encode_snapshot, SnapshotSession, WireEntity,
    },
    CONSERVATIVE_DATAGRAM_BYTES,
};
use std::collections::BTreeMap;

#[test]
fn rust_snapshot_encoder_matches_the_js_wire_fixture() {
    let state = WireEntity {
        net_id: 1,
        x: 400,
        y: 800,
        facing: 16384,
        hp: 66,
        guard: 75,
        action: 1,
        flags: 2,
    };
    let record = build_delta(state, None).expect("full record");
    let encoded = encode_snapshot(7, 6, 1234, false, &[record], CONSERVATIVE_DATAGRAM_BYTES);
    let expected_hex = include_str!("../../tests/fixtures/m4-snapshot-v1.hex").trim();
    assert_eq!(hex(&encoded), expected_hex);

    let decoded = decode_snapshot(&encoded).expect("decode fixture");
    assert_eq!(decoded.sequence, 7);
    assert_eq!(decoded.baseline_sequence, 6);
    assert_eq!(decoded.server_tick, 1234);
    assert!(!decoded.full);
    assert_eq!(decoded.records.len(), 1);
    assert_eq!(decoded.records[0].net_id, 1);
    assert_eq!(decoded.records[0].x, 400);
    assert_eq!(decoded.records[0].y, 800);
    assert_eq!(decoded.records[0].hp, 66);
    assert_eq!(decoded.records[0].action, 1);
}

#[test]
fn server_owned_attack_changes_authoritative_vitals_once() {
    let mut world = World::new(500.0, 300.0);
    assert!(world.add_player_at(1, 100.0, 100.0, 0.0));
    assert!(world.add_player_at(2, 180.0, 100.0, std::f32::consts::PI));
    world.set_input(
        1,
        InputIntent {
            attack: true,
            facing_radians: 0.0,
            ..InputIntent::default()
        },
    );

    let mut hit_count = 0;
    for _ in 0..40 {
        for event in world.step() {
            if matches!(event, CombatEvent::Hit { attacker: 1, target: 2, .. }) {
                hit_count += 1;
            }
        }
    }

    assert_eq!(hit_count, 1, "one committed attack must hit a target at most once");
    assert_eq!(world.fighter(2).expect("target").hp.round() as u8, 66);
}

#[test]
fn acknowledged_baseline_recovers_after_snapshot_loss_and_unknown_ack_forces_full() {
    let mut world = World::new(1000.0, 1000.0);
    world.add_player_at(1, 100.0, 100.0, 0.0);
    world.add_player_at(2, 130.0, 100.0, 0.0);
    let mut session = SnapshotSession::default();
    let mut client_state = BTreeMap::new();

    let first = session.build(u16::MAX, world.tick, 1, world.fighters(), CONSERVATIVE_DATAGRAM_BYTES);
    assert!(first.full);
    assert_eq!(first.sequence, 0);
    let decoded_first = decode_snapshot(&first.bytes).expect("first snapshot");
    apply_records(&mut client_state, &decoded_first.records);

    world.set_input(
        1,
        InputIntent {
            move_x: 1.0,
            ..InputIntent::default()
        },
    );
    world.step();
    let dropped = session.build(0, world.tick, 1, world.fighters(), CONSERVATIVE_DATAGRAM_BYTES);
    assert!(!dropped.full);
    assert_eq!(dropped.baseline_sequence, 0);

    world.step();
    let recovery = session.build(0, world.tick, 1, world.fighters(), CONSERVATIVE_DATAGRAM_BYTES);
    assert!(!recovery.full);
    assert_eq!(recovery.baseline_sequence, 0, "lost snapshot must not advance the acknowledged baseline");
    let decoded_recovery = decode_snapshot(&recovery.bytes).expect("recovery snapshot");
    apply_records(&mut client_state, &decoded_recovery.records);
    let authoritative = WireEntity::from_fighter(world.fighter(1).expect("viewer"));
    assert_eq!(client_state.get(&1), Some(&authoritative));

    let resync = session.build(500, world.tick, 1, world.fighters(), CONSERVATIVE_DATAGRAM_BYTES);
    assert!(resync.full, "unknown acknowledgement must fail closed into a full resync");
    assert_eq!(resync.baseline_sequence, u16::MAX);
}

#[test]
fn dense_512_player_snapshot_stays_within_one_datagram() {
    let mut world = World::default();
    for net_id in 1..=512 {
        assert!(world.add_player(net_id));
    }
    let mut session = SnapshotSession::default();
    let snapshot = session.build(u16::MAX, 900, 1, world.fighters(), CONSERVATIVE_DATAGRAM_BYTES);
    assert!(snapshot.bytes.len() <= CONSERVATIVE_DATAGRAM_BYTES);
    assert!(snapshot.omitted_due_to_budget > 0, "dense full state should be priority-limited instead of fragmented");
    let decoded = decode_snapshot(&snapshot.bytes).expect("bounded dense snapshot");
    assert!(decoded.records.iter().any(|record| record.net_id == 1), "owner state must survive pressure");
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push(DIGITS[(byte >> 4) as usize] as char);
        result.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    result
}
