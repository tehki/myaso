use anyhow::{bail, Context, Result};
use myaso_server::{
    simulation::{InputIntent, World, SERVER_TICK_HZ},
    snapshot::{ReplicationFrame, SnapshotSession},
    CONSERVATIVE_DATAGRAM_BYTES, TARGET_PLAYERS_PER_MAP,
};
use std::{env, fs, time::Instant};

const SNAPSHOT_EVERY_TICKS: u32 = 3;
const INPUT_PAYLOAD_BYTES_PER_SECOND: f64 = 34.0 * 60.0;
const ACK_PAYLOAD_BYTES_PER_SECOND: f64 = 16.0 * 20.0;

#[derive(Debug, Clone, Copy)]
struct Scenario {
    players: usize,
    warmup_ticks: u32,
    measured_ticks: u32,
}

#[derive(Debug, Clone, Copy, Default)]
struct ByteCompositionTotals {
    header: u64,
    net_ids: u64,
    masks: u64,
    position: u64,
    facing: u64,
    vitals: u64,
    action: u64,
}

#[derive(Debug)]
struct CapacityReport {
    players: usize,
    measured_ticks: u32,
    snapshots_built: usize,
    tick_ms_p50: f64,
    tick_ms_p95: f64,
    tick_ms_p99: f64,
    tick_ms_max: f64,
    replication_batch_ms_p50: f64,
    replication_batch_ms_p95: f64,
    replication_batch_ms_p99: f64,
    replication_batch_ms_max: f64,
    avg_snapshot_bytes: f64,
    max_snapshot_bytes: usize,
    snapshot_bytes_per_player_second: f64,
    estimated_payload_bytes_per_player_second: f64,
    avg_records_per_snapshot: f64,
    omission_ratio: f64,
    reconnect_samples: usize,
    reconnect_build_ms_p95: f64,
    reconnect_avg_snapshot_bytes: f64,
    reconnect_omission_ratio: f64,
    frame_build_ms_p95: f64,
    avg_interest_candidates_checked: f64,
    avg_visible_entities: f64,
    candidate_scan_ratio: f64,
    freshness_max_due_age_ticks: [u32; 4],
    freshness_max_omitted_age_ticks: [u32; 4],
    freshness_deadline_misses: [u64; 4],
    max_history_depth: usize,
    rss_growth_bytes: Option<u64>,
    rss_growth_bytes_per_session: Option<u64>,
    target_60hz_tick_met: bool,
    target_20hz_replication_batch_met: bool,
    byte_composition: ByteCompositionTotals,
}

impl CapacityReport {
    fn to_json(&self) -> String {
        format!(
            concat!(
                "{{",
                "\"players\":{},",
                "\"measured_ticks\":{},",
                "\"snapshots_built\":{},",
                "\"tick_ms\":{{\"p50\":{:.3},\"p95\":{:.3},\"p99\":{:.3},\"max\":{:.3}}},",
                "\"replication_batch_ms\":{{\"p50\":{:.3},\"p95\":{:.3},\"p99\":{:.3},\"max\":{:.3}}},",
                "\"avg_snapshot_bytes\":{:.1},",
                "\"max_snapshot_bytes\":{},",
                "\"snapshot_bytes_per_player_second\":{:.1},",
                "\"estimated_payload_bytes_per_player_second\":{:.1},",
                "\"avg_records_per_snapshot\":{:.2},",
                "\"omission_ratio\":{:.6},",
                "\"reconnect\":{{\"samples\":{},\"build_ms_p95\":{:.3},\"avg_snapshot_bytes\":{:.1},\"omission_ratio\":{:.6}}},",
                "\"planner\":{{\"frame_build_ms_p95\":{:.3},\"avg_interest_candidates_checked\":{:.2},\"avg_visible_entities\":{:.2},\"candidate_scan_ratio\":{:.6},\"freshness_max_due_age_ticks\":{{\"combat\":{},\"near\":{},\"mid\":{},\"far\":{}}},\"freshness_max_omitted_age_ticks\":{{\"combat\":{},\"near\":{},\"mid\":{},\"far\":{}}},\"freshness_deadline_misses\":{{\"combat\":{},\"near\":{},\"mid\":{},\"far\":{}}},\"max_history_depth\":{}}},",
                "\"rss_growth_bytes\":{},",
                "\"rss_growth_bytes_per_session\":{},",
                "\"target_60hz_tick_met\":{},",
                "\"target_20hz_replication_batch_met\":{}",
                "}}"
            ),
            self.players,
            self.measured_ticks,
            self.snapshots_built,
            self.tick_ms_p50,
            self.tick_ms_p95,
            self.tick_ms_p99,
            self.tick_ms_max,
            self.replication_batch_ms_p50,
            self.replication_batch_ms_p95,
            self.replication_batch_ms_p99,
            self.replication_batch_ms_max,
            self.avg_snapshot_bytes,
            self.max_snapshot_bytes,
            self.snapshot_bytes_per_player_second,
            self.estimated_payload_bytes_per_player_second,
            self.avg_records_per_snapshot,
            self.omission_ratio,
            self.reconnect_samples,
            self.reconnect_build_ms_p95,
            self.reconnect_avg_snapshot_bytes,
            self.reconnect_omission_ratio,
            self.frame_build_ms_p95,
            self.avg_interest_candidates_checked,
            self.avg_visible_entities,
            self.candidate_scan_ratio,
            self.freshness_max_due_age_ticks[0],
            self.freshness_max_due_age_ticks[1],
            self.freshness_max_due_age_ticks[2],
            self.freshness_max_due_age_ticks[3],
            self.freshness_max_omitted_age_ticks[0],
            self.freshness_max_omitted_age_ticks[1],
            self.freshness_max_omitted_age_ticks[2],
            self.freshness_max_omitted_age_ticks[3],
            self.freshness_deadline_misses[0],
            self.freshness_deadline_misses[1],
            self.freshness_deadline_misses[2],
            self.freshness_deadline_misses[3],
            self.max_history_depth,
            json_optional_u64(self.rss_growth_bytes),
            json_optional_u64(self.rss_growth_bytes_per_session),
            self.target_60hz_tick_met,
            self.target_20hz_replication_batch_met,
        )
    }
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    let scenario = Scenario {
        players: parse_usize_arg(&args, 0, TARGET_PLAYERS_PER_MAP)?,
        warmup_ticks: parse_u32_arg(&args, 1, 15)?,
        measured_ticks: parse_u32_arg(&args, 2, 60)?,
    };
    validate_scenario(scenario)?;

    let report = run_scenario(scenario)?;
    validate_report(&report)?;
    println!("M8_CAPACITY {}", report.to_json());
    println!(
        "M18_BYTE_COMPOSITION {}",
        report
            .byte_composition
            .to_json(report.players, report.snapshots_built)
    );
    Ok(())
}

fn parse_usize_arg(args: &[String], index: usize, fallback: usize) -> Result<usize> {
    args.get(index)
        .map(|value| {
            value
                .parse::<usize>()
                .with_context(|| format!("argument {} must be an integer", index + 1))
        })
        .unwrap_or(Ok(fallback))
}

fn parse_u32_arg(args: &[String], index: usize, fallback: u32) -> Result<u32> {
    args.get(index)
        .map(|value| {
            value
                .parse::<u32>()
                .with_context(|| format!("argument {} must be an integer", index + 1))
        })
        .unwrap_or(Ok(fallback))
}

fn validate_scenario(scenario: Scenario) -> Result<()> {
    if !(1..=TARGET_PLAYERS_PER_MAP).contains(&scenario.players) {
        bail!(
            "players must be in [1, {}] for the M8 single-map probe",
            TARGET_PLAYERS_PER_MAP
        );
    }
    if scenario.warmup_ticks < SNAPSHOT_EVERY_TICKS
        || scenario.measured_ticks < SNAPSHOT_EVERY_TICKS * 2
    {
        bail!("warmup/measured tick counts are too small for stable snapshot evidence");
    }
    Ok(())
}

fn run_scenario(scenario: Scenario) -> Result<CapacityReport> {
    let mut world = World::default();
    for net_id in 1..=scenario.players as u32 {
        if !world.add_player(net_id) {
            bail!("failed to add player {net_id}");
        }
    }

    let mut sessions: Vec<_> = (0..scenario.players)
        .map(|_| SnapshotSession::default())
        .collect();
    let mut acknowledged_snapshots = vec![u16::MAX; scenario.players];
    let rss_before = current_rss_bytes();

    for _ in 0..scenario.warmup_ticks {
        drive_tick(&mut world, &mut sessions, &mut acknowledged_snapshots, None);
    }

    let snapshot_capacity = (scenario.measured_ticks / SNAPSHOT_EVERY_TICKS + 1) as usize;
    let mut measurements = ProbeMeasurements {
        tick_samples: Vec::with_capacity(scenario.measured_ticks as usize),
        replication_samples: Vec::with_capacity(snapshot_capacity),
        frame_build_samples: Vec::with_capacity(snapshot_capacity),
        totals: SnapshotTotals::default(),
    };

    for _ in 0..scenario.measured_ticks {
        drive_tick(
            &mut world,
            &mut sessions,
            &mut acknowledged_snapshots,
            Some(&mut measurements),
        );
    }

    let rss_after = current_rss_bytes();
    let rss_growth_bytes = match (rss_before, rss_after) {
        (Some(before), Some(after)) => Some(after.saturating_sub(before)),
        _ => None,
    };
    let rss_growth_bytes_per_session =
        rss_growth_bytes.map(|bytes| bytes / scenario.players.max(1) as u64);

    let reconnect_samples = scenario.players.min(32);
    let reconnect_frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    let mut reconnect_build_samples = Vec::with_capacity(reconnect_samples);
    let mut reconnect_totals = SnapshotTotals::default();
    for sample in 0..reconnect_samples {
        let viewer_index = sample * scenario.players / reconnect_samples;
        let viewer_net_id = viewer_index as u32 + 1;
        let mut session = SnapshotSession::default();
        let started = Instant::now();
        let build = session.build_from_frame(
            u16::MAX,
            viewer_net_id,
            &reconnect_frame,
            CONSERVATIVE_DATAGRAM_BYTES,
        );
        reconnect_build_samples.push(elapsed_ms(started));
        reconnect_totals.observe(&build);
    }

    let measured_seconds = scenario.measured_ticks as f64 / SERVER_TICK_HZ as f64;
    let snapshot_bytes_per_player_second =
        measurements.totals.bytes as f64 / scenario.players as f64 / measured_seconds;
    let estimated_payload_bytes_per_player_second = snapshot_bytes_per_player_second
        + INPUT_PAYLOAD_BYTES_PER_SECOND
        + ACK_PAYLOAD_BYTES_PER_SECOND;
    let tick_ms_p95 = percentile(&measurements.tick_samples, 0.95);
    let replication_batch_ms_p95 = percentile(&measurements.replication_samples, 0.95);
    let target_tick_ms = 1000.0 / SERVER_TICK_HZ as f64;
    let target_replication_ms = 1000.0 / (SERVER_TICK_HZ as f64 / SNAPSHOT_EVERY_TICKS as f64);

    Ok(CapacityReport {
        players: scenario.players,
        measured_ticks: scenario.measured_ticks,
        snapshots_built: measurements.totals.snapshots,
        tick_ms_p50: percentile(&measurements.tick_samples, 0.50),
        tick_ms_p95,
        tick_ms_p99: percentile(&measurements.tick_samples, 0.99),
        tick_ms_max: max_sample(&measurements.tick_samples),
        replication_batch_ms_p50: percentile(&measurements.replication_samples, 0.50),
        replication_batch_ms_p95,
        replication_batch_ms_p99: percentile(&measurements.replication_samples, 0.99),
        replication_batch_ms_max: max_sample(&measurements.replication_samples),
        avg_snapshot_bytes: measurements.totals.average_bytes(),
        max_snapshot_bytes: measurements.totals.max_bytes,
        snapshot_bytes_per_player_second,
        estimated_payload_bytes_per_player_second,
        avg_records_per_snapshot: measurements.totals.average_records(),
        omission_ratio: measurements.totals.omission_ratio(),
        reconnect_samples,
        reconnect_build_ms_p95: percentile(&reconnect_build_samples, 0.95),
        reconnect_avg_snapshot_bytes: reconnect_totals.average_bytes(),
        reconnect_omission_ratio: reconnect_totals.omission_ratio(),
        frame_build_ms_p95: percentile(&measurements.frame_build_samples, 0.95),
        avg_interest_candidates_checked: measurements.totals.average_interest_candidates_checked(),
        avg_visible_entities: measurements.totals.average_visible_entities(),
        candidate_scan_ratio: measurements.totals.average_interest_candidates_checked()
            / scenario.players as f64,
        freshness_max_due_age_ticks: measurements.totals.freshness_max_due_age_ticks,
        freshness_max_omitted_age_ticks: measurements.totals.freshness_max_omitted_age_ticks,
        freshness_deadline_misses: measurements.totals.freshness_deadline_misses,
        max_history_depth: sessions
            .iter()
            .map(SnapshotSession::history_depth)
            .max()
            .unwrap_or(0),
        rss_growth_bytes,
        rss_growth_bytes_per_session,
        target_60hz_tick_met: tick_ms_p95 <= target_tick_ms,
        target_20hz_replication_batch_met: replication_batch_ms_p95 <= target_replication_ms,
        byte_composition: measurements.totals.byte_composition,
    })
}

fn drive_tick(
    world: &mut World,
    sessions: &mut [SnapshotSession],
    acknowledged_snapshots: &mut [u16],
    mut measurements: Option<&mut ProbeMeasurements>,
) {
    let next_tick = world.tick.wrapping_add(1);
    for net_id in 1..=sessions.len() as u32 {
        let _ = world.set_input(net_id, deterministic_input(net_id, next_tick));
    }

    let tick_started = Instant::now();
    let _events = world.step();
    if let Some(measurements) = measurements.as_deref_mut() {
        measurements.tick_samples.push(elapsed_ms(tick_started));
    }

    if world.tick % SNAPSHOT_EVERY_TICKS != 0 {
        return;
    }

    let replication_started = Instant::now();
    let frame_started = Instant::now();
    let frame = ReplicationFrame::from_fighters(world.tick, world.fighters());
    if let Some(measurements) = measurements.as_deref_mut() {
        measurements
            .frame_build_samples
            .push(elapsed_ms(frame_started));
    }
    for (index, session) in sessions.iter_mut().enumerate() {
        let build = session.build_from_frame(
            acknowledged_snapshots[index],
            index as u32 + 1,
            &frame,
            CONSERVATIVE_DATAGRAM_BYTES,
        );
        acknowledged_snapshots[index] = build.sequence;
        if let Some(measurements) = measurements.as_deref_mut() {
            measurements.totals.observe(&build);
        }
    }
    if let Some(measurements) = measurements {
        measurements
            .replication_samples
            .push(elapsed_ms(replication_started));
    }
}

fn deterministic_input(net_id: u32, tick: u32) -> InputIntent {
    let phase = (net_id as f32 * 0.618_034 + tick as f32 * 0.031_25) % std::f32::consts::TAU;
    InputIntent {
        move_x: phase.cos() * 0.82,
        move_y: phase.sin() * 0.82,
        facing_radians: phase + 0.4,
        attack: tick.wrapping_add(net_id.wrapping_mul(11)) % 97 == 0,
        heavy_attack: false,
        dodge: tick.wrapping_add(net_id.wrapping_mul(7)) % 181 == 0,
        block: tick.wrapping_add(net_id.wrapping_mul(13)) % 127 < 4,
    }
}

#[derive(Debug, Default)]
struct ProbeMeasurements {
    tick_samples: Vec<f64>,
    replication_samples: Vec<f64>,
    frame_build_samples: Vec<f64>,
    totals: SnapshotTotals,
}

#[derive(Debug, Default)]
struct SnapshotTotals {
    snapshots: usize,
    bytes: u64,
    max_bytes: usize,
    records: u64,
    omitted: u64,
    interest_candidates_checked: u64,
    visible_entities: u64,
    freshness_max_due_age_ticks: [u32; 4],
    freshness_max_omitted_age_ticks: [u32; 4],
    freshness_deadline_misses: [u64; 4],
    byte_composition: ByteCompositionTotals,
}

impl ByteCompositionTotals {
    fn observe(&mut self, c: myaso_server::snapshot::SnapshotByteComposition) {
        self.header += c.header as u64;
        self.net_ids += c.net_ids as u64;
        self.masks += c.masks as u64;
        self.position += c.position as u64;
        self.facing += c.facing as u64;
        self.vitals += c.vitals as u64;
        self.action += c.action as u64;
    }

    fn total(self) -> u64 {
        self.header
            + self.net_ids
            + self.masks
            + self.position
            + self.facing
            + self.vitals
            + self.action
    }

    fn average(value: u64, snapshots: usize) -> f64 {
        if snapshots == 0 {
            0.0
        } else {
            value as f64 / snapshots as f64
        }
    }

    fn share(self, value: u64) -> f64 {
        let total = self.total();
        if total == 0 {
            0.0
        } else {
            value as f64 / total as f64
        }
    }

    fn to_json(self, players: usize, snapshots: usize) -> String {
        format!(
            r#"{{"players":{},"snapshots":{},"avg_bytes":{{"header":{:.3},"net_ids":{:.3},"masks":{:.3},"position":{:.3},"facing":{:.3},"vitals":{:.3},"action":{:.3}}},"share":{{"header":{:.6},"net_ids":{:.6},"masks":{:.6},"position":{:.6},"facing":{:.6},"vitals":{:.6},"action":{:.6}}}}}"#,
            players,
            snapshots,
            Self::average(self.header, snapshots),
            Self::average(self.net_ids, snapshots),
            Self::average(self.masks, snapshots),
            Self::average(self.position, snapshots),
            Self::average(self.facing, snapshots),
            Self::average(self.vitals, snapshots),
            Self::average(self.action, snapshots),
            self.share(self.header),
            self.share(self.net_ids),
            self.share(self.masks),
            self.share(self.position),
            self.share(self.facing),
            self.share(self.vitals),
            self.share(self.action),
        )
    }
}

impl SnapshotTotals {
    fn observe(&mut self, build: &myaso_server::snapshot::SnapshotBuild) {
        self.snapshots += 1;
        self.bytes += build.bytes.len() as u64;
        self.max_bytes = self.max_bytes.max(build.bytes.len());
        self.records += build.record_count as u64;
        self.omitted += build.omitted_due_to_budget as u64;
        self.interest_candidates_checked += build.interest_candidates_checked as u64;
        self.visible_entities += build.visible_entity_count as u64;
        self.byte_composition.observe(build.byte_composition);
        let freshness = [
            build.freshness.combat,
            build.freshness.near,
            build.freshness.mid,
            build.freshness.far,
        ];
        for (index, tier) in freshness.into_iter().enumerate() {
            self.freshness_max_due_age_ticks[index] =
                self.freshness_max_due_age_ticks[index].max(tier.max_due_age_ticks);
            self.freshness_max_omitted_age_ticks[index] =
                self.freshness_max_omitted_age_ticks[index].max(tier.max_omitted_age_ticks);
            self.freshness_deadline_misses[index] += tier.deadline_misses as u64;
        }
    }

    fn average_bytes(&self) -> f64 {
        if self.snapshots == 0 {
            0.0
        } else {
            self.bytes as f64 / self.snapshots as f64
        }
    }

    fn average_interest_candidates_checked(&self) -> f64 {
        if self.snapshots == 0 {
            0.0
        } else {
            self.interest_candidates_checked as f64 / self.snapshots as f64
        }
    }

    fn average_visible_entities(&self) -> f64 {
        if self.snapshots == 0 {
            0.0
        } else {
            self.visible_entities as f64 / self.snapshots as f64
        }
    }

    fn average_records(&self) -> f64 {
        if self.snapshots == 0 {
            0.0
        } else {
            self.records as f64 / self.snapshots as f64
        }
    }

    fn omission_ratio(&self) -> f64 {
        let due = self.records + self.omitted;
        if due == 0 {
            0.0
        } else {
            self.omitted as f64 / due as f64
        }
    }
}

fn elapsed_ms(started: Instant) -> f64 {
    started.elapsed().as_secs_f64() * 1000.0
}

fn percentile(samples: &[f64], fraction: f64) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    let mut ordered = samples.to_vec();
    ordered.sort_by(f64::total_cmp);
    let index = (((ordered.len() - 1) as f64) * fraction)
        .ceil()
        .min((ordered.len() - 1) as f64) as usize;
    ordered[index]
}

fn max_sample(samples: &[f64]) -> f64 {
    samples.iter().copied().fold(0.0, f64::max)
}

fn current_rss_bytes() -> Option<u64> {
    let status = fs::read_to_string("/proc/self/status").ok()?;
    let line = status.lines().find(|line| line.starts_with("VmRSS:"))?;
    let kib = line.split_whitespace().nth(1)?.parse::<u64>().ok()?;
    Some(kib.saturating_mul(1024))
}

fn json_optional_u64(value: Option<u64>) -> String {
    value
        .map(|number| number.to_string())
        .unwrap_or_else(|| "null".to_string())
}

fn validate_report(report: &CapacityReport) -> Result<()> {
    if report.snapshots_built == 0 {
        bail!("capacity probe produced no snapshots");
    }
    if report.max_snapshot_bytes > CONSERVATIVE_DATAGRAM_BYTES {
        bail!(
            "snapshot exceeded datagram budget: {} > {}",
            report.max_snapshot_bytes,
            CONSERVATIVE_DATAGRAM_BYTES
        );
    }
    for value in [
        report.tick_ms_p95,
        report.replication_batch_ms_p95,
        report.snapshot_bytes_per_player_second,
        report.omission_ratio,
        report.reconnect_build_ms_p95,
        report.reconnect_omission_ratio,
        report.frame_build_ms_p95,
        report.avg_interest_candidates_checked,
        report.avg_visible_entities,
        report.candidate_scan_ratio,
    ] {
        if !value.is_finite() || value < 0.0 {
            bail!("capacity report contains an invalid measurement");
        }
    }
    if report.omission_ratio > 1.0 || report.reconnect_omission_ratio > 1.0 {
        bail!("omission ratio escaped [0, 1]");
    }
    if report.candidate_scan_ratio > 1.0 {
        bail!("spatial candidate scan ratio escaped [0, 1]");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn small_capacity_probe_preserves_protocol_bounds() {
        let report = run_scenario(Scenario {
            players: 8,
            warmup_ticks: 3,
            measured_ticks: 6,
        })
        .expect("small capacity scenario");

        validate_report(&report).expect("valid report");
        assert_eq!(report.players, 8);
        assert_eq!(report.snapshots_built, 16);
        assert!(report.max_snapshot_bytes <= CONSERVATIVE_DATAGRAM_BYTES);
        assert_eq!(report.reconnect_samples, 8);
    }
}
