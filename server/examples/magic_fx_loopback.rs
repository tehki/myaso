//! P9: isolated REAL WebTransport loopback handshake+datagram acceptance server.
//!
//! This is an engineering **sidecar**, not the game's listening server.
//! Always binds 127.0.0.1 on an ephemeral UDP port, generates a throwaway
//! test certificate, accepts /physics-fx-lab ONLY, and has no spell commands,
//! combat state, persistent data, credentials or connection to production.
//! Cargo: cargo run --locked --manifest-path server/Cargo.toml --example magic_fx_loopback
//!
//! GP/PI/PO are test-only gameplay-style datagrams; not a game protocol.

use anyhow::{Context, Result};
use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_delivery::ShardedMagicFxHub;
use myaso_server::magic_fx_events::{TrustedEffectSpec, ViewerInterest};
use myaso_server::magic_fx_handoff::{FxQueueGate, TrustedFxHandoff, TrustedFxViewer};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::MissedTickBehavior;
use wtransport::{Connection, Endpoint, Identity, ServerConfig};

const LAB_PATH: &str = "/physics-fx-lab";
const TOTAL_LAB_TICKS: u64 = 115;
const FX_START_TICK: u64 = 31;
const LAB_ZONE_ID: u32 = 7;

#[tokio::main]
async fn main() -> Result<()> {
    let addr: SocketAddr = "127.0.0.1:0".parse().expect("static loopback address");
    let identity = Identity::self_signed(["localhost", "127.0.0.1"])
        .context("generate P9 loopback-only test identity")?;
    let cert_hash = identity
        .certificate_chain()
        .as_slice()
        .first()
        .context("loopback identity has no certificate")?
        .hash()
        .to_string();
    let config = ServerConfig::builder()
        .with_bind_address(addr)
        .with_identity(identity)
        .build();
    let endpoint = Endpoint::server(config).context("bind P9 loopback WebTransport")?;
    let local_addr = endpoint.local_addr().context("read P9 loopback address")?;
    println!("P9_LOOPBACK_LISTENING https://{local_addr}{LAB_PATH}");
    println!("P9_CERT_SHA256 {cert_hash}");
    let next_id = Arc::new(AtomicU32::new(1));

    loop {
        let incoming = endpoint.accept().await;
        let request = incoming.await.context("P9 WebTransport handshake")?;
        if request.path() != LAB_PATH {
            request.not_found().await;
            continue;
        }
        let connection = request.accept().await.context("accept P9 WebTransport")?;
        let id = next_id.fetch_add(1, Ordering::Relaxed);
        tokio::spawn(async move {
            if let Err(error) = run_lab_connection(connection, id).await {
                eprintln!("P9 loopback client session ended: {error:#}");
            }
        });
    }
}

async fn run_lab_connection(connection: Connection, id: u32) -> Result<()> {
    let mut hub = ShardedMagicFxHub::new();
    hub.register_zone(LAB_ZONE_ID)
        .expect("trusted P9 test zone");
    let mut handoff = TrustedFxHandoff::new();
    // These are test-only server-owned identities and known fixture positions.
    // They do NOT represent real game authentication.
    let route = handoff
        .register_trusted(u64::from(id), id, LAB_ZONE_ID)
        .expect("unique test server ID");
    let mut clock = tokio::time::interval(Duration::from_millis(30));
    clock.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut next_tick = 1u64;

    loop {
        tokio::select! {
            _ = clock.tick() => {
                if next_tick > TOTAL_LAB_TICKS {
                    break;
                }
                let tick = next_tick;
                next_tick += 1;
                hub.advance(tick).expect("monotonic test clock");

                // Gameplay-style marker is emitted FIRST. It is never an
                // authenticated player input, combat event or live snapshot.
                let mut gp = [0u8; 6];
                gp[0] = b'G';
                gp[1] = b'P';
                gp[2..6].copy_from_slice(&(tick as u32).to_le_bytes());
                connection.send_datagram(gp.to_vec())
                    .context("send test gameplay marker")?;

                if tick >= FX_START_TICK {
                    hub.admit_trusted(tick, TrustedEffectSpec {
                        zone_id: LAB_ZONE_ID,
                        x: 12.5,
                        y: -7.25,
                        element: Element::Wind,
                        seed: tick as u32,
                        intensity: 160,
                        ttl_ticks: 30,
                    }).expect("trusted lab FX capacity");
                }
                let gate = FxQueueGate {
                    // Simulated gameplay pressure MUST suppress FX, even
                    // while the lightweight test marker still transmits.
                    gameplay_pending: tick % 7 == 0,
                    writer_backpressured: false,
                    cosmetic_slots: 1,
                };
                let plan = handoff.plan_trusted_tick(
                    &mut hub,
                    tick,
                    &[TrustedFxViewer {
                        route,
                        view: ViewerInterest {
                            zone_id: LAB_ZONE_ID,
                            x: 12.5,
                            y: -7.25,
                            radius: 700.0,
                        },
                        gate,
                    }],
                ).expect("trusted test-viewer plan");
                for batch in plan.routes {
                    if !handoff.route_current(batch.route) {
                        continue;
                    }
                    for packet in batch.packets {
                        // The EXACT P4 semantic 32-byte payload travels over
                        // an actual QUIC datagram. No per-particle streaming.
                        connection.send_datagram(packet.to_vec())
                            .context("send optional P9 cosmetic datagram")?;
                    }
                }
            }
            message = connection.receive_datagram() => {
                let bytes = message.context("receive P9 test ping datagram")?;
                let input = bytes.as_ref();
                if input.len() == 6 && &input[0..2] == b"PI" {
                    // Echo the 4-byte ping ID for browser-measured RTT.
                    let mut reply = [0u8; 6];
                    reply[0] = b'P';
                    reply[1] = b'O';
                    reply[2..6].copy_from_slice(&input[2..6]);
                    connection.send_datagram(reply.to_vec())
                        .context("send P9 test ping reply")?;
                }
                // Ignore all other incoming data. NO spell or combat input.
            }
        }
    }
    Ok(())
}
