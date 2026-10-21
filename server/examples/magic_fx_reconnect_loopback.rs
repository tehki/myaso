//! P18: isolated genuine browser WebTransport zone migration + reconnect.
//! This is NOT the live /game server and never parses or executes gameplay.
//! Only server-assigned test identities and zone membership are permitted.

use anyhow::{bail, Context, Result};
use myaso_server::elemental_physics::Element;
use myaso_server::magic_fx_delivery::ShardedMagicFxHub;
use myaso_server::magic_fx_events::{TrustedEffectSpec, ViewerInterest, MAGIC_FX_PACKET_BYTES};
use myaso_server::magic_fx_handoff::{
    FxHandoffPlan, FxQueueGate, FxRoute, FxRoutedBatch, TrustedFxHandoff, TrustedFxViewer,
};
use myaso_server::magic_fx_shared_transport::{
    plan_shared_dispatch, CoreGameplayDatagram, CoreWriterCapacity,
};
use myaso_server::magic_fx_shared_writer::{
    try_write_core_guarded, CoreAuthenticatedWriter, CoreGuardedEnqueueError,
};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::MissedTickBehavior;
use wtransport::{Connection, Endpoint, Identity, ServerConfig};

const PATH: &str = "/physics-fx-reconnect";
const CONNECT_ID: u64 = 19;
const NET_ID: u32 = 19;
const OLD_ZONE: u32 = 7;
const TRANSFER_ZONE: u32 = 8;
const NEW_ZONE: u32 = 9;

struct LabWriter<'a> {
    registry: &'a TrustedFxHandoff,
    connection: &'a Connection,
}

impl CoreAuthenticatedWriter for LabWriter<'_> {
    type Error = anyhow::Error;

    fn enqueue_if_current(
        &mut self,
        route: FxRoute,
        bytes: &[u8],
    ) -> Result<(), CoreGuardedEnqueueError<Self::Error>> {
        if route.connection_id != CONNECT_ID || !self.registry.route_current(route) {
            return Err(CoreGuardedEnqueueError::StaleGeneration);
        }
        self.connection
            .send_datagram(bytes)
            .map_err(|err| CoreGuardedEnqueueError::WriterRejected(err.into()))
    }
}

fn control(connection: &Connection, phase: u8, zone: u8) -> Result<()> {
    connection
        .send_datagram([b'Z', phase, zone, 0, 0, 0])
        .context("P18 server-owned phase control")?;
    Ok(())
}

fn forged_old_plan(route: FxRoute, zone: u32) -> FxHandoffPlan {
    let mut payload = [0u8; MAGIC_FX_PACKET_BYTES];
    payload[..2].copy_from_slice(b"ME");
    payload[2] = 1;
    payload[4..8].copy_from_slice(&zone.to_le_bytes());
    payload[8..12].copy_from_slice(&1u32.to_le_bytes());
    payload[28] = 180;
    payload[29] = 30;
    FxHandoffPlan {
        routes: vec![FxRoutedBatch {
            route,
            packets: vec![payload],
        }],
        registered: 1,
        eligible: 1,
        suppressed_by_gameplay_or_backpressure: 0,
        cosmetic_payload_bytes: MAGIC_FX_PACKET_BYTES,
    }
}

async fn run_phase(
    connection: &Connection,
    registry: &mut TrustedFxHandoff,
    hub: &mut ShardedMagicFxHub,
    route: FxRoute,
    zone: u32,
    begin: u64,
    end: u64,
) -> Result<(usize, usize)> {
    let mut clock = tokio::time::interval(Duration::from_millis(30));
    clock.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut gameplay_sent = 0usize;
    let mut fx_sent = 0usize;
    for tick in begin..=end {
        clock.tick().await;
        hub.advance(tick)
            .expect("monotonic P18 server-owned fixture clock");
        hub.admit_trusted(
            tick,
            TrustedEffectSpec {
                zone_id: zone,
                x: 12.5,
                y: -7.25,
                element: Element::Wind,
                seed: tick as u32,
                intensity: 160,
                ttl_ticks: 25,
            },
        )
        .expect("bounded P18 FX fixture");

        let visuals = registry
            .plan_trusted_tick(
                hub,
                tick,
                &[TrustedFxViewer {
                    route,
                    view: ViewerInterest {
                        zone_id: zone,
                        x: 12.5,
                        y: -7.25,
                        radius: 700.0,
                    },
                    gate: FxQueueGate {
                        gameplay_pending: false,
                        writer_backpressured: false,
                        cosmetic_slots: 1,
                    },
                }],
            )
            .expect("P18 server-authorized viewer");
        let mut marker = [0u8; 6];
        marker[..2].copy_from_slice(b"GP");
        marker[2..].copy_from_slice(&(tick as u32).to_le_bytes());
        let game = [CoreGameplayDatagram {
            route,
            bytes: marker.to_vec(),
        }];
        let plan = plan_shared_dispatch(
            registry,
            &game,
            &visuals,
            &[CoreWriterCapacity {
                route,
                available_datagrams: 2,
                gameplay_waiting: false,
                backpressured: false,
            }],
        )
        .expect("P18 gameplay first, optional FX second");
        let outcome = try_write_core_guarded(
            &plan,
            &mut LabWriter {
                registry,
                connection,
            },
        );
        if let Some(failure) = outcome.failure {
            bail!("P18 authoritative-style test marker refused: {failure:?}");
        }
        if outcome.gameplay_sent != 1 || outcome.cosmetic_not_sent != 0 {
            bail!("P18 fixture lost marker or optional FX");
        }
        gameplay_sent += outcome.gameplay_sent;
        fx_sent += outcome.cosmetic_sent;
    }
    Ok((gameplay_sent, fx_sent))
}

async fn accept_one(receiver: &mut mpsc::Receiver<Connection>) -> Result<Connection> {
    tokio::time::timeout(Duration::from_secs(35), receiver.recv())
        .await
        .context("P18 real QUIC accept timed out")?
        .context("P18 QUIC accept worker closed")
}

#[tokio::main]
async fn main() -> Result<()> {
    let identity = Identity::self_signed(["localhost", "127.0.0.1", "::1"])
        .context("P18 throwaway local certificate")?;
    let hash = identity
        .certificate_chain()
        .as_slice()
        .first()
        .context("P18 certificate chain empty")?
        .hash()
        .to_string();
    let addr: SocketAddr = "127.0.0.1:0".parse().expect("loopback literal");
    let endpoint = Endpoint::server(
        ServerConfig::builder()
            .with_bind_address(addr)
            .with_identity(identity)
            .keep_alive_interval(Some(Duration::from_secs(2)))
            .build(),
    )
    .context("P18 loopback QUIC endpoint")?;
    println!(
        "P18_LOOPBACK_LISTENING https://{}{PATH}",
        endpoint.local_addr().context("P18 local address")?
    );
    println!("P18_CERT_SHA256 {hash}");

    let (tx, mut accepted) = mpsc::channel::<Connection>(4);
    let _accept_task = tokio::spawn(async move {
        loop {
            let incoming = endpoint.accept().await;
            let sender = tx.clone();
            // Match P9: concurrent handshakes, never serialize browser QUIC.
            tokio::spawn(async move {
                let request = match incoming.await {
                    Ok(request) => request,
                    Err(err) => {
                        eprintln!("P18_HANDSHAKE_FAILED {err}");
                        return;
                    }
                };
                if request.path() != PATH {
                    request.not_found().await;
                    return;
                }
                match request.accept().await {
                    Ok(connection) => {
                        if sender.send(connection).await.is_err() {
                            eprintln!("P18 accept receiver closed");
                        }
                    }
                    Err(err) => eprintln!("P18_REQUEST_FAILED {err}"),
                }
            });
        }
    });

    let mut hub = ShardedMagicFxHub::new();
    for zone in [OLD_ZONE, TRANSFER_ZONE, NEW_ZONE] {
        hub.register_zone(zone).expect("registered lab zone");
    }
    let mut registry = TrustedFxHandoff::new();
    let first = accept_one(&mut accepted).await?;
    let old = registry
        .register_trusted(CONNECT_ID, NET_ID, OLD_ZONE)
        .expect("trusted fixture client A");
    println!(
        "P18_ACCEPTED_A generation={} zone={OLD_ZONE}",
        old.generation
    );
    control(&first, b'M', OLD_ZONE as u8)?;
    let (gp_old, fx_old) = run_phase(&first, &mut registry, &mut hub, old, OLD_ZONE, 1, 25).await?;

    // Prepare genuine P12 optional FX *before* the server-authorized zone
    // transfer. P15 MUST fence this already-planned stale route at send time.
    let old_fx = forged_old_plan(old, OLD_ZONE);
    let pretransfer = plan_shared_dispatch(
        &registry,
        &[],
        &old_fx,
        &[CoreWriterCapacity {
            route: old,
            available_datagrams: 1,
            gameplay_waiting: false,
            backpressured: false,
        }],
    )
    .expect("P18 pre-transfer visual plan");
    assert_eq!(pretransfer.cosmetic_datagrams, 1);
    let moved = registry
        .transfer_trusted(old, TRANSFER_ZONE)
        .expect("trusted zone transfer");
    let stale = try_write_core_guarded(
        &pretransfer,
        &mut LabWriter {
            registry: &registry,
            connection: &first,
        },
    );
    assert_eq!(stale.stale_cosmetic_skipped, 1);
    assert_eq!(stale.cosmetic_sent, 0);
    assert!(!registry.route_current(old));
    println!(
        "P18_TRANSFER old_generation={} generation={} stale_fx_blocked=1",
        old.generation, moved.generation
    );
    control(&first, b'M', TRANSFER_ZONE as u8)?;
    let (gp_moved, fx_moved) = run_phase(
        &first,
        &mut registry,
        &mut hub,
        moved,
        TRANSFER_ZONE,
        26,
        50,
    )
    .await?;

    // The browser explicitly closes actual connection A before creating B.
    control(&first, b'E', TRANSFER_ZONE as u8)?;
    tokio::time::timeout(Duration::from_secs(15), first.closed())
        .await
        .context("P18 first WebTransport was not truly closed by browser")?;
    registry
        .unregister_trusted(moved)
        .expect("P18 trusted disconnect");
    println!("P18_CLOSED_A generation={}", moved.generation);

    let second = accept_one(&mut accepted).await?;
    let fresh = registry
        .register_trusted(CONNECT_ID, NET_ID, NEW_ZONE)
        .expect("trusted fixture recycled ID B");
    if fresh.generation == old.generation || fresh.generation == moved.generation {
        bail!("P18 reused stale route generation");
    }
    if registry.route_current(old) || registry.route_current(moved) {
        bail!("P18 old generations remained authorized");
    }
    println!(
        "P18_ACCEPTED_B generation={} zone={NEW_ZONE} reused_connection_id={CONNECT_ID}",
        fresh.generation
    );
    control(&second, b'M', NEW_ZONE as u8)?;
    let (gp_fresh, fx_fresh) =
        run_phase(&second, &mut registry, &mut hub, fresh, NEW_ZONE, 51, 90).await?;

    // Recheck old-zone packet after *real* disconnect and registration B.
    // The old ME must not be delivered to B's recycled connection ID.
    let stale_again = try_write_core_guarded(
        &pretransfer,
        &mut LabWriter {
            registry: &registry,
            connection: &second,
        },
    );
    assert_eq!(stale_again.stale_cosmetic_skipped, 1);
    assert_eq!(stale_again.cosmetic_sent, 0);
    control(&second, b'E', NEW_ZONE as u8)?;
    println!(
        "P18_REAL_CHURN_SUMMARY accepted_real_connections=2 migrated=1 real_closes=1 recycled=1 stale_fx_blocked=2 old_generation={} moved_generation={} new_generation={} old_gp={gp_old} old_fx={fx_old} moved_gp={gp_moved} moved_fx={fx_moved} new_gp={gp_fresh} new_fx={fx_fresh}",
        old.generation, moved.generation, fresh.generation
    );
    // Leave QUIC connection B open while the browser extracts evidence.
    tokio::time::sleep(Duration::from_millis(1_500)).await;
    Ok(())
}
