//! Core8C native REAL original QUIC server admission + departure replacement.
//! Four independent certificate-pinned gameplay transports with four real
//! server-owned net IDs; revoke one and qualify capacity reuse with a fresh
//! fifth ID while remaining real original sessions continue playing.
//! Pre-Alpha authority regression ONLY: original v1, NO live v2 gesture,
//! no Combat hit, no browser/independent host or production release claim.
use myaso_server::snapshot::{decode_snapshot, DecodedSnapshot, SNAPSHOT_FIELD_REMOVED};
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};
use tokio::time::{sleep, timeout};
use wtransport::{
    endpoint::endpoint_side, tls::Sha256Digest, ClientConfig, Connection, Endpoint, RecvStream,
    SendStream, VarInt,
};

struct TestServer(Child);
impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn start_server() -> (TestServer, String, Sha256Digest) {
    let mut command = Command::new(env!("CARGO_BIN_EXE_myaso-server"));
    let mut process = command
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_MAX_PLAYERS", "4")
        .env_remove("MYASO_CHAT_C1_ENABLED")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("original Rust server, not mock");
    let stdout = process.stdout.take().expect("actual server startup");
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut url = None;
        let mut digest = None;
        let mut announced = false;
        // Keep draining the REAL Rust server stdout until it exits.
        // Closing the pipe after its startup banner makes its normal
        // session/audit println panic with EPIPE, invalidating QUIC proof.
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(value) = line.split("listening on ").nth(1) {
                url = Some(value.trim().to_owned());
            }
            if let Some(value) = line.split("development certificate SHA-256: ").nth(1) {
                digest = Some(
                    value
                        .trim()
                        .parse::<Sha256Digest>()
                        .expect("actual TLS pin"),
                );
            }
            if !announced && url.is_some() && digest.is_some() {
                let _ = tx.send((url.take().unwrap(), digest.take().unwrap()));
                announced = true;
            }
        }
    });
    let (url, digest) = rx
        .recv_timeout(Duration::from_secs(15))
        .expect("server announced URL and fingerprint");
    assert!(url.starts_with("https://127.0.0.1:"));
    (TestServer(process), url, digest)
}
async fn connect(
    url: &str,
    digest: &Sha256Digest,
) -> (
    Endpoint<endpoint_side::Client>,
    Connection,
    SendStream,
    RecvStream,
) {
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([digest.clone()])
            .build(),
    )
    .expect("real QUIC endpoint");
    let connection = timeout(Duration::from_secs(8), endpoint.connect(url))
        .await
        .expect("real WebTransport connect timeout")
        .expect("original server accepted pinned connection");
    let (game_send, game_recv) = timeout(Duration::from_secs(8), async {
        connection
            .open_bi()
            .await
            .expect("real original game stream")
            .await
            .expect("game stream initialized")
    })
    .await
    .expect("WebTransport native game handshake timeout");
    (endpoint, connection, game_send, game_recv)
}
async fn assert_original_v1_input_ack(connection: &Connection, net_id: u32, tick: u32) {
    let mut input = [0_u8; 22];
    input[0] = 1;
    input[1] = 1;
    input[2] = 1;
    input[4..6].copy_from_slice(&1_u16.to_le_bytes());
    input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    input[8..12].copy_from_slice(&tick.to_le_bytes());
    input[17] = 127;
    connection
        .send_datagram(input)
        .expect("real original input accepted by transport");
    let ack = timeout(Duration::from_secs(5), async {
        loop {
            let packet = connection
                .receive_datagram()
                .await
                .expect("original game connection remains alive");
            if packet.len() == 16
                && packet[0] == 1
                && packet[1] == 3
                && u32::from_le_bytes(packet[4..8].try_into().unwrap()) == tick
            {
                break packet;
            }
        }
    })
    .await
    .expect("one real server-owned INPUT_ACK from authentic server session");
    assert_eq!(
        u32::from_le_bytes(ack[12..16].try_into().unwrap()),
        net_id,
        "ACK must bind to correct original server-issued net ID"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn four_real_quic_sessions_disconnect_frees_capacity_without_reusing_actor_identity() {
    let (_server, url, digest) = start_server();
    let (_ep1, one, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, two, _send2, _recv2) = connect(&url, &digest).await;
    let (_ep3, three, _send3, _recv3) = connect(&url, &digest).await;
    let (_ep4, four, _send4, _recv4) = connect(&url, &digest).await;

    // Four DISTINCT genuine WebTransport QUIC sessions, not four simulated
    // fighters. Each receives its OWN authoritative ID via actual v1 ACK.
    assert_original_v1_input_ack(&one, 1, 501).await;
    assert_original_v1_input_ack(&two, 2, 502).await;
    assert_original_v1_input_ack(&three, 3, 503).await;
    assert_original_v1_input_ack(&four, 4, 504).await;

    // The original max-player admission gate is intentionally FULL (4/4).
    // Terminate only owner #2; it must release its actor and admission permit
    // without invalidating independent actors #1, #3 and #4.
    two.close(VarInt::from_u32(0), b"core8c-test-departure");
    sleep(Duration::from_millis(900)).await;

    let (_ep5, newcomer, _send5, _recv5) = connect(&url, &digest).await;
    // A new connection obtains ID 5, NEVER the old disconnected actor ID 2.
    assert_original_v1_input_ack(&newcomer, 5, 505).await;

    // Three surviving original sessions remain authorized for distinct
    // player IDs after the fifth client is admitted; no cross-actor aliasing.
    assert_original_v1_input_ack(&one, 1, 601).await;
    assert_original_v1_input_ack(&three, 3, 603).await;
    assert_original_v1_input_ack(&four, 4, 604).await;
}

async fn actual_initial_game_baseline(recv: &mut RecvStream) -> DecodedSnapshot {
    let mut length = [0_u8; 2];
    timeout(Duration::from_secs(8), recv.read_exact(&mut length))
        .await
        .expect("real game reliable baseline header arrived")
        .expect("original game reliable header read");
    let bytes_len = u16::from_le_bytes(length) as usize;
    assert!(
        bytes_len >= 14 && bytes_len <= 1100,
        "real full baseline bounded"
    );
    let mut bytes = vec![0_u8; bytes_len];
    timeout(Duration::from_secs(8), recv.read_exact(&mut bytes))
        .await
        .expect("real game reliable baseline payload arrived")
        .expect("original game reliable baseline read");
    let baseline = decode_snapshot(&bytes).expect("original encoded Rust snapshot");
    assert!(baseline.full, "first server baseline is authoritative full");
    baseline
}

fn send_v1_with_baseline_ack(
    connection: &Connection,
    sequence: u16,
    baseline_sequence: u16,
    tick: u32,
) {
    let mut input = [0_u8; 22];
    input[0] = 1;
    input[1] = 1;
    input[2] = 1;
    input[4..6].copy_from_slice(&sequence.to_le_bytes());
    input[6..8].copy_from_slice(&baseline_sequence.to_le_bytes());
    input[8..12].copy_from_slice(&tick.to_le_bytes());
    input[17] = 127;
    connection
        .send_datagram(input)
        .expect("genuine old v1 input through authenticated QUIC");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn surviving_quic_player_receives_real_removed_actor_tombstone_and_newcomer() {
    let (_server, url, digest) = start_server();
    let (_ep1, one, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, departed, _send2, _recv2) = connect(&url, &digest).await;
    let (_ep3, three, _send3, _recv3) = connect(&url, &digest).await;
    let (_ep4, viewer, _send4, mut viewer_recv) = connect(&url, &digest).await;

    let initial = actual_initial_game_baseline(&mut viewer_recv).await;
    assert_eq!(
        initial.sequence, 0,
        "new viewer starts with baseline sequence zero"
    );
    for actor_id in 1_u32..=4 {
        assert!(
            initial
                .records
                .iter()
                .any(|r| { r.net_id == actor_id && r.mask & SNAPSHOT_FIELD_REMOVED == 0 }),
            "four actual previously admitted actors must exist in real viewer baseline: {actor_id}"
        );
    }

    send_v1_with_baseline_ack(&viewer, 1, initial.sequence, 708);
    // After the actual four-player initial baseline has been acknowledged,
    // original server sends authoritative real-time delta snapshots to viewer.
    departed.close(VarInt::from_u32(0), b"core8c-tombstone-test");
    sleep(Duration::from_millis(900)).await;
    let (_ep5, newcomer, _send5, _recv5) = connect(&url, &digest).await;
    assert_original_v1_input_ack(&newcomer, 5, 705).await;

    let mut saw_departed_removal = false;
    let mut saw_fresh_actor = false;
    let mut last_tick = 0_u32;
    timeout(Duration::from_secs(7), async {
        loop {
            let frame = viewer
                .receive_datagram()
                .await
                .expect("viewer remains genuine QUIC game connection");
            if frame.len() < 2 || frame[0] != 1 || frame[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(&frame).expect("server-authored delta snapshot");
            assert!(
                snapshot.server_tick >= last_tick,
                "server clock must not regress"
            );
            last_tick = snapshot.server_tick;
            assert!(
                !snapshot.full,
                "baseline-ACK-confirmed viewer must observe delta, not forged full"
            );
            saw_departed_removal |= snapshot
                .records
                .iter()
                .any(|r| r.net_id == 2 && r.mask & SNAPSHOT_FIELD_REMOVED != 0);
            saw_fresh_actor |= snapshot
                .records
                .iter()
                .any(|r| r.net_id == 5 && r.mask & SNAPSHOT_FIELD_REMOVED == 0);
            if saw_departed_removal && saw_fresh_actor {
                break;
            }
        }
    })
    .await
    .expect("real server must replicate old actor removal and fresh actor admission");
    assert!(saw_departed_removal && saw_fresh_actor);

    assert_original_v1_input_ack(&one, 1, 711).await;
    assert_original_v1_input_ack(&three, 3, 713).await;
    // The actual viewer remains able to play after observing the tombstone.
    assert_original_v1_input_ack(&viewer, 4, 714).await;
}
