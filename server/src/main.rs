use anyhow::{bail, Context, Result};
use myaso_server::{
    coalesce_accepted_input_batch, decode_input_packet, is_sequence_newer16, is_tick_newer32,
    kill_event::{encode_kill_event, KillEventPacket},
    prealpha_authenticated_gesture::{is_v2_event, new_server_boot_nonce, SessionGestureWorldPath},
    prealpha_lmb_gesture_proposal::encode_ack,
    prealpha_lmb_gesture_proposal::{decode_typed_event, GestureAck, TypedGestureEvent},
    reliable::{try_enqueue_reliable, ReliableQueueError},
    simulation::{CombatEvent, InputIntent, World},
    snapshot::{ReplicationFrame, SnapshotSession},
    AdmissionGate, InputIngressWindow, InputSample, CONSERVATIVE_DATAGRAM_BYTES, PROTOCOL_VERSION,
    TARGET_PLAYERS_PER_MAP,
};
use std::{
    collections::{BTreeMap, VecDeque},
    env,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU32, AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::{mpsc, Mutex};
use wtransport::{Connection, Endpoint, Identity, SendStream, ServerConfig, VarInt};

const GAME_PATH: &str = "/game";
const V2_LAB_HELLO: [u8; 8] = [2, 0x10, b'M', b'Y', b'A', b'S', b'O', b'1'];
const V2_LAB_GRANTED: [u8; 4] = [2, 0x13, 0, 0];
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
const MAX_DROPPED_ACTION_TICKS: usize = 64;

fn one_shot_action_mask(sample: &InputSample) -> u8 {
    u8::from(sample.attack)
        | (u8::from(sample.heavy_attack) << 1)
        | (u8::from(sample.dodge) << 2)
        | (u8::from(sample.kick) << 3)
        | (u8::from(sample.jump) << 4)
}

fn remember_dropped_action_tick(dropped_action_ticks: &mut VecDeque<u32>, tick: u32) {
    if dropped_action_ticks.contains(&tick) {
        return;
    }
    if dropped_action_ticks.len() == MAX_DROPPED_ACTION_TICKS {
        dropped_action_ticks.pop_front();
    }
    dropped_action_ticks.push_back(tick);
}

fn register_new_action_datagram(
    samples: &[InputSample],
    dropped_action_ticks: &mut VecDeque<u32>,
) -> Option<u32> {
    let mut first_unseen = None;

    // Samples are newest -> oldest. Only a false->true transition is a new
    // one-shot action. A held button must not make every subsequent tick look
    // like a fresh action or the impairment fixture would drop the entire hold.
    for pair in samples.windows(2) {
        let newer = &pair[0];
        let older = &pair[1];
        let rising = one_shot_action_mask(newer) & !one_shot_action_mask(older);
        if rising == 0 || dropped_action_ticks.contains(&newer.tick) {
            continue;
        }
        first_unseen.get_or_insert(newer.tick);
        remember_dropped_action_tick(dropped_action_ticks, newer.tick);
    }

    // A one-sample packet has no older state to compare. Treat it as an edge
    // once; the remembered tick prevents the same action from being re-dropped.
    if samples.len() == 1 && one_shot_action_mask(&samples[0]) != 0 {
        let tick = samples[0].tick;
        if !dropped_action_ticks.contains(&tick) {
            first_unseen = Some(tick);
            remember_dropped_action_tick(dropped_action_ticks, tick);
        }
    }

    first_unseen
}

#[derive(Debug, Clone, Copy)]
struct LoopbackFlightConfig {
    background_players: usize,
    near_pressure_players: usize,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
}

#[derive(Debug)]
enum ReliablePayload {
    Bytes(Vec<u8>),
    KillEvent(KillEventPacket),
}

struct GameState {
    world: World,
    boot_nonce: u128,
    gesture_sessions: BTreeMap<u64, SessionGestureWorldPath>,
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
            boot_nonce: 0,
            gesture_sessions: BTreeMap::new(),
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
        if cursor == self.next_kill_event_sequence {
            return None;
        }
        let first = self.kill_events.front()?;
        let offset = cursor.wrapping_sub(first.sequence) as usize;
        if let Some(event) = self.kill_events.get(offset).copied() {
            if event.sequence == cursor {
                return Some(event);
            }
        }
        self.kill_events.front().copied()
    }
}

struct SharedGame {
    state: Mutex<GameState>,
    next_player_id: AtomicU32,
    next_lease_epoch: AtomicU64,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
}

impl SharedGame {
    fn new(flight: LoopbackFlightConfig, boot_nonce: u128) -> Arc<Self> {
        let mut state = GameState::new(flight.background_players, flight.near_pressure_players);
        state.boot_nonce = boot_nonce;
        Arc::new(Self {
            state: Mutex::new(state),
            next_player_id: AtomicU32::new(1),
            next_lease_epoch: AtomicU64::new(1),
            reliable_write_delay: flight.reliable_write_delay,
            drop_new_action_datagrams: flight.drop_new_action_datagrams,
        })
    }

    fn allocate_player_id(&self) -> Option<u32> {
        self.next_player_id
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| n.checked_add(1))
            .ok()
    }

    fn allocate_lease_epoch(&self) -> Option<u64> {
        self.next_lease_epoch
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |n| n.checked_add(1))
            .ok()
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

    // R0 alpha: explicitly cap *real* concurrent players on the shared VPS.
    // Flight fixtures remain loopback-only, and the default engineering cap
    // stays unchanged for the existing 512-player acceptance suite.
    let player_cap_raw = match env::var("MYASO_MAX_PLAYERS") {
        Ok(value) => Some(value),
        Err(env::VarError::NotPresent) => None,
        Err(error) => bail!("MYASO_MAX_PLAYERS is invalid: {error}"),
    };
    let player_cap = parse_player_cap(player_cap_raw.as_deref())?;
    if flight.background_players >= player_cap {
        bail!("flight background player count must remain below MYASO_MAX_PLAYERS");
    }
    let gate = AdmissionGate::new(player_cap - flight.background_players);
    println!("myaso admission cap: {player_cap} concurrent players");
    // No account authentication service exists for this temporary arena.
    // The experiment is session-assigned, loopback-only, and default OFF.
    let v2_lab = match env::var("MYASO_EXPERIMENTAL_GESTURE_V2").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(_) => false,
        Ok(_) => bail!("MYASO_EXPERIMENTAL_GESTURE_V2 must be 0 or 1"),
    };
    if v2_lab && !bind.ip().is_loopback() {
        bail!("experimental v2 gesture ingress is loopback-only");
    }
    // Legacy v1 boot remains unchanged; only the explicit v2 lab requires OS
    // CSPRNG. No entropy failure may accidentally block a disabled v1 game.
    let boot_nonce = if v2_lab { new_server_boot_nonce()? } else { 0 };
    let game = SharedGame::new(flight, boot_nonce);
    // Accept server-side diagnostic output only on loopback and only when
    // explicitly requested by the real-browser M201 acceptance fixture.
    let flight_action_proof = match env::var("MYASO_FLIGHT_ACTION_PROOF").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(_) => false,
        Ok(_) => bail!("MYASO_FLIGHT_ACTION_PROOF must be 0 or 1"),
    };
    if flight_action_proof && !bind.ip().is_loopback() {
        bail!("authoritative flight action proof is permitted only on loopback binds");
    }
    // M121 native W3C forensic only: opt-in original v1 accepted input samples,
    // separate from the existing v2 lab and NEVER available on public binds.
    let flight_m121_input_proof = match env::var("MYASO_FLIGHT_M121_INPUT_PROOF").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(_) => false,
        Ok(_) => bail!("MYASO_FLIGHT_M121_INPUT_PROOF must be 0 or 1"),
    };
    if flight_m121_input_proof && (!bind.ip().is_loopback() || !flight_action_proof || v2_lab) {
        bail!("M121 original-v1 ingress proof requires loopback, flight action proof and v2 OFF");
    }
    tokio::spawn(run_authoritative_clock(
        Arc::clone(&game),
        flight_action_proof,
    ));

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

            let Some(player_id) = game.allocate_player_id() else {
                connection.close(VarInt::from_u32(0x15), b"player id exhausted");
                return;
            };
            let Some(lease_epoch) = game.allocate_lease_epoch() else {
                connection.close(VarInt::from_u32(0x16), b"session epoch exhausted");
                return;
            };
            {
                let mut state = game.state.lock().await;
                if !state.world.add_player(player_id) {
                    eprintln!("failed to add allocated player {player_id}");
                    return;
                }
                state.refresh_replication_frame();
            }

            let result = handle_connection(
                connection,
                player_id,
                lease_epoch,
                v2_lab,
                flight_action_proof,
                flight_m121_input_proof,
                Arc::clone(&game),
            )
            .await;
            {
                let mut state = game.state.lock().await;
                if let Some(mut gesture) = state.gesture_sessions.remove(&lease_epoch) {
                    gesture.retire();
                }
                state.world.remove_player(player_id);
                state.refresh_replication_frame();
            }
            if let Err(error) = result {
                eprintln!("player {player_id} session ended: {error:#}");
            }
        });
    }
}

fn parse_player_cap(raw: Option<&str>) -> Result<usize> {
    let Some(raw) = raw else {
        return Ok(TARGET_PLAYERS_PER_MAP);
    };
    let count: usize = raw
        .parse()
        .context("MYASO_MAX_PLAYERS must be a decimal integer")?;
    if !(2..=TARGET_PLAYERS_PER_MAP).contains(&count) {
        bail!("MYASO_MAX_PLAYERS must be between 2 and {TARGET_PLAYERS_PER_MAP}");
    }
    Ok(count)
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

// This stdout trace is a loopback-only *read-only* CI diagnostic. The server
// emits actions on every authoritative simulation tick (60 Hz), unlike the
// 50ms replicated snapshots, which can miss an 80ms attack-active phase.
// No extra messages are sent to the gameplay clients or network protocol.
// The original loopback action-proof flag also fences this admission-level
// diagnostic. It reads real before/after World states and an actual typed ACK;
// it is not a simulation tick, gameplay receipt or inferred active/HIT edge.
fn m201_gesture_action_proof_line(
    tick: u32,
    fighter: u32,
    event: TypedGestureEvent,
    ack: GestureAck,
    from: u8,
    to: u8,
) -> String {
    format!(
        "M201_AUTH_GESTURE_ACTION tick={tick} fighter={fighter} source={} gesture={} sequence={} eventAction={} status={} from={from} to={to}",
        event.source as u8,
        event.event.gesture_id,
        event.event.sequence,
        event.event.action as u8,
        ack.status as u8,
    )
}

fn m201_flight_proof_lines(
    world: &World,
    events: &[CombatEvent],
    previous: &mut BTreeMap<u32, u8>,
) -> Vec<String> {
    let mut lines = Vec::new();
    let tick = world.tick;
    for fighter in world.fighters() {
        // Background pressure fixtures are synthetic actors; only report
        // live browser-owned fighters to keep the trace bounded.
        if fighter.net_id >= FLIGHT_BACKGROUND_NET_ID_BASE {
            continue;
        }
        let action = fighter.action.wire_code();
        if let Some(from) = previous.insert(fighter.net_id, action) {
            if from != action {
                lines.push(format!(
                    "M201_AUTH_ACTION tick={tick} fighter={} from={from} to={action}",
                    fighter.net_id
                ));
            }
        } else {
            // The very first observed actor state has no prior World tick
            // with which to prove an action transition. Emit an explicit
            // READ-ONLY loopback flight baseline: browser tests must wait for
            // fighter=1 action=0 before sending physical input, otherwise a
            // valid fast PRESS could be ACKed and start World HeavyWindup
            // before the M201 observer ever sampled the original Idle actor.
            // This line is not a hit, action event, or protocol packet.
            lines.push(format!(
                "M201_FLIGHT_ACTOR_BASELINE tick={tick} fighter={} action={action}",
                fighter.net_id
            ));
        }
    }
    for event in events {
        match event {
            CombatEvent::Block { attacker, target } => lines.push(format!(
                "M201_AUTH_BLOCK tick={tick} attacker={attacker} target={target}"
            )),
            CombatEvent::Parry { attacker, target } => lines.push(format!(
                "M201_AUTH_PARRY tick={tick} attacker={attacker} target={target}"
            )),
            CombatEvent::GuardBreak { attacker, target } => lines.push(format!(
                "M201_AUTH_BREAK tick={tick} attacker={attacker} target={target}"
            )),
            CombatEvent::Hit {
                attacker,
                target,
                damage,
                hp,
            } => lines.push(format!(
                "M201_AUTH_HIT tick={tick} attacker={attacker} target={target} damage={damage} hp={hp}"
            )),
            _ => {}
        }
    }
    lines
}

async fn run_authoritative_clock(game: Arc<SharedGame>, flight_action_proof: bool) {
    let mut interval = tokio::time::interval(Duration::from_secs_f64(1.0 / 60.0));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut events = Vec::new();
    let mut previous_actions = BTreeMap::new();
    loop {
        interval.tick().await;
        let mut state = game.state.lock().await;
        state.apply_flight_background_motion();
        state.world.step_into(&mut events);
        // Single authoritative 60Hz World lock covers every current session.
        let GameState {
            world,
            gesture_sessions,
            boot_nonce,
            ..
        } = &mut *state;
        for (epoch, gesture) in gesture_sessions.iter_mut() {
            gesture.advance_under_world_lock(world, *epoch, *boot_nonce);
        }
        if flight_action_proof {
            for line in m201_flight_proof_lines(&state.world, &events, &mut previous_actions) {
                println!("{line}");
            }
        }
        state.record_combat_events(&events);
        if state.world.tick % SNAPSHOT_EVERY_SERVER_TICKS == 0 {
            state.refresh_replication_frame();
        }
    }
}

async fn handle_connection(
    connection: Connection,
    player_id: u32,
    lease_epoch: u64,
    v2_lab: bool,
    flight_action_proof: bool,
    flight_m121_input_proof: bool,
    game: Arc<SharedGame>,
) -> Result<()> {
    let stable_id = connection.stable_id();
    let remote = connection.remote_address();
    println!("session {stable_id} assigned player {player_id} from {remote}");

    let mut v2_enabled = false;
    let mut legacy_combat_seen = false;
    let mut ingress = InputIngressWindow::default();
    let mut snapshots = SnapshotSession::default();
    let mut reliable_snapshots = SnapshotSession::default();
    let mut last_input_sequence = None;
    let mut dropped_action_ticks = VecDeque::with_capacity(MAX_DROPPED_ACTION_TICKS);
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
    let (reliable_tx, mut reliable_rx) = mpsc::channel::<ReliablePayload>(1);
    let reliable_write_delay = game.reliable_write_delay;
    let mut reliable_writer = tokio::spawn(async move {
        while let Some(payload) = reliable_rx.recv().await {
            if !reliable_write_delay.is_zero() {
                tokio::time::sleep(reliable_write_delay).await;
            }
            prepare_reliable_payload(&mut reliable_frame_buffer, &payload)?;
            reliable_send
                .write_all(&reliable_frame_buffer)
                .await
                .context("write reliable frame")?;
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
            // Separate negotiated client uni stream, on the admitted QUIC
            // connection. No datagram or query parameter can enable v2.
            negotiation = connection.accept_uni(), if v2_lab && !v2_enabled => {
                if let Ok(mut stream) = negotiation {
                    let mut hello = [0u8; 8];
                    if let Ok(Ok(())) = tokio::time::timeout(
                        Duration::from_secs(1), stream.read_exact(&mut hello)
                    ).await {
                        // Complete the client-written FIN before releasing
                        // RecvStream. Dropping immediately after read_exact
                        // can send QUIC STOP_SENDING while Chrome's writer
                        // awaits close, aborting an otherwise valid handshake.
                        // Reject trailing data: exactly ONE 8-byte hello.
                        let mut trailing = [0_u8; 1];
                        let complete = matches!(
                            tokio::time::timeout(Duration::from_secs(1), stream.read(&mut trailing)).await,
                            Ok(Ok(None))
                        );
                        if complete && hello == V2_LAB_HELLO && !legacy_combat_seen {
                            let mut state = game.state.lock().await;
                            if let Some(path) = SessionGestureWorldPath::from_admitted_world(
                                &state.world, player_id, lease_epoch, state.boot_nonce
                            ) {
                                state.gesture_sessions.insert(lease_epoch, path);
                                v2_enabled = true;
                                drop(state);
                                reliable_tx.send(ReliablePayload::Bytes(V2_LAB_GRANTED.to_vec()))
                                    .await.context("send reliable experimental v2 grant")?;
                            }
                        }
                    }
                }
            }
            datagram = connection.receive_datagram() => {
                let datagram = datagram?;
                if is_v2_event(datagram.as_ref()) {
                    if !v2_enabled { continue; }
                    // No await inside real World admission/Combat application.
                    let mut admission_proof = None;
                    let ack = {
                        let mut state = game.state.lock().await;
                        let boot_nonce = state.boot_nonce;
                        state.gesture_sessions.remove(&lease_epoch).and_then(|mut path| {
                            // Tick-sampled action proof can miss two genuine
                            // transitions admitted between simulation ticks.
                            // Capture only actual state around the unchanged
                            // admission call, on this same original World lock.
                            let before = if flight_action_proof {
                                decode_typed_event(datagram.as_ref()).ok().and_then(|event| {
                                    state.world.fighter(player_id)
                                        .map(|fighter| (event, fighter.action.wire_code()))
                                })
                            } else {
                                None
                            };
                            let ack = path.accept_under_world_lock(
                                &mut state.world, lease_epoch, boot_nonce, datagram.as_ref()
                            );
                            if let (Some((event, from)), Some(receipt)) = (before, ack) {
                                if let Some(fighter) = state.world.fighter(player_id) {
                                    admission_proof = Some(m201_gesture_action_proof_line(
                                        state.world.tick, player_id, event, receipt,
                                        from, fighter.action.wire_code()
                                    ));
                                }
                            }
                            state.gesture_sessions.insert(lease_epoch, path);
                            ack
                        })
                    };
                    // Formatting captured real state under the World lock;
                    // stdout I/O never holds that lock or steps simulation.
                    if let Some(line) = admission_proof {
                        println!("{line}");
                    }
                    if let Some(ack) = ack {
                        connection.send_datagram(encode_ack(ack).map_err(|e| anyhow::anyhow!("v2 ACK encoding: {e:?}"))?)
                            .context("send v2 event processed ACK")?;
                    }
                    continue;
                }
                let packet = match decode_input_packet(datagram.as_ref()) {
                    Ok(packet) => packet,
                    Err(error) => {
                        eprintln!("session {stable_id} invalid input datagram: {error:?}");
                        continue;
                    }
                };

                if game.drop_new_action_datagrams {
                    if let Some(action_tick) =
                        register_new_action_datagram(packet.samples(), &mut dropped_action_ticks)
                    {
                        println!(
                            "M63_INPUT_ACTION_PACKET_DROPPED session={stable_id} tick={action_tick} packet_tick={}",
                            packet.client_tick
                        );
                        continue;
                    }
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
                let coalesced: Option<(u32, InputIntent)> =
                    coalesce_accepted_input_batch(accepted.as_slice()).map(|sample| {
                        let mut intent: InputIntent = sample.into();
                        if v2_enabled {
                            // Still permit v1 locomotion, but block an
                            // independent sampled Combat attack producer.
                            intent.attack = false;
                            intent.heavy_attack = false;
                        } else if intent.attack || intent.heavy_attack {
                            legacy_combat_seen = true;
                        }
                        (sample.tick, intent)
                    });
                // M229: loopback-only read-only evidence after real ingress/dedup.
                // Never claim that sending an action proved it was accepted.
                if game.drop_new_action_datagrams {
                    if let Some((input_tick, intent)) = coalesced.as_ref() {
                        if intent.heavy_attack {
                            // M230: log the original *accepted* heavy sample
                            // tick, not only the newest coalesced input tick.
                            if let Some(heavy_sample) =
                                accepted.iter().rev().find(|sample| sample.heavy_attack)
                            {
                                let action_tick = heavy_sample.tick;
                                println!(
                                    "M229_LOOPBACK_HEAVY_INPUT_ACCEPTED session={stable_id} action_tick={action_tick} client_tick={input_tick} packet_tick={} accepted_samples={}",
                                    packet.client_tick,
                                    accepted.len()
                                );
                            }
                        }
                    }
                }
                // M121: preserve actual accepted v1 samples and post-set-input
                // World state under one original authoritative lock. A client
                // send, a decoded QUIC datagram, an ingress-accepted sample
                // and a World action are four different proofs.
                let prove_m121 = flight_m121_input_proof && player_id <= 3
                    && packet.samples().iter().any(|sample| {
                        sample.attack || sample.heavy_attack
                            || sample.move_x != 0.0 || sample.move_y != 0.0
                    });
                let m121_accepted = if prove_m121 {
                    accepted.iter().map(|sample| format!(
                        "{}:{}:{}:{:.2}:{:.2}",
                        sample.tick, u8::from(sample.attack),
                        u8::from(sample.heavy_attack), sample.move_x, sample.move_y
                    )).collect::<Vec<_>>().join(",")
                } else {
                    String::new()
                };
                let m121_coalesced = if prove_m121 {
                    coalesced.as_ref().map(|(tick, input)| format!(
                        "{tick}:{}:{}:{:.2}:{:.2}",
                        u8::from(input.attack), u8::from(input.heavy_attack),
                        input.move_x, input.move_y
                    )).unwrap_or_else(|| "none".to_owned())
                } else {
                    String::new()
                };
                // The original v1 batch coalescer correctly owns locomotion
                // from the NEWEST accepted sample, even when it is neutral.
                // Carry only the authenticated selected one-shot light sample
                // direction separately; otherwise same-datagram RELEASE then
                // neutral would produce a generic attack despite real W+LMB.
                let release_motion = selected_light_release_motion(
                    accepted.as_slice(),
                    coalesced.as_ref(),
                );
                let (server_tick, m121_world) = {
                    let mut state = game.state.lock().await;
                    let tick = apply_coalesced_input_and_read_tick(
                        &mut state,
                        player_id,
                        coalesced,
                        &mut pending_input_acks,
                        release_motion,
                    );
                    let probe = if prove_m121 {
                        state.world.fighter(player_id).map(|fighter| {
                            let latest = fighter.input();
                            format!(
                                "{}:{}:{}:{:.2}:{:.2}",
                                fighter.action.wire_code(),
                                u8::from(latest.attack), u8::from(latest.heavy_attack),
                                latest.move_x, latest.move_y
                            )
                        })
                    } else {
                        None
                    };
                    (tick, probe)
                };
                if prove_m121 {
                    println!(
                        "M121_V1_SERVER_INPUT actor={player_id} session={stable_id} packet_tick={} accepted=[{m121_accepted}] coalesced={m121_coalesced} world_tick={server_tick} world={}",
                        packet.client_tick, m121_world.as_deref().unwrap_or("missing")
                    );
                }
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
                    match try_enqueue_reliable(&reliable_tx, || ReliablePayload::KillEvent(event)) {
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
                        ReliablePayload::Bytes(snapshot.bytes)
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

fn prepare_reliable_payload(framed: &mut Vec<u8>, payload: &ReliablePayload) -> Result<()> {
    match payload {
        ReliablePayload::Bytes(bytes) => prepare_reliable_frame(framed, bytes),
        ReliablePayload::KillEvent(event) => {
            let bytes = encode_kill_event(*event);
            prepare_reliable_frame(framed, &bytes)
        }
    }
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

// Use the SAME most-recent one-shot sample as coalesce_accepted_input_batch,
// but only for directional attack selection. Do not override the newer
// continuous movement, or fabricate another World input.
fn selected_light_release_motion(
    accepted: &[InputSample],
    coalesced: Option<&(u32, InputIntent)>,
) -> Option<(f32, f32, f32)> {
    if !coalesced.is_some_and(|(_, intent)| intent.attack && !intent.heavy_attack) {
        return None;
    }
    accepted
        .iter()
        .rev()
        .find(|sample| {
            sample.attack
                || sample.heavy_attack
                || sample.dodge
                || sample.kick
                || sample.jump
                || sample.dash
        })
        .and_then(|sample| {
            if sample.attack && !sample.heavy_attack {
                Some((sample.move_x, sample.move_y, sample.facing_radians))
            } else {
                None
            }
        })
}

fn apply_coalesced_input_and_read_tick(
    state: &mut GameState,
    player_id: u32,
    coalesced: Option<(u32, InputIntent)>,
    pending_input_acks: &mut VecDeque<(u32, u32)>,
    release_motion: Option<(f32, f32, f32)>,
) -> u32 {
    if let Some((client_tick, input)) = coalesced {
        state
            .world
            .set_input_with_light_release_motion(player_id, input, release_motion);
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
    fn gesture_action_proof_keeps_actual_same_tick_admission_edges_distinct() {
        use myaso_server::prealpha_lmb_gesture_proposal::{
            AckStatus, GestureAction, GestureEvent, GestureSource,
        };
        let event = TypedGestureEvent {
            source: GestureSource::Lmb,
            event: GestureEvent {
                action: GestureAction::Press,
                sequence: 1,
                gesture_id: 7,
                client_tick: u32::MAX,
            },
        };
        let ack = GestureAck {
            status: AckStatus::Accepted,
            sequence: 1,
            gesture_id: 7,
            server_tick: 1359,
        };
        assert_eq!(
            m201_gesture_action_proof_line(1359, 1, event, ack, 0, 1),
            "M201_AUTH_GESTURE_ACTION tick=1359 fighter=1 source=0 gesture=7 sequence=1 eventAction=1 status=1 from=0 to=1"
        );
        let upgraded = TypedGestureEvent {
            event: GestureEvent {
                action: GestureAction::Upgrade,
                sequence: 2,
                ..event.event
            },
            ..event
        };
        let upgrade_ack = GestureAck { sequence: 2, ..ack };
        assert_eq!(
            m201_gesture_action_proof_line(1359, 1, upgraded, upgrade_ack, 1, 9),
            "M201_AUTH_GESTURE_ACTION tick=1359 fighter=1 source=0 gesture=7 sequence=2 eventAction=2 status=1 from=1 to=9"
        );
        // A replay/failed admission must preserve its real unchanged state;
        // formatting must never manufacture the previously observed edge.
        let duplicate = GestureAck {
            status: AckStatus::Duplicate,
            ..upgrade_ack
        };
        assert!(
            m201_gesture_action_proof_line(1359, 1, upgraded, duplicate, 9, 9)
                .ends_with("eventAction=2 status=2 from=9 to=9")
        );
    }

    fn action_sample(tick: u32, heavy_attack: bool) -> InputSample {
        InputSample {
            tick,
            move_x: 0.0,
            move_y: 0.0,
            facing_radians: 0.0,
            attack: false,
            heavy_attack,
            dodge: false,
            block: false,
            kick: false,
            run: false,
            jump: false,
            dash: false,
        }
    }

    #[test]
    fn loopback_action_loss_drops_first_datagram_then_accepts_redundant_tick() {
        let mut dropped = VecDeque::new();
        let first = [
            action_sample(12, false),
            action_sample(11, true),
            action_sample(10, false),
        ];
        assert_eq!(register_new_action_datagram(&first, &mut dropped), Some(11));
        assert_eq!(dropped, VecDeque::from([11]));

        let redundant = [
            action_sample(13, false),
            action_sample(12, false),
            action_sample(11, true),
        ];
        assert_eq!(register_new_action_datagram(&redundant, &mut dropped), None);

        let next = [
            action_sample(14, true),
            action_sample(13, false),
            action_sample(12, false),
        ];
        assert_eq!(register_new_action_datagram(&next, &mut dropped), Some(14));
        assert_eq!(dropped, VecDeque::from([11, 14]));
    }

    #[test]
    fn loopback_action_loss_does_not_redrop_sustained_action_hold() {
        let mut dropped = VecDeque::new();
        let first = [
            action_sample(38, true),
            action_sample(37, false),
            action_sample(36, false),
        ];
        assert_eq!(register_new_action_datagram(&first, &mut dropped), Some(38));

        let held_redundant = [
            action_sample(39, true),
            action_sample(38, true),
            action_sample(37, false),
        ];
        assert_eq!(
            register_new_action_datagram(&held_redundant, &mut dropped),
            None
        );

        let held = [
            action_sample(40, true),
            action_sample(39, true),
            action_sample(38, true),
        ];
        assert_eq!(register_new_action_datagram(&held, &mut dropped), None);

        let repressed = [
            action_sample(42, true),
            action_sample(41, false),
            action_sample(40, true),
        ];
        assert_eq!(
            register_new_action_datagram(&repressed, &mut dropped),
            Some(42)
        );
        assert_eq!(dropped, VecDeque::from([38, 42]));
    }

    #[test]
    fn m229_heavy_one_shot_replay_matrix_shows_exact_three_packet_boundary() {
        use myaso_server::simulation::Action;

        // Deterministic protocol test, not synthetic browser acceptance:
        // a genuine KeyE is encoded as one heavy-action client tick.
        // Each 34-byte datagram carries newest-to-oldest three samples.
        const ACTION_TICK: u32 = 700;
        for additional_losses in 0..=2_u32 {
            let mut ingress = InputIngressWindow::default();
            let mut dropped_action_ticks = VecDeque::new();
            let mut state = GameState::new(0, 0);
            assert!(state.world.add_player(1));
            let mut acks = VecDeque::new();
            let mut accepted_heavy_ticks = Vec::new();

            for packet_offset in 0..4_u32 {
                let packet_tick = ACTION_TICK + packet_offset;
                let mut bytes = vec![0_u8; 16 + 3 * 6];
                bytes[0] = PROTOCOL_VERSION;
                bytes[1] = 1; // Input datagram.
                bytes[2] = 3; // Actual protocol redundancy.
                bytes[4..6].copy_from_slice(&(packet_offset as u16).to_le_bytes());
                bytes[8..12].copy_from_slice(&packet_tick.to_le_bytes());
                for sample_offset in 0..3_u32 {
                    let sample_tick = packet_tick - sample_offset;
                    let index = 16 + sample_offset as usize * 6;
                    bytes[index] = sample_offset as u8;
                    bytes[index + 5] = u8::from(sample_tick == ACTION_TICK) << 3;
                }
                let packet = decode_input_packet(&bytes).expect("valid genuine input wire format");
                assert_eq!(packet.samples().len(), 3);

                if packet_offset == 0 {
                    // Existing M63 fixture must deliberately drop the first
                    // datagram with the new one-shot heavy action.
                    assert_eq!(
                        register_new_action_datagram(packet.samples(), &mut dropped_action_ticks),
                        Some(ACTION_TICK)
                    );
                    continue;
                }
                if packet_offset <= additional_losses {
                    // Additional simulated QUIC loss, not a repeated KeyE.
                    continue;
                }
                assert_eq!(
                    register_new_action_datagram(packet.samples(), &mut dropped_action_ticks),
                    None,
                    "replay of an already dropped action must not be re-dropped"
                );
                let accepted = ingress.ingest(&packet);
                if let Some(sample) = coalesce_accepted_input_batch(accepted.as_slice()) {
                    if sample.heavy_attack {
                        accepted_heavy_ticks.push(ACTION_TICK);
                    }
                    apply_coalesced_input_and_read_tick(
                        &mut state,
                        1,
                        Some((sample.tick, sample.into())),
                        &mut acks,
                    );
                }
                state.world.step();
            }

            let within_replay = additional_losses < 2;
            assert_eq!(
                accepted_heavy_ticks,
                if within_replay {
                    vec![ACTION_TICK]
                } else {
                    Vec::new()
                },
                "a third lost datagram exhausts three-sample replay"
            );
            assert_eq!(
                state.world.fighter(1).expect("fighter").action,
                if within_replay {
                    Action::HeavyAttackWindup
                } else {
                    Action::Idle
                },
                "never invent a heavy action after replay is exhausted"
            );
            assert_eq!(state.world.fighter(1).expect("fighter").hp, 100.0);
        }
    }

    #[test]
    fn reliable_kill_event_payload_reuses_frame_buffer_without_owned_byte_payload() {
        let event = KillEventPacket {
            sequence: 7,
            killer: 11,
            victim: 23,
        };
        let payload = ReliablePayload::KillEvent(event);
        let mut framed = Vec::with_capacity(64);
        let allocation = framed.as_ptr();
        let capacity = framed.capacity();

        prepare_reliable_payload(&mut framed, &payload).expect("kill event frame");

        let encoded = encode_kill_event(event);
        assert_eq!(framed.as_ptr(), allocation);
        assert_eq!(framed.capacity(), capacity);
        assert_eq!(&framed[..2], &(encoded.len() as u16).to_le_bytes());
        assert_eq!(&framed[2..], encoded.as_slice());
    }

    #[test]
    fn kill_event_cursor_lookup_spans_sequence_wrap() {
        let mut state = GameState::new(0, 0);
        state.kill_events = VecDeque::from([
            KillEventPacket {
                sequence: u32::MAX - 1,
                killer: 1,
                victim: 2,
            },
            KillEventPacket {
                sequence: u32::MAX,
                killer: 2,
                victim: 3,
            },
            KillEventPacket {
                sequence: 0,
                killer: 3,
                victim: 4,
            },
            KillEventPacket {
                sequence: 1,
                killer: 4,
                victim: 5,
            },
        ]);
        state.next_kill_event_sequence = 2;

        for sequence in [u32::MAX - 1, u32::MAX, 0, 1] {
            assert_eq!(
                state
                    .kill_event_for_cursor(sequence)
                    .expect("retained cursor must resolve")
                    .sequence,
                sequence
            );
        }
        assert!(state.kill_event_for_cursor(2).is_none());
        assert_eq!(
            state
                .kill_event_for_cursor(u32::MAX - 2)
                .expect("stale cursor should restart from oldest retained event")
                .sequence,
            u32::MAX - 1
        );
        assert_eq!(
            state
                .kill_event_for_cursor(99)
                .expect("unknown future cursor should restart from oldest retained event")
                .sequence,
            u32::MAX - 1
        );
    }

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
            heavy_attack: false,
            dodge: false,
            block: false,
            kick: false,
            run: false,
            jump: false,
            dash: false,
        };

        let server_tick = apply_coalesced_input_and_read_tick(
            &mut state,
            1,
            Some((77, input)),
            &mut pending,
            None,
        );

        assert_eq!(server_tick, state.world.tick);
        assert_eq!(pending.front().copied(), Some((77, server_tick)));
        assert_eq!(
            state.world.fighter(1).expect("player exists").input(),
            input
        );

        let pending_len = pending.len();
        assert_eq!(
            apply_coalesced_input_and_read_tick(&mut state, 1, None, &mut pending, None),
            server_tick
        );
        assert_eq!(pending.len(), pending_len);
    }

    #[test]
    fn m121_authenticated_v1_coalesced_release_keeps_attack_direction_not_movement() {
        // Real native M121: within one authenticated datagram the light-only
        // W+LMB release was sample93; newest sample94 was neutral. Preserve
        // sample94's movement while selecting the release's LEFT SWEEP.
        let release = InputSample {
            tick: 93,
            move_x: 0.0,
            move_y: -1.0,
            facing_radians: 0.0,
            attack: true,
            heavy_attack: false,
            dodge: false,
            block: false,
            kick: false,
            run: false,
            jump: false,
            dash: false,
        };
        let neutral = InputSample {
            tick: 94,
            move_y: 0.0,
            attack: false,
            ..release
        };
        let accepted = [release, neutral];
        let coalesced = coalesce_accepted_input_batch(&accepted)
            .expect("authenticated original release+neutral batch");
        assert_eq!(coalesced.tick, 94);
        assert_eq!(coalesced.move_y, 0.0);
        assert!(coalesced.attack);
        assert!(!coalesced.heavy_attack);
        let intent: InputIntent = coalesced.into();
        let motion = selected_light_release_motion(&accepted, Some(&(coalesced.tick, intent)));
        assert_eq!(motion, Some((0.0, -1.0, 0.0)));

        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player_at(1, 250.0, 300.0, 0.0));
        assert!(state.world.set_input(
            1,
            InputIntent {
                attack: true,
                heavy_attack: true,
                ..InputIntent::default()
            }
        ));
        state.world.step();
        assert_eq!(state.world.fighter(1).unwrap().action.wire_code(), 9);
        let mut pending = VecDeque::new();
        apply_coalesced_input_and_read_tick(
            &mut state,
            1,
            Some((coalesced.tick, intent)),
            &mut pending,
            motion,
        );
        // The original following neutral packet can precede the World step,
        // but it cannot change the already-authenticated release direction.
        state.world.set_input(1, InputIntent::default());
        state.world.step();
        assert_eq!(state.world.fighter(1).unwrap().action.wire_code(), 24);
        assert_eq!(state.world.fighter(1).unwrap().input().move_y, 0.0);
        state.world.step();
        assert_eq!(state.world.fighter(1).unwrap().action.wire_code(), 24);
        assert_eq!(pending.len(), 1);

        let independent_keye = InputSample {
            tick: 95,
            attack: false,
            heavy_attack: true,
            ..neutral
        };
        let keye: InputIntent = independent_keye.into();
        assert_eq!(
            selected_light_release_motion(&[independent_keye], Some(&(95, keye))),
            None,
            "a standalone KeyE heavy is never a light-release lateral"
        );
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

#[cfg(test)]
mod r0_player_cap_tests {
    use super::parse_player_cap;

    #[test]
    fn alpha_cap_is_strict_and_engineering_default_is_preserved() {
        assert_eq!(parse_player_cap(None).unwrap(), 512);
        assert_eq!(parse_player_cap(Some("2")).unwrap(), 2);
        assert_eq!(parse_player_cap(Some("8")).unwrap(), 8);
        assert_eq!(parse_player_cap(Some("512")).unwrap(), 512);
        for invalid in ["", "0", "1", "513", "-1", "abc", "8.5"] {
            assert!(
                parse_player_cap(Some(invalid)).is_err(),
                "unexpected admission cap accepted: {invalid}"
            );
        }
    }
}
