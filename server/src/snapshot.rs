use crate::simulation::Fighter;
use std::collections::{BTreeMap, HashMap, VecDeque};

pub const SNAPSHOT_PACKET_TYPE: u8 = 2;
pub const SNAPSHOT_HEADER_BYTES: usize = 14;
pub const SNAPSHOT_RECORD_BASE_BYTES: usize = 5;
pub const SNAPSHOT_ENCODING_LEGACY_U32_IDS: u8 = 0;
pub const SNAPSHOT_ENCODING_VARINT_IDS: u8 = 1;
pub const SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING: u8 = 2;
pub const SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION: u8 = 3;
pub const SNAPSHOT_ENCODING_CURRENT: u8 = SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION;
pub const SNAPSHOT_FLAG_FULL: u8 = 1;
pub const SNAPSHOT_FIELD_POSITION: u8 = 1 << 0;
pub const SNAPSHOT_FIELD_FACING: u8 = 1 << 1;
pub const SNAPSHOT_FIELD_VITALS: u8 = 1 << 2;
pub const SNAPSHOT_FIELD_ACTION: u8 = 1 << 3;
pub const SNAPSHOT_FIELD_WIDE_POSITION: u8 = 1 << 4;
pub const SNAPSHOT_FIELD_REMOVED: u8 = 1 << 7;
pub const SNAPSHOT_FULL_FIELDS: u8 =
    SNAPSHOT_FIELD_POSITION | SNAPSHOT_FIELD_FACING | SNAPSHOT_FIELD_VITALS | SNAPSHOT_FIELD_ACTION;
pub const WORLD_COORDINATE_SCALE: f32 = 4.0;
pub const MAX_WORLD_COORDINATE: f32 = u16::MAX as f32 / WORLD_COORDINATE_SCALE;
const COMPACT_POSITION_SHIFT: u32 = 3;
const COMPACT_POSITION_MAX: u16 = (0x0fff_u16 << COMPACT_POSITION_SHIFT) + 3;
pub const INTEREST_COMBAT_RADIUS: f32 = 420.0;
pub const INTEREST_NEAR_RADIUS: f32 = 700.0;
pub const INTEREST_MID_RADIUS: f32 = 1500.0;
pub const INTEREST_FAR_RADIUS: f32 = 2600.0;
pub const INTEREST_NEAR_INTERVAL_TICKS: u32 = 3;
pub const INTEREST_MID_INTERVAL_TICKS: u32 = 6;
pub const INTEREST_FAR_INTERVAL_TICKS: u32 = 30;
pub const COMBAT_FRESHNESS_BUDGET_TICKS: u32 = 6;
pub const NEAR_FRESHNESS_BUDGET_TICKS: u32 = 12;
pub const REPLICATION_STARVATION_TICKS: u32 = 120;
pub const REPLICATION_CELL_SIZE: f32 = 512.0;
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
            flags: fighter.kills.min(u8::MAX as u16) as u8,
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
    pub encoding: u8,
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
    UnsupportedEncoding(u8),
    InvalidVarint,
    InvalidPositionEncoding,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TierFreshness {
    pub due: usize,
    pub sent: usize,
    pub omitted: usize,
    pub deadline_misses: usize,
    pub max_due_age_ticks: u32,
    pub max_sent_age_ticks: u32,
    pub max_omitted_age_ticks: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SnapshotFreshness {
    pub combat: TierFreshness,
    pub near: TierFreshness,
    pub mid: TierFreshness,
    pub far: TierFreshness,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SnapshotByteComposition {
    pub header: usize,
    pub net_ids: usize,
    pub masks: usize,
    pub position: usize,
    pub facing: usize,
    pub vitals: usize,
    pub action: usize,
}

impl SnapshotByteComposition {
    pub fn total_bytes(self) -> usize {
        self.header
            + self.net_ids
            + self.masks
            + self.position
            + self.facing
            + self.vitals
            + self.action
    }

    fn add(&mut self, other: Self) {
        self.header += other.header;
        self.net_ids += other.net_ids;
        self.masks += other.masks;
        self.position += other.position;
        self.facing += other.facing;
        self.vitals += other.vitals;
        self.action += other.action;
    }
}

#[derive(Debug)]
struct EncodedSnapshot {
    bytes: Vec<u8>,
    composition: SnapshotByteComposition,
}

#[derive(Debug, Clone)]
pub struct SnapshotBuild {
    pub bytes: Vec<u8>,
    pub sequence: u16,
    pub baseline_sequence: u16,
    pub full: bool,
    pub record_count: usize,
    pub byte_composition: SnapshotByteComposition,
    pub omitted_due_to_budget: usize,
    pub interest_candidates_checked: usize,
    pub visible_entity_count: usize,
    pub freshness: SnapshotFreshness,
}

#[derive(Debug, Clone)]
pub struct InterestQuery {
    pub states: Vec<WireEntity>,
    pub candidates_checked: usize,
    pub cells_visited: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InterestQueryStats {
    pub candidates_checked: usize,
    pub cells_visited: usize,
}

#[derive(Debug, Clone)]
pub struct ReplicationFrame {
    server_tick: u32,
    states: Vec<WireEntity>,
    cells: HashMap<(i32, i32), Vec<usize>>,
    recycled_cell_buckets: Vec<Vec<usize>>,
}

impl ReplicationFrame {
    pub fn from_fighters(server_tick: u32, fighters: &[Fighter]) -> Self {
        let mut frame = Self {
            server_tick,
            states: Vec::with_capacity(fighters.len()),
            cells: HashMap::with_capacity(fighters.len()),
            recycled_cell_buckets: Vec::new(),
        };
        frame.refresh_from_fighters(server_tick, fighters);
        frame
    }

    pub fn refresh_from_fighters(&mut self, server_tick: u32, fighters: &[Fighter]) {
        self.server_tick = server_tick;
        self.states.clear();
        for (_, mut bucket) in self.cells.drain() {
            bucket.clear();
            self.recycled_cell_buckets.push(bucket);
        }
        if self.states.capacity() < fighters.len() {
            self.states.reserve(fighters.len());
        }
        if self.cells.capacity() < fighters.len() {
            self.cells.reserve(fighters.len());
        }
        for fighter in fighters {
            let state = WireEntity::from_fighter(fighter);
            debug_assert!(
                self.states
                    .last()
                    .is_none_or(|previous: &WireEntity| previous.net_id < state.net_id),
                "fighters must remain sorted by authoritative network ID"
            );
            let state_index = self.states.len();
            self.states.push(state);
            let cells = &mut self.cells;
            let recycled_cell_buckets = &mut self.recycled_cell_buckets;
            cells
                .entry(replication_cell(state))
                .or_insert_with(|| recycled_cell_buckets.pop().unwrap_or_default())
                .push(state_index);
        }
    }

    pub fn server_tick(&self) -> u32 {
        self.server_tick
    }

    pub fn len(&self) -> usize {
        self.states.len()
    }

    pub fn is_empty(&self) -> bool {
        self.states.is_empty()
    }

    pub fn get(&self, net_id: u32) -> Option<WireEntity> {
        self.states
            .binary_search_by_key(&net_id, |state| state.net_id)
            .ok()
            .map(|index| self.states[index])
    }

    pub fn query_interest(&self, viewer_net_id: u32) -> Option<InterestQuery> {
        let mut states = Vec::new();
        let stats = self.query_interest_into(viewer_net_id, &mut states)?;
        Some(InterestQuery {
            states,
            candidates_checked: stats.candidates_checked,
            cells_visited: stats.cells_visited,
        })
    }

    pub fn query_interest_into(
        &self,
        viewer_net_id: u32,
        states: &mut Vec<WireEntity>,
    ) -> Option<InterestQueryStats> {
        let Some(viewer) = self.get(viewer_net_id) else {
            states.clear();
            return None;
        };
        Some(self.query_interest_from_viewer_into(viewer, states))
    }

    fn query_interest_from_viewer_into(
        &self,
        viewer: WireEntity,
        states: &mut Vec<WireEntity>,
    ) -> InterestQueryStats {
        states.clear();
        let center = replication_cell(viewer);
        let cell_wire = replication_cell_wire();
        let far_wire = INTEREST_FAR_RADIUS * WORLD_COORDINATE_SCALE;
        let span = (far_wire / cell_wire as f32).ceil() as i32;
        let mut candidates_checked = 0_usize;
        let mut cells_visited = 0_usize;

        for cell_y in center.1 - span..=center.1 + span {
            for cell_x in center.0 - span..=center.0 + span {
                cells_visited += 1;
                let Some(cell) = self.cells.get(&(cell_x, cell_y)) else {
                    continue;
                };
                for state_index in cell.iter().copied() {
                    candidates_checked += 1;
                    let state = self.states[state_index];
                    if interest_distance_sq(viewer, state)
                        <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
                    {
                        states.push(state);
                    }
                }
            }
        }

        InterestQueryStats {
            candidates_checked,
            cells_visited,
        }
    }
}

#[derive(Debug, Clone)]
struct SnapshotHistoryEntry {
    sequence: u16,
    baseline_sequence: u16,
    full: bool,
    records: Vec<SnapshotRecord>,
}

#[derive(Debug, Clone)]
pub struct SnapshotSession {
    next_sequence: u16,
    history_limit: usize,
    history: VecDeque<SnapshotHistoryEntry>,
    acknowledged_sequence: Option<u16>,
    acknowledged_state: BTreeMap<u32, WireEntity>,
    last_sent_tick: HashMap<u32, u32>,
    planner_scratch: SnapshotPlannerScratch,
    recycled_records: Vec<SnapshotRecord>,
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
            acknowledged_sequence: None,
            acknowledged_state: BTreeMap::new(),
            last_sent_tick: HashMap::new(),
            planner_scratch: SnapshotPlannerScratch::default(),
            recycled_records: Vec::new(),
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
        let frame = ReplicationFrame::from_fighters(server_tick, fighters);
        self.build_from_frame(ack_snapshot_sequence, viewer_net_id, &frame, max_bytes)
    }

    pub fn build_from_frame(
        &mut self,
        ack_snapshot_sequence: u16,
        viewer_net_id: u32,
        frame: &ReplicationFrame,
        max_bytes: usize,
    ) -> SnapshotBuild {
        let server_tick = frame.server_tick();
        let has_baseline = self.advance_acknowledged_state(ack_snapshot_sequence);
        let full = !has_baseline;
        let baseline_sequence = if full {
            u16::MAX
        } else {
            ack_snapshot_sequence
        };
        let empty_baseline = BTreeMap::new();
        let baseline = if full {
            &empty_baseline
        } else {
            &self.acknowledged_state
        };
        debug_assert!(self.planner_scratch.records.is_empty());
        self.planner_scratch.records = std::mem::take(&mut self.recycled_records);
        let plan = plan_records(
            viewer_net_id,
            server_tick,
            frame,
            baseline,
            &mut self.last_sent_tick,
            max_bytes,
            &mut self.planner_scratch,
        );
        let sequence = self.next_sequence;
        self.next_sequence = self.next_sequence.wrapping_add(1);
        let encoded = encode_snapshot_current_with_planned_composition(
            sequence,
            baseline_sequence,
            server_tick,
            full,
            &plan.records,
            max_bytes,
            plan.byte_composition,
        );
        let bytes = encoded.bytes;
        let byte_composition = encoded.composition;
        debug_assert_eq!(byte_composition.total_bytes(), bytes.len());

        let record_count = plan.records.len();
        self.history.push_back(SnapshotHistoryEntry {
            sequence,
            baseline_sequence,
            full,
            records: plan.records,
        });
        while self.history.len() > self.history_limit {
            if let Some(evicted) = self.history.pop_front() {
                self.recycled_records = evicted.records;
            }
        }

        SnapshotBuild {
            bytes,
            sequence,
            baseline_sequence,
            full,
            record_count,
            byte_composition,
            omitted_due_to_budget: plan.omitted_due_to_budget,
            interest_candidates_checked: plan.interest_candidates_checked,
            visible_entity_count: plan.visible_entity_count,
            freshness: plan.freshness,
        }
    }

    pub fn has_sequence(&self, sequence: u16) -> bool {
        self.acknowledged_sequence == Some(sequence)
            || self
                .history
                .iter()
                .any(|candidate| candidate.sequence == sequence)
    }

    pub fn history_depth(&self) -> usize {
        self.history.len()
    }

    pub fn acknowledged_entity_count(&self) -> usize {
        self.acknowledged_state.len()
    }

    fn advance_acknowledged_state(&mut self, sequence: u16) -> bool {
        if sequence == u16::MAX {
            return false;
        }
        if self.acknowledged_sequence == Some(sequence) {
            return true;
        }
        let Some(index) = self
            .history
            .iter()
            .position(|candidate| candidate.sequence == sequence)
        else {
            return false;
        };
        let candidate = &self.history[index];
        if !candidate.full && self.acknowledged_sequence != Some(candidate.baseline_sequence) {
            return false;
        }

        for _ in 0..index {
            if let Some(discarded) = self.history.pop_front() {
                self.recycle_history_records(discarded.records);
            }
        }
        let candidate = self
            .history
            .pop_front()
            .expect("located history entry must remain present");
        if candidate.full {
            self.acknowledged_state.clear();
        }
        apply_records(&mut self.acknowledged_state, &candidate.records);
        self.acknowledged_sequence = Some(candidate.sequence);
        self.recycle_history_records(candidate.records);
        true
    }

    fn recycle_history_records(&mut self, records: Vec<SnapshotRecord>) {
        if records.capacity() >= self.recycled_records.capacity() {
            self.recycled_records = records;
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum FreshnessTier {
    Combat,
    Near,
    Mid,
    Far,
}

impl SnapshotFreshness {
    fn tier_mut(&mut self, tier: FreshnessTier) -> &mut TierFreshness {
        match tier {
            FreshnessTier::Combat => &mut self.combat,
            FreshnessTier::Near => &mut self.near,
            FreshnessTier::Mid => &mut self.mid,
            FreshnessTier::Far => &mut self.far,
        }
    }

    fn observe_due(&mut self, tier: FreshnessTier, age_ticks: u32) {
        let stats = self.tier_mut(tier);
        stats.due += 1;
        stats.max_due_age_ticks = stats.max_due_age_ticks.max(age_ticks);
    }

    fn observe_sent(&mut self, tier: FreshnessTier, age_ticks: u32) {
        let stats = self.tier_mut(tier);
        stats.sent += 1;
        stats.max_sent_age_ticks = stats.max_sent_age_ticks.max(age_ticks);
    }

    fn observe_omitted(&mut self, tier: FreshnessTier, age_ticks: u32) {
        let missed_deadline = age_ticks > freshness_budget_ticks(tier);
        let stats = self.tier_mut(tier);
        stats.omitted += 1;
        stats.max_omitted_age_ticks = stats.max_omitted_age_ticks.max(age_ticks);
        if missed_deadline {
            stats.deadline_misses += 1;
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct PlannedRecord {
    record: SnapshotRecord,
    tier: Option<FreshnessTier>,
    age_ticks: u32,
    priority_age_ticks: u32,
}

#[derive(Debug, Clone, Default)]
struct SnapshotPlannerScratch {
    interest_states: Vec<WireEntity>,
    buckets: [Vec<PlannedRecord>; 9],
    records: Vec<SnapshotRecord>,
}

#[derive(Debug)]
struct SnapshotPlan {
    records: Vec<SnapshotRecord>,
    byte_composition: SnapshotByteComposition,
    omitted_due_to_budget: usize,
    interest_candidates_checked: usize,
    visible_entity_count: usize,
    freshness: SnapshotFreshness,
}

fn plan_records(
    viewer_net_id: u32,
    server_tick: u32,
    frame: &ReplicationFrame,
    baseline: &BTreeMap<u32, WireEntity>,
    last_sent_tick: &mut HashMap<u32, u32>,
    max_bytes: usize,
    scratch: &mut SnapshotPlannerScratch,
) -> SnapshotPlan {
    assert!(max_bytes >= SNAPSHOT_HEADER_BYTES);
    let viewer = frame.get(viewer_net_id);
    let query_stats = viewer.map(|viewer_state| {
        frame.query_interest_from_viewer_into(viewer_state, &mut scratch.interest_states)
    });
    if viewer.is_none() {
        scratch.interest_states.clear();
    }
    let interest_candidates_checked = query_stats.map_or(0, |stats| stats.candidates_checked);
    let visible_entity_count = query_stats.map_or(0, |_| scratch.interest_states.len());
    for bucket in scratch.buckets.iter_mut() {
        bucket.clear();
    }
    let mut due_count = 0_usize;
    let mut freshness = SnapshotFreshness::default();

    if let (Some(viewer_state), Some(_)) = (viewer, query_stats) {
        for state in scratch.interest_states.iter().copied() {
            let is_owner = state.net_id == viewer_net_id;
            let distance_sq = interest_distance_sq(viewer_state, state);
            let before = baseline.get(&state.net_id).copied();
            let Some(record) = build_delta(state, before) else {
                continue;
            };

            let unseen_in_baseline = before.is_none();
            let last_sent_age = last_sent_tick
                .get(&state.net_id)
                .map(|last| server_tick.wrapping_sub(*last));
            let sent_age = last_sent_age.unwrap_or(u32::MAX);
            let freshness_age = last_sent_age.unwrap_or(0);
            let urgent_state = state.action != 0
                || (before.is_some()
                    && record.mask & (SNAPSHOT_FIELD_VITALS | SNAPSHOT_FIELD_ACTION) != 0);
            let desired_interval = desired_interval_ticks(distance_sq, is_owner);
            if !is_owner && !unseen_in_baseline && !urgent_state && sent_age < desired_interval {
                continue;
            }

            due_count += 1;
            let tier = freshness_tier(distance_sq, is_owner);
            freshness.observe_due(tier, freshness_age);
            let bucket = if is_owner {
                0
            } else if matches!(tier, FreshnessTier::Combat) {
                1
            } else if matches!(tier, FreshnessTier::Near) {
                2
            } else if urgent_state {
                3
            } else if unseen_in_baseline {
                5
            } else if sent_age >= REPLICATION_STARVATION_TICKS {
                6
            } else if matches!(tier, FreshnessTier::Mid) {
                7
            } else {
                8
            };
            scratch.buckets[bucket].push(PlannedRecord {
                record,
                tier: Some(tier),
                age_ticks: freshness_age,
                priority_age_ticks: if unseen_in_baseline {
                    u32::MAX
                } else {
                    freshness_age
                },
            });
        }
    }

    due_count += collect_baseline_removals(frame, viewer, baseline, &mut scratch.buckets[4]);

    let mut bytes_used = SNAPSHOT_HEADER_BYTES;
    let mut byte_composition = SnapshotByteComposition {
        header: SNAPSHOT_HEADER_BYTES,
        ..SnapshotByteComposition::default()
    };
    scratch.records.clear();
    let (buckets, records) = (&mut scratch.buckets, &mut scratch.records);
    for (bucket_index, bucket) in buckets.iter_mut().enumerate() {
        if bucket.is_empty() {
            continue;
        }
        let deadline_ordered = matches!(bucket_index, 1 | 2);
        if deadline_ordered {
            bucket.sort_unstable_by(|left, right| {
                right
                    .priority_age_ticks
                    .cmp(&left.priority_age_ticks)
                    .then_with(|| left.record.net_id.cmp(&right.record.net_id))
            });
        }
        let start = if deadline_ordered {
            0
        } else {
            rotating_bucket_offset(viewer_net_id, server_tick, bucket_index, bucket.len())
        };
        for offset in 0..bucket.len() {
            let planned = bucket[(start + offset) % bucket.len()];
            let record_composition = snapshot_record_composition_for_encoding(
                &planned.record,
                SNAPSHOT_ENCODING_CURRENT,
            );
            let record_bytes = record_composition.total_bytes();
            if bytes_used + record_bytes > max_bytes {
                if let Some(tier) = planned.tier {
                    freshness.observe_omitted(tier, planned.age_ticks);
                }
                continue;
            }
            bytes_used += record_bytes;
            byte_composition.add(record_composition);
            records.push(planned.record);
            if planned.record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
                last_sent_tick.remove(&planned.record.net_id);
            } else {
                last_sent_tick.insert(planned.record.net_id, server_tick);
            }
            if let Some(tier) = planned.tier {
                freshness.observe_sent(tier, planned.age_ticks);
            }
        }
    }

    SnapshotPlan {
        omitted_due_to_budget: due_count.saturating_sub(records.len()),
        records: std::mem::take(records),
        byte_composition,
        interest_candidates_checked,
        visible_entity_count,
        freshness,
    }
}

fn collect_baseline_removals(
    frame: &ReplicationFrame,
    viewer: Option<WireEntity>,
    baseline: &BTreeMap<u32, WireEntity>,
    removals: &mut Vec<PlannedRecord>,
) -> usize {
    let Some(viewer_state) = viewer else {
        let start_len = removals.len();
        removals.extend(baseline.keys().copied().map(|net_id| PlannedRecord {
            record: SnapshotRecord::removed(net_id),
            tier: None,
            age_ticks: 0,
            priority_age_ticks: 0,
        }));
        return removals.len() - start_len;
    };

    let start_len = removals.len();
    let mut state_index = 0_usize;
    for net_id in baseline.keys().copied() {
        while state_index < frame.states.len() && frame.states[state_index].net_id < net_id {
            state_index += 1;
        }
        let still_visible = frame
            .states
            .get(state_index)
            .copied()
            .filter(|state| state.net_id == net_id)
            .is_some_and(|state| {
                interest_distance_sq(viewer_state, state)
                    <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
            });
        if still_visible {
            continue;
        }
        removals.push(PlannedRecord {
            record: SnapshotRecord::removed(net_id),
            tier: None,
            age_ticks: 0,
            priority_age_ticks: 0,
        });
    }
    removals.len() - start_len
}

fn freshness_tier(distance_sq: f32, is_owner: bool) -> FreshnessTier {
    if is_owner || distance_sq <= INTEREST_COMBAT_RADIUS * INTEREST_COMBAT_RADIUS {
        FreshnessTier::Combat
    } else if distance_sq <= INTEREST_NEAR_RADIUS * INTEREST_NEAR_RADIUS {
        FreshnessTier::Near
    } else if distance_sq <= INTEREST_MID_RADIUS * INTEREST_MID_RADIUS {
        FreshnessTier::Mid
    } else {
        FreshnessTier::Far
    }
}

fn freshness_budget_ticks(tier: FreshnessTier) -> u32 {
    match tier {
        FreshnessTier::Combat => COMBAT_FRESHNESS_BUDGET_TICKS,
        FreshnessTier::Near => NEAR_FRESHNESS_BUDGET_TICKS,
        FreshnessTier::Mid => INTEREST_MID_INTERVAL_TICKS * 5,
        FreshnessTier::Far => INTEREST_FAR_INTERVAL_TICKS * 2,
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
    encode_snapshot_with_encoding(
        sequence,
        baseline_sequence,
        server_tick,
        full,
        records,
        max_bytes,
        SNAPSHOT_ENCODING_LEGACY_U32_IDS,
    )
    .bytes
}

pub fn encode_snapshot_current(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    max_bytes: usize,
) -> Vec<u8> {
    encode_snapshot_current_with_composition(
        sequence,
        baseline_sequence,
        server_tick,
        full,
        records,
        max_bytes,
    )
    .bytes
}

fn encode_snapshot_current_with_composition(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    max_bytes: usize,
) -> EncodedSnapshot {
    encode_snapshot_with_encoding(
        sequence,
        baseline_sequence,
        server_tick,
        full,
        records,
        max_bytes,
        SNAPSHOT_ENCODING_CURRENT,
    )
}

fn encode_snapshot_current_with_planned_composition(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    max_bytes: usize,
    composition: SnapshotByteComposition,
) -> EncodedSnapshot {
    assert!(
        composition.total_bytes() <= max_bytes,
        "snapshot exceeds datagram budget"
    );
    encode_snapshot_with_composition(
        sequence,
        baseline_sequence,
        server_tick,
        full,
        records,
        SNAPSHOT_ENCODING_CURRENT,
        composition,
    )
}

fn encode_snapshot_with_encoding(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    max_bytes: usize,
    encoding: u8,
) -> EncodedSnapshot {
    let composition = snapshot_byte_composition_for_encoding(records, encoding);
    assert!(
        composition.total_bytes() <= max_bytes,
        "snapshot exceeds datagram budget"
    );
    encode_snapshot_with_composition(
        sequence,
        baseline_sequence,
        server_tick,
        full,
        records,
        encoding,
        composition,
    )
}

fn encode_snapshot_with_composition(
    sequence: u16,
    baseline_sequence: u16,
    server_tick: u32,
    full: bool,
    records: &[SnapshotRecord],
    encoding: u8,
    composition: SnapshotByteComposition,
) -> EncodedSnapshot {
    assert!(records.len() <= u16::MAX as usize);
    assert!(matches!(
        encoding,
        SNAPSHOT_ENCODING_LEGACY_U32_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    ));
    let total_bytes = composition.total_bytes();

    let mut bytes = Vec::with_capacity(total_bytes);
    bytes.push(crate::PROTOCOL_VERSION);
    bytes.push(SNAPSHOT_PACKET_TYPE);
    bytes.push(if full { SNAPSHOT_FLAG_FULL } else { 0 });
    bytes.push(encoding);
    bytes.extend_from_slice(&sequence.to_le_bytes());
    bytes.extend_from_slice(&baseline_sequence.to_le_bytes());
    bytes.extend_from_slice(&server_tick.to_le_bytes());
    bytes.extend_from_slice(&(records.len() as u16).to_le_bytes());

    for record in records {
        match encoding {
            SNAPSHOT_ENCODING_LEGACY_U32_IDS => {
                bytes.extend_from_slice(&record.net_id.to_le_bytes())
            }
            SNAPSHOT_ENCODING_VARINT_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION => {
                encode_u32_varint(record.net_id, &mut bytes)
            }
            _ => unreachable!("encoding validated"),
        }
        let wire_mask = encoded_record_mask(record, encoding);
        bytes.push(wire_mask);
        encode_record_fields(record, wire_mask, &mut bytes, encoding);
    }
    debug_assert_eq!(bytes.len(), total_bytes);
    EncodedSnapshot { bytes, composition }
}

fn encode_record_fields(record: &SnapshotRecord, wire_mask: u8, bytes: &mut Vec<u8>, encoding: u8) {
    if wire_mask & SNAPSHOT_FIELD_REMOVED != 0 {
        return;
    }
    if wire_mask & SNAPSHOT_FIELD_POSITION != 0 {
        if uses_compact_position(encoding) && wire_mask & SNAPSHOT_FIELD_WIDE_POSITION == 0 {
            encode_compact_position(record.x, record.y, bytes);
        } else {
            bytes.extend_from_slice(&record.x.to_le_bytes());
            bytes.extend_from_slice(&record.y.to_le_bytes());
        }
    }
    if wire_mask & SNAPSHOT_FIELD_FACING != 0 {
        if uses_compact_facing(encoding) {
            bytes.push(compact_facing_u8(record.facing));
        } else {
            bytes.extend_from_slice(&record.facing.to_le_bytes());
        }
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
    let encoding = bytes[3];
    if !matches!(
        encoding,
        SNAPSHOT_ENCODING_LEGACY_U32_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    ) {
        return Err(SnapshotDecodeError::UnsupportedEncoding(encoding));
    }
    let sequence = u16::from_le_bytes([bytes[4], bytes[5]]);
    let baseline_sequence = u16::from_le_bytes([bytes[6], bytes[7]]);
    let server_tick = u32::from_le_bytes(bytes[8..12].try_into().expect("header length checked"));
    let count = u16::from_le_bytes([bytes[12], bytes[13]]) as usize;
    let mut offset = SNAPSHOT_HEADER_BYTES;
    let mut records = Vec::with_capacity(count);

    for _ in 0..count {
        let net_id = match encoding {
            SNAPSHOT_ENCODING_LEGACY_U32_IDS => {
                require(bytes, offset, 4)?;
                let value = u32::from_le_bytes(
                    bytes[offset..offset + 4]
                        .try_into()
                        .expect("length checked"),
                );
                offset += 4;
                value
            }
            SNAPSHOT_ENCODING_VARINT_IDS
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION => {
                decode_u32_varint(bytes, &mut offset)?
            }
            _ => unreachable!("encoding validated"),
        };
        require(bytes, offset, 1)?;
        let mask = bytes[offset];
        offset += 1;
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
        decode_record_fields(bytes, &mut offset, &mut record, encoding)?;
        records.push(record);
    }
    if offset != bytes.len() {
        return Err(SnapshotDecodeError::TrailingBytes);
    }

    Ok(DecodedSnapshot {
        encoding,
        sequence,
        baseline_sequence,
        server_tick,
        full: bytes[2] & SNAPSHOT_FLAG_FULL != 0,
        records,
    })
}

fn decode_record_fields(
    bytes: &[u8],
    offset: &mut usize,
    record: &mut SnapshotRecord,
    encoding: u8,
) -> Result<(), SnapshotDecodeError> {
    let wide_position = record.mask & SNAPSHOT_FIELD_WIDE_POSITION != 0;
    if wide_position
        && (!uses_compact_position(encoding) || record.mask & SNAPSHOT_FIELD_POSITION == 0)
    {
        return Err(SnapshotDecodeError::InvalidPositionEncoding);
    }
    if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
        return Ok(());
    }
    if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
        if uses_compact_position(encoding) && !wide_position {
            require(bytes, *offset, 3)?;
            let packed = u32::from(bytes[*offset])
                | (u32::from(bytes[*offset + 1]) << 8)
                | (u32::from(bytes[*offset + 2]) << 16);
            record.x = expand_compact_position_u12((packed & 0x0fff) as u16);
            record.y = expand_compact_position_u12(((packed >> 12) & 0x0fff) as u16);
            *offset += 3;
        } else {
            require(bytes, *offset, 4)?;
            record.x = u16::from_le_bytes([bytes[*offset], bytes[*offset + 1]]);
            record.y = u16::from_le_bytes([bytes[*offset + 2], bytes[*offset + 3]]);
            *offset += 4;
        }
    }
    if record.mask & SNAPSHOT_FIELD_FACING != 0 {
        if uses_compact_facing(encoding) {
            require(bytes, *offset, 1)?;
            record.facing = expand_facing_u8(bytes[*offset]);
            *offset += 1;
        } else {
            require(bytes, *offset, 2)?;
            record.facing = u16::from_le_bytes([bytes[*offset], bytes[*offset + 1]]);
            *offset += 2;
        }
    }
    if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
        require(bytes, *offset, 2)?;
        record.hp = bytes[*offset];
        record.guard = bytes[*offset + 1];
        *offset += 2;
    }
    if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
        require(bytes, *offset, 2)?;
        record.action = bytes[*offset];
        record.flags = bytes[*offset + 1];
        *offset += 2;
    }
    Ok(())
}

pub fn snapshot_byte_composition(records: &[SnapshotRecord]) -> SnapshotByteComposition {
    snapshot_byte_composition_for_encoding(records, SNAPSHOT_ENCODING_CURRENT)
}

fn snapshot_byte_composition_for_encoding(
    records: &[SnapshotRecord],
    encoding: u8,
) -> SnapshotByteComposition {
    let mut composition = SnapshotByteComposition {
        header: SNAPSHOT_HEADER_BYTES,
        ..SnapshotByteComposition::default()
    };
    for record in records {
        composition.add(snapshot_record_composition_for_encoding(record, encoding));
    }
    composition
}

fn snapshot_record_composition_for_encoding(
    record: &SnapshotRecord,
    encoding: u8,
) -> SnapshotByteComposition {
    let net_ids = match encoding {
        SNAPSHOT_ENCODING_LEGACY_U32_IDS => 4,
        SNAPSHOT_ENCODING_VARINT_IDS
        | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
        | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION => u32_varint_bytes(record.net_id),
        _ => unreachable!("encoding validated by caller"),
    };
    let mut composition = SnapshotByteComposition {
        net_ids,
        masks: 1,
        ..SnapshotByteComposition::default()
    };
    if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
        return composition;
    }
    if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
        composition.position = position_bytes_for_record(record, encoding);
    }
    if record.mask & SNAPSHOT_FIELD_FACING != 0 {
        composition.facing = facing_bytes_for_encoding(encoding);
    }
    if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
        composition.vitals = 2;
    }
    if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
        composition.action = 2;
    }
    composition
}

pub fn snapshot_record_bytes(record: &SnapshotRecord) -> usize {
    snapshot_record_bytes_for_encoding(record, SNAPSHOT_ENCODING_CURRENT)
}

fn snapshot_record_bytes_for_encoding(record: &SnapshotRecord, encoding: u8) -> usize {
    snapshot_record_composition_for_encoding(record, encoding).total_bytes()
}

fn encoded_record_mask(record: &SnapshotRecord, encoding: u8) -> u8 {
    let mut mask = record.mask & !SNAPSHOT_FIELD_WIDE_POSITION;
    if uses_compact_position(encoding)
        && mask & SNAPSHOT_FIELD_POSITION != 0
        && !position_is_compact(record.x, record.y)
    {
        mask |= SNAPSHOT_FIELD_WIDE_POSITION;
    }
    mask
}

fn position_bytes_for_record(record: &SnapshotRecord, encoding: u8) -> usize {
    if uses_compact_position(encoding) && position_is_compact(record.x, record.y) {
        3
    } else {
        4
    }
}

fn position_is_compact(x: u16, y: u16) -> bool {
    x <= COMPACT_POSITION_MAX && y <= COMPACT_POSITION_MAX
}

fn encode_compact_position(x: u16, y: u16, bytes: &mut Vec<u8>) {
    let x = compact_position_u12(x);
    let y = compact_position_u12(y);
    let packed = u32::from(x) | (u32::from(y) << 12);
    bytes.push((packed & 0xff) as u8);
    bytes.push(((packed >> 8) & 0xff) as u8);
    bytes.push(((packed >> 16) & 0xff) as u8);
}

fn compact_position_u12(value: u16) -> u16 {
    debug_assert!(value <= COMPACT_POSITION_MAX);
    (value.saturating_add(4) >> COMPACT_POSITION_SHIFT) & 0x0fff
}

fn expand_compact_position_u12(value: u16) -> u16 {
    (value & 0x0fff) << COMPACT_POSITION_SHIFT
}

fn uses_compact_position(encoding: u8) -> bool {
    encoding == SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
}

fn uses_compact_facing(encoding: u8) -> bool {
    matches!(
        encoding,
        SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING
            | SNAPSHOT_ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    )
}

fn facing_bytes_for_encoding(encoding: u8) -> usize {
    if uses_compact_facing(encoding) {
        1
    } else {
        2
    }
}

fn compact_facing_u8(facing: u16) -> u8 {
    ((u32::from(facing) + 128) / 257).min(u32::from(u8::MAX)) as u8
}

fn expand_facing_u8(facing: u8) -> u16 {
    u16::from(facing) * 257
}

fn u32_varint_bytes(mut value: u32) -> usize {
    let mut bytes = 1;
    while value >= 0x80 {
        value >>= 7;
        bytes += 1;
    }
    bytes
}

fn encode_u32_varint(mut value: u32, bytes: &mut Vec<u8>) {
    loop {
        let mut next = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            next |= 0x80;
        }
        bytes.push(next);
        if value == 0 {
            break;
        }
    }
}

fn decode_u32_varint(bytes: &[u8], offset: &mut usize) -> Result<u32, SnapshotDecodeError> {
    let start = *offset;
    let mut value = 0_u32;
    for index in 0..5 {
        require(bytes, *offset, 1)?;
        let byte = bytes[*offset];
        *offset += 1;
        if index == 4 && byte & 0xf0 != 0 {
            return Err(SnapshotDecodeError::InvalidVarint);
        }
        value |= u32::from(byte & 0x7f) << (index * 7);
        if byte & 0x80 == 0 {
            if *offset - start != u32_varint_bytes(value) {
                return Err(SnapshotDecodeError::InvalidVarint);
            }
            return Ok(value);
        }
    }
    Err(SnapshotDecodeError::InvalidVarint)
}

fn replication_cell_wire() -> i32 {
    (REPLICATION_CELL_SIZE * WORLD_COORDINATE_SCALE) as i32
}

fn replication_cell(state: WireEntity) -> (i32, i32) {
    let cell_wire = replication_cell_wire();
    (state.x as i32 / cell_wire, state.y as i32 / cell_wire)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::World;

    #[test]
    fn replication_frame_preallocates_cell_index_capacity() {
        let mut world = World::new(6000.0, 6000.0);
        for net_id in 1..=64 {
            let column = ((net_id - 1) % 8) as f32;
            let row = ((net_id - 1) / 8) as f32;
            assert!(world.add_player_at(net_id, 600.0 + column * 550.0, 600.0 + row * 550.0, 0.0,));
        }

        let fighter_count = world.fighters().len();
        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());

        assert_eq!(frame.states.len(), fighter_count);
        assert!(
            frame.cells.capacity() >= fighter_count,
            "cell index should be preallocated for the known fighter upper bound"
        );
    }

    #[test]
    fn replication_frame_refresh_reuses_cell_bucket_capacity() {
        let mut world = World::new(6000.0, 6000.0);
        for net_id in 1..=8 {
            assert!(world.add_player_at(net_id, 600.0 + net_id as f32 * 10.0, 600.0, 0.0));
        }

        let mut frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let viewer_net_id = 1;
        let before_query = frame.query_interest(viewer_net_id).expect("viewer exists");
        let cell_key = replication_cell(frame.get(viewer_net_id).expect("viewer exists"));
        let before_bucket = frame.cells.get(&cell_key).expect("occupied cell exists");
        let bucket_ptr = before_bucket.as_ptr();
        let bucket_capacity = before_bucket.capacity();
        assert_eq!(before_bucket.len(), world.fighters().len());

        frame.refresh_from_fighters(world.tick.wrapping_add(1), world.fighters());

        let after_bucket = frame.cells.get(&cell_key).expect("occupied cell remains");
        assert_eq!(after_bucket.as_ptr(), bucket_ptr);
        assert_eq!(after_bucket.capacity(), bucket_capacity);
        assert_eq!(after_bucket.len(), world.fighters().len());
        assert!(frame.recycled_cell_buckets.is_empty());

        let after_query = frame.query_interest(viewer_net_id).expect("viewer exists");
        assert_eq!(after_query.states, before_query.states);
        assert_eq!(after_query.candidates_checked, before_query.candidates_checked);
        assert_eq!(after_query.cells_visited, before_query.cells_visited);
    }

    #[test]
    fn indexed_replication_cells_preserve_legacy_query_order() {
        let mut world = World::new(6000.0, 6000.0);
        for (net_id, x, y) in [
            (9, 900.0, 900.0),
            (1, 1000.0, 1000.0),
            (7, 1700.0, 1100.0),
            (3, 2400.0, 900.0),
            (5, 3100.0, 1400.0),
            (11, 3800.0, 1700.0),
        ] {
            assert!(world.add_player_at(net_id, x, y, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        for (cell_key, indexes) in &frame.cells {
            assert!(indexes.windows(2).all(|pair| pair[0] < pair[1]));
            for index in indexes {
                let state = frame.states[*index];
                assert_eq!(replication_cell(state), *cell_key);
            }
        }

        let viewer_net_id = 3;
        let viewer = frame.get(viewer_net_id).expect("viewer exists");
        let center = replication_cell(viewer);
        let cell_wire = replication_cell_wire();
        let far_wire = INTEREST_FAR_RADIUS * WORLD_COORDINATE_SCALE;
        let span = (far_wire / cell_wire as f32).ceil() as i32;
        let mut expected = Vec::new();

        for cell_y in center.1 - span..=center.1 + span {
            for cell_x in center.0 - span..=center.0 + span {
                for state in frame.states.iter().copied() {
                    if replication_cell(state) == (cell_x, cell_y)
                        && interest_distance_sq(viewer, state)
                            <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
                    {
                        expected.push(state);
                    }
                }
            }
        }

        let actual = frame.query_interest(viewer_net_id).expect("viewer exists");
        assert_eq!(actual.states, expected);
    }

    #[test]
    fn reused_viewer_interest_query_matches_public_lookup_semantics() {
        let mut world = World::new(6000.0, 6000.0);
        for (net_id, x, y) in [
            (1, 1000.0, 1000.0),
            (2, 1300.0, 1050.0),
            (3, 1800.0, 1200.0),
            (4, 2600.0, 1600.0),
            (5, 4200.0, 2100.0),
        ] {
            assert!(world.add_player_at(net_id, x, y, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let public = frame.query_interest(3).expect("viewer exists");
        let viewer = frame.get(3).expect("viewer exists");

        let mut reused_states = vec![viewer];
        let reused = frame.query_interest_from_viewer_into(viewer, &mut reused_states);

        assert_eq!(reused_states, public.states);
        assert_eq!(reused.candidates_checked, public.candidates_checked);
        assert_eq!(reused.cells_visited, public.cells_visited);

        reused_states.push(viewer);
        assert!(frame
            .query_interest_into(u32::MAX, &mut reused_states)
            .is_none());
        assert!(reused_states.is_empty());
    }

    #[test]
    fn hashed_replication_cells_match_ordered_cell_lookup_semantics() {
        let mut world = World::new(6000.0, 6000.0);
        for (net_id, x, y) in [
            (1, 1000.0, 1000.0),
            (2, 1250.0, 1000.0),
            (3, 1700.0, 1200.0),
            (4, 2300.0, 1400.0),
            (5, 3100.0, 1700.0),
            (6, 4300.0, 2000.0),
        ] {
            assert!(world.add_player_at(net_id, x, y, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let viewer_net_id = 3;
        let viewer = frame.get(viewer_net_id).expect("viewer exists");
        let center = replication_cell(viewer);
        let cell_wire = replication_cell_wire();
        let far_wire = INTEREST_FAR_RADIUS * WORLD_COORDINATE_SCALE;
        let span = (far_wire / cell_wire as f32).ceil() as i32;

        let mut legacy_cells: BTreeMap<(i32, i32), Vec<usize>> = BTreeMap::new();
        for (index, state) in frame.states.iter().copied().enumerate() {
            legacy_cells
                .entry(replication_cell(state))
                .or_default()
                .push(index);
        }

        let mut expected_states = Vec::new();
        let mut expected_candidates = 0_usize;
        let mut expected_cells = 0_usize;
        for cell_y in center.1 - span..=center.1 + span {
            for cell_x in center.0 - span..=center.0 + span {
                expected_cells += 1;
                let Some(cell) = legacy_cells.get(&(cell_x, cell_y)) else {
                    continue;
                };
                for state_index in cell.iter().copied() {
                    expected_candidates += 1;
                    let state = frame.states[state_index];
                    if interest_distance_sq(viewer, state)
                        <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
                    {
                        expected_states.push(state);
                    }
                }
            }
        }

        let actual = frame.query_interest(viewer_net_id).expect("viewer exists");
        assert_eq!(actual.states, expected_states);
        assert_eq!(actual.candidates_checked, expected_candidates);
        assert_eq!(actual.cells_visited, expected_cells);
    }

    #[test]
    fn acknowledged_history_advances_in_place_and_preserves_newer_entries() {
        let mut world = World::new(1200.0, 800.0);
        for net_id in 1..=3 {
            assert!(world.add_player_at(net_id, 300.0 + net_id as f32 * 50.0, 300.0, 0.0,));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let mut session = SnapshotSession::new(8);
        let first =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let second =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let third =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);

        assert_eq!(session.history_depth(), 3);
        let capacity = session.history.capacity();

        assert!(session.advance_acknowledged_state(second.sequence));
        assert_eq!(session.acknowledged_sequence, Some(second.sequence));
        assert_eq!(session.acknowledged_entity_count(), 3);
        assert_eq!(session.history_depth(), 1);
        assert_eq!(
            session.history.front().map(|entry| entry.sequence),
            Some(third.sequence)
        );
        assert!(!session.has_sequence(first.sequence));
        assert!(session.has_sequence(second.sequence));
        assert!(session.has_sequence(third.sequence));
        assert_eq!(session.history.capacity(), capacity);

        assert!(session.advance_acknowledged_state(second.sequence));
        assert_eq!(session.history_depth(), 1);
        assert_eq!(session.history.capacity(), capacity);
    }

    #[test]
    fn linear_baseline_removals_match_binary_lookup_semantics() {
        let mut world = World::new(6000.0, 6000.0);
        assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
        assert!(world.add_player_at(2, 1200.0, 1000.0, 0.0));
        assert!(world.add_player_at(4, 4000.0, 1000.0, 0.0));
        assert!(world.add_player_at(5, 1400.0, 1000.0, 0.0));

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let viewer = frame.get(1);

        let mut baseline = BTreeMap::new();
        for net_id in [1_u32, 2, 4] {
            baseline.insert(net_id, frame.get(net_id).expect("baseline state exists"));
        }
        for net_id in [3_u32, 6] {
            baseline.insert(
                net_id,
                WireEntity {
                    net_id,
                    x: 0,
                    y: 0,
                    facing: 0,
                    hp: 100,
                    guard: 100,
                    action: 0,
                    flags: 0,
                },
            );
        }

        let expected: Vec<_> = baseline
            .keys()
            .copied()
            .filter(|net_id| {
                !viewer.is_some_and(|viewer_state| {
                    frame.get(*net_id).is_some_and(|state| {
                        interest_distance_sq(viewer_state, state)
                            <= INTEREST_FAR_RADIUS * INTEREST_FAR_RADIUS
                    })
                })
            })
            .collect();

        let mut removals = Vec::new();
        let count = collect_baseline_removals(&frame, viewer, &baseline, &mut removals);
        let actual: Vec<_> = removals
            .iter()
            .map(|planned| planned.record.net_id)
            .collect();

        assert_eq!(count, expected.len());
        assert_eq!(actual, expected);

        removals.clear();
        let no_viewer_count = collect_baseline_removals(&frame, None, &baseline, &mut removals);
        assert_eq!(no_viewer_count, baseline.len());
        assert_eq!(
            removals
                .iter()
                .map(|planned| planned.record.net_id)
                .collect::<Vec<_>>(),
            baseline.keys().copied().collect::<Vec<_>>()
        );
    }

    #[test]
    fn single_freshness_lookup_preserves_present_and_missing_age_semantics() {
        let mut world = World::new(1200.0, 800.0);
        assert!(world.add_player_at(1, 400.0, 300.0, 0.0));

        let initial_frame = ReplicationFrame::from_fighters(0, world.fighters());
        let mut session = SnapshotSession::default();
        let first = session.build_from_frame(
            u16::MAX,
            1,
            &initial_frame,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );

        let mut changed_frame = initial_frame.clone();
        changed_frame.server_tick = 5;
        changed_frame.states[0].x += 1;
        let second = session.build_from_frame(
            first.sequence,
            1,
            &changed_frame,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );
        assert_eq!(second.record_count, 1);
        assert_eq!(second.freshness.combat.max_due_age_ticks, 5);
        assert_eq!(second.freshness.combat.max_sent_age_ticks, 5);

        session.last_sent_tick.remove(&1);
        let mut changed_again_frame = changed_frame.clone();
        changed_again_frame.server_tick = 6;
        changed_again_frame.states[0].x += 1;
        let third = session.build_from_frame(
            second.sequence,
            1,
            &changed_again_frame,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );
        assert_eq!(third.record_count, 1);
        assert_eq!(third.freshness.combat.max_due_age_ticks, 0);
        assert_eq!(third.freshness.combat.max_sent_age_ticks, 0);
    }

    #[test]
    fn planner_updates_last_sent_only_for_admitted_records() {
        let mut world = World::new(6000.0, 6000.0);
        assert!(world.add_player_at(1, 1000.0, 1000.0, 0.0));
        assert!(world.add_player_at(2, 1200.0, 1000.0, 0.0));

        let frame = ReplicationFrame::from_fighters(42, world.fighters());
        let baseline = BTreeMap::new();
        let mut last_sent_tick = HashMap::new();
        let mut scratch = SnapshotPlannerScratch::default();
        let owner_record = SnapshotRecord::full(frame.get(1).expect("viewer must exist"));
        let max_bytes = SNAPSHOT_HEADER_BYTES + snapshot_record_bytes(&owner_record);

        let plan = plan_records(
            1,
            frame.server_tick(),
            &frame,
            &baseline,
            &mut last_sent_tick,
            max_bytes,
            &mut scratch,
        );

        assert_eq!(plan.records.len(), 1);
        assert_eq!(plan.records[0].net_id, 1);
        assert_eq!(plan.omitted_due_to_budget, 1);
        assert_eq!(last_sent_tick.get(&1), Some(&42));
        assert!(!last_sent_tick.contains_key(&2));

        let acknowledged: BTreeMap<_, _> = frame
            .states
            .iter()
            .copied()
            .map(|state| (state.net_id, state))
            .collect();
        last_sent_tick.insert(2, 41);

        let mut viewer_only_world = World::new(6000.0, 6000.0);
        assert!(viewer_only_world.add_player_at(1, 1000.0, 1000.0, 0.0));
        let viewer_only = ReplicationFrame::from_fighters(43, viewer_only_world.fighters());
        let mut removal_scratch = SnapshotPlannerScratch::default();

        let removal_plan = plan_records(
            1,
            viewer_only.server_tick(),
            &viewer_only,
            &acknowledged,
            &mut last_sent_tick,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
            &mut removal_scratch,
        );

        assert_eq!(removal_plan.records.len(), 1);
        assert_eq!(removal_plan.records[0].net_id, 2);
        assert_ne!(removal_plan.records[0].mask & SNAPSHOT_FIELD_REMOVED, 0);
        assert!(!last_sent_tick.contains_key(&2));
    }

    #[test]
    fn planned_byte_composition_matches_encoder_sizing() {
        let mut world = World::new(6000.0, 6000.0);
        for (net_id, x, y) in [
            (1, 1000.0, 1000.0),
            (2, 1300.0, 1000.0),
            (300, 1700.0, 1200.0),
            (70_000, 2200.0, 1500.0),
        ] {
            assert!(world.add_player_at(net_id, x, y, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(12, world.fighters());
        let baseline = BTreeMap::new();
        let mut last_sent_tick = HashMap::new();
        let mut scratch = SnapshotPlannerScratch::default();
        let plan = plan_records(
            1,
            frame.server_tick(),
            &frame,
            &baseline,
            &mut last_sent_tick,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
            &mut scratch,
        );

        let standalone = snapshot_byte_composition(&plan.records);
        assert_eq!(plan.byte_composition, standalone);

        let planned = encode_snapshot_current_with_planned_composition(
            9,
            u16::MAX,
            frame.server_tick(),
            true,
            &plan.records,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
            plan.byte_composition,
        );
        let regular = encode_snapshot_current(
            9,
            u16::MAX,
            frame.server_tick(),
            true,
            &plan.records,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );

        assert_eq!(planned.composition, standalone);
        assert_eq!(planned.composition.total_bytes(), planned.bytes.len());
        assert_eq!(planned.bytes, regular);
    }

    #[test]
    fn hashed_last_sent_ticks_preserve_planner_results_across_insertion_order() {
        let mut world = World::new(6000.0, 6000.0);
        for (net_id, x, y) in [
            (1, 1000.0, 1000.0),
            (2, 1200.0, 1000.0),
            (3, 1500.0, 1000.0),
            (4, 1800.0, 1000.0),
        ] {
            assert!(world.add_player_at(net_id, x, y, 0.0));
        }

        let baseline_frame = ReplicationFrame::from_fighters(0, world.fighters());
        let baseline: BTreeMap<_, _> = baseline_frame
            .states
            .iter()
            .copied()
            .map(|state| (state.net_id, state))
            .collect();

        let mut changed_frame = baseline_frame.clone();
        changed_frame.server_tick = 20;
        for state in &mut changed_frame.states {
            state.x += 1;
        }

        let mut forward = HashMap::new();
        forward.insert(1, 19);
        forward.insert(2, 5);
        forward.insert(3, 18);

        let mut reverse = HashMap::new();
        reverse.insert(3, 18);
        reverse.insert(2, 5);
        reverse.insert(1, 19);

        let mut forward_scratch = SnapshotPlannerScratch::default();
        let mut reverse_scratch = SnapshotPlannerScratch::default();
        let forward_plan = plan_records(
            1,
            20,
            &changed_frame,
            &baseline,
            &mut forward,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
            &mut forward_scratch,
        );
        let reverse_plan = plan_records(
            1,
            20,
            &changed_frame,
            &baseline,
            &mut reverse,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
            &mut reverse_scratch,
        );

        assert_eq!(forward_plan.records, reverse_plan.records);
        assert_eq!(
            forward_plan.omitted_due_to_budget,
            reverse_plan.omitted_due_to_budget
        );
        assert_eq!(
            forward_plan.interest_candidates_checked,
            reverse_plan.interest_candidates_checked
        );
        assert_eq!(
            forward_plan.visible_entity_count,
            reverse_plan.visible_entity_count
        );
        assert_eq!(forward_plan.freshness, reverse_plan.freshness);
    }

    #[test]
    fn inline_byte_composition_matches_standalone_accounting() {
        let records = vec![
            SnapshotRecord::full(WireEntity {
                net_id: 1,
                x: 1024,
                y: 2048,
                facing: 4096,
                hp: 90,
                guard: 80,
                action: 2,
                flags: 1,
            }),
            SnapshotRecord::from_state(
                WireEntity {
                    net_id: 300,
                    x: COMPACT_POSITION_MAX + 1,
                    y: 512,
                    facing: 8192,
                    hp: 70,
                    guard: 60,
                    action: 3,
                    flags: 2,
                },
                SNAPSHOT_FIELD_POSITION | SNAPSHOT_FIELD_FACING | SNAPSHOT_FIELD_ACTION,
            ),
            SnapshotRecord::removed(70_000),
        ];

        let encoded = encode_snapshot_current_with_composition(
            7,
            6,
            123,
            false,
            &records,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );
        let standalone = snapshot_byte_composition(&records);
        let public_bytes = encode_snapshot_current(
            7,
            6,
            123,
            false,
            &records,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );

        assert_eq!(encoded.composition, standalone);
        assert_eq!(encoded.composition.total_bytes(), encoded.bytes.len());
        assert_eq!(encoded.bytes, public_bytes);

        let decoded = decode_snapshot(&encoded.bytes).expect("encoded snapshot must decode");
        assert_eq!(decoded.sequence, 7);
        assert_eq!(decoded.baseline_sequence, 6);
        assert_eq!(decoded.server_tick, 123);
        assert!(!decoded.full);
        assert_eq!(decoded.records.len(), records.len());
    }

    #[test]
    fn acknowledged_history_reuses_record_capacity_on_next_snapshot() {
        let mut world = World::new(1200.0, 800.0);
        for net_id in 1..=8 {
            assert!(world.add_player_at(net_id, 300.0 + net_id as f32 * 25.0, 300.0, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let mut session = SnapshotSession::new(64);
        let first =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let first_history = session
            .history
            .back()
            .expect("first snapshot history entry");
        let first_ptr = first_history.records.as_ptr();
        let first_capacity = first_history.records.capacity();
        assert!(first_capacity >= first.record_count);

        let mut changed_frame = frame.clone();
        changed_frame.server_tick = frame.server_tick().wrapping_add(1);
        changed_frame.states[0].x += 1;

        let second = session.build_from_frame(
            first.sequence,
            1,
            &changed_frame,
            crate::CONSERVATIVE_DATAGRAM_BYTES,
        );
        let newest = session
            .history
            .back()
            .expect("second snapshot history entry");

        assert!(!second.full);
        assert_eq!(second.baseline_sequence, first.sequence);
        assert_eq!(second.record_count, 1);
        assert_eq!(newest.records.as_ptr(), first_ptr);
        assert_eq!(newest.records.capacity(), first_capacity);
        assert!(session.recycled_records.is_empty());
    }

    #[test]
    fn snapshot_history_reuses_evicted_record_capacity() {
        let mut world = World::new(1200.0, 800.0);
        for net_id in 1..=8 {
            assert!(world.add_player_at(net_id, 300.0 + net_id as f32 * 25.0, 300.0, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let mut session = SnapshotSession::new(2);
        let first =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let second =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let third =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);

        assert_eq!(session.history_depth(), 2);
        assert_eq!(third.record_count, first.record_count);
        assert_eq!(third.byte_composition, first.byte_composition);
        assert!(!session.recycled_records.is_empty());

        let recycled_ptr = session.recycled_records.as_ptr();
        let recycled_capacity = session.recycled_records.capacity();
        assert!(recycled_capacity >= first.record_count);

        let fourth =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let newest = session.history.back().expect("new snapshot history entry");

        assert_eq!(session.history_depth(), 2);
        assert_eq!(fourth.record_count, first.record_count);
        assert_eq!(fourth.byte_composition, first.byte_composition);
        assert_eq!(newest.records.as_ptr(), recycled_ptr);
        assert_eq!(newest.records.capacity(), recycled_capacity);
        assert_eq!(session.recycled_records.len(), second.record_count);
    }

    #[test]
    fn snapshot_planner_reuses_priority_bucket_capacity() {
        let mut world = World::new(6000.0, 6000.0);
        assert!(world.add_player_at(1, 2500.0, 2500.0, 0.0));
        for net_id in 2..=64 {
            let ring = (net_id - 2) % 3;
            let offset = ((net_id - 2) / 3) as f32 * 4.0;
            let x = match ring {
                0 => 2600.0 + offset,
                1 => 3100.0 + offset,
                _ => 4300.0 + offset,
            };
            assert!(world.add_player_at(net_id, x, 2500.0, 0.0));
        }

        let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
        let mut session = SnapshotSession::default();
        let first =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let capacities = session
            .planner_scratch
            .buckets
            .each_ref()
            .map(|bucket| bucket.capacity());

        assert!(capacities.iter().any(|capacity| *capacity > 0));

        let second =
            session.build_from_frame(u16::MAX, 1, &frame, crate::CONSERVATIVE_DATAGRAM_BYTES);
        let reused_capacities = session
            .planner_scratch
            .buckets
            .each_ref()
            .map(|bucket| bucket.capacity());

        assert_eq!(reused_capacities, capacities);
        assert_eq!(second.record_count, first.record_count);
        assert_eq!(second.byte_composition, first.byte_composition);
        assert_eq!(second.freshness, first.freshness);
    }
}
