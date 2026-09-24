use anyhow::{bail, Context, Result};
use myaso_server::{
    coalesce_accepted_input_batch, decode_input_packet, is_sequence_newer16, is_tick_newer32,
    kill_event::{encode_kill_event, KillEventPacket},
    reliable::{try_enqueue_reliable, ReliableQueueError},
    simulation::{CombatEvent, InputIntent, World},
    snapshot::{ReplicationFrame, SnapshotSession},
    AdmissionGate, InputIngressWindow, CONSERVATIVE_DATAGRAM_BYTES, PROTOCOL_VERSION,
    TARGET_PLAYERS_PER_MAP,
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
use tokio::sync::{mpsc, Mutex};
use wtransport::{Connection, Endpoint, Identity, SendStream, ServerConfig, VarInt};

const GAME_PATH: &str = "/game";
const CLOSE_DATAGRAM_UNAVAILABLE: u32 = 0x11;
const SNAPSHOT_INTERVAL: Duration = Duration::from_millis(50);
const SNAPSHOT_EVERY_SERVER_TICKS: u32 = 3;
const INPUT_ACK_PACKET_TYPE: u8 = 3;
const INPUT_ACK_BYTES: usize = 16;
const MAX_PENDING_INPUT_ACKS: usize = 256;
const MAX_RELIABLE_SNAPSHOT_BYTES: usize = u16::MAX as usize;
const RELIABLE_BACKGROUND_COOLDOWN_TICKS: u32 = 60;
const RELIABLE_DELTA_CHECKPOINT_INTERVAL: u8 = 3;
const MAX_FLIGHT_BACKGROUND_PLAYERS: usize = TARGET_PLAYERS_PER_MAP - 1;
const FLIGHT_BACKGROUND_NET_ID_BASE: u32 = 10_000;
const DEFAULT_FLIGHT_NEAR_PRESSURE_PLAYERS: usize = 150;
const MAX_KILL_EVENT_HISTORY: usize = 256;

#[derive(Debug, Clone, Copy)]
struct LoopbackFlightConfig {
    background_players: usize,
    near_pressure_players: usize,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
}

struct GameState {
    world: World,
    replication_frame: Arc<ReplicationFrame>,
    flight_background_ids: Vec<u32>,
    kill_events: VecDeque<KillEventPacket>,
    next_kill_event_sequence: u32,
}

impl GameState {
    fn new(background_players: usize, near_pressure_players: usize) -> Self {
        let mut world = World::default();
        let mut flight_background_ids = Vec::with_capacity(background_players);
        for index in 0..background_players {
            let net_id = FLIGHT_BACKGROUND_NET_ID_BASE + index as u32;
            let (x, y) = if index < near_pressure_players {
                let column = (index % 15) as f32;
                let row = (index / 15) as f32;
                (90.0 + column * 38.0, 90.0 + row * 38.0)
            } else {
                let background_index = index - near_pressure_players;
                let column = (background_index % 7) as f32;
                let row = (background_index / 7) as f32;
                (900.0 + column * 38.0, 100.0 + row * 38.0)
            };
            assert!(world.add_player_at(net_id, x, y, 0.0));
            flight_background_ids.push(net_id);
        }
        let replication_frame = Arc::new(ReplicationFrame::from_fighters(
            world.tick,
            world.fighters(),
        ));
        Self {
            world,
            replication_frame,
            flight_background_ids,
            kill_events: VecDeque::with_capacity(MAX_KILL_EVENT_HISTORY),
            next_kill_event_sequence: 0,
        }
    }

    fn apply_flight_background_motion(&mut self) {
        let base_facing = self.world.tick as f32 * 0.075;
        for (index, net_id) in self.flight_background_ids.iter().copied().enumerate() {
            self.world.set_input(
                net_id,
                InputIntent {
                    facing_radians: base_facing + index as f32 * 0.003,
                    block: true,
                    ..InputIntent::default()
                },
            );
        }
    }

    fn refresh_replication_frame(&mut self) {
        if let Some(frame) = Arc::get_mut(&mut self.replication_frame) {
            frame.refresh_from_fighters(self.world.tick, self.world.fighters());
        } else {
            self.replication_frame = Arc::new(ReplicationFrame::from_fighters(
                self.world.tick,
                self.world.fighters(),
            ));
        }
    }

    fn record_combat_events(&mut self, events: &[CombatEvent]) {
        for event in events {
            let CombatEvent::Death { fighter, killer } = event else {
                continue;
            };
            let packet = KillEventPacket {
                sequence: self.next_kill_event_sequence,
                killer: *killer,
                victim: *fighter,
            };
            self.next_kill_event_sequence = self.next_kill_event_sequence.wrapping_add(1);
            self.kill_events.push_back(packet);
            while self.kill_events.len() > MAX_KILL_EVENT_HISTORY {
                self.kill_events.pop_front();
            }
        }
    }

    fn kill_event_for_cursor(&self, cursor: u32) -> Option<KillEventPacket> {
        if let Some(event) = self
            .kill_events
            .iter()
            .copied()
            .find(|event| event.sequence == cursor)
        {
            return Some(event);
        }
        if cursor != self.next_kill_event_sequence {
            return self.kill_events.front().copied();
        }
        None
    }
}

struct SharedGame {
    state: Mutex<GameState>,
    next_player_id: AtomicU32,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
}

impl SharedGame {
    fn new(flight: LoopbackFlightConfig) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(GameState::new(
                flight.background_players,
                flight.near_pressure_players,
            )),
            next_player_id: AtomicU32::new(1),
            reliable_write_delay: flight.reliable_write_delay,
            drop_new_action_datagrams: flight.drop_new_action_datagrams,
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

fn should_enqueue_reliable_catchup(
    background_deadline_misses: usize,
    omitted_due_to_budget: usize,
    reliable_write_delay: Duration,
) -> bool {
    background_deadline_misses > 0 || (!reliable_write_delay.is_zero() && omitted_due_to_budget > 0)
}

#[tokio::main]
async fn main() -> Result<()> {
    let bind: SocketAddr = env::var("MYASO_BIND")
        .unwrap_or_else(|_| "127.0.0.1:4433".to_string())
        .parse()
        .context("MYASO_BIND must be a socket address")?;

    let flight = load_loopback_flight_config(bind)?;
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

    let gate = AdmissionGate::new(TARGET_PLAYERS_PER_MAP - flight.background_players);
    let game = SharedGame::new(flight);
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
                let mut state = game.state.lock().await;
                if !state.world.add_player(player_id) {
                    eprintln!("failed to add allocated player {player_id}");
                    return;
                }
                state.refresh_replication_frame();
            }

            let result = handle_connection(connection, player_id, Arc::clone(&game)).await;
            {
                let mut state = game.state.lock().await;
                state.world.remove_player(player_id);
                state.refresh_replication_frame();
            }
            if let Err(error) = result {
                eprintln!("player {player_id} session ended: {error:#}");
            }
        });
    }
}

fn load_loopback_flight_config(bind: SocketAddr) -> Result<LoopbackFlightConfig> {
    let background_players = env::var("MYASO_FLIGHT_BACKGROUND_PLAYERS")
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .context("MYASO_FLIGHT_BACKGROUND_PLAYERS must be an integer")
        })
        .transpose()?
        .unwrap_or(0);
    let near_pressure_players = env::var("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS")
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .context("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS must be an integer")
        })
        .transpose()?
        .unwrap_or(DEFAULT_FLIGHT_NEAR_PRESSURE_PLAYERS.min(background_players));
    let reliable_delay_ms = env::var("MYASO_FLIGHT_RELIABLE_DELAY_MS")
        .ok()
        .map(|value| {
            value
                .parse::<u64>()
                .context("MYASO_FLIGHT_RELIABLE_DELAY_MS must be an integer")
        })
        .transpose()?
        .unwrap_or(0);
    let drop_new_action_datagrams = env::var("MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS")
        .ok()
        .map(|value| match value.as_str() {
            "0" => Ok(false),
            "1" => Ok(true),
            _ => bail!("MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS must be 0 or 1"),
        })
        .transpose()?
        .unwrap_or(false);
    if background_players > MAX_FLIGHT_BACKGROUND_PLAYERS {
        bail!("MYASO_FLIGHT_BACKGROUND_PLAYERS exceeds bounded flight maximum");
    }
    if near_pressure_players > background_players {
        bail!("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS exceeds background player count");
    }
    if (background_players > 0 || reliable_delay_ms > 0 || drop_new_action_datagrams)
        && !bind.ip().is_loopback()
    {
        bail!("flight impairment fixtures are permitted only on loopback binds");
    }
    Ok(LoopbackFlightConfig {
        background_players,
        near_pressure_players,
        reliable_write_delay: Duration::from_millis(reliable_delay_ms),
        drop_new_action_datagrams,
    })
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
        let mut state = game.state.lock().await;
        state.apply_flight_background_motion();
        let events = state.world.step();
        state.record_combat_events(&events);
        if state.world.tick % SNAPSHOT_EVERY_SERVER_TICKS == 0 {
            state.refresh_replication_frame();
        }
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
    let mut reliable_snapshots = SnapshotSession::default();
    let mut last_input_sequence = None;
    let mut pending_input_acks = VecDeque::with_capacity(MAX_PENDING_INPUT_ACKS);
    let (mut reliable_send, _reliable_recv) = connection
        .accept_bi()
        .await
        .context("accept reliable game stream")?;
    let (initial_frame, mut next_kill_event_sequence) = {
        let state = game.state.lock().await;
        (
            Arc::clone(&state.replication_frame),
            state.next_kill_event_sequence,
        )
    };
    let initial_baseline = snapshots.build_from_frame(
        u16::MAX,
        player_id,
        &initial_frame,
        MAX_RELIABLE_SNAPSHOT_BYTES,
    );
    let initial_reliable_baseline = reliable_snapshots.build_from_frame(
        u16::MAX,
        player_id,
        &initial_frame,
        MAX_RELIABLE_SNAPSHOT_BYTES,
    );
    if initial_baseline.omitted_due_to_budget != 0
        || initial_reliable_baseline.omitted_due_to_budget != 0
    {
        bail!("initial reliable baseline exceeded reliable frame budget");
    }
    if initial_reliable_baseline.sequence != initial_baseline.sequence
        || initial_reliable_baseline.bytes != initial_baseline.bytes
    {
        bail!("reliable and realtime baseline sessions diverged");
    }
    let mut reliable_frame_buffer = Vec::new();
    send_reliable_frame(
        &mut reliable_send,
        &mut reliable_frame_buffer,
        &initial_baseline.bytes,
    )
    .await?;
    let initial_baseline_sequence = initial_baseline.sequence;
    let mut acknowledged_snapshot = u16::MAX;
    let mut realtime_ready = false;
    let mut last_reliable_background_tick = initial_frame.server_tick();
    let mut last_reliable_sequence = initial_reliable_baseline.sequence;
    let mut reliable_deltas_since_checkpoint = 0_u8;
    let (reliable_tx, mut reliable_rx) = mpsc::channel::<Vec<u8>>(1);
    let reliable_write_delay = game.reliable_write_delay;
    let mut reliable_writer = tokio::spawn(async move {
        while let Some(payload) = reliable_rx.recv().await {
            if !reliable_write_delay.is_zero() {
                tokio::time::sleep(reliable_write_delay).await;
            }
            send_reliable_frame(&mut reliable_send, &mut reliable_frame_buffer, &payload).await?;
        }
        Ok::<(), anyhow::Error>(())
    });
    let mut snapshot_interval = tokio::time::interval(SNAPSHOT_INTERVAL);
    snapshot_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            writer_result = &mut reliable_writer => {
                match writer_result {
                    Ok(Ok(())) => bail!("reliable writer ended unexpectedly"),
                    Ok(Err(error)) => return Err(error),
                    Err(error) => bail!("reliable writer task failed: {error}"),
                }
            }
            datagram = connection.receive_datagram() => {
                let datagram = datagram?;
                let packet = match decode_input_packet(datagram.as_ref()) {
                    Ok(packet) => packet,
                    Err(error) => {
                        eprintln!("session {stable_id} invalid input datagram: {error:?}");
                        continue;
                    }
                };

                if game.drop_new_action_datagrams
                    && packet
                        .samples()
                        .first()
                        .is_some_and(|sample| sample.attack || sample.dodge)
                {
                    println!(
                        "M63_INPUT_ACTION_PACKET_DROPPED session={stable_id} tick={}",
                        packet.client_tick
                    );
                    continue;
                }

                if last_input_sequence.is_none_or(|previous| is_sequence_newer16(packet.sequence, previous)) {
                    last_input_sequence = Some(packet.sequence);
                    advance_snapshot_ack(
                        &mut acknowledged_snapshot,
                        &mut realtime_ready,
                        initial_baseline_sequence,
                        packet.ack_snapshot_sequence,
                    );
                }

                let accepted = ingress.ingest(&packet);
                let coalesced = coalesce_accepted_input_batch(accepted.as_slice())
                    .map(|sample| (sample.tick, sample.into()));
                let server_tick = {
                    let mut state = game.state.lock().await;
                    apply_coalesced_input_and_read_tick(
                        &mut state,
                        player_id,
                        coalesced,
                        &mut pending_input_acks,
                    )
                };
                if server_tick.wrapping_sub(packet.ack_server_tick) > 600 {
                    eprintln!(
                        "session {stable_id} stale server acknowledgement: client={} server={}",
                        packet.ack_server_tick, server_tick
                    );
                }
            }
            _ = snapshot_interval.tick() => {
                let (frame, pending_kill_event) = {
                    let state = game.state.lock().await;
                    (
                        Arc::clone(&state.replication_frame),
                        state.kill_event_for_cursor(next_kill_event_sequence),
                    )
                };
                let server_tick = frame.server_tick();
                let safe_input_ack = take_safe_input_ack(&mut pending_input_acks, server_tick);
                let snapshot = realtime_ready.then(|| {
                    snapshots.build_from_frame(
                        acknowledged_snapshot,
                        player_id,
                        &frame,
                        CONSERVATIVE_DATAGRAM_BYTES,
                    )
                });
                let background_mid_deadline_misses = snapshot
                    .as_ref()
                    .map_or(0, |snapshot| snapshot.freshness.mid.deadline_misses);
                let background_far_deadline_misses = snapshot
                    .as_ref()
                    .map_or(0, |snapshot| snapshot.freshness.far.deadline_misses);
                let background_deadline_misses =
                    background_mid_deadline_misses + background_far_deadline_misses;
                let omitted_due_to_budget = snapshot
                    .as_ref()
                    .map_or(0, |snapshot| snapshot.omitted_due_to_budget);
                if let Some(snapshot) = snapshot {
                    connection
                        .send_datagram(snapshot.bytes)
                        .context("send authoritative snapshot datagram")?;
                }
                let mut kill_event_queued = false;
                if let Some(event) = pending_kill_event {
                    match try_enqueue_reliable(&reliable_tx, || encode_kill_event(event).to_vec()) {
                        Ok(true) => {
                            next_kill_event_sequence = event.sequence.wrapping_add(1);
                            kill_event_queued = true;
                        }
                        Ok(false) => {}
                        Err(ReliableQueueError::Closed) => {
                            bail!("reliable frame writer is unavailable")
                        }
                    }
                }
                if !kill_event_queued && should_enqueue_reliable_catchup(
                    background_deadline_misses,
                    omitted_due_to_budget,
                    game.reliable_write_delay,
                ) && server_tick.wrapping_sub(last_reliable_background_tick)
                    >= RELIABLE_BACKGROUND_COOLDOWN_TICKS
                {
                    if !game.reliable_write_delay.is_zero() {
                        println!(
                            "M15_RELIABLE_TRIGGER tick={server_tick} mid_misses={} far_misses={} omitted={}",
                            background_mid_deadline_misses,
                            background_far_deadline_misses,
                            omitted_due_to_budget,
                        );
                    }
                    let force_full_checkpoint =
                        reliable_deltas_since_checkpoint >= RELIABLE_DELTA_CHECKPOINT_INTERVAL;
                    let reliable_ack = if force_full_checkpoint {
                        u16::MAX
                    } else {
                        last_reliable_sequence
                    };
                    let mut built_reliable = None;
                    match try_enqueue_reliable(&reliable_tx, || {
                        let snapshot = reliable_snapshots.build_from_frame(
                            reliable_ack,
                            player_id,
                            &frame,
                            MAX_RELIABLE_SNAPSHOT_BYTES,
                        );
                        built_reliable = Some((
                            snapshot.sequence,
                            snapshot.baseline_sequence,
                            snapshot.full,
                            snapshot.record_count,
                            snapshot.bytes.len(),
                        ));
                        snapshot.bytes
                    }) {
                        Ok(true) => {
                            last_reliable_background_tick = server_tick;
                            let (sequence, baseline_sequence, full, records, bytes) =
                                built_reliable.expect("reserved reliable enqueue must build payload");
                            last_reliable_sequence = sequence;
                            if full {
                                reliable_deltas_since_checkpoint = 0;
                            } else {
                                reliable_deltas_since_checkpoint =
                                    reliable_deltas_since_checkpoint.saturating_add(1);
                            }
                            if !game.reliable_write_delay.is_zero() {
                                println!("M15_RELIABLE_ENQUEUED tick={server_tick}");
                                println!(
                                    "M17_RELIABLE_ENQUEUED tick={server_tick} sequence={sequence} baseline={baseline_sequence} kind={} records={records} bytes={bytes}",
                                    if full { "full" } else { "delta" },
                                );
                            }
                        }
                        Ok(false) => {
                            if !game.reliable_write_delay.is_zero() {
                                println!("M15_RELIABLE_BACKPRESSURED tick={server_tick}");
                            }
                        }
                        Err(ReliableQueueError::Closed) => {
                            bail!("reliable snapshot writer is unavailable")
                        }
                    }
                }
                if let Some(client_tick) = safe_input_ack {
                    connection
                        .send_datagram(encode_input_ack(client_tick, server_tick, player_id))
                        .context("send processed-input acknowledgement datagram")?;
                }
            }
        }
    }
}

fn prepare_reliable_frame(framed: &mut Vec<u8>, payload: &[u8]) -> Result<()> {
    if payload.len() > u16::MAX as usize {
        bail!("reliable payload exceeds 65535-byte frame limit");
    }
    framed.clear();
    let required = 2 + payload.len();
    if framed.capacity() < required {
        framed.reserve(required);
    }
    framed.extend_from_slice(&(payload.len() as u16).to_le_bytes());
    framed.extend_from_slice(payload);
    Ok(())
}

async fn send_reliable_frame(
    stream: &mut SendStream,
    framed: &mut Vec<u8>,
    payload: &[u8],
) -> Result<()> {
    prepare_reliable_frame(framed, payload)?;
    stream
        .write_all(framed)
        .await
        .context("write reliable frame")
}

fn advance_snapshot_ack(
    acknowledged_snapshot: &mut u16,
    realtime_ready: &mut bool,
    initial_baseline_sequence: u16,
    candidate: u16,
) {
    if !*realtime_ready {
        if candidate == initial_baseline_sequence {
            *acknowledged_snapshot = initial_baseline_sequence;
            *realtime_ready = true;
        }
        return;
    }
    if candidate != u16::MAX
        && (candidate == *acknowledged_snapshot
            || is_sequence_newer16(candidate, *acknowledged_snapshot))
    {
        *acknowledged_snapshot = candidate;
    }
}

fn record_pending_input_ack(
    pending: &mut VecDeque<(u32, u32)>,
    client_tick: u32,
    server_tick: u32,
) {
    if pending.len() == MAX_PENDING_INPUT_ACKS {
        pending.pop_front();
    }
    pending.push_back((client_tick, server_tick));
}

fn apply_coalesced_input_and_read_tick(
    state: &mut GameState,
    player_id: u32,
    coalesced: Option<(u32, InputIntent)>,
    pending_input_acks: &mut VecDeque<(u32, u32)>,
) -> u32 {
    if let Some((client_tick, input)) = coalesced {
        state.world.set_input(player_id, input);
        record_pending_input_ack(pending_input_acks, client_tick, state.world.tick);
    }
    state.world.tick
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
    fn replication_frame_refresh_reuses_unique_arc_without_mutating_shared_snapshot() {
        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player_at(1, 100.0, 100.0, 0.0));

        let initial_ptr = Arc::as_ptr(&state.replication_frame);
        state.refresh_replication_frame();
        assert_eq!(Arc::as_ptr(&state.replication_frame), initial_ptr);
        assert_eq!(state.replication_frame.server_tick(), state.world.tick);
        assert_eq!(state.replication_frame.len(), 1);

        let shared = Arc::clone(&state.replication_frame);
        let shared_ptr = Arc::as_ptr(&shared);
        let shared_tick = shared.server_tick();
        state.world.step();
        state.refresh_replication_frame();

        assert_ne!(Arc::as_ptr(&state.replication_frame), shared_ptr);
        assert_eq!(shared.server_tick(), shared_tick);
        assert_eq!(shared.len(), 1);
        assert_eq!(state.replication_frame.server_tick(), state.world.tick);
        assert_eq!(state.replication_frame.len(), 1);

        drop(shared);
        let unique_ptr = Arc::as_ptr(&state.replication_frame);
        state.world.step();
        state.refresh_replication_frame();

        assert_eq!(Arc::as_ptr(&state.replication_frame), unique_ptr);
        assert_eq!(state.replication_frame.server_tick(), state.world.tick);
    }

    #[test]
    fn reliable_frame_buffer_reuses_capacity_without_changing_wire_bytes() {
        let mut framed = Vec::new();
        let first_payload = vec![0x5a; 64];
        prepare_reliable_frame(&mut framed, &first_payload).expect("first frame");
        assert_eq!(&framed[..2], &(64_u16).to_le_bytes());
        assert_eq!(&framed[2..], first_payload.as_slice());

        let allocation = framed.as_ptr();
        let capacity = framed.capacity();
        let second_payload = [1_u8, 2, 3, 4, 5];
        prepare_reliable_frame(&mut framed, &second_payload).expect("second frame");

        assert_eq!(framed.as_ptr(), allocation);
        assert_eq!(framed.capacity(), capacity);
        assert_eq!(&framed[..2], &(second_payload.len() as u16).to_le_bytes());
        assert_eq!(&framed[2..], second_payload.as_slice());
    }

    #[test]
    fn reliable_frame_buffer_rejects_oversized_payload() {
        let mut framed = Vec::new();
        let oversized = vec![0_u8; u16::MAX as usize + 1];
        let error = prepare_reliable_frame(&mut framed, &oversized)
            .expect_err("oversized reliable frame must be rejected");
        assert!(error.to_string().contains("65535-byte frame limit"));
        assert!(framed.is_empty());
    }

    #[test]
    fn input_state_access_applies_and_reads_tick_in_one_scope() {
        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player(1));
        let mut pending = VecDeque::new();
        let input = InputIntent {
            move_x: 0.5,
            move_y: -0.25,
            facing_radians: 1.0,
            attack: true,
            dodge: false,
            block: false,
        };

        let server_tick =
            apply_coalesced_input_and_read_tick(&mut state, 1, Some((77, input)), &mut pending);

        assert_eq!(server_tick, state.world.tick);
        assert_eq!(pending.front().copied(), Some((77, server_tick)));
        assert_eq!(
            state.world.fighter(1).expect("player exists").input(),
            input
        );

        let pending_len = pending.len();
        assert_eq!(
            apply_coalesced_input_and_read_tick(&mut state, 1, None, &mut pending),
            server_tick
        );
        assert_eq!(pending.len(), pending_len);
    }

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
    fn reliable_baseline_must_be_echoed_before_realtime_snapshot_ack_advances() {
        let mut acknowledged = u16::MAX;
        let mut ready = false;
        advance_snapshot_ack(&mut acknowledged, &mut ready, 7, 6);
        assert!(!ready);
        assert_eq!(acknowledged, u16::MAX);

        advance_snapshot_ack(&mut acknowledged, &mut ready, 7, 7);
        assert!(ready);
        assert_eq!(acknowledged, 7);

        advance_snapshot_ack(&mut acknowledged, &mut ready, 7, 6);
        assert_eq!(acknowledged, 7);
        advance_snapshot_ack(&mut acknowledged, &mut ready, 7, 8);
        assert_eq!(acknowledged, 8);
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

    #[test]
    fn kill_event_history_is_join_scoped_ordered_and_bounded() {
        let mut state = GameState::new(0, 0);
        let first_join_cursor = state.next_kill_event_sequence;
        state.record_combat_events(&[
            CombatEvent::Death {
                fighter: 2,
                killer: 1,
            },
            CombatEvent::Death {
                fighter: 2,
                killer: 3,
            },
        ]);

        assert_eq!(
            state.kill_event_for_cursor(first_join_cursor),
            Some(KillEventPacket {
                sequence: 0,
                killer: 1,
                victim: 2,
            })
        );
        assert_eq!(
            state.kill_event_for_cursor(1),
            Some(KillEventPacket {
                sequence: 1,
                killer: 3,
                victim: 2,
            })
        );
        let late_join_cursor = state.next_kill_event_sequence;
        assert_eq!(state.kill_event_for_cursor(late_join_cursor), None);

        for sequence in 0..(MAX_KILL_EVENT_HISTORY as u32 + 2) {
            state.record_combat_events(&[CombatEvent::Death {
                fighter: 10 + sequence,
                killer: 9,
            }]);
        }
        assert_eq!(state.kill_events.len(), MAX_KILL_EVENT_HISTORY);
        assert_eq!(
            state.kill_event_for_cursor(late_join_cursor),
            state.kill_events.front().copied()
        );
    }

    #[test]
    fn loopback_reliable_pressure_uses_omission_without_weakening_production_trigger() {
        assert!(!should_enqueue_reliable_catchup(0, 4, Duration::ZERO));
        assert!(should_enqueue_reliable_catchup(1, 0, Duration::ZERO));
        assert!(should_enqueue_reliable_catchup(
            0,
            4,
            Duration::from_millis(250)
        ));
    }
}
