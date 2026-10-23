//! P0 Core8 actual four independent native pinned QUIC clients -> one original
//! loopback-only 0x11 actor-admitted World. This is NOT four browser hosts.
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tokio::time::{sleep, timeout};
use wtransport::{
    endpoint::endpoint_side, tls::Sha256Digest, ClientConfig, Connection, Endpoint, RecvStream,
    SendStream, VarInt,
};

const WAIT: Duration = Duration::from_secs(8);
const HELLO: [u8; 8] = [2, 0x10, b'M', b'Y', b'A', b'S', b'O', b'1'];
const GRANTED: [u8; 4] = [2, 0x13, 0, 0];

struct TestServer {
    child: Child,
    lines: Arc<Mutex<Vec<String>>>,
}
impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn real_server() -> (TestServer, String, Sha256Digest) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_myaso-server"))
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_MAX_PLAYERS", "4")
        .env("MYASO_EXPERIMENTAL_GESTURE_V2", "1")
        .env("MYASO_FLIGHT_ACTION_PROOF", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("actual Rust QUIC server spawned");
    let stdout = child.stdout.take().expect("server stdout");
    let lines = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&lines);
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut url = None;
        let mut digest = None;
        let mut sent = false;
        for item in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(v) = item.split("listening on ").nth(1) {
                url = Some(v.trim().to_owned());
            }
            if let Some(v) = item.split("development certificate SHA-256: ").nth(1) {
                digest = Some(v.trim().parse::<Sha256Digest>().expect("TLS digest"));
            }
            if !sent && url.is_some() && digest.is_some() {
                let _ = tx.send((url.take().unwrap(), digest.take().unwrap()));
                sent = true;
            }
            sink.lock().unwrap().push(item);
        }
    });
    let (url, digest) = rx
        .recv_timeout(Duration::from_secs(15))
        .expect("real server TLS address+pin");
    assert!(url.starts_with("https://127.0.0.1:"));
    (TestServer { child, lines }, url, digest)
}
struct Seat {
    _endpoint: Endpoint<endpoint_side::Client>,
    connection: Connection,
    _send: SendStream,
    _recv: RecvStream,
}
fn client_endpoint(digest: &Sha256Digest) -> Endpoint<endpoint_side::Client> {
    Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([digest.clone()])
            .build(),
    )
    .expect("independent pinned native client endpoint")
}
async fn framed_recv(recv: &mut RecvStream) -> Vec<u8> {
    let mut length = [0_u8; 2];
    timeout(WAIT, recv.read_exact(&mut length))
        .await
        .expect("reliable header timeout")
        .expect("reliable header");
    let mut bytes = vec![0_u8; u16::from_le_bytes(length) as usize];
    timeout(WAIT, recv.read_exact(&mut bytes))
        .await
        .expect("reliable frame timeout")
        .expect("reliable body");
    bytes
}
async fn admitted_seat(url: &str, digest: &Sha256Digest) -> Seat {
    let endpoint = client_endpoint(digest);
    let connection = timeout(WAIT, endpoint.connect(url))
        .await
        .expect("QUIC connect timeout")
        .expect("real pinned WebTransport connection");
    let (send, mut recv) = timeout(WAIT, async {
        connection
            .open_bi()
            .await
            .expect("client bidi")
            .await
            .expect("game bidi opened")
    })
    .await
    .expect("bidi game stream bounded");
    let mut uni = timeout(WAIT, async {
        connection
            .open_uni()
            .await
            .expect("uni stream")
            .await
            .expect("uni ready")
    })
    .await
    .expect("negotiation uni opened");
    timeout(WAIT, uni.write_all(&HELLO))
        .await
        .expect("write hello timeout")
        .expect("hello bytes written");
    timeout(WAIT, uni.finish())
        .await
        .expect("negotiation FIN timeout")
        .expect("finish handshake FIN");
    let mut granted = false;
    for _ in 0..24 {
        let frame = framed_recv(&mut recv).await;
        if frame == GRANTED {
            granted = true;
            break;
        }
    }
    assert!(
        granted,
        "same admitted QUIC client received reliable v2 grant"
    );
    Seat {
        _endpoint: endpoint,
        connection,
        _send: send,
        _recv: recv,
    }
}
fn event(action: u8, seq: u32) -> [u8; 16] {
    let mut bytes = [0_u8; 16];
    bytes[0] = 2;
    bytes[1] = 0x11;
    bytes[2] = action; // LMB source0; id1 per separate lease
    bytes[4..8].copy_from_slice(&seq.to_le_bytes());
    bytes[8..12].copy_from_slice(&1_u32.to_le_bytes());
    bytes[12..16].copy_from_slice(&u32::MAX.to_le_bytes()); // diagnostic ONLY
    bytes
}
async fn assert_both_server_acks(conn: &Connection) -> Vec<(u32, u32)> {
    let mut result = Vec::new();
    timeout(Duration::from_secs(8), async {
        while result.len() < 2 {
            let packet = conn.receive_datagram().await.expect("real QUIC still live");
            if packet.len() == 16 && packet[0] == 2 && packet[1] == 0x12 {
                assert_eq!(packet[2], 1, "must be server admission ACCEPTED");
                assert_eq!(packet[3], 0, "ACK reserved byte zero");
                let seq = u32::from_le_bytes(packet[4..8].try_into().unwrap());
                let id = u32::from_le_bytes(packet[8..12].try_into().unwrap());
                let tick = u32::from_le_bytes(packet[12..16].try_into().unwrap());
                assert_eq!(id, 1, "per-lease gesture ID unchanged");
                assert!(tick > 0, "real server-owned World tick");
                assert!(seq == 1 || seq == 2, "no forged/foreign ACK");
                assert!(!result.iter().any(|(previous, _)| *previous == seq));
                result.push((seq, tick));
            }
        }
    })
    .await
    .expect("both independent 0x11 edges admitted");
    result.sort_by_key(|(seq, _)| *seq);
    assert_eq!(result[0].0, 1);
    assert_eq!(result[1].0, 2);
    result
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_independent_quic_seats_receive_distinct_original_world_light() {
    let (server, url, digest) = real_server();
    let mut seats = Vec::new();
    for _ in 0..4 {
        seats.push(admitted_seat(&url, &digest).await);
    }
    assert_eq!(seats.len(), 4);
    // Same gesture seq/id is legitimate on four DIFFERENT trusted leases.
    // Nothing client controlled is used for player ID/World identity.
    for seat in &seats {
        seat.connection
            .send_datagram(event(1, 1))
            .expect("real PRESS");
        seat.connection
            .send_datagram(event(3, 2))
            .expect("real RELEASE");
    }
    let mut acks = Vec::new();
    for seat in &seats {
        acks.push(assert_both_server_acks(&seat.connection).await);
    }
    assert_eq!(acks.len(), 4);
    let result = timeout(Duration::from_secs(3), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            let mut found = Vec::new();
            for player in 1..=4_u32 {
                let evidence = lines
                    .iter()
                    .find(|line| {
                        line.contains("M201_AUTH_ACTION tick=")
                            && line.contains(&format!(" fighter={player} from=1 to=2"))
                    })
                    .cloned();
                if let Some(line) = evidence {
                    found.push(line);
                }
            }
            if found.len() == 4 {
                println!("CORE8_FOUR_REAL_QUIC_WORLD_PASS {:?}", found);
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await;
    if let Err(error) = result {
        let lines = server.lines.lock().unwrap().clone();
        eprintln!(
            "CORE8_FOUR_WORLD_TRACE_LAST={:?}",
            lines
                .iter()
                .filter(|line| line.contains("M201_AUTH")
                    || line.contains("session ")
                    || line.contains("player "))
                .cloned()
                .collect::<Vec<_>>()
        );
        panic!("four genuine World windup-to-active transitions missing: {error:?}");
    }
    // Hold all four authenticated QUIC sessions until after the World checks.
    drop(seats);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn fifth_independent_native_quic_game_seat_is_refused_at_real_server_gate() {
    let (_server, url, digest) = real_server();
    let mut seats = Vec::new();
    for _ in 0..4 {
        seats.push(admitted_seat(&url, &digest).await);
    }
    let endpoint = client_endpoint(&digest);
    let excess = timeout(WAIT, endpoint.connect(&url))
        .await
        .expect("fifth admission HTTP response bounded");
    assert!(
        excess.is_err(),
        "fifth real client may not pass maximum four seats"
    );
    // Four existing acknowledged game seats remain alive after fifth denial.
    for seat in &seats {
        seat.connection
            .send_datagram(event(1, 1))
            .expect("original seat still connected");
        seat.connection
            .send_datagram(event(3, 2))
            .expect("original seat still connected");
    }
    for seat in &seats {
        assert_both_server_acks(&seat.connection).await;
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn departed_v2_seat_is_replaced_by_new_actor_without_cross_lease_replay() {
    let (server, url, digest) = real_server();
    let mut seats = Vec::new();
    for _ in 0..4 {
        seats.push(admitted_seat(&url, &digest).await);
    }
    // Retire only the original actor #2 / its independent authenticated QUIC
    // session. This also frees ONE live permit, not the actor's retired ID.
    seats[1]
        .connection
        .close(VarInt::from_u32(0), b"core8c-v2-actor-retired");
    sleep(Duration::from_millis(900)).await;

    // The next valid pinned-TLS transport must negotiate a new v2 seat.
    let newcomer = admitted_seat(&url, &digest).await;
    // The same numeric per-lease sequence / gesture IDs are legal for
    // surviving players 1,3,4 and fresh actor 5; never inherit actor 2.
    for seat in [&seats[0], &seats[2], &seats[3], &newcomer] {
        seat.connection
            .send_datagram(event(1, 1))
            .expect("real current-lease PRESS");
        seat.connection
            .send_datagram(event(3, 2))
            .expect("real current-lease RELEASE");
    }
    for seat in [&seats[0], &seats[2], &seats[3], &newcomer] {
        let acks = assert_both_server_acks(&seat.connection).await;
        assert_eq!(acks.len(), 2, "two admitted events per current lease");
    }
    // ACK alone is transport receipt, never proof of original World damage.
    // The *real server World* must advance all FOUR still-live distinct actors.
    timeout(Duration::from_secs(4), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            let admitted_five = lines.iter().any(|line| line.contains("assigned player 5 "));
            let exact_four_active = [1, 3, 4, 5].iter().all(|id| {
                lines.iter().any(|line| {
                    line.contains("M201_AUTH_ACTION tick=")
                        && line.contains(&format!(" fighter={id} from=1 to=2"))
                })
            });
            let retired_actor_was_not_attacked = !lines.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=") && line.contains(" fighter=2 from=1 to=2")
            });
            if admitted_five && exact_four_active && retired_actor_was_not_attacked {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("original World action for active #1,#3,#4,#5, never retired #2");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn admitted_windup_session_retirement_cannot_attack_from_departed_quic_actor() {
    let (server, url, digest) = real_server();
    let mut seats = Vec::new();
    for _ in 0..4 {
        seats.push(admitted_seat(&url, &digest).await);
    }

    // Actor #2 begins a REAL server-owned light windup and receives a
    // processed-World receipt, not just a generic input highwater ACK.
    seats[1]
        .connection
        .send_datagram(event(1, 1))
        .expect("real actor #2 PRESS");
    timeout(WAIT, async {
        loop {
            let ack = seats[1]
                .connection
                .receive_datagram()
                .await
                .expect("QUIC actor #2 still connected");
            if ack.len() == 16 && ack[0] == 2 && ack[1] == 0x12 {
                assert_eq!(ack[2], 1, "original World admitted actor #2 PRESS");
                assert_eq!(u32::from_le_bytes(ack[4..8].try_into().unwrap()), 1);
                assert_eq!(u32::from_le_bytes(ack[8..12].try_into().unwrap()), 1);
                assert!(u32::from_le_bytes(ack[12..16].try_into().unwrap()) > 0);
                break;
            }
        }
    })
    .await
    .expect("actual actor #2 PRESS accepted by live World");

    // Close only this admitted transport while the attack may still be
    // winding up. Retirement forbids NEW actions; it is not permission to
    // backdate or undo any hit that legitimately completed before cleanup.
    seats[1]
        .connection
        .close(VarInt::from_u32(0), b"core8c-inflight-windup-retirement");
    sleep(Duration::from_millis(900)).await;
    let replacement = admitted_seat(&url, &digest).await;
    // New actor #5 is admitted only after old lease #2's World cleanup.
    // Mark the post-replacement log boundary: pre-retirement contact is
    // intentionally not classified as ghost damage.
    let after_replacement = server.lines.lock().unwrap().len();
    let current = [&seats[0], &seats[2], &seats[3], &replacement];
    for seat in current {
        seat.connection
            .send_datagram(event(1, 1))
            .expect("current actor PRESS");
        seat.connection
            .send_datagram(event(3, 2))
            .expect("current actor RELEASE");
    }
    for seat in current {
        assert_both_server_acks(&seat.connection).await;
    }

    timeout(Duration::from_secs(4), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            let recent = &lines[after_replacement..];
            let fresh_actor_is_admitted =
                lines.iter().any(|line| line.contains("assigned player 5 "));
            let all_current_actors_attack = [1_u32, 3, 4, 5].iter().all(|id| {
                recent.iter().any(|line| {
                    line.contains("M201_AUTH_ACTION tick=")
                        && line.contains(&format!(" fighter={id} from=1 to=2"))
                })
            });
            let retired_actor_has_no_new_active_action = !recent.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=")
                    && line.contains(" fighter=2 from=1 to=2")
            });
            if fresh_actor_is_admitted
                && all_current_actors_attack
                && retired_actor_has_no_new_active_action
            {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("no post-retirement actor #2 action; active #1,#3,#4,#5 work");
}
