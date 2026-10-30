#[cfg(feature = "experimental-hit-delivery-lab")]
mod private_hit_delivery_lab;

use anyhow::{bail, Context, Result};
use myaso_server::{
    chat::{
        decode_send, encode_result, ChatPosition, ChatResult, LocalChatHub, MAX_CHAT_FRAME,
        OUTBOUND_QUEUE,
    },
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
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, Mutex};
use wtransport::{Connection, Endpoint, Identity, RecvStream, SendStream, ServerConfig, VarInt};

// Chat is an optional, lower-priority QUIC stream. Peer backpressure or a
// partial frame must never retain its sender/recipient routing indefinitely.
// An idle chat reader remains allowed to wait for its next *new* frame.
// C1 v1 optional, one-time chat stream preface (never a player message).
const CHAT_STREAM_PREFACE: [u8; 2] = [0x30, 1];
const CHAT_STREAM_SETUP_DEADLINE: Duration = Duration::from_secs(10);
const CHAT_FRAME_BODY_DEADLINE: Duration = Duration::from_secs(10);
const CHAT_STREAM_WRITE_DEADLINE: Duration = Duration::from_secs(10);
// A malicious opted-in peer can send fast *valid* requests after exhausting
// ChatHub rate tokens. Cap per-chat ingress BEFORE scanning live world fighters.
const MAX_CHAT_INGRESS_FRAMES_PER_SECOND: u16 = 64;

struct ChatIngressBudget {
    window_start: Instant,
    frames: u16,
}

impl ChatIngressBudget {
    fn new(now: Instant) -> Self {
        Self {
            window_start: now,
            frames: 0,
        }
    }

    fn consume(&mut self, now: Instant) -> bool {
        if now.saturating_duration_since(self.window_start) >= Duration::from_secs(1) {
            self.window_start = now;
            self.frames = 0;
        }
        if self.frames >= MAX_CHAT_INGRESS_FRAMES_PER_SECOND {
            return false;
        }
        self.frames += 1;
        true
    }
}

const GAME_PATH: &str = "/game";
const V2_LAB_HELLO: [u8; 8] = [2, 0x10, b'M', b'Y', b'A', b'S', b'O', b'1'];
const V2_LAB_GRANTED: [u8; 4] = [2, 0x13, 0, 0];
// Source11 is negotiated ONLY after the original authenticated v2 grant.
// This root reliable notification is a hint, never a player-selected lease.
const V2_RESPAWN_RENEW_REQUIRED: [u8; 4] = [2, 0x14, 0, 0];
const MAX_TYPED_RENEW_ATTEMPTS: usize = 8;
const TYPED_FRAME_DEADLINE: Duration = Duration::from_secs(2);
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

// Loopback-only M230 evidence: a sustained LMB hold legitimately produces
// many accepted heavy=true input samples, but only the exact dropped one-shot
// tick retransmitted by the original three-copy wire proves recovery.
// InputIngressWindow already deduplicates each accepted tick; never count the
// following held samples as more accepted actions or infer a second World HIT.
fn recovered_dropped_heavy_tick(
    accepted: &[InputSample],
    dropped_action_ticks: &VecDeque<u32>,
) -> Option<u32> {
    accepted
        .iter()
        .find(|sample| sample.heavy_attack && dropped_action_ticks.contains(&sample.tick))
        .map(|sample| sample.tick)
}

// One standard-input freshness fence per accepted QUIC connection. Reject an
// older WHOLE frame before sample dedup consumes its holes. Old genuine action
// samples inside a NEW frame still pass through the unchanged replay window.
#[derive(Default)]
struct StandardInputIngress {
    samples: InputIngressWindow,
    latest_accepted_packet_tick: Option<u32>,
}

impl StandardInputIngress {
    fn ingest(&mut self, packet: &myaso_server::InputPacket) -> myaso_server::AcceptedInputBatch {
        if self
            .latest_accepted_packet_tick
            .is_some_and(|previous| !is_tick_newer32(packet.client_tick, previous))
        {
            return myaso_server::AcceptedInputBatch::default();
        }
        let accepted = self.samples.ingest(packet);
        if !accepted.is_empty() {
            self.latest_accepted_packet_tick = Some(packet.client_tick);
        }
        accepted
    }
}

#[derive(Debug, Clone, Copy)]
struct LoopbackFlightConfig {
    background_players: usize,
    near_pressure_players: usize,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
    drop_following_input_datagrams: usize,
}

#[derive(Debug)]
enum ReliablePayload {
    Bytes(Vec<u8>),
    KillEvent(KillEventPacket),
    #[cfg(feature = "experimental-hit-delivery-lab")]
    PrivateHit(private_hit_delivery_lab::Outgoing),
}

struct GameState {
    world: World,
    // Connection-to-actor membership is server-owned, never on the Chat wire.
    chat_leases: BTreeMap<u32, u64>,
    #[cfg(feature = "experimental-hit-delivery-lab")]
    hit_lab: Option<private_hit_delivery_lab::PrivateHitLab>,
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
            chat_leases: BTreeMap::new(),
            #[cfg(feature = "experimental-hit-delivery-lab")]
            hit_lab: None,
            boot_nonce: 0,
            gesture_sessions: BTreeMap::new(),
            replication_frame,
            flight_background_ids,
            kill_events: VecDeque::with_capacity(MAX_KILL_EVENT_HISTORY),
            next_kill_event_sequence: 0,
        }
    }

    // A retired QUIC connection must never leave a generation-specific
    // typed path on the 60Hz World clock. Select by authoritative player
    // binding, never by a client-selected lease or numeric action ID.
    fn retire_gesture_paths_for_player(&mut self, player_id: u32) {
        self.gesture_sessions.retain(|_, path| {
            if path.binding().player_id == player_id {
                path.retire();
                false
            } else {
                true
            }
        });
    }

    // Core 8C: one atomic original-World decision for renewal. Neither a
    // client HELLO nor another player's typed seat can grant this authority.
    // The caller holds the World mutex and publishes the new active epoch
    // before releasing it; the root connection continues to own membership.
    fn authorize_typed_respawn_renewal(
        &mut self,
        player_id: u32,
        root_lease: u64,
        prior_epoch: u64,
        fresh_lease: u64,
        jump_review: bool,
    ) -> Result<()> {
        if self.chat_leases.get(&player_id) != Some(&root_lease) {
            bail!("original admitted gameplay lease has retired");
        }
        if fresh_lease == prior_epoch || self.gesture_sessions.contains_key(&fresh_lease) {
            bail!("typed generation epoch must be distinct and unused");
        }
        let old_binding = self
            .gesture_sessions
            .get(&prior_epoch)
            .ok_or_else(|| anyhow::anyhow!("typed predecessor missing"))?
            .binding();
        let current_actor = self
            .world
            .fighter(player_id)
            .ok_or_else(|| anyhow::anyhow!("authenticated actor missing"))?;
        if old_binding.player_id != player_id
            || old_binding.lease_epoch != prior_epoch
            || old_binding.boot_nonce != self.boot_nonce
            || old_binding.world_instance != self.world.world_instance()
            || current_actor.world_incarnation() == old_binding.incarnation
            || current_actor.hp <= 0.0
            || current_actor.action == myaso_server::simulation::Action::Dead
        {
            bail!("fresh authoritative World incarnation required for typed renewal");
        }
        let mut new_path = SessionGestureWorldPath::from_admitted_world(
            &self.world,
            player_id,
            fresh_lease,
            self.boot_nonce,
        )
        .ok_or_else(|| anyhow::anyhow!("new typed generation not admissible"))?;
        if jump_review {
            new_path.enable_jump_review();
        }
        // No old 16-byte DATAGRAM is given the successor's epoch or path.
        let mut old_path = self
            .gesture_sessions
            .remove(&prior_epoch)
            .ok_or_else(|| anyhow::anyhow!("old typed generation disappeared"))?;
        old_path.retire();
        self.gesture_sessions.insert(fresh_lease, new_path);
        Ok(())
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
    chat: Mutex<LocalChatHub>,
    chat_radius: f32,
    chat_enabled: bool,
    next_player_id: AtomicU32,
    next_lease_epoch: AtomicU64,
    reliable_write_delay: Duration,
    drop_new_action_datagrams: bool,
    drop_following_input_datagrams: usize,
}

impl SharedGame {
    fn new(
        flight: LoopbackFlightConfig,
        boot_nonce: u128,
        chat_radius: f32,
        chat_enabled: bool,
    ) -> Arc<Self> {
        let mut state = GameState::new(flight.background_players, flight.near_pressure_players);
        state.boot_nonce = boot_nonce;
        Arc::new(Self {
            state: Mutex::new(state),
            chat: Mutex::new(LocalChatHub::default()),
            chat_radius,
            chat_enabled,
            next_player_id: AtomicU32::new(1),
            next_lease_epoch: AtomicU64::new(1),
            reliable_write_delay: flight.reliable_write_delay,
            drop_new_action_datagrams: flight.drop_new_action_datagrams,
            drop_following_input_datagrams: flight.drop_following_input_datagrams,
        })
    }

    // Chat registration is optional: never wait on a congested chat hub
    // while holding the authoritative World mutex. A rejected attempt does
    // not consume this session's one successful Chat C1 subscription.
    async fn try_register_chat_stream(
        &self,
        player_id: u32,
        lease_epoch: u64,
        outgoing: mpsc::Sender<Vec<u8>>,
    ) -> bool {
        let state = self.state.lock().await;
        let current = state.chat_leases.get(&player_id) == Some(&lease_epoch);
        let alive = state.world.fighter(player_id).is_some_and(|fighter| {
            fighter.hp > 0.0 && fighter.action != myaso_server::simulation::Action::Dead
        });
        current
            && alive
            && self.chat.try_lock().ok().is_some_and(|mut hub| {
                hub.register(
                    player_id,
                    lease_epoch,
                    state.world.world_instance(),
                    outgoing,
                    Instant::now(),
                )
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
    // Independent operator-owned release capability. Never inferred from a
    // browser URL or experimental switch; the original admitted QUIC actor,
    // server nonce, World and replay fences remain authoritative.
    let instant_lmb = match env::var("MYASO_INSTANT_LMB_ENABLED").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(env::VarError::NotPresent) => false,
        Ok(_) => bail!("MYASO_INSTANT_LMB_ENABLED must be 0 or 1"),
        Err(error) => bail!("invalid MYASO_INSTANT_LMB_ENABLED: {error}"),
    };
    if instant_lmb && v2_lab {
        bail!("select one instant LMB release or experimental gesture profile");
    }
    let gesture_enabled = instant_lmb || v2_lab;
    // C1 requires BOTH an explicit operator gate and trusted first-party
    // served /game-config.json chatC1Enabled:true. A URL query is never server
    // authority. With C1 enabled, gesture negotiation uses the original
    // length-prefixed game bi stream; C1 exclusively owns optional uni streams.
    let chat_enabled = match env::var("MYASO_CHAT_C1_ENABLED").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(env::VarError::NotPresent) => false,
        Ok(_) => bail!("MYASO_CHAT_C1_ENABLED must be 0 or 1"),
        Err(error) => bail!("invalid MYASO_CHAT_C1_ENABLED: {error}"),
    };
    let chat_radius: f32 = env::var("MYASO_CHAT_RADIUS")
        .unwrap_or_else(|_| "160".to_owned())
        .parse()
        .context("MYASO_CHAT_RADIUS must be numeric")?;
    if !chat_radius.is_finite() || !(32.0..=160.0).contains(&chat_radius) {
        bail!("MYASO_CHAT_RADIUS must be within 32..=160 world units");
    }
    // An additional review-only gate beyond the old v2 source0 protocol.
    let jump_review = match env::var("MYASO_EXPERIMENTAL_JUMP_ATTACK_V2").as_deref() {
        Ok("1") => true,
        Ok("0") | Err(_) => false,
        Ok(_) => bail!("MYASO_EXPERIMENTAL_JUMP_ATTACK_V2 must be 0 or 1"),
    };
    if jump_review && (!v2_lab || !bind.ip().is_loopback()) {
        bail!("JumpAttack extension requires original loopback v2 gesture ingress");
    }
    let jump_review = jump_review || instant_lmb;
    // Legacy v1 boot remains unchanged; only the explicit v2 lab requires OS
    // CSPRNG. No entropy failure may accidentally block a disabled v1 game.
    let boot_nonce = if gesture_enabled {
        new_server_boot_nonce()?
    } else {
        0
    };
    let private_hit_setting = env::var("MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB").ok();
    let hit_lab_enabled = private_hit_lab_config(
        private_hit_setting.as_deref(),
        cfg!(feature = "experimental-hit-delivery-lab"),
        bind.ip().is_loopback(),
        v2_lab,
    )?;
    // Keep fail-closed configuration validation in default builds as well;
    // only the feature-gated laboratory consumes the enabled value.
    #[cfg(not(feature = "experimental-hit-delivery-lab"))]
    let _ = hit_lab_enabled;
    let game = SharedGame::new(flight, boot_nonce, chat_radius, chat_enabled);
    #[cfg(feature = "experimental-hit-delivery-lab")]
    if hit_lab_enabled {
        let mut state = game.state.lock().await;
        state.hit_lab = Some(private_hit_delivery_lab::PrivateHitLab::new(
            &state.world,
            boot_nonce,
        )?);
    }
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
    if flight_m121_input_proof
        && (!bind.ip().is_loopback() || !flight_action_proof || gesture_enabled)
    {
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
                // No synthetic flight actor or client-supplied chat identity.
                state.chat_leases.insert(player_id, lease_epoch);
                state.refresh_replication_frame();
            }

            let result = handle_connection(
                connection,
                player_id,
                lease_epoch,
                ExperimentalGestureSettings {
                    v2_lab: gesture_enabled,
                    jump_review,
                },
                flight_action_proof,
                flight_m121_input_proof,
                Arc::clone(&game),
            )
            .await;
            // Chat is never allowed to preserve a ghost peer after the actual
            // authoritative gameplay session is retired, even on error.
            game.chat.lock().await.unregister(player_id, lease_epoch);
            {
                let mut state = game.state.lock().await;
                let still_owned = state.chat_leases.get(&player_id) == Some(&lease_epoch);
                if still_owned {
                    state.chat_leases.remove(&player_id);
                }
                #[cfg(feature = "experimental-hit-delivery-lab")]
                if let Some(lab) = &mut state.hit_lab {
                    lab.remove(lease_epoch);
                }
                if let Some(mut gesture) = state.gesture_sessions.remove(&lease_epoch) {
                    gesture.retire();
                }
                if still_owned {
                    // Source11 can own a fresh server epoch distinct from
                    // the original root lease. Cleanup *all* remaining
                    // generations before retiring the original World actor.
                    state.retire_gesture_paths_for_player(player_id);
                    state.world.remove_player(player_id);
                    state.refresh_replication_frame();
                }
            }
            if let Err(error) = result {
                eprintln!("player {player_id} session ended: {error:#}");
            }
        });
    }
}

fn private_hit_lab_config(
    raw: Option<&str>,
    compiled: bool,
    loopback: bool,
    v2: bool,
) -> Result<bool> {
    let enabled = match raw {
        Some("1") => true,
        Some("0") | None => false,
        _ => bail!("MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB must be 0 or 1"),
    };
    if enabled && (!compiled || !loopback || !v2) {
        bail!("private HIT lab requires compiled feature, loopback and original v2 lab");
    }
    Ok(enabled)
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
    let drop_following_input_datagrams = env::var("MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS")
        .ok()
        .map(|value| {
            value
                .parse::<usize>()
                .context("MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS must be an integer")
        })
        .transpose()?
        .unwrap_or(0);
    if drop_following_input_datagrams > 2 {
        bail!("MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS must be between 0 and 2");
    }
    if drop_following_input_datagrams > 0 && !drop_new_action_datagrams {
        bail!("MYASO_FLIGHT_DROP_FOLLOWING_INPUT_DATAGRAMS requires MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS=1");
    }
    if background_players > MAX_FLIGHT_BACKGROUND_PLAYERS {
        bail!("MYASO_FLIGHT_BACKGROUND_PLAYERS exceeds bounded flight maximum");
    }
    if near_pressure_players > background_players {
        bail!("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS exceeds background player count");
    }
    if (background_players > 0
        || reliable_delay_ms > 0
        || drop_new_action_datagrams
        || drop_following_input_datagrams > 0)
        && !bind.ip().is_loopback()
    {
        bail!("flight impairment fixtures are permitted only on loopback binds");
    }
    Ok(LoopbackFlightConfig {
        background_players,
        near_pressure_players,
        reliable_write_delay: Duration::from_millis(reliable_delay_ms),
        drop_new_action_datagrams,
        drop_following_input_datagrams,
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
        if matches!(action, 3 | 6 | 9) {
            // Read-only, existing loopback-only flight proof. A native test
            // can release its real held LMB against the CURRENT server phase
            // without estimating two independent browser command clocks.
            lines.push(format!(
                "COMBAT4_NATIVE_WORLD_PHASE tick={tick} fighter={} action={action} elapsedMs={:.1}",
                fighter.net_id, fighter.action_elapsed_ms
            ));
        }
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
        // Original World event provenance at the actual collision/guard
        // resolution tick. Separate CORE8C namespace avoids changing the strict M201
        // phase-proof trace grammar. Loopback-only, read-only CI evidence; never a
        // recipient HIT receipt, transport ACK, or another event producer.
        let contact = match event {
            CombatEvent::Block { attacker, target } => Some(("BLOCK", *attacker, *target)),
            CombatEvent::Parry { attacker, target } => Some(("PARRY", *attacker, *target)),
            CombatEvent::Hit {
                attacker, target, ..
            } => Some(("HIT", *attacker, *target)),
            _ => None,
        };
        if let Some((outcome, attacker, target)) = contact {
            if let (Some(source), Some(defender)) = (world.fighter(attacker), world.fighter(target))
            {
                lines.push(format!(
                    "CORE8C_WORLD_CONTACT tick={tick} world={} outcome={outcome} attacker={attacker} target={target} attackerLife={} targetLife={} defenderAction={} defenderActionElapsedMs={:.1} defenderHp={:.1} defenderGuard={:.1}",
                    world.world_instance(),
                    source.world_incarnation(),
                    defender.world_incarnation(),
                    defender.action.wire_code(),
                    defender.action_elapsed_ms,
                    defender.hp,
                    defender.guard,
                ));
            }
        }
    }
    lines
}

// Read-only loopback QA: the state immediately before the actual World step
// is the only valid baseline for an exact stamina cost. A browser snapshot
// taken several ticks earlier may omit intervening authoritative regeneration.
fn m173_original_jump_spend_lines(world: &World, before: &BTreeMap<u32, (u8, f32)>) -> Vec<String> {
    let mut lines = Vec::new();
    for fighter in world.fighters() {
        if fighter.net_id >= FLIGHT_BACKGROUND_NET_ID_BASE {
            continue;
        }
        if let Some(&(before_action, before_stamina)) = before.get(&fighter.net_id) {
            if before_action == 0 && fighter.action.wire_code() == 15 {
                lines.push(format!(
                    "M173_AUTH_JUMP_SPEND tick={} fighter={} before={:.4} after={:.4} cost={:.4}",
                    world.tick,
                    fighter.net_id,
                    before_stamina,
                    fighter.stamina,
                    before_stamina - fighter.stamina,
                ));
            }
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
        let before_jump_stamina: BTreeMap<u32, (u8, f32)> = if flight_action_proof {
            state
                .world
                .fighters()
                .iter()
                .map(|fighter| {
                    (
                        fighter.net_id,
                        (fighter.action.wire_code(), fighter.stamina),
                    )
                })
                .collect()
        } else {
            BTreeMap::new()
        };
        state.world.step_into(&mut events);
        #[cfg(feature = "experimental-hit-delivery-lab")]
        {
            let GameState { world, hit_lab, .. } = &mut *state;
            if let Some(lab) = hit_lab {
                if let Err(error) = lab.committed_step(world, &events) {
                    eprintln!("private HIT delivery halted: {error}");
                    lab.fail_all();
                }
            }
        }
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
            for line in m173_original_jump_spend_lines(&state.world, &before_jump_stamina) {
                println!("{line}");
            }
        }
        state.record_combat_events(&events);
        if state.world.tick % SNAPSHOT_EVERY_SERVER_TICKS == 0 {
            state.refresh_replication_frame();
        }
    }
}

// The optional stream owns no gameplay lifetime. Retiring the original
// admitted session must cancel a pending chat read even if the peer keeps
// its QUIC connection open and never sends another byte.
struct ChatTaskAbortGuard(Option<tokio::task::AbortHandle>);
impl Drop for ChatTaskAbortGuard {
    fn drop(&mut self) {
        if let Some(handle) = self.0.take() {
            handle.abort();
        }
    }
}

// All extra typed streams must terminate with their ORIGINAL admitted QUIC
// session. The root reliable and optional Chat C1 readers have separate owners.
struct TypedTaskAbortGuard(Vec<tokio::task::AbortHandle>);
impl Drop for TypedTaskAbortGuard {
    fn drop(&mut self) {
        for handle in self.0.drain(..) {
            handle.abort();
        }
    }
}

#[derive(Clone, Copy)]
struct ExperimentalGestureSettings {
    v2_lab: bool,
    jump_review: bool,
}

async fn handle_connection(
    connection: Connection,
    player_id: u32,
    lease_epoch: u64,
    gesture_settings: ExperimentalGestureSettings,
    flight_action_proof: bool,
    flight_m121_input_proof: bool,
    game: Arc<SharedGame>,
) -> Result<()> {
    let ExperimentalGestureSettings {
        v2_lab,
        jump_review,
    } = gesture_settings;
    let connection = Arc::new(connection);
    let stable_id = connection.stable_id();
    let remote = connection.remote_address();
    println!("session {stable_id} assigned player {player_id} from {remote}");

    let mut v2_enabled = false;
    let current_typed_epoch = Arc::new(AtomicU64::new(lease_epoch));
    let mut typed_tasks = TypedTaskAbortGuard(Vec::new());
    let mut renewal_attempts = 0_usize;
    let mut notified_incarnation = 0_u64;
    let mut legacy_combat_seen = false;
    let mut ingress = StandardInputIngress::default();
    let mut snapshots = SnapshotSession::default();
    let mut reliable_snapshots = SnapshotSession::default();
    let mut last_input_sequence = None;
    let mut dropped_action_ticks = VecDeque::with_capacity(MAX_DROPPED_ACTION_TICKS);
    // One bounded diagnostic window per original QUIC session. The impairment
    // fixture is loopback-only and OFF in the normal server configuration.
    let mut first_loss_probe_seen = false;
    let mut first_loss_probe_packets_remaining = 0_u8;
    let mut followup_input_datagrams_to_drop = 0_usize;
    let mut pending_input_acks = VecDeque::with_capacity(MAX_PENDING_INPUT_ACKS);
    let (mut reliable_send, mut reliable_recv) = connection
        .accept_bi()
        .await
        .context("accept reliable game stream")?;
    let (initial_frame, mut next_kill_event_sequence, hit_lab_enabled) = {
        let state = game.state.lock().await;
        #[cfg(feature = "experimental-hit-delivery-lab")]
        let hit_lab_enabled = state.hit_lab.is_some();
        #[cfg(not(feature = "experimental-hit-delivery-lab"))]
        let hit_lab_enabled = false;
        (
            Arc::clone(&state.replication_frame),
            state.next_kill_event_sequence,
            hit_lab_enabled,
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
    #[cfg(feature = "experimental-hit-delivery-lab")]
    let (private_written_tx, mut private_written_rx) = mpsc::channel(1);
    let reliable_write_delay = game.reliable_write_delay;
    let mut reliable_writer = tokio::spawn(async move {
        while let Some(payload) = reliable_rx.recv().await {
            if !reliable_write_delay.is_zero() {
                tokio::time::sleep(reliable_write_delay).await;
            }
            prepare_reliable_payload(&mut reliable_frame_buffer, &payload)?;
            #[cfg(feature = "experimental-hit-delivery-lab")]
            if let ReliablePayload::PrivateHit(outgoing) = &payload {
                tokio::time::timeout(
                    Duration::from_millis(private_hit_delivery_lab::WRITE_TIMEOUT_MS),
                    reliable_send.write_all(&reliable_frame_buffer),
                )
                .await
                .context("private HIT writer timeout")?
                .context("private HIT frame write")?;
                if matches!(
                    outgoing.kind,
                    private_hit_delivery_lab::WrittenKind::Terminal
                ) {
                    // Terminal GAP/retirement drains this original reliable
                    // stream through FIN before closing its private connection.
                    tokio::time::timeout(
                        Duration::from_millis(private_hit_delivery_lab::WRITE_TIMEOUT_MS),
                        reliable_send.finish(),
                    )
                    .await
                    .context("private HIT terminal FIN timeout")?
                    .context("private HIT terminal FIN")?;
                }
                private_written_tx
                    .send(outgoing.kind)
                    .await
                    .context("private HIT write completion receiver")?;
                continue;
            }
            reliable_send
                .write_all(&reliable_frame_buffer)
                .await
                .context("write reliable frame")?;
        }
        Ok::<(), anyhow::Error>(())
    });
    #[cfg(feature = "experimental-hit-delivery-lab")]
    let _private_writer_guard = hit_lab_enabled
        .then(|| private_hit_delivery_lab::WriterAbortGuard(reliable_writer.abort_handle()));
    let mut private_control_buffer = [0_u8; 34];
    let mut private_control_used = 0_usize;
    let mut private_control_window = tokio::time::Instant::now();
    let mut private_control_count = 0_u32;
    let mut private_write_pending = false;
    let mut private_write_deadline = None;
    #[cfg(feature = "experimental-hit-delivery-lab")]
    let mut private_write_turn = false;
    let mut chat_task_guard = ChatTaskAbortGuard(None);
    let mut chat_started = false;
    // Rejected registration can be retried after respawn or transient
    // chat-lock contention, without allowing unlimited stream-open churn.
    let mut chat_retry_allowed_at = Instant::now();
    let mut snapshot_interval = tokio::time::interval(SNAPSHOT_INTERVAL);
    snapshot_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            incoming_chat = connection.accept_uni(),
                if game.chat_enabled && !chat_started && Instant::now() >= chat_retry_allowed_at => {
                // Stream belongs only to this already-admitted QUIC game
                // connection, not a second identity or recipient list.
                let incoming_chat = incoming_chat.context("accept local chat stream")?;
                let (chat_tx, chat_rx) = mpsc::channel(OUTBOUND_QUEUE);
                if !game.try_register_chat_stream(player_id, lease_epoch, chat_tx.clone()).await {
                    // E.g. actor was still dead or the optional chat hub was
                    // occupied. Only this stream is refused, not the Combat
                    // session. Allow a later attempt after a bounded pause.
                    chat_retry_allowed_at = Instant::now() + Duration::from_millis(500);
                    continue;
                }
                // A failed registration must NOT permanently burn the only
                // C1 stream slot for this authenticated gameplay session.
                chat_started = true;
                let chat_game = Arc::clone(&game);
                let chat_connection = Arc::clone(&connection);
                let task = tokio::spawn(async move {
                    let outcome = run_chat_stream(
                        chat_connection, incoming_chat, chat_tx, chat_rx,
                        player_id, lease_epoch, Arc::clone(&chat_game)
                    ).await;
                    chat_game.chat.lock().await.unregister(player_id, lease_epoch);
                    if let Err(error) = outcome {
                        // Optional stream failure cannot close gameplay; no
                        // user's text is ever logged by this task.
                        eprintln!("player {player_id} isolated chat stream ended: {error:#}");
                    }
                });
                chat_task_guard.0 = Some(task.abort_handle());
            }
            writer_result = &mut reliable_writer => {
                match writer_result {
                    Ok(Ok(())) => bail!("reliable writer ended unexpectedly"),
                    Ok(Err(error)) => return Err(error),
                    Err(error) => bail!("reliable writer task failed: {error}"),
                }
            }
            // Cancellation-safe incremental reads on the ORIGINAL bi stream.
            // No bytes are consumed when the private compile/runtime gates are off.
            private_read = async {
                if (v2_lab && !v2_enabled) || (hit_lab_enabled && v2_enabled && !private_write_pending) {
                    // Read only the current bounded frame. Never swallow a
                    // subsequent private control while completing a HELLO.
                    let end = if private_control_used < 2 { 2 } else {
                        2 + u16::from_le_bytes(private_control_buffer[..2].try_into().unwrap()) as usize
                    };
                    reliable_recv.read(&mut private_control_buffer[private_control_used..end]).await
                        .map_err(|error| anyhow::anyhow!("private HIT control read: {error}"))
                } else { std::future::pending().await }
            } => {
                let count = private_read?.ok_or_else(|| anyhow::anyhow!("private HIT control stream closed"))?;
                private_control_used += count;
                if private_control_used < 2 { continue; }
                let size = u16::from_le_bytes(private_control_buffer[..2].try_into().unwrap()) as usize;
                if !((size == 8 && v2_lab && !v2_enabled)
                    || (size == 32 && hit_lab_enabled && v2_enabled)) {
                    bail!("unnegotiated or invalid original-stream control frame");
                }
                if private_control_used == size + 2 {
                    if private_control_window.elapsed() >= Duration::from_secs(1) {
                        private_control_window = tokio::time::Instant::now();
                        private_control_count = 0;
                    }
                    private_control_count += 1;
                    if private_control_count > 32 { bail!("private HIT control rate exceeded"); }
                    if size == 8 {
                        if private_control_buffer[2..10] != V2_LAB_HELLO || legacy_combat_seen {
                            bail!("invalid or late original-stream gesture HELLO");
                        }
                        v2_enabled = grant_gesture_session(
                            &game, &connection, player_id, lease_epoch, jump_review, &reliable_tx
                        ).await?;
                    } else {
                        #[cfg(feature = "experimental-hit-delivery-lab")]
                        {
                        let mut state = game.state.lock().await;
                        let GameState { world, hit_lab, .. } = &mut *state;
                        hit_lab.as_mut().ok_or_else(|| anyhow::anyhow!("private HIT disabled"))?
                            .control(world, lease_epoch, &private_control_buffer[2..])?;
                        }
                    }
                    private_control_used = 0;
                }
            }
            completion = async {
                #[cfg(feature = "experimental-hit-delivery-lab")]
                { private_written_rx.recv().await }
                #[cfg(not(feature = "experimental-hit-delivery-lab"))]
                { std::future::pending::<Option<()>>().await }
            } => {
                #[cfg(feature = "experimental-hit-delivery-lab")]
                {
                    let completion = completion.ok_or_else(|| anyhow::anyhow!("private HIT writer completion closed"))?;
                    let mut state = game.state.lock().await;
                    let GameState { world, hit_lab, .. } = &mut *state;
                    hit_lab.as_mut().ok_or_else(|| anyhow::anyhow!("private HIT disabled"))?
                        .written(world, lease_epoch, completion)?;
                }
                #[cfg(not(feature = "experimental-hit-delivery-lab"))]
                let _ = completion;
                private_write_pending = false;
                private_write_deadline = None;
            }
            _ = async {
                if let Some(deadline) = private_write_deadline {
                    tokio::time::sleep_until(deadline).await;
                } else { std::future::pending().await }
            } => { bail!("private HIT reliable writer exceeded 1500ms; no delivery claimed"); }
            // Source11 owns only ADDITIONAL admitted game bidi streams. The
            // original reliable bidi and Chat C1 optional uni remain untouched.
            new_typed = connection.accept_bi(), if v2_enabled && renewal_attempts < MAX_TYPED_RENEW_ATTEMPTS => {
                let (send, recv) = new_typed.context("accept optional typed renewal bidi")?;
                renewal_attempts += 1;
                let game = Arc::clone(&game);
                let active = Arc::clone(&current_typed_epoch);
                let task = tokio::spawn(async move {
                    if let Err(error) = run_respawn_typed_channel(
                        send, recv, TypedRenewContext {
                            game, player_id, root_lease: lease_epoch, active,
                            jump_review, flight_action_proof,
                        }
                    ).await {
                        eprintln!("optional respawn typed stream rejected: {error:#}");
                    }
                });
                typed_tasks.0.push(task.abort_handle());
            }
            // Separate negotiated client uni stream, on the admitted QUIC
            // connection. No datagram or query parameter can enable v2.
            negotiation = connection.accept_uni(), if v2_lab && !v2_enabled && !game.chat_enabled => {
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
                            v2_enabled = grant_gesture_session(
                                &game, &connection, player_id, lease_epoch, jump_review, &reliable_tx
                            ).await?;
                        }
                    }
                }
            }
            datagram = connection.receive_datagram() => {
                let datagram = datagram?;
                if is_v2_event(datagram.as_ref()) {
                    if !v2_enabled { continue; }
                    // Old 16-byte DATAGRAMs NEVER lookup or acquire the fresh
                    // incarnation path, including delayed/duplicated packets.
                    if current_typed_epoch.load(Ordering::Acquire) != lease_epoch { continue; }
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

                // Optional loopback-only M230 stress: after dropping the first
                // authentic rising-action datagram, drop the next bounded number
                // of actual input datagrams before ingress. No packet is forged,
                // resent, widened, or acknowledged by this fixture.
                if followup_input_datagrams_to_drop > 0 {
                    let wire_samples = packet.samples().iter().take(3)
                        .map(|sample| format!("{}:{}:{}", sample.tick, u8::from(sample.attack), u8::from(sample.heavy_attack)))
                        .collect::<Vec<_>>().join(",");
                    followup_input_datagrams_to_drop -= 1;
                    println!(
                        "CORE8A_FOLLOWING_INPUT_DATAGRAM_DROPPED session={stable_id} packet_tick={} remaining_after={} wire_tick_attack_heavy=[{wire_samples}]",
                        packet.client_tick,
                        followup_input_datagrams_to_drop,
                    );
                    continue;
                }

                if game.drop_new_action_datagrams {
                    if let Some(action_tick) =
                        register_new_action_datagram(packet.samples(), &mut dropped_action_ticks)
                    {
                        println!(
                            "M63_INPUT_ACTION_PACKET_DROPPED session={stable_id} tick={action_tick} packet_tick={}",
                            packet.client_tick
                        );
                        if !first_loss_probe_seen {
                            // Read-only proof from the actual dropped QUIC packet:
                            // did we drop an initial light PRESS, or a heavy edge?
                            if let Some(sample) = packet.samples().iter().find(|s| s.tick == action_tick) {
                                println!(
                                    "CORE8A_FIRST_LOSS_DROP session={stable_id} action_tick={action_tick} packet_tick={} mask={} attack={} heavy={}",
                                    packet.client_tick,
                                    one_shot_action_mask(sample),
                                    u8::from(sample.attack),
                                    u8::from(sample.heavy_attack)
                                );
                            }
                            first_loss_probe_seen = true;
                            first_loss_probe_packets_remaining = 4;
                            followup_input_datagrams_to_drop = game.drop_following_input_datagrams;
                        }
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
                if game.drop_new_action_datagrams && first_loss_probe_packets_remaining > 0 {
                    // At most four post-drop datagrams. No raw bytes, tokens,
                    // capabilities, addresses, or client-authored HIT claims.
                    let wire_samples = packet.samples().iter().take(3)
                        .map(|s| format!("{}:{}:{}", s.tick, u8::from(s.attack), u8::from(s.heavy_attack)))
                        .collect::<Vec<_>>().join(",");
                    let accepted_samples = accepted.iter().take(3)
                        .map(|s| format!("{}:{}:{}", s.tick, u8::from(s.attack), u8::from(s.heavy_attack)))
                        .collect::<Vec<_>>().join(",");
                    println!(
                        "CORE8A_FIRST_LOSS_INGRESS session={stable_id} packet_tick={} wire_tick_attack_heavy=[{wire_samples}] accepted_tick_attack_heavy=[{accepted_samples}]",
                        packet.client_tick
                    );
                    first_loss_probe_packets_remaining -= 1;
                }
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
                            // M230: prove the original dropped action tick
                            // survived ingress redundancy, not each later held
                            // heavy sample (which would falsely look like
                            // multiple accepted original heavy actions).
                            if let Some(action_tick) = recovered_dropped_heavy_tick(
                                accepted.as_slice(), &dropped_action_ticks,
                            ) {
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
                // Original root reliable is only a notification plane. The
                // current World incarnation is read under the same mutex used
                // for typed admission. A dropped signal is retried (bounded
                // by once per 50ms snapshot), never treated as a grant.
                if v2_enabled {
                    let incarnation = {
                        let state = game.state.lock().await;
                        let active = current_typed_epoch.load(Ordering::Acquire);
                        state.gesture_sessions.get(&active).and_then(|path| {
                            state.world.fighter(player_id).and_then(|fighter| {
                                let binding = path.binding();
                                (state.chat_leases.get(&player_id) == Some(&lease_epoch)
                                    && fighter.hp > 0.0
                                    && fighter.action != myaso_server::simulation::Action::Dead
                                    && binding.incarnation != fighter.world_incarnation()
                                    && binding.world_instance == state.world.world_instance())
                                    .then_some(fighter.world_incarnation())
                            })
                        })
                    };
                    if let Some(incarnation) = incarnation {
                        if notified_incarnation != incarnation {
                            match try_enqueue_reliable(&reliable_tx, || {
                                ReliablePayload::Bytes(V2_RESPAWN_RENEW_REQUIRED.to_vec())
                            }) {
                                Ok(true) => notified_incarnation = incarnation,
                                Ok(false) => {},
                                Err(ReliableQueueError::Closed) => bail!("original reliable writer retired"),
                            }
                        }
                    }
                }
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
                #[cfg(feature = "experimental-hit-delivery-lab")]
                if hit_lab_enabled {
                    // At most one private frame on alternate existing snapshot
                    // intervals, leaving the original snapshot/kill writer fair.
                    private_write_turn = !private_write_turn;
                    if private_write_turn && v2_enabled && !private_write_pending {
                        let outgoing = {
                            let state = game.state.lock().await;
                            match &state.hit_lab {
                                Some(lab) => lab.next_frame(&state.world, lease_epoch)?,
                                None => None,
                            }
                        };
                        if let Some(outgoing) = outgoing {
                            if try_enqueue_reliable(&reliable_tx, || ReliablePayload::PrivateHit(outgoing))
                                .map_err(|_| anyhow::anyhow!("private HIT writer unavailable"))? {
                                private_write_pending = true;
                                private_write_deadline = Some(tokio::time::Instant::now()
                                    + Duration::from_millis(private_hit_delivery_lab::WRITE_TIMEOUT_MS));
                            }
                        }
                    }
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

struct TypedRenewContext {
    game: Arc<SharedGame>,
    player_id: u32,
    root_lease: u64,
    active: Arc<AtomicU64>,
    jump_review: bool,
    flight_action_proof: bool,
}

// Source11: independent, length-framed 16-byte source0 events AND same-stream
// 16-byte ACKs. An 8-byte legacy HELLO grants nothing by itself: only the
// server-owned live incarnation, original ROOT lease and boot nonce may bind
// the next channel. All error paths retire this optional stream, not gameplay.
async fn run_respawn_typed_channel(
    mut send: SendStream,
    mut recv: RecvStream,
    context: TypedRenewContext,
) -> Result<()> {
    let TypedRenewContext {
        game,
        player_id,
        root_lease,
        active,
        jump_review,
        flight_action_proof,
    } = context;
    let mut hello = [0_u8; 8];
    tokio::time::timeout(TYPED_FRAME_DEADLINE, recv.read_exact(&mut hello))
        .await
        .context("respawn typed HELLO deadline")?
        .context("respawn typed HELLO read")?;
    if hello != V2_LAB_HELLO {
        bail!("invalid respawn typed HELLO");
    }
    let fresh_lease = game
        .allocate_lease_epoch()
        .ok_or_else(|| anyhow::anyhow!("typed lease allocator exhausted"))?;
    {
        let mut state = game.state.lock().await;
        let prior_epoch = active.load(Ordering::Acquire);
        state.authorize_typed_respawn_renewal(
            player_id,
            root_lease,
            prior_epoch,
            fresh_lease,
            jump_review,
        )?;
        active.store(fresh_lease, Ordering::Release);
    }
    let mut buffer = Vec::with_capacity(18);
    tokio::time::timeout(
        TYPED_FRAME_DEADLINE,
        send_reliable_frame(&mut send, &mut buffer, &V2_LAB_GRANTED),
    )
    .await
    .context("bound typed GRANT writer deadline")?
    .context("send bound typed GRANT")?;
    let mut next_expected = 1_u32;
    loop {
        // Idle first-byte waits for a real physical gesture. A partial frame
        // must complete promptly or this stream closes; Combat stays alive.
        let mut len = [0_u8; 2];
        recv.read_exact(&mut len[..1])
            .await
            .context("read typed frame first byte")?;
        tokio::time::timeout(TYPED_FRAME_DEADLINE, recv.read_exact(&mut len[1..]))
            .await
            .context("partial typed header timed out")?
            .context("read typed frame second byte")?;
        if u16::from_le_bytes(len) != 16 {
            bail!("invalid bound typed frame size");
        }
        let mut event_bytes = [0_u8; 16];
        tokio::time::timeout(TYPED_FRAME_DEADLINE, recv.read_exact(&mut event_bytes))
            .await
            .context("partial typed body timed out")?
            .context("read bound typed event")?;
        let typed = decode_typed_event(&event_bytes)
            .map_err(|_| anyhow::anyhow!("invalid bound typed source0 event"))?;
        if typed.event.sequence > next_expected {
            // Same conservative consecutive edge fence as original datagram
            // path; reliable stream already preserves sender write ordering.
            bail!("typed sequence gap on bound generation");
        }
        let mut proof = None;
        let receipt = {
            let mut state = game.state.lock().await;
            if active.load(Ordering::Acquire) != fresh_lease
                || state.chat_leases.get(&player_id) != Some(&root_lease)
            {
                break;
            }
            let before = if flight_action_proof {
                state.world.fighter(player_id).map(|f| f.action.wire_code())
            } else {
                None
            };
            let nonce = state.boot_nonce;
            let reply = state
                .gesture_sessions
                .remove(&fresh_lease)
                .and_then(|mut path| {
                    let ack = path.accept_under_world_lock(
                        &mut state.world,
                        fresh_lease,
                        nonce,
                        &event_bytes,
                    );
                    state.gesture_sessions.insert(fresh_lease, path);
                    ack
                });
            if let (Some(from), Some(ack)) = (before, reply) {
                if let Some(to) = state.world.fighter(player_id).map(|f| f.action.wire_code()) {
                    proof = Some(m201_gesture_action_proof_line(
                        state.world.tick,
                        player_id,
                        typed,
                        ack,
                        from,
                        to,
                    ));
                }
            }
            reply
        };
        if let Some(line) = proof {
            println!("{line}");
        }
        if let Some(ack) = receipt {
            if active.load(Ordering::Acquire) != fresh_lease {
                break;
            }
            let bytes =
                encode_ack(ack).map_err(|e| anyhow::anyhow!("bound typed ACK encoding: {e:?}"))?;
            tokio::time::timeout(
                TYPED_FRAME_DEADLINE,
                send_reliable_frame(&mut send, &mut buffer, &bytes),
            )
            .await
            .context("bound typed ACK deadline")?
            .context("send bound typed ACK")?;
            if ack.status == myaso_server::prealpha_lmb_gesture_proposal::AckStatus::Stale {
                break;
            }
            if ack.status == myaso_server::prealpha_lmb_gesture_proposal::AckStatus::Accepted {
                next_expected = typed.event.sequence.saturating_add(1);
            }
        }
    }
    Ok(())
}

async fn grant_gesture_session(
    game: &SharedGame,
    _connection: &Arc<Connection>,
    player_id: u32,
    lease_epoch: u64,
    jump_review: bool,
    reliable_tx: &mpsc::Sender<ReliablePayload>,
) -> Result<bool> {
    let mut state = game.state.lock().await;
    let Some(mut path) = SessionGestureWorldPath::from_admitted_world(
        &state.world,
        player_id,
        lease_epoch,
        state.boot_nonce,
    ) else {
        return Ok(false);
    };
    #[cfg(feature = "experimental-hit-delivery-lab")]
    {
        let GameState { world, hit_lab, .. } = &mut *state;
        if let Some(lab) = hit_lab {
            lab.admit(world, player_id, lease_epoch, Arc::clone(_connection))?;
        }
    }
    if jump_review {
        path.enable_jump_review();
    }
    state.gesture_sessions.insert(lease_epoch, path);
    drop(state);
    reliable_tx
        .send(ReliablePayload::Bytes(V2_LAB_GRANTED.to_vec()))
        .await
        .context("send reliable experimental v2 grant")?;
    Ok(true)
}

async fn read_chat_frame(recv: &mut RecvStream) -> Result<Vec<u8>> {
    let mut length = [0_u8; 2];
    // The first byte may wait indefinitely for an idle, connected player.
    // Once the peer begins a frame, it must complete even the length prefix
    // promptly. Otherwise a single byte can pin its optional chat task.
    recv.read_exact(&mut length[..1])
        .await
        .context("read first chat length byte")?;
    tokio::time::timeout(CHAT_FRAME_BODY_DEADLINE, recv.read_exact(&mut length[1..]))
        .await
        .context("chat frame header timed out")?
        .context("read remaining chat length byte")?;
    let size = u16::from_le_bytes(length) as usize;
    if size != CHAT_STREAM_PREFACE.len() && !(9..=MAX_CHAT_FRAME).contains(&size) {
        bail!("invalid local chat frame length");
    }
    let mut bytes = vec![0; size];
    tokio::time::timeout(CHAT_FRAME_BODY_DEADLINE, recv.read_exact(&mut bytes))
        .await
        .context("chat frame body timed out")?
        .context("read bounded chat frame")?;
    Ok(bytes)
}

async fn run_chat_stream(
    connection: Arc<Connection>,
    mut reader: RecvStream,
    outbound: mpsc::Sender<Vec<u8>>,
    mut outgoing: mpsc::Receiver<Vec<u8>>,
    player_id: u32,
    lease_epoch: u64,
    game: Arc<SharedGame>,
) -> Result<()> {
    let mut writer = tokio::time::timeout(CHAT_STREAM_SETUP_DEADLINE, async {
        connection
            .open_uni()
            .await
            .context("open isolated chat reply stream")?
            .await
            .context("initialize isolated chat reply stream")
    })
    .await
    .context("local chat reply stream setup timed out")??;
    let mut violations = 0_u8;
    let mut first_frame_seen = false;
    let mut ingress_budget = ChatIngressBudget::new(Instant::now());
    loop {
        // Preserve an in-progress length-prefixed read while servicing queued
        // outbound chat. read_exact is NOT cancellation-safe: recreating its
        // future after each send would drop consumed header/body bytes and
        // desynchronize the next chat frame under bidirectional traffic.
        let inbound = read_chat_frame(&mut reader);
        tokio::pin!(inbound);
        loop {
            tokio::select! {
                frame = &mut inbound => {
                    let frame = frame?;
                    // Accept one no-message preface only before the first
                    // ChatSend. Legacy clients can send ChatSend directly.
                    // A preface never costs rate tokens or creates an ACK.
                    if frame.len() == CHAT_STREAM_PREFACE.len() {
                        if !first_frame_seen && frame.as_slice() == CHAT_STREAM_PREFACE {
                            first_frame_seen = true;
                            break;
                        }
                        bail!("invalid or out-of-order chat preface");
                    }
                    first_frame_seen = true;
                    if !ingress_budget.consume(Instant::now()) {
                        // Isolate abusive chat traffic without closing the
                        // realtime combat datagram/gameplay stream.
                        bail!("local chat ingress frame budget exceeded");
                    }
                    let correlation = if frame.len() >= 7 {
                        u32::from_le_bytes(frame[3..7].try_into().expect("length checked"))
                    } else { 0 };
                    let result = match decode_send(&frame) {
                        Ok(request) => {
                            let state = game.state.lock().await;
                            // Route from the SAME original World snapshot
                            // while the 60Hz tick is frozen by its mutex.
                            if state.chat_leases.get(&player_id) != Some(&lease_epoch) {
                                ChatResult { correlation: request.correlation,
                                    code: myaso_server::chat::ChatCode::Unauthorized,
                                    message_id: 0 }
                            } else {
                                let instance = state.world.world_instance();
                                let positions: Vec<ChatPosition> = state.world.fighters().iter()
                                    .filter_map(|fighter| {
                                        let actor_lease = *state.chat_leases.get(&fighter.net_id)?;
                                        Some(ChatPosition {
                                            player_id: fighter.net_id,
                                            world_instance: instance,
                                            lease_epoch: actor_lease,
                                            alive: fighter.hp > 0.0 &&
                                                fighter.action != myaso_server::simulation::Action::Dead,
                                            x: fighter.x, y: fighter.y,
                                        })
                                    }).collect();
                                // IMPORTANT: try_lock, never .lock().await
                                // while holding World. Congested chat gets an
                                // unavailable reply rather than stalling combat.
                                match game.chat.try_lock() {
                                    Ok(mut hub) => hub.route(
                                        (player_id, lease_epoch), &request, &positions,
                                        game.chat_radius, state.world.tick, Instant::now()
                                    ),
                                    Err(_) => ChatResult {
                                        correlation: request.correlation,
                                        code: myaso_server::chat::ChatCode::Unavailable,
                                        message_id: 0,
                                    }
                                }
                            }
                        }
                        Err(code) => {
                            violations = violations.saturating_add(1);
                            ChatResult { correlation, code, message_id: 0 }
                        }
                    };
                    outbound.try_send(encode_result(result))
                        .map_err(|_| anyhow::anyhow!("chat result queue full or disconnected"))?;
                    if violations >= 8 {
                        bail!("too many malformed chat frames");
                    }
                    break; // Completed one frame; only now create the next reader.
                }
                maybe = outgoing.recv() => {
                    let Some(payload) = maybe else { return Ok(()); };
                    let length = u16::try_from(payload.len())
                        .context("chat response length overflow")?;
                    tokio::time::timeout(CHAT_STREAM_WRITE_DEADLINE, async {
                        writer.write_all(&length.to_le_bytes()).await
                            .context("write chat reply length")?;
                        writer.write_all(&payload).await
                            .context("write chat reply frame")
                    }).await.context("local chat reply write timed out")??;
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
        #[cfg(feature = "experimental-hit-delivery-lab")]
        ReliablePayload::PrivateHit(outgoing) => prepare_reliable_frame(framed, &outgoing.bytes),
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

    #[tokio::test]
    async fn c1_optional_stream_registration_can_retry_after_contention_and_respawn() {
        let game = SharedGame::new(
            LoopbackFlightConfig {
                background_players: 0,
                near_pressure_players: 0,
                reliable_write_delay: Duration::ZERO,
                drop_new_action_datagrams: false,
                drop_following_input_datagrams: 0,
            },
            1,
            160.0,
            true,
        );
        let (tx, _rx) = mpsc::channel(OUTBOUND_QUEUE);
        {
            let mut state = game.state.lock().await;
            state.chat_leases.insert(1, 77);
            // Actor does not exist yet (same restriction as a dead actor):
            // a client-owned uni stream cannot register by merely asking.
        }
        assert!(!game.try_register_chat_stream(1, 77, tx.clone()).await);
        {
            let mut state = game.state.lock().await;
            assert!(state.world.add_player(1)); // Original World respawn.
        }
        assert!(!game.try_register_chat_stream(1, 76, tx.clone()).await);
        let hub_guard = game.chat.lock().await;
        assert!(!game.try_register_chat_stream(1, 77, tx.clone()).await);
        drop(hub_guard); // Optional chat congestion clears.
        assert!(game.try_register_chat_stream(1, 77, tx.clone()).await);
        assert!(!game.try_register_chat_stream(1, 77, tx.clone()).await); // No duplicate.
        game.chat.lock().await.unregister(1, 77);
        // Old retired lease cannot re-register after same player ID rejoins.
        game.state.lock().await.chat_leases.insert(1, 88);
        assert!(!game.try_register_chat_stream(1, 77, tx.clone()).await);
        assert!(game.try_register_chat_stream(1, 88, tx).await);
    }

    #[test]
    fn private_hit_activation_requires_every_independent_engineering_gate() {
        for compiled in [false, true] {
            for loopback in [false, true] {
                for v2 in [false, true] {
                    assert!(!private_hit_lab_config(None, compiled, loopback, v2).unwrap());
                    assert!(!private_hit_lab_config(Some("0"), compiled, loopback, v2).unwrap());
                    assert_eq!(
                        private_hit_lab_config(Some("1"), compiled, loopback, v2).is_ok(),
                        compiled && loopback && v2
                    );
                }
            }
        }
        assert!(private_hit_lab_config(Some("true"), true, true, true).is_err());
    }

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
    fn m230_recovery_logs_only_the_original_dropped_heavy_tick() {
        // Regression for protected M108: the first real held-LMB packet is
        // deliberately dropped at tick59; accepted redundancy contains tick59
        // plus newer held tick60. Later 17 sustained heavy samples must never
        // masquerade as 17 more original replayed action ticks.
        let mut dropped = VecDeque::new();
        let first = [
            action_sample(59, true),
            action_sample(58, false),
            action_sample(57, false),
        ];
        assert_eq!(register_new_action_datagram(&first, &mut dropped), Some(59));
        assert_eq!(
            recovered_dropped_heavy_tick(
                &[action_sample(59, true), action_sample(60, true)],
                &dropped
            ),
            Some(59),
            "the oldest accepted sample is the true original dropped heavy"
        );
        for newest in 61..=85 {
            assert_eq!(
                recovered_dropped_heavy_tick(
                    &[action_sample(newest - 1, true), action_sample(newest, true)],
                    &dropped
                ),
                None,
                "subsequent valid held-heavy inputs are not extra replays"
            );
        }
        assert_eq!(
            recovered_dropped_heavy_tick(&[action_sample(59, false)], &dropped),
            None,
            "a forged same-tick nonheavy sample is not heavy acceptance"
        );
        assert_eq!(
            recovered_dropped_heavy_tick(&[action_sample(59, true)], &VecDeque::new()),
            None,
            "an unmatched heavy action cannot claim deliberate input loss"
        );
    }

    #[test]
    fn m230_dropped_light_edge_cannot_be_miscredited_as_replayed_heavy() {
        // Reproduce the discriminating trace: a source0 initial light PRESS
        // at tick34 is first seen in a packet whose newest client tick is35.
        // Later heavy=true at tick36 is a different edge, not recovery of34.
        let mut dropped = VecDeque::new();
        let light = InputSample {
            attack: true,
            ..action_sample(34, false)
        };
        let first_packet = [action_sample(35, false), light, action_sample(33, false)];
        assert_eq!(
            register_new_action_datagram(&first_packet, &mut dropped),
            Some(34)
        );
        assert_eq!(
            one_shot_action_mask(&light),
            1,
            "the dropped edge was light-only"
        );
        assert_eq!(
            recovered_dropped_heavy_tick(
                &[action_sample(34, false), action_sample(36, true)],
                &dropped
            ),
            None,
            "a later accepted heavy cannot prove replay of a dropped light-only tick"
        );
        assert_eq!(
            recovered_dropped_heavy_tick(&[action_sample(34, true)], &dropped),
            Some(34),
            "only an accepted heavy bit on that exact original tick could qualify M230"
        );
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
    fn m229_lmb_light_one_shot_replay_matrix_shows_exact_three_packet_boundary() {
        use myaso_server::simulation::Action;

        // Deterministic protocol test, not synthetic browser acceptance:
        // one genuine short-LMB light edge is encoded as one attack client tick.
        // Each 34-byte datagram carries newest-to-oldest three samples.
        const ACTION_TICK: u32 = 700;
        for additional_losses in 0..=2_u32 {
            let mut ingress = InputIngressWindow::default();
            let mut dropped_action_ticks = VecDeque::new();
            let mut state = GameState::new(0, 0);
            assert!(state.world.add_player(1));
            let mut acks = VecDeque::new();
            let mut accepted_light_ticks = Vec::new();

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
                    bytes[index + 5] = u8::from(sample_tick == ACTION_TICK); // canonical LMB ATTACK bit0
                }
                let packet = decode_input_packet(&bytes).expect("valid genuine input wire format");
                assert_eq!(packet.samples().len(), 3);

                if packet_offset == 0 {
                    // Existing M63 fixture must deliberately drop the first
                    // datagram with the new one-shot physical LMB attack edge.
                    assert_eq!(
                        register_new_action_datagram(packet.samples(), &mut dropped_action_ticks),
                        Some(ACTION_TICK)
                    );
                    continue;
                }
                if packet_offset <= additional_losses {
                    // Additional simulated QUIC loss, not a repeated physical LMB press.
                    continue;
                }
                assert_eq!(
                    register_new_action_datagram(packet.samples(), &mut dropped_action_ticks),
                    None,
                    "replay of an already dropped action must not be re-dropped"
                );
                let accepted = ingress.ingest(&packet);
                if let Some(sample) = coalesce_accepted_input_batch(accepted.as_slice()) {
                    if sample.attack {
                        accepted_light_ticks.push(ACTION_TICK);
                    }
                    assert!(
                        !sample.heavy_attack,
                        "single short LMB must never synthesize a heavy bit"
                    );
                    apply_coalesced_input_and_read_tick(
                        &mut state,
                        1,
                        Some((sample.tick, sample.into())),
                        &mut acks,
                        None,
                    );
                }
                state.world.step();
            }

            let within_replay = additional_losses < 2;
            assert_eq!(
                accepted_light_ticks,
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
                    Action::AttackWindup
                } else {
                    Action::Idle
                },
                "a fully lost LMB must not invent a light action after replay is exhausted"
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
    fn m121_selected_authenticated_light_direction_survives_reverse_locomotion() {
        // Review-only regression at the EXISTING v1 accepted-sample -> World
        // boundary. This does not create another action producer or trust
        // arbitrary client metadata: release provenance is from accepted
        // samples, and the newest sample still owns continuous locomotion.
        for (release_y, expected) in [
            (-1.0, myaso_server::simulation::Action::AttackLeftWindup),
            (1.0, myaso_server::simulation::Action::AttackRightWindup),
        ] {
            let release = InputSample {
                tick: 101,
                move_x: 0.0,
                move_y: release_y,
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
            // In the same accepted original QUIC datagram the player can
            // reverse direction before the 60Hz World consumes the release.
            let reverse = InputSample {
                tick: 102,
                move_y: -release_y,
                attack: false,
                ..release
            };
            let accepted = [release, reverse];
            let sample = coalesce_accepted_input_batch(&accepted).unwrap();
            assert_eq!(sample.tick, 102);
            assert_eq!(sample.move_y, -release_y);
            assert!(
                sample.attack,
                "one real accepted release survives coalescing"
            );
            let intent: InputIntent = sample.into();
            let motion = selected_light_release_motion(&accepted, Some(&(sample.tick, intent)));
            assert_eq!(motion, Some((0.0, release_y, 0.0)));

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
            assert_eq!(
                state.world.fighter(1).unwrap().action,
                myaso_server::simulation::Action::HeavyAttackWindup
            );
            let mut acks = VecDeque::new();
            apply_coalesced_input_and_read_tick(
                &mut state,
                1,
                Some((sample.tick, intent)),
                &mut acks,
                motion,
            );
            // Another accepted non-attack World input before stepping must
            // change actual movement, NOT alter release direction or add HIT.
            assert!(state.world.set_input(
                1,
                InputIntent {
                    move_y: -release_y,
                    ..InputIntent::default()
                }
            ));
            state.world.step();
            assert_eq!(state.world.fighter(1).unwrap().action, expected);
            assert_eq!(state.world.fighter(1).unwrap().input().move_y, -release_y);
            assert_eq!(acks.len(), 1, "one accepted coalesced input, one ACK");
            state.world.step();
            assert_eq!(
                state.world.fighter(1).unwrap().action,
                expected,
                "the reverse movement cannot create a second light"
            );

            // If the already-selected v2 route suppresses the legacy v1
            // sampled attack bit, release metadata alone cannot re-arm it.
            let mut suppressed_v1 = intent;
            suppressed_v1.attack = false;
            suppressed_v1.heavy_attack = false;
            assert_eq!(
                selected_light_release_motion(&accepted, Some(&(sample.tick, suppressed_v1)),),
                None,
                "no parallel legacy attack producer while v2 owns Combat"
            );
        }
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
mod m173_world_jump_spend_proof_tests {
    use super::*;

    #[test]
    fn real_original_world_jump_logs_exact_stamina_cost_from_same_tick() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        let before = world
            .fighters()
            .iter()
            .map(|fighter| {
                (
                    fighter.net_id,
                    (fighter.action.wire_code(), fighter.stamina),
                )
            })
            .collect();
        assert!(world.set_input(
            1,
            InputIntent {
                jump: true,
                ..InputIntent::default()
            }
        ));
        world.step_into(&mut Vec::new());
        let rows = m173_original_jump_spend_lines(&world, &before);
        assert_eq!(rows.len(), 1, "exactly one real World Jump spend event");
        assert!(rows[0].contains("fighter=1 "));
        assert!(rows[0].contains("before=100.0000 after=86.0000 cost=14.0000"));
        assert!(m173_original_jump_spend_lines(&world, &BTreeMap::new()).is_empty());
    }
}

#[cfg(test)]
mod m201_original_world_contact_tests {
    use super::*;

    #[test]
    fn real_guard_block_contact_reports_original_defender_age_without_hit_credit() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 200.0, std::f32::consts::PI));
        assert!(world.set_input(
            2,
            InputIntent {
                block: true,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        let mut previous = BTreeMap::new();
        for _ in 0..4 {
            let mut events = Vec::new();
            world.step_into(&mut events);
            let _ = m201_flight_proof_lines(&world, &events, &mut previous);
        }
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));

        let mut observed = None;
        for _ in 0..20 {
            let mut events = Vec::new();
            world.step_into(&mut events);
            let lines = m201_flight_proof_lines(&world, &events, &mut previous);
            if events.iter().any(|event| {
                matches!(
                    event,
                    CombatEvent::Block {
                        attacker: 1,
                        target: 2
                    }
                )
            }) {
                assert!(!events
                    .iter()
                    .any(|event| matches!(event, CombatEvent::Hit { .. })));
                observed = lines.into_iter().find(|line| {
                    line.contains("CORE8C_WORLD_CONTACT")
                        && line.contains("outcome=BLOCK")
                        && line.contains("attacker=1 target=2")
                });
                break;
            }
        }
        let contact =
            observed.expect("real original World Block must emit read-only contact evidence");
        let attacker = world.fighter(1).expect("original World attacker");
        let defender = world.fighter(2).expect("original World defender");
        assert!(contact.contains(&format!("tick={}", world.tick)));
        assert!(contact.contains(&format!("world={}", world.world_instance())));
        assert!(contact.contains(&format!("attackerLife={}", attacker.world_incarnation())));
        assert!(contact.contains(&format!("targetLife={}", defender.world_incarnation())));
        assert!(contact.contains(&format!(
            "defenderActionElapsedMs={:.1}",
            defender.action_elapsed_ms
        )));
        assert!(
            defender.action_elapsed_ms > 125.0,
            "original World late block age must not be mistaken for parry eligibility"
        );
        assert!(contact.contains("defenderAction=6"));
        assert!(contact.contains("defenderHp=100.0"));
        assert!(contact.contains("defenderGuard=62.0"));
        assert_eq!(world.fighter(2).unwrap().hp, 100.0);
        assert_eq!(world.fighter(2).unwrap().guard, 62.0);
    }

    #[test]
    fn fresh_original_world_parry_contact_has_correct_life_age_and_no_hit() {
        let mut world = World::new(800.0, 600.0);
        assert!(world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(world.add_player_at(2, 255.0, 200.0, std::f32::consts::PI));
        assert!(world.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        let mut previous = BTreeMap::new();
        // Commit an actual light windup before the defender's later fresh
        // block. No synthetic collision tick, HIT receipt or parry event.
        for _ in 0..4 {
            let mut events = Vec::new();
            world.step_into(&mut events);
            let _ = m201_flight_proof_lines(&world, &events, &mut previous);
        }
        assert!(world.set_input(
            2,
            InputIntent {
                block: true,
                facing_radians: std::f32::consts::PI,
                ..InputIntent::default()
            }
        ));
        let mut contact = None;
        for _ in 0..20 {
            let mut events = Vec::new();
            world.step_into(&mut events);
            let lines = m201_flight_proof_lines(&world, &events, &mut previous);
            if events.iter().any(|event| {
                matches!(
                    event,
                    CombatEvent::Parry {
                        attacker: 1,
                        target: 2
                    }
                )
            }) {
                assert!(!events.iter().any(|event| {
                    matches!(event, CombatEvent::Hit { .. } | CombatEvent::Block { .. })
                }));
                contact = lines.into_iter().find(|line| {
                    line.contains("CORE8C_WORLD_CONTACT")
                        && line.contains("outcome=PARRY")
                        && line.contains("attacker=1 target=2")
                });
                break;
            }
        }
        let contact = contact.expect("real original World parry must have contact evidence");
        let attacker = world.fighter(1).expect("original World attacker");
        let defender = world.fighter(2).expect("original World defender");
        assert!(contact.contains(&format!("tick={}", world.tick)));
        assert!(contact.contains(&format!("world={}", world.world_instance())));
        assert!(contact.contains(&format!("attackerLife={}", attacker.world_incarnation())));
        assert!(contact.contains(&format!("targetLife={}", defender.world_incarnation())));
        assert!(contact.contains(&format!(
            "defenderActionElapsedMs={:.1}",
            defender.action_elapsed_ms
        )));
        assert!(
            defender.action_elapsed_ms <= 125.0,
            "fresh original World block must parry within the protected window"
        );
        assert!(contact.contains("defenderAction=6"));
        assert!(contact.contains("defenderHp=100.0"));
        assert!(contact.contains("defenderGuard=100.0"));
        assert_eq!(
            attacker.action.wire_code(),
            7,
            "genuine parry stuns attacker"
        );
        assert_eq!(defender.hp, 100.0);
        assert_eq!(defender.guard, 100.0);
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

#[cfg(test)]
mod core8a_standard_input_freshness_tests {
    use super::*;
    use myaso_server::{simulation::Action, InputPacket};

    fn block_packet(tick: u32, block: bool) -> InputPacket {
        let mut bytes = vec![0_u8; 16 + 3 * 6];
        bytes[0] = PROTOCOL_VERSION;
        bytes[1] = 1;
        bytes[2] = 3;
        bytes[4..6].copy_from_slice(&(tick as u16).to_le_bytes());
        bytes[8..12].copy_from_slice(&tick.to_le_bytes());
        for index in 0..3 {
            let offset = 16 + index * 6;
            bytes[offset] = index as u8;
            // Defender genuinely faces the attacker to its left.
            bytes[offset + 3..offset + 5].copy_from_slice(&(u16::MAX / 2).to_le_bytes());
            bytes[offset + 5] = if block { 4 } else { 0 };
        }
        decode_input_packet(&bytes).expect("original standard v1 datagram")
    }

    fn apply_original_packet(
        state: &mut GameState,
        ingress: &mut StandardInputIngress,
        packet: &InputPacket,
    ) -> Vec<u32> {
        let accepted = ingress.ingest(packet);
        let ticks = accepted.iter().map(|sample| sample.tick).collect();
        let coalesced = coalesce_accepted_input_batch(accepted.as_slice())
            .map(|sample| (sample.tick, sample.into()));
        apply_coalesced_input_and_read_tick(state, 2, coalesced, &mut VecDeque::new(), None);
        ticks
    }

    #[test]
    fn delayed_unseen_old_block_cannot_restart_parry_after_newer_neutral() {
        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player_at(1, 200.0, 200.0, 0.0));
        assert!(state
            .world
            .add_player_at(2, 260.0, 200.0, std::f32::consts::PI));
        let mut ingress = StandardInputIngress::default();
        apply_original_packet(&mut state, &mut ingress, &block_packet(10, true));
        for _ in 0..12 {
            assert!(state.world.step().is_empty());
        }
        assert_eq!(state.world.fighter(2).unwrap().action, Action::Block);
        assert!(state.world.fighter(2).unwrap().action_elapsed_ms > 125.0);
        apply_original_packet(&mut state, &mut ingress, &block_packet(30, false));
        assert!(state.world.step().is_empty());
        assert_eq!(state.world.fighter(2).unwrap().action, Action::Idle);

        // Begin a genuine World light, then deliver an actual older datagram
        // whose held-block sample ticks are still UNSEEN in the replay window.
        // No Action setter, damage injection or synthetic Parry is used.
        assert!(state.world.set_input(
            1,
            InputIntent {
                attack: true,
                facing_radians: 0.0,
                ..InputIntent::default()
            }
        ));
        for _ in 0..7 {
            assert!(state.world.step().is_empty());
        }
        let delayed_ticks =
            apply_original_packet(&mut state, &mut ingress, &block_packet(20, true));
        let mut actual_events = Vec::new();
        for _ in 0..20 {
            actual_events.extend(state.world.step());
        }
        assert!(
            !actual_events.iter().any(|event| matches!(event,
                CombatEvent::Parry { attacker: 1, target: 2 })),
            "old held-block must not reopen 125ms parry: accepted={delayed_ticks:?}, events={actual_events:?}"
        );
        assert_eq!(
            actual_events
                .iter()
                .filter(|event| matches!(
                    event,
                    CombatEvent::Hit {
                        attacker: 1,
                        target: 2,
                        damage: 34,
                        hp: 66
                    }
                ))
                .count(),
            1,
            "newer neutral remains authoritative; delayed old block cannot change damage"
        );
        assert_eq!(state.world.fighter(2).unwrap().hp, 66.0);
    }

    fn sampled_packet(
        packet_tick: u32,
        samples: &[(u32, u8)],
        move_x: i8,
        facing: u16,
    ) -> InputPacket {
        let mut bytes = vec![0_u8; 16 + samples.len() * 6];
        bytes[0] = PROTOCOL_VERSION;
        bytes[1] = 1;
        bytes[2] = samples.len() as u8;
        bytes[4..6].copy_from_slice(&(packet_tick as u16).to_le_bytes());
        bytes[8..12].copy_from_slice(&packet_tick.to_le_bytes());
        for (index, (tick, buttons)) in samples.iter().enumerate() {
            let offset = 16 + index * 6;
            bytes[offset] = u8::try_from(packet_tick.wrapping_sub(*tick)).unwrap();
            bytes[offset + 1] = move_x as u8;
            bytes[offset + 3..offset + 5].copy_from_slice(&facing.to_le_bytes());
            bytes[offset + 5] = *buttons;
        }
        decode_input_packet(&bytes).expect("real standard v1 sample bytes")
    }

    #[test]
    fn rejected_old_frame_keeps_holes_for_old_genuine_edge_in_new_frame() {
        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player_at(2, 200.0, 200.0, 0.0));
        assert!(state
            .world
            .add_player_at(1, 260.0, 200.0, std::f32::consts::PI));
        let mut ingress = StandardInputIngress::default();
        let neutral = sampled_packet(60, &[(60, 0), (59, 0), (58, 0)], 0, 0);
        assert_eq!(
            apply_original_packet(&mut state, &mut ingress, &neutral),
            vec![58, 59, 60]
        );
        let delayed = sampled_packet(57, &[(57, 1), (56, 0), (55, 0)], 0, 0);
        assert!(apply_original_packet(&mut state, &mut ingress, &delayed).is_empty());
        // Exactly the original sampled tick57, not a substituted later held
        // tick. The NEW packet's fresh control survives; the old sample has
        // not been consumed by the rejected whole frame's dedup path.
        let recovered = sampled_packet(61, &[(61, 0), (60, 0), (57, 1)], 0, 0);
        assert_eq!(
            apply_original_packet(&mut state, &mut ingress, &recovered),
            vec![57, 61]
        );
        assert!(apply_original_packet(&mut state, &mut ingress, &recovered).is_empty());
        let mut actual_hits = Vec::new();
        for _ in 0..60 {
            for event in state.world.step() {
                if let CombatEvent::Hit {
                    attacker,
                    target,
                    damage,
                    hp,
                } = event
                {
                    actual_hits.push((attacker, target, damage, hp));
                }
            }
        }
        assert_eq!(actual_hits, vec![(2, 1, 34, 66)]);
    }

    #[test]
    fn stale_whole_frame_cannot_replace_current_movement_facing_or_block() {
        let mut state = GameState::new(0, 0);
        assert!(state.world.add_player_at(2, 200.0, 200.0, 0.0));
        let mut ingress = StandardInputIngress::default();
        let current = sampled_packet(60, &[(60, 0), (59, 0), (58, 0)], 127, 0);
        assert_eq!(
            apply_original_packet(&mut state, &mut ingress, &current).len(),
            3
        );
        let old = sampled_packet(50, &[(50, 4), (49, 4), (48, 4)], -127, u16::MAX / 2);
        assert!(apply_original_packet(&mut state, &mut ingress, &old).is_empty());
        let authoritative = state.world.fighter(2).unwrap().input();
        assert_eq!(authoritative.move_x, 1.0);
        assert_eq!(authoritative.facing_radians, 0.0);
        assert!(!authoritative.block);
    }

    #[test]
    fn packet_freshness_handles_u32_wrap_duplicate_headers_and_new_connection() {
        let mut ingress = StandardInputIngress::default();
        let before_wrap = block_packet(u32::MAX - 1, false);
        assert_eq!(ingress.ingest(&before_wrap).len(), 3);
        assert!(ingress.ingest(&before_wrap).is_empty());
        let after_wrap = block_packet(0, false);
        assert_eq!(
            ingress
                .ingest(&after_wrap)
                .iter()
                .map(|s| s.tick)
                .collect::<Vec<_>>(),
            vec![u32::MAX, 0]
        );
        assert!(ingress.ingest(&block_packet(u32::MAX - 5, true)).is_empty());
        assert!(ingress.ingest(&after_wrap).is_empty());
        assert_eq!(ingress.ingest(&block_packet(1, false)).len(), 1);

        let mut old_connection = StandardInputIngress::default();
        assert_eq!(old_connection.ingest(&block_packet(100, false)).len(), 3);
        assert!(old_connection.ingest(&block_packet(10, true)).is_empty());
        let mut fresh_connection = StandardInputIngress::default();
        assert_eq!(fresh_connection.ingest(&block_packet(10, true)).len(), 3);
        assert_eq!(old_connection.latest_accepted_packet_tick, Some(100));
        assert_eq!(fresh_connection.latest_accepted_packet_tick, Some(10));
    }
}

#[cfg(test)]
mod chat_task_lifetime_tests {
    use super::ChatTaskAbortGuard;
    use std::time::Duration;

    #[tokio::test]
    async fn retired_gameplay_lease_aborts_idle_optional_chat_reader() {
        // An idle reliable stream may never produce a byte. Its task cannot
        // outlive the accepted GAME lease or retain its connection Arc.
        let task = tokio::spawn(async {
            std::future::pending::<()>().await;
        });
        let guard = ChatTaskAbortGuard(Some(task.abort_handle()));
        drop(guard);
        let error = tokio::time::timeout(Duration::from_secs(1), task)
            .await
            .expect("optional chat task must terminate after session guard drops")
            .expect_err("idle chat task cannot complete without cancellation");
        assert!(error.is_cancelled());
    }
}

// Core8A Source11 authority-map lifetime: a new generation is server owned,
// and retiring a root gameplay connection must leave NO ghost path for that
// player. A separate live player's path must not be disturbed.
#[cfg(test)]
mod source11_gesture_path_lifetime_tests {
    use super::*;

    #[test]
    fn retiring_root_connection_removes_only_its_player_gesture_generations() {
        let mut state = GameState::new(0, 0);
        state.boot_nonce = 17;
        assert!(state.world.add_player(1));
        assert!(state.world.add_player(2));
        for epoch in [1, 3] {
            let path = SessionGestureWorldPath::from_admitted_world(
                &state.world,
                1,
                epoch,
                state.boot_nonce,
            )
            .expect("admitted first player");
            state.gesture_sessions.insert(epoch, path);
        }
        let other =
            SessionGestureWorldPath::from_admitted_world(&state.world, 2, 7, state.boot_nonce)
                .expect("admitted second player");
        state.gesture_sessions.insert(7, other);
        state.retire_gesture_paths_for_player(1);
        assert!(!state.gesture_sessions.contains_key(&1));
        assert!(!state.gesture_sessions.contains_key(&3));
        assert_eq!(state.gesture_sessions.len(), 1);
        assert_eq!(
            state.gesture_sessions.get(&7).unwrap().binding().player_id,
            2
        );
    }
}

// Core 8C independent review of the EXACT renewal decision used by the live
// optional QUIC stream. Other Rust tests already prove authentic 3x34HP
// death/timed respawn; these cases qualify actor/lease/World handover itself.
#[cfg(test)]
mod core8c_source11_world_authority_tests {
    use super::*;
    use myaso_server::prealpha_lmb_gesture_proposal::{
        encode_event, AckStatus, GestureAction, GestureEvent,
    };

    #[test]
    fn renewal_requires_new_world_life_and_preserves_other_current_player() {
        let mut state = GameState::new(0, 0);
        state.boot_nonce = 17;
        assert!(state.world.add_player(1));
        assert!(state.world.add_player(2));
        state.chat_leases.insert(1, 101);
        state.chat_leases.insert(2, 202);
        let first =
            SessionGestureWorldPath::from_admitted_world(&state.world, 1, 11, state.boot_nonce)
                .unwrap();
        let mut old_packet_owner =
            SessionGestureWorldPath::from_admitted_world(&state.world, 1, 11, state.boot_nonce)
                .unwrap();
        let old_life = first.binding().incarnation;
        state.gesture_sessions.insert(11, first);
        state.gesture_sessions.insert(
            22,
            SessionGestureWorldPath::from_admitted_world(&state.world, 2, 22, state.boot_nonce)
                .unwrap(),
        );

        // No renewal on the same incarnation, forged root, or foreign path.
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, false)
            .is_err());
        assert!(state
            .authorize_typed_respawn_renewal(1, 999, 11, 33, false)
            .is_err());
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 22, 33, false)
            .is_err());
        assert_eq!(state.gesture_sessions.len(), 2);

        assert!(state.world.remove_player(1));
        // A new incarnation of the SAME numeric actor, not another user.
        assert!(state.world.add_player(1));
        assert_ne!(
            state.world.fighter(1).unwrap().world_incarnation(),
            old_life
        );
        assert!(
            state
                .authorize_typed_respawn_renewal(1, 101, 11, 22, false)
                .is_err(),
            "foreign epoch must never be overwritten"
        );
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 11, false)
            .is_err());
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, true)
            .is_ok());
        assert!(!state.gesture_sessions.contains_key(&11));
        assert_eq!(state.gesture_sessions.len(), 2);
        let bound = state.gesture_sessions.get(&33).unwrap().binding();
        assert_eq!(bound.player_id, 1);
        assert_eq!(bound.lease_epoch, 33);
        assert_eq!(
            bound.incarnation,
            state.world.fighter(1).unwrap().world_incarnation()
        );
        assert_eq!(
            state.chat_leases.get(&1),
            Some(&101),
            "Chat C1 keeps the original root session lease"
        );
        assert_eq!(
            state.gesture_sessions.get(&22).unwrap().binding().player_id,
            2
        );

        let press = encode_event(GestureEvent {
            action: GestureAction::Press,
            sequence: 1,
            gesture_id: 1,
            client_tick: u32::MAX,
        })
        .unwrap();
        let old_ack = old_packet_owner
            .accept_under_world_lock(&mut state.world, 11, state.boot_nonce, &press)
            .unwrap();
        assert_eq!(old_ack.status, AckStatus::Stale);
        assert_eq!(
            state.world.fighter(1).unwrap().action,
            myaso_server::simulation::Action::Idle
        );
        let mut renewed = state.gesture_sessions.remove(&33).unwrap();
        let fresh_ack = renewed
            .accept_under_world_lock(&mut state.world, 33, state.boot_nonce, &press)
            .unwrap();
        assert_eq!(fresh_ack.status, AckStatus::Accepted);
        assert_eq!(
            state.world.fighter(1).unwrap().action,
            myaso_server::simulation::Action::AttackWindup
        );
        state.gesture_sessions.insert(33, renewed);
        assert!(
            state
                .authorize_typed_respawn_renewal(1, 101, 33, 44, false)
                .is_err(),
            "a second HELLO cannot rotate an already-current life"
        );
        assert_eq!(state.gesture_sessions.get(&33).unwrap().binding(), bound);
    }

    #[test]
    fn two_successive_world_lives_rotate_only_current_generation_and_reject_old_boot() {
        let mut state = GameState::new(0, 0);
        state.boot_nonce = 41;
        assert!(state.world.add_player(1));
        assert!(state.world.add_player(2));
        state.chat_leases.insert(1, 101);
        state.chat_leases.insert(2, 202);
        state.gesture_sessions.insert(
            11,
            SessionGestureWorldPath::from_admitted_world(&state.world, 1, 11, state.boot_nonce)
                .unwrap(),
        );
        state.gesture_sessions.insert(
            22,
            SessionGestureWorldPath::from_admitted_world(&state.world, 2, 22, state.boot_nonce)
                .unwrap(),
        );

        let first_life = state.world.fighter(1).unwrap().world_incarnation();
        assert!(state.world.remove_player(1));
        assert!(state.world.add_player(1));
        let second_life = state.world.fighter(1).unwrap().world_incarnation();
        assert_ne!(first_life, second_life);
        // No path from a different boot may bind the new incarnation,
        // even if its numeric player and root lease are unchanged.
        state.boot_nonce = 42;
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, false)
            .is_err());
        assert!(state.gesture_sessions.contains_key(&11));
        assert!(!state.gesture_sessions.contains_key(&33));
        state.boot_nonce = 41;
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, false)
            .is_ok());
        assert!(!state.gesture_sessions.contains_key(&11));
        assert_eq!(
            state
                .gesture_sessions
                .get(&33)
                .unwrap()
                .binding()
                .incarnation,
            second_life
        );
        let mut second_life_old =
            SessionGestureWorldPath::from_admitted_world(&state.world, 1, 33, state.boot_nonce)
                .unwrap();

        // A second full life change occurs under the SAME authenticated
        // root lease. Its old bound bidi cannot attack the third life.
        assert!(state.world.remove_player(1));
        assert!(state.world.add_player(1));
        let third_life = state.world.fighter(1).unwrap().world_incarnation();
        assert_ne!(second_life, third_life);
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 33, 44, false)
            .is_ok());
        assert_eq!(state.gesture_sessions.len(), 2);
        assert!(!state.gesture_sessions.contains_key(&33));
        assert_eq!(
            state
                .gesture_sessions
                .get(&44)
                .unwrap()
                .binding()
                .incarnation,
            third_life
        );
        assert_eq!(
            state.gesture_sessions.get(&22).unwrap().binding().player_id,
            2
        );
        assert_eq!(state.chat_leases.get(&1), Some(&101));
        assert_eq!(state.chat_leases.get(&2), Some(&202));

        let press = encode_event(GestureEvent {
            action: GestureAction::Press,
            sequence: 1,
            gesture_id: 1,
            client_tick: u32::MAX,
        })
        .unwrap();
        let retired = second_life_old
            .accept_under_world_lock(&mut state.world, 33, state.boot_nonce, &press)
            .unwrap();
        assert_eq!(retired.status, AckStatus::Stale);
        let mut third = state.gesture_sessions.remove(&44).unwrap();
        let live = third
            .accept_under_world_lock(&mut state.world, 44, state.boot_nonce, &press)
            .unwrap();
        assert_eq!(live.status, AckStatus::Accepted);
        state.gesture_sessions.insert(44, third);
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 44, 55, false)
            .is_err());
        assert_eq!(state.gesture_sessions.len(), 2);
    }

    #[test]
    fn root_retirement_and_absent_actor_never_grant_typed_generation() {
        let mut state = GameState::new(0, 0);
        state.boot_nonce = 19;
        assert!(state.world.add_player(1));
        state.chat_leases.insert(1, 101);
        state.gesture_sessions.insert(
            11,
            SessionGestureWorldPath::from_admitted_world(&state.world, 1, 11, state.boot_nonce)
                .unwrap(),
        );
        assert!(state.world.remove_player(1));
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, false)
            .is_err());
        state.chat_leases.remove(&1);
        assert!(state.world.add_player(1));
        assert!(state
            .authorize_typed_respawn_renewal(1, 101, 11, 33, false)
            .is_err());
        assert!(state.gesture_sessions.contains_key(&11));
        assert!(!state.gesture_sessions.contains_key(&33));
    }
}
