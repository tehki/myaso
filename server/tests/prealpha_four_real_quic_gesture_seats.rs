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
async fn genuine_source1_keye_press_enters_real_server_heavy_without_release_hit() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    // Existing authenticated actor and 0x11/0x12 ACK family; only byte3
    // chooses source1. KeyE terminal cannot trigger a second World attack.
    let mut press = event(1, 1);
    press[3] = 1;
    let mut cancel = event(4, 2);
    cancel[3] = 1;
    seat.connection
        .send_datagram(press)
        .expect("real KeyE PRESS");
    seat.connection
        .send_datagram(cancel)
        .expect("real KeyE CANCEL");
    assert_both_server_acks(&seat.connection).await;
    timeout(Duration::from_secs(4), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            if lines.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=") && line.contains(" fighter=1 from=9 to=10")
            }) {
                println!("CORE8_NATIVE_KEYE_HEAVY_WORLD_PASS");
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("actual World HeavyWindup9 to HeavyActive10 on standalone KeyE");
    sleep(Duration::from_millis(600)).await;
    let lines = server.lines.lock().unwrap().clone();
    assert_eq!(
        lines
            .iter()
            .filter(|line| line.contains("M201_AUTH_ACTION tick=")
                && line.contains(" fighter=1 from=9 to=10"))
            .count(),
        1,
        "one KeyE gesture must not create a second heavy after CANCEL"
    );
    drop(seat);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_quic_busy_keye_does_not_strand_authenticated_lmb_release() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    let mut keye_press = event(1, 2);
    keye_press[3] = 1;
    keye_press[8..12].copy_from_slice(&2_u32.to_le_bytes());
    let lmb_release = event(3, 3);
    let mut keye_release = event(3, 4);
    keye_release[3] = 1;
    keye_release[8..12].copy_from_slice(&2_u32.to_le_bytes());

    // Real separate QUIC datagrams are admitted one at a time so the test
    // identifies World-busy status, not retransmit-dependent packet order.
    for (packet, seq, gesture) in [
        (event(1, 1), 1, 1),
        (keye_press, 2, 2),
        (lmb_release, 3, 1),
        (keye_release, 4, 2),
    ] {
        seat.connection
            .send_datagram(packet)
            .expect("original QUIC datagram");
        let received = timeout(WAIT, seat.connection.receive_datagram())
            .await
            .expect("current World 0x12 ACK timeout")
            .expect("real authenticated connection open");
        assert_eq!(received.len(), 16);
        assert_eq!(
            &received[..4],
            &[2, 0x12, 1, 0],
            "benign busy KeyE ACK must not be fatal REJECTED"
        );
        assert_eq!(u32::from_le_bytes(received[4..8].try_into().unwrap()), seq);
        assert_eq!(
            u32::from_le_bytes(received[8..12].try_into().unwrap()),
            gesture
        );
        assert!(u32::from_le_bytes(received[12..16].try_into().unwrap()) > 0);
    }
    timeout(Duration::from_secs(3), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            if lines.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=") && line.contains(" fighter=1 from=1 to=2")
            }) {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("authenticated LMB must retain original World LightActive");
    sleep(Duration::from_millis(400)).await;
    let lines = server.lines.lock().unwrap().clone();
    assert!(
        !lines
            .iter()
            .any(|line| line.contains("M201_AUTH_ACTION tick=")
                && line.contains(" fighter=1 from=9 to=10")),
        "a World-busy KeyE must not yield a second heavy attack"
    );
    println!("CORE8_NATIVE_BUSY_CROSS_SOURCE_ACK_WORLD_PASS");
    drop(seat);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_quic_busy_lmb_upgrade_does_not_retire_authentic_keye_heavy() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    let mut keye_press = event(1, 1);
    keye_press[3] = 1;
    let mut lmb_press = event(1, 2);
    lmb_press[8..12].copy_from_slice(&2_u32.to_le_bytes());
    let mut lmb_upgrade = event(2, 3);
    lmb_upgrade[8..12].copy_from_slice(&2_u32.to_le_bytes());
    let mut lmb_release = event(3, 4);
    lmb_release[8..12].copy_from_slice(&2_u32.to_le_bytes());
    let mut keye_release = event(3, 5);
    keye_release[3] = 1;

    for (packet, seq, gesture) in [
        (keye_press, 1, 1),
        (lmb_press, 2, 2),
        (lmb_upgrade, 3, 2),
        (lmb_release, 4, 2),
        (keye_release, 5, 1),
    ] {
        seat.connection
            .send_datagram(packet)
            .expect("original QUIC datagram");
        let received = timeout(WAIT, seat.connection.receive_datagram())
            .await
            .expect("typed BUSY LMB 0x12 ACK timeout")
            .expect("genuine QUIC connection remains admitted");
        assert_eq!(received.len(), 16);
        assert_eq!(
            &received[..4],
            &[2, 0x12, 1, 0],
            "physical held LMB UPGRADE during real KeyE heavy must not close shared outbox"
        );
        assert_eq!(u32::from_le_bytes(received[4..8].try_into().unwrap()), seq);
        assert_eq!(
            u32::from_le_bytes(received[8..12].try_into().unwrap()),
            gesture
        );
    }
    timeout(Duration::from_secs(3), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            if lines.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=") && line.contains(" fighter=1 from=9 to=10")
            }) {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("original World standalone KeyE HeavyWindup9→HeavyActive10");
    sleep(Duration::from_millis(400)).await;
    let lines = server.lines.lock().unwrap().clone();
    assert!(
        !lines
            .iter()
            .any(|line| line.contains("M201_AUTH_ACTION tick=")
                && line.contains(" fighter=1 from=1 to=2")),
        "busy LMB with held upgrade may not add a 34HP light"
    );
    println!("CORE8_NATIVE_BUSY_LMB_UPGRADE_KEYE_HEAVY_PASS");
    drop(seat);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn retired_keye_windup_cannot_ghost_attack_replacement_and_four_seats_keep_playing() {
    let (server, url, digest) = real_server();
    let mut seats = Vec::new();
    for _ in 0..4 {
        seats.push(admitted_seat(&url, &digest).await);
    }

    // Actor #2 starts the genuine standalone source1 heavy in the original
    // server-owned World. Verify admission using a correlated original 0x12
    // receipt, not an unrelated input highwater acknowledgement.
    let mut keye_press = event(1, 1);
    keye_press[3] = 1;
    let mut keye_release = event(3, 2);
    keye_release[3] = 1;
    seats[1]
        .connection
        .send_datagram(keye_press)
        .expect("current actor #2 KeyE PRESS");
    timeout(WAIT, async {
        loop {
            let packet = seats[1]
                .connection
                .receive_datagram()
                .await
                .expect("original KeyE QUIC session live");
            if packet.len() == 16 && packet[0] == 2 && packet[1] == 0x12 {
                assert_eq!(packet[2], 1, "KeyE PRESS accepted by original World");
                assert_eq!(
                    u32::from_le_bytes(packet[4..8].try_into().unwrap()),
                    1
                );
                assert_eq!(
                    u32::from_le_bytes(packet[8..12].try_into().unwrap()),
                    1
                );
                assert!(u32::from_le_bytes(packet[12..16].try_into().unwrap()) > 0);
                break;
            }
        }
    })
    .await
    .expect("source1 real World admission must complete");

    seats[1]
        .connection
        .close(VarInt::from_u32(0), b"core8c-keye-actor-retired");
    sleep(Duration::from_millis(900)).await;
    let newcomer = admitted_seat(&url, &digest).await;

    // A committed contact before retirement remains a legitimate original
    // Combat event. The authority guarantee starts AFTER replacement.
    let after_replacement = server.lines.lock().unwrap().len();
    for survivor in [&seats[0], &seats[2], &seats[3]] {
        survivor
            .connection
            .send_datagram(event(1, 1))
            .expect("surviving LMB PRESS");
        survivor
            .connection
            .send_datagram(event(3, 2))
            .expect("surviving LMB RELEASE");
    }
    newcomer
        .connection
        .send_datagram(keye_press)
        .expect("fresh actor #5 KeyE PRESS");
    newcomer
        .connection
        .send_datagram(keye_release)
        .expect("fresh actor #5 KeyE RELEASE");
    for current in [&seats[0], &seats[2], &seats[3], &newcomer] {
        assert_both_server_acks(&current.connection).await;
    }

    timeout(Duration::from_secs(4), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            let recent = &lines[after_replacement..];
            let replacement_admitted =
                lines.iter().any(|line| line.contains("assigned player 5 "));
            let current_lights = [1_u32, 3, 4].iter().all(|id| {
                recent.iter().any(|line| {
                    line.contains("M201_AUTH_ACTION tick=")
                        && line.contains(&format!(" fighter={id} from=1 to=2"))
                })
            });
            let current_keye_heavy = recent.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=")
                    && line.contains(" fighter=5 from=9 to=10")
            });
            let no_retired_heavy = !recent.iter().any(|line| {
                line.contains("M201_AUTH_ACTION tick=")
                    && line.contains(" fighter=2 from=9 to=10")
            });
            if replacement_admitted && current_lights && current_keye_heavy && no_retired_heavy {
                break;
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("old KeyE actor cannot attack after replacement; four fresh seats remain live");
}
