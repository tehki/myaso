//! P10: real concurrent WebTransport loopback crowd acceptance sidecar.
//!
//! This never binds a public interface, imports gameplay/casting state, or
//! changes the playable /game protocol. It uses a single shared P6/P7 hub
//! and P8 handoff registry for *genuinely concurrent* QUIC test connections.
//! No client message can select its own ID, position, zone, or FX event.

use anyhow::{bail, Context, Result};
use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_delivery::{
    ShardedMagicFxHub, MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK, MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK,
};
use myaso_server::magic_fx_events::{TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES};
use myaso_server::magic_fx_handoff::{FxQueueGate, FxRoute, TrustedFxHandoff, TrustedFxViewer};
use myaso_server::magic_fx_shared_transport::{
    plan_shared_dispatch, CoreGameplayDatagram, CoreWriterCapacity, SharedPriority,
};
use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::MissedTickBehavior;
use wtransport::{Connection, Endpoint, Identity, ServerConfig};

const PATH: &str = "/physics-fx-crowd";
const ZONE: u32 = 7;
const DEFAULT_TICKS: u64 = 115;
const MAX_TICKS: u64 = 350;
const FX_START_TICK: u64 = 21;
const MAX_LAB_CONNECTIONS: usize = 64;

#[tokio::main]
async fn main() -> Result<()> {
    let expected: usize = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "16".to_owned())
        .parse()
        .context("P10 expected connection count must be a decimal integer")?;
    if !(2..=MAX_LAB_CONNECTIONS).contains(&expected) {
        bail!("P10 expected connections must be 2..={MAX_LAB_CONNECTIONS}");
    }
    // Optional longer P11 shared-host contention window, validated and
    // bounded. The existing P10 115-tick acceptance is unchanged by default.
    let total_ticks = std::env::var("P10_LAB_TICKS")
        .ok()
        .map(|s| s.parse::<u64>())
        .transpose()
        .context("P10_LAB_TICKS must be an integer")?
        .unwrap_or(DEFAULT_TICKS);
    if !(DEFAULT_TICKS..=MAX_TICKS).contains(&total_ticks) {
        bail!("P10_LAB_TICKS must be between {DEFAULT_TICKS} and {MAX_TICKS}");
    }
    // P13 is a strictly opt-in shared-writer laboratory exercise. The
    // existing P10/P11 real-crowd tests remain bit-for-bit unchanged.
    let shared_dispatch = match std::env::var("P13_SHARED_DISPATCH") {
        Ok(value) if value == "1" => true,
        Ok(value) if value == "0" => false,
        Err(std::env::VarError::NotPresent) => false,
        _ => bail!("P13_SHARED_DISPATCH must be 0 or 1"),
    };
    let addr: SocketAddr = "127.0.0.1:0".parse().expect("loopback literal");
    let identity = Identity::self_signed(["localhost", "127.0.0.1", "::1"])
        .context("P10 ephemeral loopback identity")?;
    let hash = identity
        .certificate_chain()
        .as_slice()
        .first()
        .context("P10 certificate was empty")?
        .hash()
        .to_string();
    let config = ServerConfig::builder()
        .with_bind_address(addr)
        .with_identity(identity)
        .keep_alive_interval(Some(Duration::from_secs(2)))
        .build();
    let endpoint = Arc::new(Endpoint::server(config).context("P10 loopback endpoint")?);
    let local = endpoint.local_addr().context("P10 bound address")?;
    println!("P10_LOOPBACK_LISTENING https://{local}{PATH}");
    println!("P10_CERT_SHA256 {hash}");

    let (tx, mut accepted) = mpsc::channel::<Connection>(MAX_LAB_CONNECTIONS);
    let accept_endpoint = Arc::clone(&endpoint);
    let _accept_task = tokio::spawn(async move {
        loop {
            let incoming = accept_endpoint.accept().await;
            let tx = tx.clone();
            // Each HTTP/3 handshake must run independently (P9 regression).
            tokio::spawn(async move {
                let request = match incoming.await {
                    Ok(request) => request,
                    Err(error) => {
                        eprintln!("P10_HANDSHAKE_FAILED {error}");
                        return;
                    }
                };
                if request.path() != PATH {
                    request.not_found().await;
                    return;
                }
                match request.accept().await {
                    Ok(connection) => {
                        if tx.send(connection).await.is_err() {
                            eprintln!("P10 receiver closed during handshake");
                        }
                    }
                    Err(error) => eprintln!("P10_SESSION_ACCEPT_FAILED {error}"),
                }
            });
        }
    });

    // Barrier: start shared authoritative test ticks only after all real
    // connections are accepted. Do not report synthetic/background actors.
    let mut connections = BTreeMap::<u64, (Arc<Connection>, FxRoute)>::new();
    let mut handoff = TrustedFxHandoff::new();
    for id in 1..=expected {
        let connection = tokio::time::timeout(Duration::from_secs(45), accepted.recv())
            .await
            .context("P10 timed out accepting real QUIC connections")?
            .context("P10 accept worker ended")?;
        let route = handoff
            .register_trusted(id as u64, id as u32, ZONE)
            .expect("P10 trusted fixture registration");
        let connection = Arc::new(connection);
        let reader = Arc::clone(&connection);
        tokio::spawn(async move {
            // Test-only PI ping -> PO echo. Unknown browser bytes are ignored.
            while let Ok(message) = reader.receive_datagram().await {
                let input = message.as_ref();
                if input.len() != 6 || &input[..2] != b"PI" {
                    continue;
                }
                let mut reply = [0u8; 6];
                reply[..2].copy_from_slice(b"PO");
                reply[2..].copy_from_slice(&input[2..]);
                if reader.send_datagram(reply).is_err() {
                    break;
                }
            }
        });
        connections.insert(id as u64, (connection, route));
    }
    println!("P10_REAL_CONNECTIONS_ACCEPTED {}", connections.len());

    let mut hub = ShardedMagicFxHub::new();
    hub.register_zone(ZONE).expect("trusted fixture zone");
    let mut clock = tokio::time::interval(Duration::from_millis(30));
    clock.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut total_gp = 0usize;
    let mut total_fx_bytes = 0usize;
    let mut blocked_cosmetic_polls = 0usize;
    let mut shared_gameplay_sent = 0usize;
    let mut shared_visual_sent = 0usize;
    let mut shared_visual_dropped = 0usize;
    let mut shared_congested_ticks = 0usize;
    for tick in 1..=total_ticks {
        clock.tick().await;
        hub.advance(tick)
            .expect("strictly increasing P10 fixture tick");

        // Real QUIC datagram markers are sent FIRST to every real connection.
        // The marker is NOT a real gameplay snapshot/ACK and does not imply
        // combat QoS or independent-network readiness.
        let mut marker = [0u8; 6];
        marker[..2].copy_from_slice(b"GP");
        marker[2..].copy_from_slice(&(tick as u32).to_le_bytes());
        if !shared_dispatch {
            for (connection, _) in connections.values() {
                connection
                    .send_datagram(marker)
                    .context("P10 test gameplay marker")?;
                total_gp += 1;
            }
        }

        if tick >= FX_START_TICK {
            hub.admit_trusted(
                tick,
                TrustedEffectSpec {
                    zone_id: ZONE,
                    x: 12.5,
                    y: -7.25,
                    element: Element::Wind,
                    seed: tick as u32,
                    intensity: 160,
                    ttl_ticks: 40,
                },
            )
            .expect("bounded trusted P10 event");
        }
        let viewers: Vec<TrustedFxViewer> = connections
            .iter()
            .map(|(connection_id, (_, route))| {
                let gated = tick % 7 == 0 || (tick % 11 == 0 && connection_id % 4 == 0);
                TrustedFxViewer {
                    route: *route,
                    view: ViewerInterest {
                        zone_id: ZONE,
                        x: 12.5,
                        y: -7.25,
                        radius: 700.0,
                    },
                    gate: FxQueueGate {
                        gameplay_pending: gated,
                        writer_backpressured: false,
                        cosmetic_slots: 1,
                    },
                }
            })
            .collect();
        let plan = handoff
            .plan_trusted_tick(&mut hub, tick, &viewers)
            .expect("valid P10 batch");
        blocked_cosmetic_polls += plan.suppressed_by_gameplay_or_backpressure;
        assert!(plan.cosmetic_payload_bytes <= MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK);
        assert!(plan.cosmetic_payload_bytes <= MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
        if shared_dispatch {
            // P13: REAL QUIC writes on the SAME test connection for GP and
            // ME, but every GP test payload is first validated/reserved by
            // the P12 gameplay-first dispatch planner.
            let gameplay: Vec<CoreGameplayDatagram> = connections
                .values()
                .map(|(_, route)| CoreGameplayDatagram {
                    route: *route,
                    bytes: marker.to_vec(),
                })
                .collect();
            let writers: Vec<CoreWriterCapacity> = connections
                .values()
                .map(|(_, route)| CoreWriterCapacity {
                    route: *route,
                    // Simulated cosmetic congestion every fifth tick:
                    // gameplay retains its slot; optional FX must drop.
                    available_datagrams: if tick % 5 == 0 { 1 } else { 2 },
                    gameplay_waiting: false,
                    backpressured: false,
                })
                .collect();
            let dispatch = plan_shared_dispatch(&handoff, &gameplay, &plan, &writers)
                .expect("P13 game payload and trusted routes always have capacity");
            assert_eq!(dispatch.gameplay_datagrams, connections.len());
            assert!(dispatch.ordered.len() >= connections.len());
            assert!(dispatch.ordered[..connections.len()]
                .iter()
                .all(|packet| packet.priority == SharedPriority::Gameplay));
            assert!(dispatch.ordered[connections.len()..]
                .iter()
                .all(|packet| packet.priority == SharedPriority::Cosmetic));
            assert!(dispatch.cosmetic_payload_bytes <= MAX_FX_PAYLOAD_BYTES_PER_ZONE_TICK);
            assert!(dispatch.cosmetic_payload_bytes <= MAX_FX_PAYLOAD_BYTES_GLOBAL_TICK);
            if tick % 5 == 0 {
                assert_eq!(dispatch.cosmetic_datagrams, 0);
                shared_congested_ticks += 1;
            }
            shared_gameplay_sent += dispatch.gameplay_datagrams;
            shared_visual_sent += dispatch.cosmetic_datagrams;
            shared_visual_dropped += dispatch.cosmetic_dropped;
            total_gp += dispatch.gameplay_datagrams;
            total_fx_bytes += dispatch.cosmetic_payload_bytes;
            for payload in &dispatch.ordered {
                if !handoff.route_current(payload.route) {
                    bail!("P13 stale route detected at final loopback enqueue");
                }
                let (connection, _) = connections
                    .get(&payload.route.connection_id)
                    .context("P13 connection missing at final loopback enqueue")?;
                connection
                    .send_datagram(payload.bytes)
                    .context("P13 real shared-connection QUIC datagram")?;
            }
        } else {
            total_fx_bytes += plan.cosmetic_payload_bytes;
            for batch in plan.routes {
                if !handoff.route_current(batch.route) {
                    continue;
                }
                if let Some((connection, _)) = connections.get(&batch.route.connection_id) {
                    for packet in batch.packets {
                        connection
                            .send_datagram(packet)
                            .context("P10 real cosmetic FX QUIC datagram")?;
                    }
                }
            }
        }
    }
    println!(
        "P10_REAL_CROWD_SUMMARY connections={} ticks={total_ticks} gameplay_markers_sent={total_gp} cosmetic_payload_bytes={total_fx_bytes} semantic_packets={} suppressed_optional_polls={blocked_cosmetic_polls}",
        connections.len(),
        total_fx_bytes / MAGIC_FX_PACKET_BYTES
    );
    if shared_dispatch {
        assert_eq!(shared_gameplay_sent, expected * total_ticks as usize);
        assert!(shared_visual_sent > 0);
        assert!(shared_visual_dropped > 0);
        assert!(shared_congested_ticks > 0);
        println!(
            "P13_SHARED_DISPATCH_SUMMARY connections={expected} ticks={total_ticks} gameplay_sent={shared_gameplay_sent} fx_sent={shared_visual_sent} cosmetic_dropped={shared_visual_dropped} congestion_ticks={shared_congested_ticks}"
        );
    }
    // Keep QUIC sessions available through the browser measurement/report
    // window. Closing the whole endpoint immediately after tick 115 caused
    // spurious "Connection lost" errors despite successful real receipts.
    // This is a test-only bounded drain; no extra FX or gameplay markers.
    tokio::time::sleep(Duration::from_millis(1_500)).await;
    Ok(())
}
