use anyhow::{bail, Context, Result};
use myaso_server::{
    decode_input_packet, is_tick_newer32,
    simulation::{World, SERVER_TICK_HZ},
    snapshot::{decode_snapshot, SnapshotSession, SNAPSHOT_PACKET_TYPE},
    InputIngressWindow, CONSERVATIVE_DATAGRAM_BYTES, INPUT_HEADER_BYTES, INPUT_SAMPLE_BYTES,
    PROTOCOL_VERSION,
};
use std::{
    env,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::Mutex;
use wtransport::{
    endpoint::endpoint_side::Client, ClientConfig, Endpoint, Identity, ServerConfig, VarInt,
};

const GAME_PATH: &str = "/game";
const INPUT_ACK_PACKET_TYPE: u8 = 3;
const INPUT_ACK_BYTES: usize = 16;
const CLOSE_WAIT: Duration = Duration::from_secs(2);

#[derive(Debug)]
struct ClientMetrics {
    ack_rtt_ms: Vec<f64>,
    snapshot_bytes: u64,
    snapshots: usize,
    max_snapshot_bytes: usize,
    first_round_ms: f64,
    first_snapshot_bytes: usize,
    first_snapshot_full: bool,
}

#[derive(Debug)]
struct WaveReport {
    clients: usize,
    rounds: usize,
    elapsed_ms: f64,
    acknowledgements: usize,
    snapshots: usize,
    snapshot_bytes: u64,
    max_snapshot_bytes: usize,
    ack_rtt_ms_p50: f64,
    ack_rtt_ms_p95: f64,
    ack_rtt_ms_p99: f64,
    ack_rtt_ms_max: f64,
    first_round_ms_p95: f64,
    avg_first_snapshot_bytes: f64,
    full_first_snapshots: usize,
}

impl WaveReport {
    fn to_json(&self, reconnect_clients: usize) -> String {
        let seconds = (self.elapsed_ms / 1000.0).max(f64::EPSILON);
        let snapshot_bytes_per_player_second =
            self.snapshot_bytes as f64 / self.clients.max(1) as f64 / seconds;
        format!(
            concat!(
                "{{",
                "\"clients\":{},",
                "\"rounds\":{},",
                "\"elapsed_ms\":{:.2},",
                "\"acknowledgements\":{},",
                "\"snapshots\":{},",
                "\"snapshot_bytes_per_player_second\":{:.1},",
                "\"max_snapshot_bytes\":{},",
                "\"ack_rtt_ms\":{{\"p50\":{:.3},\"p95\":{:.3},\"p99\":{:.3},\"max\":{:.3}}},",
                "\"first_round_ms_p95\":{:.3},",
                "\"avg_first_snapshot_bytes\":{:.1},",
                "\"full_first_snapshots\":{},",
                "\"reconnect_clients\":{}",
                "}}"
            ),
            self.clients,
            self.rounds,
            self.elapsed_ms,
            self.acknowledgements,
            self.snapshots,
            snapshot_bytes_per_player_second,
            self.max_snapshot_bytes,
            self.ack_rtt_ms_p50,
            self.ack_rtt_ms_p95,
            self.ack_rtt_ms_p99,
            self.ack_rtt_ms_max,
            self.first_round_ms_p95,
            self.avg_first_snapshot_bytes,
            self.full_first_snapshots,
            reconnect_clients,
        )
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    let clients = parse_arg(&args, 0, 64)?;
    let rounds = parse_arg(&args, 1, 6)?;
    if !(1..=128).contains(&clients) {
        bail!("transport probe clients must be in [1, 128]");
    }
    if !(1..=120).contains(&rounds) {
        bail!("transport probe rounds must be in [1, 120]");
    }
    let reconnect_clients = clients.min(8);

    let identity = Identity::self_signed(["localhost", "127.0.0.1"])?;
    let certificate_hash = identity.certificate_chain().as_slice()[0].hash();
    let server_config = ServerConfig::builder()
        .with_bind_address("127.0.0.1:0".parse()?)
        .with_identity(identity)
        .build();
    let server = Arc::new(Endpoint::server(server_config)?);
    let port = server.local_addr()?.port();
    let world = Arc::new(Mutex::new(World::default()));
    let next_player = Arc::new(AtomicU32::new(1));

    let clock_task = spawn_clock(Arc::clone(&world));
    let server_task = spawn_server(
        Arc::clone(&server),
        Arc::clone(&world),
        Arc::clone(&next_player),
        clients,
        reconnect_clients,
        rounds,
    );

    let client_config = ClientConfig::builder()
        .with_bind_default()
        .with_server_certificate_hashes([certificate_hash])
        .build();
    let client = Arc::new(Endpoint::client(client_config)?);

    let initial = run_client_wave(Arc::clone(&client), port, clients, rounds, 10_000).await?;
    validate_wave(&initial, clients, rounds)?;
    wait_for_world_empty(&world).await?;

    let reconnect =
        run_client_wave(Arc::clone(&client), port, reconnect_clients, 1, 90_000).await?;
    validate_wave(&reconnect, reconnect_clients, 1)?;
    wait_for_world_empty(&world).await?;

    server_task.await??;
    clock_task.abort();
    let _ = clock_task.await;

    println!(
        "M8_WEBTRANSPORT_LOAD {}",
        initial.to_json(reconnect_clients)
    );
    println!("M8_RECONNECT {}", reconnect.to_json(reconnect_clients));
    Ok(())
}

fn spawn_clock(world: Arc<Mutex<World>>) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(Duration::from_secs_f64(1.0 / SERVER_TICK_HZ as f64));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let mut world = world.lock().await;
            let _events = world.step();
        }
    })
}

fn spawn_server(
    server: Arc<Endpoint<wtransport::endpoint::endpoint_side::Server>>,
    world: Arc<Mutex<World>>,
    next_player: Arc<AtomicU32>,
    clients: usize,
    reconnect_clients: usize,
    rounds: usize,
) -> tokio::task::JoinHandle<Result<()>> {
    tokio::spawn(async move {
        let expected_connections = clients + reconnect_clients;
        let mut sessions = Vec::with_capacity(expected_connections);
        for connection_index in 0..expected_connections {
            let incoming = server.accept().await;
            let world = Arc::clone(&world);
            let next_player = Arc::clone(&next_player);
            let connection_rounds = if connection_index < clients { rounds } else { 1 };
            sessions.push(tokio::spawn(async move {
                let request = incoming.await?;
                if request.path() != GAME_PATH {
                    bail!(
                        "transport probe received unexpected path {}",
                        request.path()
                    );
                }
                let connection = request.accept().await?;
                if connection.max_datagram_size().unwrap_or(0) < CONSERVATIVE_DATAGRAM_BYTES {
                    bail!("transport probe connection lacks the conservative datagram budget");
                }

                let player_id = next_player.fetch_add(1, Ordering::Relaxed);
                {
                    let mut world = world.lock().await;
                    if !world.add_player(player_id) {
                        bail!("failed to add transport probe player {player_id}");
                    }
                }

                let result = serve_probe_connection(
                    &connection,
                    player_id,
                    Arc::clone(&world),
                    connection_rounds,
                )
                .await;
                world.lock().await.remove_player(player_id);
                result
            }));
        }

        for session in sessions {
            session.await??;
        }
        Ok(())
    })
}

async fn serve_probe_connection(
    connection: &wtransport::Connection,
    player_id: u32,
    world: Arc<Mutex<World>>,
    rounds: usize,
) -> Result<()> {
    let mut ingress = InputIngressWindow::default();
    let mut snapshots = SnapshotSession::default();

    for _ in 0..rounds {
        let datagram = connection
            .receive_datagram()
            .await
            .context("receive probe input datagram")?;
        let packet = decode_input_packet(datagram.as_ref())
            .map_err(|error| anyhow::anyhow!("decode probe input: {error:?}"))?;
        let accepted = ingress.ingest(&packet);
        let newest = accepted
            .last()
            .copied()
            .context("probe input was not accepted")?;

        let accepted_at_tick = {
            let mut world = world.lock().await;
            world.set_input(player_id, newest.into());
            world.tick
        };
        let server_tick = wait_for_newer_tick(&world, accepted_at_tick).await;

        let snapshot = {
            let world = world.lock().await;
            snapshots.build(
                packet.ack_snapshot_sequence,
                server_tick,
                player_id,
                world.fighters(),
                CONSERVATIVE_DATAGRAM_BYTES,
            )
        };
        connection
            .send_datagram(snapshot.bytes)
            .context("send probe authoritative snapshot")?;
        connection
            .send_datagram(encode_input_ack(newest.tick, server_tick, player_id))
            .context("send probe processed-input acknowledgement")?;
    }

    tokio::time::timeout(CLOSE_WAIT, connection.closed())
        .await
        .context("probe client did not confirm final reply delivery by closing")?;
    Ok(())
}

async fn wait_for_newer_tick(world: &Arc<Mutex<World>>, accepted_at_tick: u32) -> u32 {
    loop {
        let tick = world.lock().await.tick;
        if is_tick_newer32(tick, accepted_at_tick) {
            return tick;
        }
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
}

async fn wait_for_world_empty(world: &Arc<Mutex<World>>) -> Result<()> {
    tokio::time::timeout(CLOSE_WAIT, async {
        loop {
            if world.lock().await.fighters().is_empty() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await
    .context("transport probe sessions did not drain from authoritative world")?;
    Ok(())
}

async fn run_client_wave(
    endpoint: Arc<Endpoint<Client>>,
    port: u16,
    clients: usize,
    rounds: usize,
    tick_base: u32,
) -> Result<WaveReport> {
    let started = Instant::now();
    let mut tasks = Vec::with_capacity(clients);

    for index in 0..clients {
        let endpoint = Arc::clone(&endpoint);
        tasks.push(tokio::spawn(async move {
            let connection = endpoint
                .connect(format!("https://127.0.0.1:{port}{GAME_PATH}"))
                .await
                .context("connect WebTransport probe client")?;
            let mut ack_snapshot_sequence = u16::MAX;
            let mut ack_server_tick = 0_u32;
            let mut metrics = ClientMetrics {
                ack_rtt_ms: Vec::with_capacity(rounds),
                snapshot_bytes: 0,
                snapshots: 0,
                max_snapshot_bytes: 0,
                first_round_ms: 0.0,
                first_snapshot_bytes: 0,
                first_snapshot_full: false,
            };

            for round in 0..rounds {
                let client_tick = tick_base
                    .wrapping_add((index as u32).wrapping_mul(1000))
                    .wrapping_add(round as u32);
                let sequence = round as u16;
                let input = input_datagram(
                    sequence,
                    ack_snapshot_sequence,
                    client_tick,
                    ack_server_tick,
                    index,
                );
                let round_started = Instant::now();
                connection
                    .send_datagram(input)
                    .context("send WebTransport probe input")?;

                let mut got_snapshot = false;
                let mut got_ack = false;
                while !(got_snapshot && got_ack) {
                    let reply = connection
                        .receive_datagram()
                        .await
                        .context("receive WebTransport probe reply")?;
                    if reply.len() < 2 {
                        bail!("probe reply was too short");
                    }
                    match reply[1] {
                        SNAPSHOT_PACKET_TYPE => {
                            let decoded = decode_snapshot(reply.as_ref()).map_err(|error| {
                                anyhow::anyhow!("decode probe snapshot: {error:?}")
                            })?;
                            if round == 0 {
                                metrics.first_snapshot_bytes = reply.len();
                                metrics.first_snapshot_full = decoded.full;
                            }
                            ack_snapshot_sequence = decoded.sequence;
                            ack_server_tick = decoded.server_tick;
                            metrics.snapshot_bytes += reply.len() as u64;
                            metrics.snapshots += 1;
                            metrics.max_snapshot_bytes = metrics.max_snapshot_bytes.max(reply.len());
                            got_snapshot = true;
                        }
                        INPUT_ACK_PACKET_TYPE => {
                            let (processed_client_tick, server_tick, player_net_id) =
                                decode_input_ack(reply.as_ref())?;
                            if processed_client_tick != client_tick {
                                bail!(
                                    "processed client tick mismatch: expected {client_tick}, got {processed_client_tick}"
                                );
                            }
                            if player_net_id == 0 {
                                bail!("server returned zero player id");
                            }
                            ack_server_tick = server_tick;
                            metrics.ack_rtt_ms.push(elapsed_ms(round_started));
                            got_ack = true;
                        }
                        other => bail!("unexpected probe packet type {other}"),
                    }
                }

                if round == 0 {
                    metrics.first_round_ms = elapsed_ms(round_started);
                }
            }

            connection.close(VarInt::from_u32(0), b"probe complete");
            Ok::<ClientMetrics, anyhow::Error>(metrics)
        }));
    }

    let mut client_metrics = Vec::with_capacity(clients);
    for task in tasks {
        client_metrics.push(task.await??);
    }
    Ok(summarize_wave(
        client_metrics,
        clients,
        rounds,
        elapsed_ms(started),
    ))
}

fn summarize_wave(
    clients_metrics: Vec<ClientMetrics>,
    clients: usize,
    rounds: usize,
    elapsed_ms: f64,
) -> WaveReport {
    let mut ack_rtt_ms = Vec::new();
    let mut first_round_ms = Vec::new();
    let mut acknowledgements = 0;
    let mut snapshots = 0;
    let mut snapshot_bytes = 0_u64;
    let mut max_snapshot_bytes = 0;
    let mut first_snapshot_bytes = 0_u64;
    let mut full_first_snapshots = 0;

    for metrics in clients_metrics {
        acknowledgements += metrics.ack_rtt_ms.len();
        ack_rtt_ms.extend(metrics.ack_rtt_ms);
        first_round_ms.push(metrics.first_round_ms);
        snapshots += metrics.snapshots;
        snapshot_bytes += metrics.snapshot_bytes;
        max_snapshot_bytes = max_snapshot_bytes.max(metrics.max_snapshot_bytes);
        first_snapshot_bytes += metrics.first_snapshot_bytes as u64;
        if metrics.first_snapshot_full {
            full_first_snapshots += 1;
        }
    }

    WaveReport {
        clients,
        rounds,
        elapsed_ms,
        acknowledgements,
        snapshots,
        snapshot_bytes,
        max_snapshot_bytes,
        ack_rtt_ms_p50: percentile(&ack_rtt_ms, 0.50),
        ack_rtt_ms_p95: percentile(&ack_rtt_ms, 0.95),
        ack_rtt_ms_p99: percentile(&ack_rtt_ms, 0.99),
        ack_rtt_ms_max: max_sample(&ack_rtt_ms),
        first_round_ms_p95: percentile(&first_round_ms, 0.95),
        avg_first_snapshot_bytes: if clients == 0 {
            0.0
        } else {
            first_snapshot_bytes as f64 / clients as f64
        },
        full_first_snapshots,
    }
}

fn validate_wave(report: &WaveReport, clients: usize, rounds: usize) -> Result<()> {
    let expected = clients * rounds;
    if report.snapshots != expected || report.acknowledgements != expected {
        bail!(
            "incomplete transport wave: snapshots={} acknowledgements={} expected={expected}",
            report.snapshots,
            report.acknowledgements
        );
    }
    if report.full_first_snapshots != clients {
        bail!(
            "fresh sessions did not all receive full resync snapshots: {} / {}",
            report.full_first_snapshots,
            clients
        );
    }
    if report.max_snapshot_bytes > CONSERVATIVE_DATAGRAM_BYTES {
        bail!(
            "transport snapshot exceeded datagram budget: {} > {}",
            report.max_snapshot_bytes,
            CONSERVATIVE_DATAGRAM_BYTES
        );
    }
    if !report.ack_rtt_ms_p95.is_finite() || report.ack_rtt_ms_p95 < 0.0 {
        bail!("invalid acknowledgement RTT measurement");
    }
    Ok(())
}

fn input_datagram(
    sequence: u16,
    ack_snapshot_sequence: u16,
    client_tick: u32,
    ack_server_tick: u32,
    client_index: usize,
) -> Vec<u8> {
    let mut bytes = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    bytes[0] = PROTOCOL_VERSION;
    bytes[1] = 1;
    bytes[2] = 1;
    bytes[4..6].copy_from_slice(&sequence.to_le_bytes());
    bytes[6..8].copy_from_slice(&ack_snapshot_sequence.to_le_bytes());
    bytes[8..12].copy_from_slice(&client_tick.to_le_bytes());
    bytes[12..16].copy_from_slice(&ack_server_tick.to_le_bytes());
    bytes[16] = 0;
    bytes[17] = if client_index % 2 == 0 {
        96_u8
    } else {
        (-96_i8) as u8
    };
    bytes[18] = if client_index % 3 == 0 { 64_u8 } else { 0 };
    let facing = ((client_index as u32 * 7919 + client_tick) & 0xffff) as u16;
    bytes[19..21].copy_from_slice(&facing.to_le_bytes());
    bytes[21] = 0;
    bytes
}

fn encode_input_ack(processed_client_tick: u32, server_tick: u32, player_net_id: u32) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(INPUT_ACK_BYTES);
    bytes.push(PROTOCOL_VERSION);
    bytes.push(INPUT_ACK_PACKET_TYPE);
    bytes.extend_from_slice(&0_u16.to_le_bytes());
    bytes.extend_from_slice(&processed_client_tick.to_le_bytes());
    bytes.extend_from_slice(&server_tick.to_le_bytes());
    bytes.extend_from_slice(&player_net_id.to_le_bytes());
    bytes
}

fn decode_input_ack(bytes: &[u8]) -> Result<(u32, u32, u32)> {
    if bytes.len() != INPUT_ACK_BYTES
        || bytes[0] != PROTOCOL_VERSION
        || bytes[1] != INPUT_ACK_PACKET_TYPE
    {
        bail!("invalid processed-input acknowledgement packet");
    }
    let processed_client_tick = u32::from_le_bytes(bytes[4..8].try_into()?);
    let server_tick = u32::from_le_bytes(bytes[8..12].try_into()?);
    let player_net_id = u32::from_le_bytes(bytes[12..16].try_into()?);
    Ok((processed_client_tick, server_tick, player_net_id))
}

fn parse_arg(args: &[String], index: usize, fallback: usize) -> Result<usize> {
    args.get(index)
        .map(|value| {
            value
                .parse::<usize>()
                .with_context(|| format!("argument {} must be an integer", index + 1))
        })
        .unwrap_or(Ok(fallback))
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
