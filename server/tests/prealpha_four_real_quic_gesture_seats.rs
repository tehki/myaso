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
    SendStream,
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
fn typed_event(source: u8, action: u8, seq: u32, id: u32) -> [u8; 16] {
    let mut bytes = [0_u8; 16];
    bytes[0] = 2;
    bytes[1] = 0x11;
    bytes[2] = action;
    bytes[3] = source; // LMB0 or independent KeyE1; cannot name an actor
    bytes[4..8].copy_from_slice(&seq.to_le_bytes());
    bytes[8..12].copy_from_slice(&id.to_le_bytes());
    bytes[12..16].copy_from_slice(&u32::MAX.to_le_bytes()); // diagnostic ONLY
    bytes
}
fn event(action: u8, seq: u32) -> [u8; 16] {
    typed_event(0, action, seq, 1)
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

/// Actual TLS-pinned QUIC negative: retired source1 Key E cannot mutate
/// the original Rust World or commit damage. The 0x12 ACK is NOT a HIT.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn one_native_key_e_source_is_rejected_and_cannot_hit_original_world() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    // Retired legacy typed source1 PRESS/RELEASE can never acquire Combat authority.
    combat4c_ack(&seat.connection, 1, 1, 1, 1, 4).await;
    combat4c_ack(&seat.connection, 1, 3, 2, 1, 4).await;
    sleep(Duration::from_millis(430)).await;
    let lines = server.lines.lock().unwrap().clone();
    assert!(
        !lines
            .iter()
            .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=0 to=9")),
        "reserved Use key cannot start original World heavy windup"
    );
    assert!(
        !lines
            .iter()
            .any(|l| l.contains("M201_AUTH_HIT") && l.contains(" attacker=1 ")),
        "reserved Use key cannot commit World damage"
    );
    println!("KEYE_RESERVED_USE_NO_HEAVY_HIT_QUIC_PASS");
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn retired_key_e_source_does_not_consume_server_actor_sequence() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    // Synchronize the read-only 60Hz original World observer BEFORE sending
    // authenticated inputs. Otherwise an authentic source0 PRESS can arrive
    // before the flight journal's first Idle snapshot, making a real
    // Idle->LightWindup transition invisible without any admission defect.
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_FLIGHT_ACTOR_BASELINE") && line.contains(" fighter=1 action=0")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("original World Idle baseline recorded before hostile E and valid LMB");
    // Same authenticated lease: rejected old E seq1 MUST NOT block genuine LMB seq1.
    combat4c_ack(&seat.connection, 1, 1, 1, 1, 4).await;
    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;
    let observed = timeout(Duration::from_secs(2), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            if lines
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=0 to=1"))
            {
                break lines;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("real LMB still enters original LightWindup after rejected E");
    assert!(
        !observed
            .iter()
            .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=0 to=9")),
        "retired Key E must not start a heavy World action"
    );
    println!("KEYE_RESERVED_USE_QUIC_SEQUENCE_UNCHANGED_PASS");
}
async fn combat4c_ack(conn: &Connection, source: u8, action: u8, seq: u32, id: u32, status: u8) {
    conn.send_datagram(typed_event(source, action, seq, id))
        .expect("real same-connection v2 event");
    let packet = timeout(WAIT, async {
        loop {
            let packet = conn
                .receive_datagram()
                .await
                .expect("same live authenticated QUIC connection");
            if packet.len() == 16 && packet[0] == 2 && packet[1] == 0x12 {
                break packet;
            }
        }
    })
    .await
    .expect("bounded real 0x12 ACK");
    assert_eq!(
        &packet[0..4],
        &[2, 0x12, status, 0],
        "physical source terminal and real World ACK status must agree"
    );
    assert_eq!(
        u32::from_le_bytes(packet[4..8].try_into().unwrap()),
        seq,
        "ACK sequence must correlate to one shared ordered lease"
    );
    assert_eq!(
        u32::from_le_bytes(packet[8..12].try_into().unwrap()),
        id,
        "ACK gesture ID cannot be substituted"
    );
    assert!(
        u32::from_le_bytes(packet[12..16].try_into().unwrap()) > 0,
        "actual World-owned tick required"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn retired_key_e_source_cannot_displace_a_valid_lmb_world_action() {
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;
    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;
    // Legacy source1 cannot become a second Combat owner or consume sequence2.
    combat4c_ack(&seat.connection, 1, 1, 2, 2, 4).await;
    combat4c_ack(&seat.connection, 0, 3, 2, 1, 1).await;
    sleep(Duration::from_millis(370)).await;
    let lines = server.lines.lock().unwrap().clone();
    assert!(
        !lines.iter().any(
            |line| line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=0 to=9")
        ),
        "Key E cannot steal original World HeavyWindup: {lines:?}"
    );
    assert!(
        !lines
            .iter()
            .any(|line| line.contains("M201_AUTH_ACTION")
                && line.contains(" fighter=1 from=9 to=10")),
        "Key E cannot commit a heavy attack after LMB release: {lines:?}"
    );
    println!("KEYE_RESERVED_USE_CANNOT_DISPLACE_LMB_QUIC_PASS");
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn combat4c_native_lmb_early_upgrade_stays_ready_until_matching_release() {
    // One actual pinned WebTransport/QUIC lease, source0 LMB, original 60Hz
    // Rust World. This is NOT a browser/human WAN admission test.
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;

    // The original M201 observer emits its FIRST actor observation as a
    // baseline, not an ACTION transition. Wait for actual server Idle0 before
    // issuing PRESS, so every later action is trace-correlated on one clock.
    timeout(Duration::from_secs(2), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            let seen_idle = lines.iter().any(|l| {
                l.contains("M201_FLIGHT_ACTOR_BASELINE") && l.contains(" fighter=1 action=0")
            });
            if seen_idle {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("real QUIC actor1 was observed Idle on original 60Hz World");

    // Same physical source, same gesture ID, monotonic transport sequences.
    // No client-supplied tick may force World readiness or damage.
    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;

    // The World ACTION trace is sampled once per 60Hz tick. A PRESS and
    // UPGRADE accepted in the same tick may appear as Idle -> HeavyWindup,
    // hiding the intermediate real light state. Require an observed genuine
    // Idle -> LightWindup tick, strictly before the 135ms light becomes active.
    timeout(Duration::from_millis(90), async {
        loop {
            if server
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=0 to=1"))
            {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("actual 60Hz World observed LMB light windup before upgrade");
    combat4c_ack(&seat.connection, 0, 2, 2, 1, 1).await;

    timeout(Duration::from_secs(3), async {
        loop {
            let lines = server.lines.lock().unwrap().clone();
            if lines
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=1 to=9"))
            {
                break;
            }
            sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("original World upgraded real LMB light windup to held heavy");

    // Past the legitimate 320ms READY threshold there must be neither
    // auto-heavy nor the abandoned 135ms light from the same gesture.
    sleep(Duration::from_millis(410)).await;
    let held = server.lines.lock().unwrap().clone();
    assert!(
        !held.iter().any(|l| {
            l.contains("M201_AUTH_ACTION")
                && (l.contains(" fighter=1 from=9 to=10") || l.contains(" fighter=1 from=1 to=2"))
        }),
        "one upgraded held LMB cannot auto-hit before physical release: {held:?}"
    );

    // Only the matching real source0 UP commits the heavy. Byte-identical
    // datagram replay must ACK DUPLICATE and must not commit another hit.
    combat4c_ack(&seat.connection, 0, 3, 3, 1, 1).await;
    combat4c_ack(&seat.connection, 0, 3, 3, 1, 2).await;
    timeout(Duration::from_secs(3), async {
        loop {
            if server
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=9 to=10"))
            {
                break;
            }
            sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("matching physical source0 release triggers original World HeavyActive");
    sleep(Duration::from_millis(100)).await;
    let final_lines = server.lines.lock().unwrap().clone();
    let heavy_count = final_lines
        .iter()
        .filter(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=9 to=10"))
        .count();
    assert_eq!(
        heavy_count, 1,
        "replayed release cannot produce a second heavy"
    );
    assert!(
        !final_lines
            .iter()
            .any(|l| { l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=1 to=2") }),
        "upgraded LMB cannot also produce a 34HP LightActive"
    );
    println!("COMBAT4C_NATIVE_LMB_EARLY_UPGRADE_RELEASE_ONLY_QUIC_PASS");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn combat4c_native_held_lmb_cancel_blocks_late_release_and_world_damage() {
    // One REAL loopback-only, TLS-pinned original QUIC actor/World, selected
    // 0x11 source0 LMB + 0x12 admission ACK. Not a live public protocol.
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;

    // Original 60Hz action observer's first row is a baseline rather than
    // an ACTION transition. Pin Idle0 before the physical source0 DOWN.
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|l| {
                l.contains("M201_FLIGHT_ACTOR_BASELINE") && l.contains(" fighter=1 action=0")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("real source0 actor observed idle on original Rust World");

    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;
    timeout(Duration::from_millis(90), async {
        loop {
            if server
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=0 to=1"))
            {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("one physical LMB PRESS really began LightWindup1");

    combat4c_ack(&seat.connection, 0, 2, 2, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=1 to=9"))
            {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("genuine pre-135ms original World light-to-heavy upgrade");

    // Authoritative CANCEL wins before any deliberate RELEASE, including
    // cancellation caused by physical pointercancel, blur or actor teardown.
    combat4c_ack(&seat.connection, 0, 4, 3, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server
                .lines
                .lock()
                .unwrap()
                .iter()
                .any(|l| l.contains("M201_AUTH_ACTION") && l.contains(" fighter=1 from=9 to=0"))
            {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("physical source0 CANCEL returned original 60Hz World to Idle");
    combat4c_ack(&seat.connection, 0, 4, 3, 1, 2).await;

    // A delayed old source0 RELEASE may be rejected, but MUST NEVER turn the
    // cancelled held gesture into a 46HP or 34HP World hit.
    combat4c_ack(&seat.connection, 0, 3, 4, 1, 4).await;
    sleep(Duration::from_millis(440)).await;
    let observed = server.lines.lock().unwrap().clone();
    assert!(
        !observed.iter().any(|l| {
            l.contains("M201_AUTH_ACTION")
                && (l.contains(" fighter=1 from=9 to=10") || l.contains(" fighter=1 from=1 to=2"))
        }),
        "cancelled physical LMB must never activate an original World hit: {observed:?}"
    );
    assert!(
        !observed
            .iter()
            .any(|l| { l.contains("M201_AUTH_HIT") && l.contains(" attacker=1 ") }),
        "admission ACK, CANCEL replay or late RELEASE cannot create HIT"
    );
    println!("COMBAT4C_NATIVE_CANCEL_HELD_LMB_NO_PHANTOM_QUIC_PASS");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn combat4d_native_cancelled_old_lmb_release_cannot_commit_newer_same_source_gesture() {
    // Independent QA for the selected 0x11/0x12 development-only ingress.
    // Real pinned loopback QUIC, original World 60Hz; NOT a physical DOM test
    // and NOT permission to publish this protocol or accept it as release QA.
    //
    // The existing cancellation test proves old RELEASE cannot strike when
    // nothing owns the World. This negative instead has a NEW, valid LMB
    // charging on the SAME accepted connection when the OLD RELEASE arrives.
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;

    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_FLIGHT_ACTOR_BASELINE") && line.contains(" fighter=1 action=0")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("original Rust World actor baseline before typed input");

    // Old gesture #1: admitted real source0 PRESS/UPGRADE/CANCEL, not a HIT.
    println!("COMBAT4D_STAGE old-press");
    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;
    timeout(Duration::from_millis(90), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=0 to=1")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("first original World light windup observed before upgrade");

    println!("COMBAT4D_STAGE old-upgrade");
    combat4c_ack(&seat.connection, 0, 2, 2, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=1 to=9")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("first World light-to-held-heavy transition");
    println!("COMBAT4D_STAGE old-cancel");
    combat4c_ack(&seat.connection, 0, 4, 3, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=9 to=0")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("first World heavy cancelled without a strike");

    // Give original World a full tick to retire source0 gesture #1.
    sleep(Duration::from_millis(45)).await;

    // Second independent physical-gesture ID #2 on the SAME authenticated
    // actor/lease. ACKs and World action transitions must be observable twice,
    // not matched to the first gesture's earlier logs.
    println!("COMBAT4D_STAGE new-press");
    combat4c_ack(&seat.connection, 0, 1, 4, 2, 1).await;
    timeout(Duration::from_millis(90), async {
        loop {
            let count = server
                .lines
                .lock()
                .unwrap()
                .iter()
                .filter(|line| {
                    line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=0 to=1")
                })
                .count();
            if count == 2 {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("second independent LMB created a new original World light windup");

    println!("COMBAT4D_STAGE new-upgrade");
    combat4c_ack(&seat.connection, 0, 2, 5, 2, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            let count = server
                .lines
                .lock()
                .unwrap()
                .iter()
                .filter(|line| {
                    line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=1 to=9")
                })
                .count();
            if count == 2 {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("second legitimate LMB independently entered World heavy windup");

    // A byte-identical retransmission of the earlier CANCEL is a VALID
    // delayed network duplicate. Its original seq3/ID1 ACK is DUPLICATE and
    // must not steal current source0 ID2 or poison its contiguous ACK cursor.
    println!("COMBAT4D_STAGE duplicate-old-cancel");
    combat4c_ack(&seat.connection, 0, 4, 3, 1, 2).await;

    // An OLD gesture RELEASE also arrives while the NEW source0 remains
    // genuinely held. Reusing old seq3 with a different terminal is rejected,
    // never interpreted as release of current ID2 or consumed as seq6.
    // This deliberately hostile raw-QUIC probe tests server isolation only:
    // a real Core8A outbox must retire on REJECTED rather than continue it.
    println!("COMBAT4D_STAGE invalid-old-release-while-new-held");
    combat4c_ack(&seat.connection, 0, 3, 3, 1, 4).await;

    // Even after original server-time READY, neither the earlier CANCEL
    // replay nor rejected OLD RELEASE may commit the newer source0 gesture.
    sleep(Duration::from_millis(430)).await;
    let before = server.lines.lock().unwrap().clone();
    assert!(
        !before.iter().any(|line| {
            line.contains("M201_AUTH_ACTION")
                && (line.contains(" fighter=1 from=9 to=10")
                    || line.contains(" fighter=1 from=1 to=2"))
        }),
        "old CANCEL or RELEASE cannot commit newer World heavy or leaked light: {before:?}"
    );
    assert!(
        !before
            .iter()
            .any(|line| line.contains("M201_AUTH_HIT") && line.contains(" attacker=1 ")),
        "stale source0 terminal cannot manufacture any original World HIT"
    );

    // ONLY deliberate release of current source0 gesture ID #2 may commit
    // one HeavyActive; a byte-identical replay must ACK DUPLICATE with no
    // second transition or World HIT.
    println!("COMBAT4D_STAGE new-release");
    combat4c_ack(&seat.connection, 0, 3, 6, 2, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            let count = server
                .lines
                .lock()
                .unwrap()
                .iter()
                .filter(|line| {
                    line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=9 to=10")
                })
                .count();
            if count == 1 {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("matching new source0 RELEASE committed exactly one World heavy");
    println!("COMBAT4D_STAGE duplicate-release");
    combat4c_ack(&seat.connection, 0, 3, 6, 2, 2).await;

    // A newly fabricated seq7 RELEASE for long-cancelled ID1 is INVALID,
    // unlike a retransmitted authentic seq3 CANCEL. REJECTED is terminal to
    // the single Core8A outbox: sender must retire/reconnect, not continue
    // submitting seq8 on this lease or require the server to accept it.
    println!("COMBAT4D_STAGE invalid-old-release-terminal");
    combat4c_ack(&seat.connection, 0, 3, 7, 1, 4).await;
    sleep(Duration::from_millis(75)).await;
    let after = server.lines.lock().unwrap().clone();
    assert_eq!(
        after
            .iter()
            .filter(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=9 to=10")
            })
            .count(),
        1,
        "no duplicate World heavy may follow identical replay"
    );
    assert!(
        !after
            .iter()
            .any(|line| line.contains("M201_AUTH_HIT") && line.contains(" attacker=1 ")),
        "this native solo-actor test has no target and cannot invent damage"
    );
    println!("COMBAT4D_NATIVE_SAME_SOURCE_OLD_RELEASE_NEW_GESTURE_FENCE_PASS");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn combat4d_retired_keye_cannot_steal_or_commit_a_held_lmb_heavy() {
    // Owner control contract: source1 is retired, Key E is future Use.
    // One original authenticated QUIC actor, existing 0x11/0x12 admission,
    // single original Rust 60Hz World; no human/browser or public v2 claim.
    let (server, url, digest) = real_server();
    let seat = admitted_seat(&url, &digest).await;

    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_FLIGHT_ACTOR_BASELINE") && line.contains(" fighter=1 action=0")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("original World actor idle before source0 physical PRESS");

    println!("COMBAT4D_STAGE lmb-press");
    combat4c_ack(&seat.connection, 0, 1, 1, 1, 1).await;
    timeout(Duration::from_millis(90), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=0 to=1")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("physical LMB enters original World LightWindup1");

    println!("COMBAT4D_STAGE lmb-upgrade");
    combat4c_ack(&seat.connection, 0, 2, 2, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=1 to=9")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("only source0 LMB legitimately upgrades the original World");

    // Source1 UPGRADE never belonged to the canonical KeyE wire grammar.
    // The typed decoder drops it BEFORE admission and intentionally sends
    // no 0x12 ACK. Assert that exact fail-closed decoder boundary, then
    // inject the malformed datagram against the genuinely held source0.
    let malformed_keye_upgrade = typed_event(1, 2, 3, 99);
    assert_eq!(
        myaso_server::prealpha_lmb_gesture_proposal::decode_typed_event(&malformed_keye_upgrade),
        Err(myaso_server::prealpha_lmb_gesture_proposal::TypedDecodeError::InvalidSourceAction),
        "old KeyE UPGRADE is invalid wire, not an admitted rejected event"
    );
    println!("COMBAT4D_STAGE invalid-keye-upgrade-no-ack");
    seat.connection
        .send_datagram(malformed_keye_upgrade)
        .expect("send deliberately invalid source1 UPGRADE");

    // Legacy KeyE PRESS/RELEASE/CANCEL ARE valid historical packet shapes.
    // Each must return a real 0x12 REJECTED, consume no source0 sequence3,
    // and neither terminate nor replace the legitimately held LMB ID1.
    for action in [1, 3, 4] {
        println!("COMBAT4D_STAGE old-keye-action={action}");
        combat4c_ack(&seat.connection, 1, action, 3, 99, 4).await;
    }
    sleep(Duration::from_millis(410)).await;
    let held = server.lines.lock().unwrap().clone();
    assert!(
        !held.iter().any(|line| {
            line.contains("M201_AUTH_ACTION")
                && (line.contains(" fighter=1 from=9 to=10")
                    || line.contains(" fighter=1 from=1 to=2"))
        }),
        "retired Key E cannot release, upgrade or auto-HIT a held LMB: {held:?}"
    );
    assert!(
        !held
            .iter()
            .any(|line| line.contains("M201_AUTH_HIT") && line.contains(" attacker=1 ")),
        "forged old source1 packet cannot manufacture an original World HIT"
    );

    // Rejected source1 seq3 may not steal the contiguous accepted-sequence
    // cursor. Deliberate source0 RELEASE seq3 alone commits one 46HP action.
    println!("COMBAT4D_STAGE lmb-release");
    combat4c_ack(&seat.connection, 0, 3, 3, 1, 1).await;
    timeout(Duration::from_secs(2), async {
        loop {
            if server.lines.lock().unwrap().iter().any(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=9 to=10")
            }) {
                break;
            }
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .expect("valid LMB RELEASE commits one original World heavy");
    println!("COMBAT4D_STAGE lmb-duplicate-release");
    combat4c_ack(&seat.connection, 0, 3, 3, 1, 2).await;
    println!("COMBAT4D_STAGE old-keye-after-lmb-complete");
    combat4c_ack(&seat.connection, 1, 1, 4, 100, 4).await;
    sleep(Duration::from_millis(100)).await;
    let after = server.lines.lock().unwrap().clone();
    assert_eq!(
        after
            .iter()
            .filter(|line| {
                line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=9 to=10")
            })
            .count(),
        1,
        "one deliberate LMB gesture cannot commit a second heavy"
    );
    assert!(
        !after.iter().any(|line| {
            line.contains("M201_AUTH_ACTION") && line.contains(" fighter=1 from=1 to=2")
        }),
        "original one-gesture heavy must not also produce a light"
    );
    assert!(
        !after
            .iter()
            .any(|line| line.contains("M201_AUTH_HIT") && line.contains(" attacker=1 ")),
        "solo-actor QA has no victim: no fabricated source1/LMB damage"
    );
    println!("COMBAT4D_RETIRED_KEYE_LMB_ONLY_HEAVY_WORLD_PASS");
}
