//! Reproducible P5 microbenchmark, opt-in:
//! cargo run --locked --release --example magic_fx_interest_bench
//! This is synthetic event-interest work, NOT network, browser or 512-player
//! end-to-end acceptance. Timings are machine-dependent, not release gates.

use std::time::Instant;

use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_events::{
    SemanticEffect, SemanticEffectBroker, TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES,
    MAX_VIEWER_FX_EVENTS,
};

const VIEWERS: usize = 512;
const ROUNDS: usize = 32;
const WORLD_SIZE: u32 = 8192;

fn viewer(index: u32) -> ViewerInterest {
    ViewerInterest {
        zone_id: 1 + index % 5,
        x: (index.wrapping_mul(577) % WORLD_SIZE) as f32 - 4096.0,
        y: (index.wrapping_mul(337) % WORLD_SIZE) as f32 - 4096.0,
        radius: 700.0,
    }
}

fn baseline(
    all: &[SemanticEffect],
    view: ViewerInterest,
) -> impl Iterator<Item = &SemanticEffect> {
    let radius_sq = view.radius * view.radius;
    all.iter()
        .filter(move |event| {
            if event.spec.zone_id != view.zone_id {
                return false;
            }
            let dx = event.spec.x - view.x;
            let dy = event.spec.y - view.y;
            dx.abs() <= view.radius && dy.abs() <= view.radius && dx * dx + dy * dy <= radius_sq
        })
        .take(MAX_VIEWER_FX_EVENTS)
}

fn p95_us(timing: &mut [u128]) -> f64 {
    timing.sort_unstable();
    let index = (timing.len() * 95 / 100).min(timing.len() - 1);
    timing[index] as f64 / 1_000.0
}

fn main() {
    let mut broker = SemanticEffectBroker::new();
    let mut reference = Vec::new();
    for tick in 1u64..=20 {
        broker
            .advance(tick)
            .expect("strictly increasing synthetic tick");
        for slot in 0..12u32 {
            let index = ((tick - 1) as u32) * 12 + slot;
            let spec = TrustedEffectSpec {
                zone_id: 1 + index % 5,
                x: (index.wrapping_mul(257) % WORLD_SIZE) as f32 - 4096.0,
                y: (index.wrapping_mul(461) % WORLD_SIZE) as f32 - 4096.0,
                element: Element::Arcane,
                seed: index,
                intensity: 127,
                ttl_ticks: 120,
            };
            let event_id = broker
                .admit_trusted(tick, spec)
                .expect("within zone/process/tick caps");
            reference.push(SemanticEffect {
                event_id,
                server_tick: tick as u32,
                expires_at: tick + 120,
                spec,
            });
        }
    }
    assert_eq!(reference.len(), 240);
    let viewers: Vec<ViewerInterest> = (0..VIEWERS as u32).map(viewer).collect();

    // Correctness gate *before* measurements: globally ordered results must
    // match the original 256-event linear scan for every synthetic viewer.
    for view in &viewers {
        let expected: Vec<u32> = baseline(&reference, *view).map(|e| e.event_id).collect();
        let actual: Vec<u32> = broker
            .interest_snapshot(*view, 0, 16)
            .iter()
            .map(|e| e.event_id)
            .collect();
        assert_eq!(actual, expected, "indexed/linear interest mismatch");
    }

    let mut indexed_times = Vec::with_capacity(VIEWERS * ROUNDS);
    let mut linear_times = Vec::with_capacity(VIEWERS * ROUNDS);
    let mut examined = 0usize;
    let mut visited = 0usize;
    let mut returned = 0usize;
    let mut digest_a = 0u64;
    let mut digest_b = 0u64;

    for _ in 0..ROUNDS {
        for view in &viewers {
            let at = Instant::now();
            let (events, stats) = broker.interest_snapshot_with_stats(*view, 0, 16);
            indexed_times.push(at.elapsed().as_nanos());
            examined += stats.examined_events;
            visited += stats.visited_cells;
            returned += events.len();
            for event in events {
                digest_a = digest_a.wrapping_add(u64::from(event.event_id));
            }
        }
    }
    for _ in 0..ROUNDS {
        for view in &viewers {
            let at = Instant::now();
            let events: Vec<&SemanticEffect> = baseline(&reference, *view).collect();
            linear_times.push(at.elapsed().as_nanos());
            for event in events {
                digest_b = digest_b.wrapping_add(u64::from(event.event_id));
            }
        }
    }
    assert_eq!(digest_a, digest_b, "sampled visibility must be equivalent");

    println!("scenario=synthetic_magic_fx_p5 index=zone_grid_512");
    println!(
        "viewers_per_round={VIEWERS} rounds={ROUNDS} pending_fx={} zone_count=5 active_cells={}",
        broker.pending(),
        broker.index_stats().active_cells
    );
    println!(
        "indexed_p95_us={:.3} linear_p95_us={:.3}",
        p95_us(&mut indexed_times),
        p95_us(&mut linear_times)
    );
    println!(
        "candidate_events_read={} full_scan_equivalent={} visited_cells={}",
        examined,
        reference.len() * VIEWERS * ROUNDS,
        visited
    );
    println!(
        "effect_events_in_results={} semantic_payload_bytes={} checksum={}",
        returned,
        returned * MAGIC_FX_PACKET_BYTES,
        digest_a
    );
    println!("NOTE: standalone broker benchmark; excludes transport, browser graphics, actor admission, world physics and live concurrency.");
}
