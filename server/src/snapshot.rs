use crate::simulation::Fighter;
use std::collections::{BTreeMap, VecDeque};

pub const SNAPSHOT_PACKET_TYPE: u8 = 2;
pub const SNAPSHOT_HEADER_BYTES: usize = 14;
pub const SNAPSHOT_RECORD_BASE_BYTES: usize = 5;
pub const SNAPSHOT_FLAG_FULL: u8 = 1;
pub const SNAPSHOT_FIELD_POSITION: u8 = 1 << 0;
pub const SNAPSHOT_FIELD_FACING: u8 = 1 << 1;
pub const SNAPSHOT_FIELD_VITALS: u8 = 1 << 2;
pub const SNAPSHOT_FIELD_ACTION: u8 = 1 << 3;
pub const SNAPSHOT_FIELD_REMOVED: u8 = 1 << 7;
pub const SNAPSHOT_FULL_FIELDS: u8 =
    SNAPSHOT_FIELD_POSITION | SNAPSHOT_FIELD_FACING | SNAPSHOT_FIELD_VITALS | SNAPSHOT_FIELD_ACTION;
pub const WORLD_COORDINATE_SCALE: f32 = 4.0;
pub const MAX_WORLD_COORDINATE: f32 = u16::MAX as f32 / WORLD_COORDINATE_SCALE;
pub const INTEREST_COMBAT_RADIUS: f32 = 420.0;
pub const INTEREST_NEAR_RADIUS: f32 = 700.0;
pub const INTEREST_MID_RADIUS: f32 = 1500.0;
pub const INTEREST_FAR_RADIUS: f32 = 2600.0;
pub const INTEREST_NEAR_INTERVAL_TICKS: u32 = 3;
pub const INTEREST_MID_INTERVAL_TICKS: u32 = 6;
pub const INTEREST_FAR_INTERVAL_TICKS: u32 = 30;
pub const REPLICATION_STARVATION_TICKS: u32 = 120;
pub const DEFAULT_SNAPSHOT_HISTORY: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WireEntity {
    pub net_id: u32,
    pub x: u16,
    pub y: u16,
    pub facing: u16,
    pub hp: u8,
    pub guard: u8,
    pub action: u8,
    pub flags: u8,
}

impl WireEntity {
    pub fn from_fighter(fighter: &Fighter) -> Self {
        Self {
            net_id: fighter.net_id,
            x: quantize_position(fighter.x),
            y: quantize_position(fighter.y),
            facing: quantize_angle(fighter.facing),
            hp: quantize_vital(fighter.hp),
            guard: quantize_vital(fighter.guard),
            action: fighter.action.wire_code(),
            flags: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SnapshotRecord {
    pub net_id: u32,
    pub mask: u8,
    pub x: u16,
    pub y: u16,
    pub facing: u16,
    pub hp: u8,
    pub guard: u8,
    pub action: u8,
    pub flags: u8,
}

impl SnapshotRecord {
    fn full(state: WireEntity) -> Self {
        Self::from_state(state, SNAPSHOT_FULL_FIELDS)
    }

    fn removed(net_id: u32) -> Self {
        Self {
            net_id,
            mask: SNAPSHOT_FIELD_REMOVED,
            x: 0,
            y: 0,
            facing: 0,
            hp: 0,
            guard: 0,
            action: 0,
            flags: 0,
        }
    }

    fn from_state(state: WireEntity, mask: u8) -> Self {
        Self {
            net_id: state.net_id,
            mask,
            x: state.x,
            y: state.y,
            facing: state.facing,
            hp: state.hp,
            guard: state.guard,
            action: state.action,
            flags: state.flags,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedSnapshot {
    pub sequence: u16,
    pub baseline_sequence: u16,
    pub server_tick: u32,
    pub full: bool,
    pub records: Vec<SnapshotRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotDecodeError {
    Truncated,
    UnsupportedProtocol(u8),
    WrongPacketType(u8),
    TruncatedRecord,
    TrailingBytes,
}

#[derive(Debug, Clone)]
pub struct SnapshotBuild {
    pub bytes: Vec<u8>,
    pub sequence: u16,
    pub baseline_sequence: u16,
    pub full: bool,
    pub record_count: usize,
    pub omitted_due_to_budget: usize,
}

#[derive(Debug, Clone)]
pub struct SnapshotSession {
    next_sequence: u16,
    history_limit: usize,
    history: VecDeque<(u16, BTreeMap<u32, WireEntity>)>,
    last_sent_tick: BTreeMap<u32, u32>,
}

impl Default for SnapshotSession {
    fn default() -> Self {
        Self::new(DEFAULT_SNAPSHOT_HISTORY)
    }
}

impl SnapshotSession {
    pub fn new(history_limit: usize) -> Self {
        assert!(history_limit > 0);
        Self {
            next_sequence: 0,
            history_limit,
            history: VecDeque::with_capacity(history_limit),
            last_sent_tick: BTreeMap::new(),
        }
    }

    pub fn build(
        &mut self,
        ack_snapshot_sequence: u16,
        server_tick: u32,
        viewer_net_id: u32,
        fighters: &[Fighter],
        max_bytes: usize,
    ) -> SnapshotBuild {
        let acknowledged = if ack_snapshot_sequence == u16::MAX {
            None
        } else {
            self.history
                .iter()
                .find(|(sequence, _)| *sequence == ack_snapshot_sequence)
                .map(|(_, state)| state.clone())
        };
        let full = acknowledged.is_none();
        let baseline_sequence = if full {
            u16::MAX
        } else {
            ack_snapshot_sequence
        };
        let baseline = acknowledged.unwrap_or_default();
        let current: Vec<_> = fighters.iter().map(WireEntity::from_fighter).collect();
        let plan = plan_records(
            viewer_net_id,
            server_tick,
            &current,
            &baseline,
            &self.last_sent_tick,
            max_bytes,
        );
        let sequence = self.next_sequence;
        self.next_sequence = self.next_sequence.wrapping_add(1);
        let bytes = encode_snapshot(
            sequence,
            baseline_sequence,
            server_tick,
            full,
            &plan.records,
            max_bytes,
        );

        let mut resulting_state = if full { BTreeMap::new() } else { baseline };
        apply_records(&mut resulting_state, &plan.records);
        for record in &plan.records {
            if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
                self.last_sent_tick.remove(&record.net_id);
            } else {
                self.last_sent_tick.insert(record.net_id, server_tick);
            }
        }
        self.history.push_back((sequence, resulting_state));
        while self.history.len() > self.history_limit {
            self.history.pop_front();
        }

        SnapshotBuild {
            bytes,
            sequence,
            baseline_sequence,
            full,
            record_count: plan.records.len(),
            omitted_due_to_budget: plan.omitted_due_to_budget,
        }
    }

    pub fn has_sequence(&self, sequence: u16) -> bool {
        self.history
            .iter()
            .any(|(candidate, _)| *candidate == sequence)
    }
}

#[derive(Debug)]
struct SnapshotPlan {
    records: Vec<SnapshotRecord>,
    omitted_due_to_budget: usize,
}

fn plan_records(
    viewer_net_id: u32,
    server_tick: u32,
    current: &[WireEntity],
    baseline: &BTreeMap<u32, WireEntity>,
    last_sent_tick: &BTreeMap<u32, u32>,
    max_bytes: usize,
) -> SnapshotPlan {
    assert!(max_bytes >= SNAPSHOT_HEADER_BYTES);
    let current_map: BTreeMap<_, _> = current
        .iter()
        .map(|entity| (entity.net_id, *entity))
        .collect();
    let viewer = current_map.get(&viewer_net_id).copied();
    let mut buckets: [Vec<SnapshotRecord>; 8] = std::array::from_fn(|_| Vec::new());
    let mut visible = BTreeMap::new();
    let mut due_count = 0_usize;

    if let Some(viewer_state) = viewer {
        for state in current_map.values().copied() {
            let is_owner = state.net_id == viewer_net_id;
            let distance_sq = interest_distance_sq(viewer_state, state);
            if !is_owner && distance_sq > INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS {
                continue;
            }

            visible.insert(state.net_id, state);
            let before = baseline.get(&state.net_id).copied();
            let Some(record) = build_delta(state, before) else {
                continue;
            };

            let unseen_in_baseline = before.is_none();
            let sent_age = last_sent_tick
                .get(&state.net_id)
                .map(|last| server_tick.wrapping_sub(*last))
                .unwrap_or(u32::MAX);
            let urgent_state = state.action != 0
                || (before.is_some()
                    && record.mask & (SNAPSHOT_FIELD_VITALS | SNAPSHOT_FIELD_ACTION) != 0);
            let desired_interval = desired_interval_ticks(distance_sq, is_owner);
            if !is_owner && !unseen_in_baseline && !urgent_state && sent_age < desired_interval {
                continue;
            }

            due_count += 1;
            let bucket = if is_owner {
                0
            } else if urgent_state || distance_sq <= INTEREST_COMBAT_RADIUS * INTEREST_COMBAT_RADIUS
            {
                2
            } else if distance_sq <= INTEREST_NEAR_RADIUS * INTEREST_NEAR_RADIUS {
                3
            } else if unseen_in_baseline {
                4
            } else if sent_age >= REPLICATION_STARVATION_TICKS {
                5
            } else if distance_sq <= INTEREST_MID_RADIUS * INTEREST_MID_RADIUS {
                6
            } else {
                7
            };
            buckets[bucket].push(record);
        }
    }

    for net_id in baseline.keys().copied() {
        if !visible.contains_key(&net_id) {
            due_count += 1;
            buckets[1].push(SnapshotRecord::removed(net_id));
        }
    }

    let mut bytes_used = SNAPSHOT_HEADER_BYTES;
    let mut records = Vec::new();
    for (bucket_index, bucket) in buckets.into_iter().enumerate() {
        if bucket.is_empty() {
            continue;
        }
        let start = rotating_bucket_offset(viewer_net_id, server_tick, bucket_index, bucket.len());
        for offset in 0..bucket.len() {
            let record = bucket[(start + offset) % bucket.len()];
            let record_bytes = snapshot_record_bytes(&record);
            if bytes_used + record_bytes > max_bytes {
                continue;
            }
            bytes_used += record_bytes;
            records.push(record);
        }
    }

    SnapshotPlan {
        omitted_due_to_budget: due_count.saturating_sub(records.len()),
        records,
    }
}

fn desired_interval_ticks(distance_sq: f32, is_owner: bool) -> u32 {
    if is_owner || distance_sq <= INTEREST_NEAR_RADIUS * INTEREST_NEAR_RADIUS {
        INTEREST_NEAR_INTERVAL_TICKS
    } else if distance_sq <= INTEREST_MID_RADIUS * INTEREST_MID_RADIUS {
        INTEREST_MID_INTERVAL_TICKS
    } else {
        INTEREST_FAR_INTERVAL_TICKS
    }
}

fn rotating_bucket_offset(
    viewer_net_id: u32,
    server_tick: u32,
    bucket_index: usize,
    length: usize,
) -> usize {
    if length <= 1 {
        return 0;
    }
    let mixed = viewer_net_id.wrapping_mul(2_654_435_761)
        ^ server_tick.wrapping_mul(2_246_822_519)
        ^ (bucket_index as u32).wrapping_mul(3_266_489_917);
    mixed as usize % length
}

pub fn build_delta(state: WireEntity, before: Option<WireEntity>) -> Option<SnapshotRecord> {
    let Some(before) = before else {
        return Some(SnapshotRecord::full(state));
    };
    let mut mask = 0_u8;
    if state.x != before.x || state.y != before.y {
        mask |= SNAPSHOT_FIELD_POSITION;
    }
    if state.facing != before.facing {
        mask |= SNAPSHOT_FIELD_FACING;
    }
    if state.hp != before.hp || state.guard != before.guard {
        mask |= SNAPSHOT_FIELD_VITALS;
    }
    if state.action != before.action || state.flags != before.flags {
        mask |= SNAPSHOT_FIELD_ACTION;
    }
    (mask != 0).then(|| SnapshotRecord::from_state(state, mask))
}

pub fn apply_records(state: &mut BTreeMap<u32, WireEntity>, records: &[SnapshotRecord]) {
    for record in records {
        if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
            state.remove(&record.net_id);
            continue;
        }
        let mut next = state.get(&record.net_id).copied().unwrap_or(WireEntity {
            net_id: record.net_id,
            x: 0,
            y: 0,
            facing: 0,
            hp: 100,
            guard: 100,
            action: 0,
            flags: 0,
        });
        if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
            next.x = record.x;
            next.y = record.y;
        }
        if record.mask & SNAPSHOT_FIELD_FACING != 0 {
            next.facing = record.facing;
        }
        if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
            next.hp = record.hp;
            next.guard = record.guard;
        }
        if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
            next.action = record.action;
            next.flags = record.flags;
        }
        state.insert(record.net_id, next);
    }
}

pub fn encode_snapshot(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    max_bytes: usize,
) -> Vec<u8> {
    assert!(records.len() <= u16::MAX as usize);
    let total_bytes =
        SNAPSHOT_HEADER_BYTES + records.iter().map(snapshot_record_bytes).sum::<usize>();
    assert!(total_bytes <= max_bytes, "snapshot exceeds datagram budget");

    let mut bytes = Vec::with_capacity(total_bytes);
    bytes.push(crate::PROTOCOL_VERSION);
    bytes.push(SNAPSHOT_PACKET_TYPE);
    bytes.push(if full { SNAPSHOT_FLAG_FULL } else { 0 });
    bytes.push(0);
    bytes.extend_from_slice(&sequence.to_le_bytes());
    bytes.extend_from_slice(&baseline_sequence.to_le_bytes());
    bytes.extend_from_slice(&server_tick.to_le_bytes());
    bytes.extend_from_slice(&(records.len() as u16).to_le_bytes());

    for record in records {
        bytes.extend_from_slice(&record.net_id.to_le_bytes());
        bytes.push(record.mask);
        if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
            continue;
        }
        if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
            bytes.extend_from_slice(&record.x.to_le_bytes());
            bytes.extend_from_slice(&record.y.to_le_bytes());
        }
        if record.mask & SNAPSHOT_FIELD_FACING != 0 {
            bytes.extend_from_slice(&record.facing.to_le_bytes());
        }
        if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
            bytes.push(record.hp);
            bytes.push(record.guard);
        }
        if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
            bytes.push(record.action);
            bytes.push(record.flags);
        }
    }
    debug_assert_eq!(bytes.len(), total_bytes);
    bytes
}

pub fn decode_snapshot(bytes: &[u8]) -> Result<DecodedSnapshot, SnapshotDecodeError> {
    if bytes.len() < SNAPSHOT_HEADER_BYTES {
        return Err(SnapshotDecodeError::Truncated);
    }
    if bytes[0] != crate::PROTOCOL_VERSION {
        return Err(SnapshotDecodeError::UnsupportedProtocol(bytes[0]));
    }
    if bytes[1] != SNAPSHOT_PACKET_TYPE {
        return Err(SnapshotDecodeError::WrongPacketType(bytes[1]));
    }
    let sequence = u16::from_le_bytes([bytes[4], bytes[5]]);
    let baseline_sequence = u16::from_le_bytes([bytes[6], bytes[7]]);
    let server_tick = u32::from_le_bytes(bytes[8..12].try_into().expect("header length checked"));
    let count = u16::from_le_bytes([bytes[12], bytes[13]]) as usize;
    let mut offset = SNAPSHOT_HEADER_BYTES;
    let mut records = Vec::with_capacity(count);

    for _ in 0..count {
        if offset + SNAPSHOT_RECORD_BASE_BYTES > bytes.len() {
            return Err(SnapshotDecodeError::TruncatedRecord);
        }
        let net_id = u32::from_le_bytes(
            bytes[offset..offset + 4]
                .try_into()
                .expect("record length checked"),
        );
        let mask = bytes[offset + 4];
        offset += SNAPSHOT_RECORD_BASE_BYTES;
        let mut record = SnapshotRecord {
            net_id,
            mask,
            x: 0,
            y: 0,
            facing: 0,
            hp: 0,
            guard: 0,
            action: 0,
            flags: 0,
        };
        if mask & SNAPSHOT_FIELD_REMOVED == 0 {
            if mask & SNAPSHOT_FIELD_POSITION != 0 {
                require(bytes, offset, 4)?;
                record.x = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
                record.y = u16::from_le_bytes([bytes[offset + 2], bytes[offset + 3]]);
                offset += 4;
            }
            if mask & SNAPSHOT_FIELD_FACING != 0 {
                require(bytes, offset, 2)?;
                record.facing = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
                offset += 2;
            }
            if mask & SNAPSHOT_FIELD_VITALS != 0 {
                require(bytes, offset, 2)?;
                record.hp = bytes[offset];
                record.guard = bytes[offset + 1];
                offset += 2;
            }
            if mask & SNAPSHOT_FIELD_ACTION != 0 {
                require(bytes, offset, 2)?;
                record.action = bytes[offset];
                record.flags = bytes[offset + 1];
                offset += 2;
            }
        }
        records.push(record);
    }
    if offset != bytes.len() {
        return Err(SnapshotDecodeError::TrailingBytes);
    }

    Ok(DecodedSnapshot {
        sequence,
        baseline_sequence,
        server_tick,
        full: bytes[2] & SNAPSHOT_FLAG_FULL != 0,
        records,
    })
}

pub fn snapshot_record_bytes(record: &SnapshotRecord) -> usize {
    let mut bytes = SNAPSHOT_RECORD_BASE_BYTES;
    if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
        return bytes;
    }
    if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
        bytes += 4;
    }
    if record.mask & SNAPSHOT_FIELD_FACING != 0 {
        bytes += 2;
    }
    if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
        bytes += 2;
    }
    if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
        bytes += 2;
    }
    bytes
}

fn interest_distance_sq(viewer: WireEntity, candidate: WireEntity) -> f32 {
    let dx = (candidate.x as f32 - viewer.x as f32) / WORLD_COORDINATE_SCALE;
    let dy = (candidate.y as f32 - viewer.y as f32) / WORLD_COORDINATE_SCALE;
    dx * dx + dy * dy
}

fn quantize_position(value: f32) -> u16 {
    (value.clamp(0.0, MAX_WORLD_COORDINATE) * WORLD_COORDINATE_SCALE).round() as u16
}

fn quantize_angle(value: f32) -> u16 {
    let normalized = value.rem_euclid(std::f32::consts::TAU);
    ((normalized / std::f32::consts::TAU) * u16::MAX as f32).round() as u16
}

fn quantize_vital(value: f32) -> u8 {
    value.clamp(0.0, 100.0).round() as u8
}

fn require(bytes: &[u8], offset: usize, count: usize) -> Result<(), SnapshotDecodeError> {
    if offset + count > bytes.len() {
        Err(SnapshotDecodeError::TruncatedRecord)
    } else {
        Ok(())
    }
}
