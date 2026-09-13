use anyhow::{bail, Context, Result};
use myaso_server::{
    decode_input_packet, is_sequence_newer16, is_tick_newer32, simulation::World,
    snapshot::SnapshotSession, AdmissionGate, InputIngressWindow, CONSERVATIVE_DATAGRAM_BYTES,
    PROTOCOL_VERSION, TARGET_PLAYERS_PER_MAP,
};
use std::{
    collections::VecDeque,
    env,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::Mutex;
use wtransport::{Connection, Endpoint, Identity, ServerConfig, VarInt};

const GAME_PATH: &str = "/game";
const CLOSE_DATAGRAM_UNAVAILABLE: u32 = 0x11;
const SNAPSHOT_INTERVAL: Duration = Duration::from_millis(50);
const INPUT_ACK_PACKET_TYPE: u8 = 3;
const INPUT_ACK_BYTES: usize = 16;
const MAX_PENDING_INPUT_ACKS: usize = 256;

struct SharedGame {
    world: Mutex<World>,
    next_player_id: AtomicU32,
}

impl SharedGame {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            world: Mutex::new(World::default()),
            next_player_id: AtomicU32::new(1),
        })
    }

    fn allocate_player_id(&self) -> u32 {
        loop {
            let candidate = self.next_player_id.fetch_add(1, Ordering::Relaxed);
            if candidate != 0 {
                return candidate;
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let bind: SocketAddr = env::var("MYASO_BIND")
        .unwrap_or_else(|_| "127.0.0.1:4433".to_string())
        .parse()
        .context("MYASO_BIND must be a socket address")?;

    let identity = load_identity(bind).await?;
    let certificate_hash = identity
        .certificate_chain()
        .as_slice()
        .first()
        .map(|certificate| certificate.hash().to_string());

    let config = ServerConfig::builder()
        .with_bind_address(bind)
        .with_identity(identity)
        .keep_alive_interval(Some(Duration::from_secs(2)))
        .build();
    let endpoint = Arc::new(Endpoint::server(config).context("create WebTransport endpoint")?);
    let local_addr = endpoint.local_addr().context("read server address")?;

    println!("myaso M6 authoritative server listening on https://{local_addr}{GAME_PATH}");
    if let Some(hash) = certificate_hash {
        println!("development certificate SHA-256: {hash}");
    }

    let gate = AdmissionGate::new(TARGET_PLAYERS_PER_MAP);
    let game = SharedGame::new();
    tokio::spawn(run_authoritative_clock(Arc::clone(&game)));

    loop {
        let incoming = endpoint.accept().await;
        let gate = Arc::clone(&gate);
        let game = Arc::clone(&game);
        tokio::spawn(async move {
            let request = match incoming.await {
                Ok(request) => request,
                Err(error) => {
                    eprintln!("handshake failed: {error}");
                    return;
                }
            };

            if request.path() != GAME_PATH {
                request.not_found().await;
                return;
            }

            let Some(_permit) = gate.try_acquire() else {
                request.too_many_requests().await;
                return;
            };

            let connection = match request.accept().await {
                Ok(connection) => connection,
                Err(error) => {
                    eprintln!("session accept failed: {error}");
                    return;
                }
            };

            if connection.max_datagram_size().unwrap_or(0) < CONSERVATIVE_DATAGRAM_BYTES {
                connection.close(
                    VarInt::from_u32(CLOSE_DATAGRAM_UNAVAILABLE),
                    b"datagram budget unavailable",
                );
                return;
            }

            let player_id = game.allocate_player_id();
            {
                let mut world = game.world.lock().await;
                if !world.add_player(player_id) {
                    eprintln!("failed to add allocated player {player_id}");
                    return;
                }
            }

            let result = handle_connection(connection, player_id, Arc::clone(&game)).await;
            game.world.lock().await.remove_player(player_id);
            if let Err(error) = result {
                eprintln!("player {player_id} session ended: {error:#}");
            }
        });
    }
}

async fn load_identity(bind: SocketAddr) -> Result<Identity> {
    match (env::var("MYASO_CERT_PEM"), env::var("MYASO_KEY_PEM")) {
        (Ok(cert), Ok(key)) => Identity::load_pemfiles(cert, key)
            .await
            .context("load MYASO_CERT_PEM/MYASO_KEY_PEM"),
        (Err(_), Err(_)) if bind.ip().is_loopback() => {
            Identity::self_signed(["localhost", "127.0.0.1", "::1"])
                .context("generate loopback-only development identity")
        }
        (Ok(_), Err(_)) | (Err(_), Ok(_)) => {
            bail!("MYASO_CERT_PEM and MYASO_KEY_PEM must be supplied together")
        }
        (Err(_), Err(_)) => bail!(
            "non-loopback binds require explicit MYASO_CERT_PEM and MYASO_KEY_PEM; refusing to generate a public-facing development key"
        ),
    }
}

async fn run_authoritative_clock(game: Arc<SharedGame>) {
    let mut interval = tokio::time::interval(Duration::from_secs_f64(1.0 / 60.0));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let mut world = game.world.lock().await;
        let _events = world.step();
    }
}

async fn handle_connection(
    connection: Connection,
    player_id: u32,
    game: Arc<SharedGame>,
) -> Result<()> {
    let stable_id = connection.stable_id();
    let remote = connection.remote_address();
    println!("session {stable_id} assigned player {player_id} from {remote}");

    let mut ingress = InputIngressWindow::default();
    let mut snapshots = SnapshotSession::default();
    let mut acknowledged_snapshot = u16::MAX;
    let mut last_input_sequence = None;
    let mut pending_input_acks = VecDeque::with_capacity(MAX_PENDING_INPUT_ACKS);
    let mut snapshot_interval = tokio::time::interval(SNAPSHOT_INTERVAL);
    snapshot_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            datagram = connection.receive_datagram() => {
                let datagram = datagram?;
                let packet = match decode_input_packet(datagram.as_ref()) {
                    Ok(packet) => packet,
                    Err(error) => {
                        eprintln!("session {stable_id} invalid input datagram: {error:?}");
                        continue;
                    }
                };

                if last_input_sequence.is_none_or(|previous| is_sequence_newer16(packet.sequence, previous)) {
                    last_input_sequence = Some(packet.sequence);
                    acknowledged_snapshot = packet.ack_snapshot_sequence;
                }

                let accepted = ingress.ingest(&packet);
                if let Some(newest) = accepted.last().copied() {
                    let mut world = game.world.lock().await;
                    world.set_input(player_id, newest.into());
                    record_pending_input_ack(&mut pending_input_acks, newest.tick, world.tick);
                }

                let server_tick = game.world.lock().await.tick;
                if server_tick.wrapping_sub(packet.ack_server_tick) > 600 {
                    eprintln!(
                        "session {stable_id} stale server acknowledgement: client={} server={}",
                        packet.ack_server_tick, server_tick
                    );
                }
            }
            _ = snapshot_interval.tick() => {
                let (snapshot, server_tick) = {
                    let world = game.world.lock().await;
                    let snapshot = snapshots.build(
                        acknowledged_snapshot,
                        world.tick,
                        player_id,
                        world.fighters(),
                        CONSERVATIVE_DATAGRAM_BYTES,
                    );
                    (snapshot, world.tick)
                };
                let safe_input_ack = take_safe_input_ack(&mut pending_input_acks, server_tick);
                connection
                    .send_datagram(snapshot.bytes)
                    .context("send authoritative snapshot datagram")?;
                if let Some(client_tick) = safe_input_ack {
                    connection
                        .send_datagram(encode_input_ack(client_tick, server_tick, player_id))
                        .context("send processed-input acknowledgement datagram")?;
                }
            }
        }
    }
}

fn record_pending_input_ack(pending: &mut VecDeque<(u32, u32)>, client_tick: u32, server_tick: u32) {
    if pending.len() == MAX_PENDING_INPUT_ACKS {
        pending.pop_front();
    }
    pending.push_back((client_tick, server_tick));
}

fn take_safe_input_ack(pending: &mut VecDeque<(u32, u32)>, server_tick: u32) -> Option<u32> {
    let mut newest_safe = None;
    while let Some(&(client_tick, accepted_at_tick)) = pending.front() {
        if !is_tick_newer32(server_tick, accepted_at_tick) {
            break;
        }
        newest_safe = Some(client_tick);
        pending.pop_front();
    }
    newest_safe
}

fn encode_input_ack(processed_client_tick: u32, server_tick: u32, player_net_id: u32) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(INPUT_ACK_BYTES);
    bytes.push(PROTOCOL_VERSION);
    bytes.push(INPUT_ACK_PACKET_TYPE);
    bytes.extend_from_slice(&0_u16.to_le_bytes());
    bytes.extend_from_slice(&processed_client_tick.to_le_bytes());
    bytes.extend_from_slice(&server_tick.to_le_bytes());
    bytes.extend_from_slice(&player_net_id.to_le_bytes());
    debug_assert_eq!(bytes.len(), INPUT_ACK_BYTES);
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn processed_input_ack_coalesces_safe_ticks_without_starvation() {
        let mut pending = VecDeque::new();
        record_pending_input_ack(&mut pending, 100, 10);
        record_pending_input_ack(&mut pending, 101, 11);
        record_pending_input_ack(&mut pending, 102, 12);

        assert_eq!(take_safe_input_ack(&mut pending, 12), Some(101));
        assert_eq!(pending.len(), 1);
        assert_eq!(take_safe_input_ack(&mut pending, 13), Some(102));
        assert!(pending.is_empty());
    }

    #[test]
    fn processed_input_ack_safety_survives_server_tick_wrap() {
        let mut pending = VecDeque::new();
        record_pending_input_ack(&mut pending, 7, u32::MAX);
        assert_eq!(take_safe_input_ack(&mut pending, 0), Some(7));
    }

    #[test]
    fn processed_input_ack_queue_is_bounded() {
        let mut pending = VecDeque::new();
        for tick in 0..(MAX_PENDING_INPUT_ACKS as u32 + 4) {
            record_pending_input_ack(&mut pending, tick, tick);
        }
        assert_eq!(pending.len(), MAX_PENDING_INPUT_ACKS);
        assert_eq!(pending.front().copied(), Some((4, 4)));
    }
}
