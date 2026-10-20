//! P8 offline handoff benchmark: 512 *synthetic* authenticated viewer records.
//! cargo run --locked --release --manifest-path server/Cargo.toml --example magic_fx_handoff_bench
//! No socket is opened. Transport framing, encryption, GPU frame rate, true
//! concurrent players, packet loss and combat tick jitter are NOT measured.

use std::time::Instant;

use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_delivery::ShardedMagicFxHub;
use myaso_server::magic_fx_events::{TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES};
use myaso_server::magic_fx_handoff::{
    FxQueueGate, TrustedFxHandoff, TrustedFxViewer,
};

const CONNECTIONS: u32 = 512;
const ZONES: u32 = 4;
const ROUNDS: u64 = 16;

fn p95_us(values: &mut [u128]) -> f64 {
    values.sort_unstable();
    let index = (values.len() * 95 / 100).min(values.len() - 1);
    values[index] as f64 / 1_000.0
}

fn main() {
    let mut hub = ShardedMagicFxHub::new();
    for zone in 1..=ZONES {
        hub.register_zone(zone).expect("trusted test zone");
    }
    for tick in 1..=4 {
        hub.advance(tick).unwrap();
        for zone in 1..=ZONES {
            for offset in 0..12 {
                hub.admit_trusted(tick, TrustedEffectSpec {
                    zone_id: zone,
                    x: offset as f32 * 5.0,
                    y: 20.0,
                    element: Element::Arcane,
                    seed: zone * 100 + offset,
                    intensity: 160,
                    ttl_ticks: 120,
                }).unwrap();
            }
        }
    }

    let mut registry = TrustedFxHandoff::new();
    let mut viewers = Vec::new();
    for index in 1..=CONNECTIONS {
        let zone = 1 + (index - 1) % ZONES;
        let route = registry.register_trusted(u64::from(index), index, zone).unwrap();
        viewers.push(TrustedFxViewer {
            route,
            view: ViewerInterest {
                zone_id: zone,
                x: 10.0,
                y: 20.0,
                radius: 700.0,
            },
            gate: FxQueueGate {
                gameplay_pending: false,
                writer_backpressured: false,
                cosmetic_slots: 1,
            },
        });
    }

    let mut times = Vec::new();
    let mut packets = 0usize;
    let mut suppressed = 0usize;
    let mut stale_routes_discarded = 0usize;
    for round in 0..ROUNDS {
        let tick = 5 + round;
        hub.advance(tick).unwrap();
        for (index, entry) in viewers.iter_mut().enumerate() {
            // Deterministic synthetic gameplay pressure and cosmetic writer
            // saturation. Neither ever costs a gameplay transport byte.
            let id = index as u64 + 1;
            entry.gate.gameplay_pending = (id + round) % 8 == 0;
            entry.gate.writer_backpressured = (id + round) % 11 == 0;
        }

        let started = Instant::now();
        let plan = registry.plan_trusted_tick(&mut hub, tick, &viewers).unwrap();
        times.push(started.elapsed().as_nanos());
        suppressed += plan.suppressed_by_gameplay_or_backpressure;
        packets += plan.cosmetic_payload_bytes / MAGIC_FX_PACKET_BYTES;
        assert_eq!(
            plan.cosmetic_payload_bytes,
            plan.routes.iter().map(|batch| batch.packets.len() * MAGIC_FX_PACKET_BYTES).sum()
        );
        for batch in &plan.routes {
            assert!(registry.route_current(batch.route));
        }

        // Simulate a trusted Core zone transfer *after* planning. Its earlier
        // cosmetic packets must be dropped rather than routed into another
        // zone/new incarnation of that connection.
        if round == 4 {
            let old = viewers[0].route;
            let new = registry.transfer_trusted(old, 2).unwrap();
            if !registry.route_current(old) {
                stale_routes_discarded += 1;
            }
            viewers[0].route = new;
            viewers[0].view.zone_id = 2;
        }
    }
    println!("scenario=synthetic_p8_authenticated_handoff connections={CONNECTIONS} zones={ZONES} rounds={ROUNDS}");
    println!("full_handoff_round_p95_us={:.3}", p95_us(&mut times));
    println!("routed_semantic_fx_packets={packets} cosmetic_payload_bytes={}", packets * MAGIC_FX_PACKET_BYTES);
    println!("suppressed_cosmetic_connection_polls={suppressed} stale_routes_discarded={stale_routes_discarded}");
    println!("NOTE: no real WebTransport connection, packet write, real frame rate or gameplay latency measured.");
}
