//! Core 8B P0 — original QUIC transport-seat retirement fencing (NONRELEASE).
//!
//! A server-owned actor/lease created after a real QUIC disconnect must not
//! inherit the retired actor's gesture cursor, even when the source0 sequence
//! and gesture ID repeat. This is NOT account authentication or same-CharacterId
//! persistent reconnect: /game still issues ephemeral actor IDs.
//! This fixture uses the original pinned, loopback-only v2 lab and Rust World.
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::{Duration, Instant},
};
use myaso_server::snapshot::decode_snapshot;
use tokio::time::{sleep, timeout};
use wtransport::{
    endpoint::endpoint_side, tls::Sha256Digest, ClientConfig, Connection, Endpoint, RecvStream,
    SendStream,
};

const WAIT: Duration = Duration::from_secs(8);
const HELLO: [u8; 8] = [2, 0x10, b'M', b'Y', b'A', b'S', b'O', b'1'];
const GRANTED: [u8; 4] = [2, 0x13, 0, 0];

struct Server {
    child: Child,
    lines: Arc<Mutex<Vec<String>>>,
}
impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn server() -> (Server, String, Sha256Digest) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_myaso-server"))
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_MAX_PLAYERS", "2")
        .env("MYASO_EXPERIMENTAL_GESTURE_V2", "1")
        .env("MYASO_FLIGHT_ACTION_PROOF", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("actual loopback original Rust server");
    let stdout = child.stdout.take().expect("server stdout");
    let lines = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&lines);
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let (mut url, mut digest) = (None, None);
        let mut notified = false;
        for item in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(v) = item.split("listening on ").nth(1) {
                url = Some(v.trim().to_string());
            }
            if let Some(v) = item.split("development certificate SHA-256: ").nth(1) {
                digest = Some(v.trim().parse::<Sha256Digest>().expect("TLS hash"));
            }
            if !notified {
                if let (Some(url), Some(digest)) = (url.as_ref(), digest.as_ref()) {
                    let _ = tx.send((url.clone(), digest.clone()));
                    notified = true;
                }
            }
            sink.lock().unwrap().push(item);
        }
    });
    let (url, hash) = rx
        .recv_timeout(WAIT)
        .expect("real server pinned address and SHA256");
    assert!(url.starts_with("https://127.0.0.1:"));
    (Server { child, lines }, url, hash)
}
struct Seat {
    _endpoint: Endpoint<endpoint_side::Client>,
    conn: Connection,
    _send: SendStream,
    _recv: RecvStream,
}
async fn seat(
    url: &str,
    hash: &Sha256Digest,
    expected_actor: u32,
    retired_actor: Option<u32>,
) -> Seat {
    let deadline = Instant::now() + WAIT;
    let (endpoint, conn) = loop {
        assert!(
            Instant::now() < deadline,
            "new QUIC actor gate never reopened"
        );
        let endpoint = Endpoint::client(
            ClientConfig::builder()
                .with_bind_default()
                .with_server_certificate_hashes([hash.clone()])
                .build(),
        )
        .expect("real independent endpoint");
        match timeout(WAIT, endpoint.connect(url)).await {
            Ok(Ok(conn)) => break (endpoint, conn),
            Ok(Err(_)) => {
                sleep(Duration::from_millis(30)).await;
            }
            Err(_) => panic!("QUIC connection attempt hung beyond WAIT"),
        }
    };
    let (send, mut recv) = timeout(WAIT, async {
        conn.open_bi()
            .await
            .expect("open bidi")
            .await
            .expect("bidi established")
    })
    .await
    .expect("real bidi timeout");
    let mut hello = timeout(WAIT, async {
        conn.open_uni()
            .await
            .expect("uni stream")
            .await
            .expect("uni established")
    })
    .await
    .expect("real uni timeout");
    timeout(WAIT, hello.write_all(&HELLO))
        .await
        .expect("write hello timeout")
        .expect("write hello");
    timeout(WAIT, hello.finish())
        .await
        .expect("hello FIN timeout")
        .expect("finish hello");
    let mut granted = false;
    let mut saw_initial_snapshot = false;
    for _ in 0..24 {
        let mut size = [0u8; 2];
        timeout(WAIT, recv.read_exact(&mut size))
            .await
            .expect("reliable header timeout")
            .expect("reliable header");
        let mut frame = vec![0u8; u16::from_le_bytes(size) as usize];
        timeout(WAIT, recv.read_exact(&mut frame))
            .await
            .expect("reliable frame timeout")
            .expect("reliable frame");
        if frame.starts_with(&[2, 2]) {
            let snapshot = decode_snapshot(&frame).expect("actual original World snapshot");
            assert!(snapshot.full, "new QUIC seat needs a full authoritative baseline");
            assert!(
                snapshot.records.iter().any(|record| record.net_id == expected_actor),
                "fresh server-owned actor {expected_actor} missing from its own baseline: {snapshot:?}"
            );
            if let Some(retired) = retired_actor {
                assert!(
                    snapshot.records.iter().all(|record| record.net_id != retired),
                    "retired actor {retired} leaked into fresh authoritative baseline: {snapshot:?}"
                );
            }
            saw_initial_snapshot = true;
        }
        if frame == GRANTED {
            assert!(
                saw_initial_snapshot,
                "v2 grant was observed without authoritative World baseline"
            );
            granted = true;
            break;
        }
    }
    assert!(
        granted,
        "only actually admitted QUIC actor gets server v2 grant"
    );
    Seat {
        _endpoint: endpoint,
        conn,
        _send: send,
        _recv: recv,
    }
}
fn press() -> [u8; 16] {
    let mut bytes = [0u8; 16];
    bytes[0..4].copy_from_slice(&[2, 0x11, 1, 0]); // real LMB source0 PRESS
    bytes[4..8].copy_from_slice(&1u32.to_le_bytes()); // sequence 1
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes()); // gesture 1
    bytes[12..16].copy_from_slice(&u32::MAX.to_le_bytes()); // untrusted
    bytes
}
async fn accepted_press(conn: &Connection) {
    conn.send_datagram(press()).expect("original 0x11 pressed");
    timeout(WAIT, async {
        loop {
            let packet = conn.receive_datagram().await.expect("real QUIC still live");
            if packet.len() == 16 && packet[0..2] == [2, 0x12] {
                assert_eq!(
                    &packet[0..4],
                    &[2, 0x12, 1, 0],
                    "accepted original World PRESS only"
                );
                assert_eq!(
                    &packet[4..8],
                    &1u32.to_le_bytes(),
                    "current lease sequence1"
                );
                assert_eq!(
                    &packet[8..12],
                    &1u32.to_le_bytes(),
                    "current lease gesture1"
                );
                assert_ne!(&packet[12..16], &[0; 4], "real World tick");
                break;
            }
        }
    })
    .await
    .expect("bounded original 0x12 ACK");
}
async fn observed(lines: &Arc<Mutex<Vec<String>>>, needle: &str) {
    timeout(WAIT, async {
        loop {
            if lines
                .lock()
                .unwrap()
                .iter()
                .any(|line| line.contains(needle))
            {
                break;
            }
            sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap_or_else(|_| panic!("missing real server evidence: {needle}"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn old_quic_disconnect_releases_one_seat_and_fresh_source0_cursor_is_independent() {
    let (server, url, digest) = server();
    let old = seat(&url, &digest, 1, None).await;
    let _spectator = seat(&url, &digest, 2, None).await;
    observed(&server.lines, " assigned player 1 ").await;
    observed(&server.lines, " assigned player 2 ").await;
    observed(&server.lines, " fighter=1 action=0").await;
    accepted_press(&old.conn).await;
    observed(&server.lines, " fighter=1 from=0 to=1").await;
    // Retire real QUIC connection with a live original Light gesture; no
    // fake World actor replacement or client-provided actor identity.
    old.conn.close(0u32.into(), b"retired old QUIC seat");
    drop(old);

    // MYASO_MAX_PLAYERS=2 and the spectator still holds seat2. A new
    // actor3 can only be admitted after actor1's old permit is released.
    let fresh = seat(&url, &digest, 3, Some(1)).await;
    observed(&server.lines, " assigned player 3 ").await;
    observed(&server.lines, " fighter=3 action=0").await; // arm original observer first
    accepted_press(&fresh.conn).await; // SAME source0 seq1, new lease
    observed(&server.lines, " fighter=3 from=0 to=1").await;
    // No original actor-1 action is allowed after the new actor was admitted.
    let trace = server.lines.lock().unwrap().clone();
    let new_actor = trace
        .iter()
        .position(|line| line.contains(" assigned player 3 "))
        .expect("actual new seat");
    assert!(
        trace[new_actor..]
            .iter()
            .all(|line| !line.contains("M201_AUTH_ACTION") || !line.contains(" fighter=1 ")),
        "retired QUIC actor cannot mutate the successor World seat: {:?}",
        &trace[new_actor..]
    );
    println!("CORE8B_ORIGINAL_QUIC_SEAT_RETIREMENT_PASS actor1→actor3, spectator2 held, source0 seq1 admitted on independent QUIC leases");
}
