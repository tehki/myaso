//! P6 synthetic multi-zone FX delivery load fixture. Offline and opt-in.
//! cargo run --locked --release --manifest-path server/Cargo.toml --example magic_fx_delivery_bench
//! This measures only planner CPU and cosmetic payload, not live network,
//! browser frames, input latency, mana, colliders, or real players.

use std::time::Instant;

use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_delivery::{
    FxDeliverySession, ShardedMagicFxHub, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK,
    MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK,
};
use myaso_server::magic_fx_events::{TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES};

const VIEWERS: usize = 512;
const ZONES: u32 = 8;
const ROUNDS: usize = 16;
const EFFECTS_PER_TICK_PER_ZONE: u32 = 12;

fn percentile_95_us(values: &mut [u128]) -> f64 {
    values.sort_unstable();
    values[(values.len() * 95 / 100).min(values.len() - 1)] as f64 / 1_000.0
}

fn main() {
    let mut hub = ShardedMagicFxHub::new();
    for zone in 1..=ZONES {
        hub.register_zone(zone).expect("bounded trusted zone");
    }
    for tick in 1..=4u64 {
        hub.advance(tick).expect("monotonic server tick");
        for zone in 1..=ZONES {
            for local in 0..EFFECTS_PER_TICK_PER_ZONE {
                hub.admit_trusted(
                    tick,
                    TrustedEffectSpec {
                        zone_id: zone,
                        x: local as f32 * 3.0,
                        y: 0.0,
                        element: Element::Arcane,
                        seed: zone * 1000 + local,
                        intensity: 200,
                        ttl_ticks: 120,
                    },
                )
                .expect("accepted synthetic semantic event");
            }
        }
    }

    let mut sessions: Vec<_> = (0..VIEWERS)
        .map(|i| FxDeliverySession::new((i + 1) as u32, (i as u32 % ZONES) + 1).unwrap())
        .collect();
    let mut measures = Vec::with_capacity(VIEWERS * ROUNDS);
    let mut emitted_packets = 0usize;
    let mut nonempty_polls = 0usize;

    for round in 0..ROUNDS {
        let tick = 5 + round as u64;
        hub.advance(tick).expect("trusted monotonic advance");
        // Rotate process order to avoid consistently starving late zones
        // under an exhausted global cosmetic byte allowance.
        let start = (round * 73) % VIEWERS;
        let mut round_bytes = 0;
        for offset in 0..VIEWERS {
            let i = (start + offset) % VIEWERS;
            let zone_id = sessions[i].zone_id;
            let view = ViewerInterest {
                zone_id,
                x: 0.0,
                y: 0.0,
                radius: 700.0,
            };
            let started = Instant::now();
            let packets = hub
                .plan_delivery(tick, &mut sessions[i], view)
                .expect("authorized cosmetic-only plan");
            measures.push(started.elapsed().as_nanos());
            let bytes = packets.len() * MAGIC_FX_PACKET_BYTES;
            assert!(bytes <= MAX_FX_PAYLOAD_BYTES_PER_VIEWER_TICK);
            round_bytes += bytes;
            emitted_packets += packets.len();
            if !packets.is_empty() {
                nonempty_polls += 1;
            }
            for packet in packets {
                assert_eq!(u32::from_le_bytes(packet[4..8].try_into().unwrap()), zone_id);
            }
        }
        assert!(round_bytes <= MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
        assert_eq!(hub.stats().global_payload_bytes_this_tick, round_bytes);
    }

    println!("scenario=synthetic_magic_fx_delivery_p6 viewers={VIEWERS} zones={ZONES} rounds={ROUNDS}");
    println!("pending_events={} zone_shards={}", hub.stats().pending_fx, hub.stats().zone_shards);
    println!("planner_poll_p95_us={:.3}", percentile_95_us(&mut measures));
    println!(
        "emitted_semantic_packets={emitted_packets} payload_only_bytes={} nonempty_polls={nonempty_polls}",
        emitted_packets * MAGIC_FX_PACKET_BYTES
    );
    println!("max_cosmetic_payload_per_tick_bytes={MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK}");
    println!("NOTE: synthetic planner only; excludes network framing, real sessions, bandwidth and frame timing.");
}
