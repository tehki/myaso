//! Private compiled-loopback integration: three original QUIC connections,
//! original 60Hz World HIT, same reliable game streams, recipient-only receipts.
//! This is not a browser/WAN/account-authentication release qualification.
#![cfg(feature = "experimental-hit-delivery-lab")]
use myaso_server::combat_hit_control_proposal::{
    decode_hit_control, encode_hit_control, HitControl, HitControlOp,
};
use myaso_server::combat_hit_receipt::{decode_hit_receipt, HitReceipt};
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
        .env("MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB", "1")
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

async fn control(seat: &mut Seat, value: HitControl) {
    let body = encode_hit_control(value).unwrap();
    let mut frame = Vec::from((body.len() as u16).to_le_bytes());
    frame.extend_from_slice(&body);
    timeout(WAIT, seat._send.write_all(&frame)).await.unwrap().unwrap();
}
async fn hit_grant(seat: &mut Seat) -> [u8; 16] {
    control(seat, HitControl { op: HitControlOp::ClientHello, cursor: 0, token: [0; 16], aux: 0 }).await;
    timeout(WAIT, async {
        loop {
            let frame = framed_recv(&mut seat._recv).await;
            if frame.len() == 32 && frame[1] == 6 {
                let grant = decode_hit_control(&frame).unwrap();
                assert_eq!(grant.op, HitControlOp::ServerGrant);
                assert_eq!(grant.cursor, 0);
                assert_eq!(grant.aux, 64);
                assert_ne!(grant.token, [0; 16]);
                return grant.token;
            }
        }
    }).await.expect("actual original reliable writer granted recipient HIT scope")
}
async fn receipt(seat: &mut Seat) -> HitReceipt {
    timeout(WAIT, async {
        loop {
            let frame = framed_recv(&mut seat._recv).await;
            if frame.len() == 28 && frame[1] == 5 { return decode_hit_receipt(&frame).unwrap(); }
        }
    }).await.expect("actual reliable HIT receipt must arrive")
}
async fn no_receipt(seat: &mut Seat) {
    let result = timeout(Duration::from_millis(350), async {
        loop {
            let frame = framed_recv(&mut seat._recv).await;
            assert_ne!(frame.get(1), Some(&5), "bystander/replay cannot receive HIT credit");
        }
    }).await;
    assert!(result.is_err());
}
fn movement(sequence: u16, tick: u32, x: i8) -> [u8; 22] {
    let mut bytes = [0_u8; 22];
    bytes[0] = 1; bytes[1] = 1; bytes[2] = 1;
    bytes[4..6].copy_from_slice(&sequence.to_le_bytes());
    bytes[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    bytes[8..12].copy_from_slice(&tick.to_le_bytes());
    bytes[17] = x as u8;
    bytes
}
async fn staged_short_light(seat: &Seat, first: bool, gesture: u32) {
    if first {
        seat.connection.send_datagram(movement(1,1,127)).unwrap();
        sleep(Duration::from_millis(230)).await;
        seat.connection.send_datagram(movement(2,2,0)).unwrap();
        sleep(Duration::from_millis(80)).await;
    }
    let seq = gesture * 2 - 1;
    seat.connection.send_datagram(typed_event(0,1,seq,gesture)).unwrap();
    sleep(Duration::from_millis(6)).await;
    seat.connection.send_datagram(typed_event(0,3,seq+1,gesture)).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn original_world_hit_crosses_one_real_reliable_writer_to_only_attacker_and_victim() {
    let (server,url,digest) = real_server();
    let mut attacker = admitted_seat(&url,&digest).await;
    let mut victim = admitted_seat(&url,&digest).await;
    let mut spectator = admitted_seat(&url,&digest).await;
    let attacker_token = hit_grant(&mut attacker).await;
    let victim_token = hit_grant(&mut victim).await;
    let spectator_token = hit_grant(&mut spectator).await;
    assert_ne!(attacker_token,victim_token);
    assert_ne!(attacker_token,spectator_token);
    staged_short_light(&attacker,true,1).await;
    let attacker_hit = receipt(&mut attacker).await;
    let victim_hit = receipt(&mut victim).await;
    assert_eq!(attacker_hit,victim_hit);
    assert_eq!((attacker_hit.sequence,attacker_hit.attacker,attacker_hit.target),(0,1,2));
    assert_eq!((attacker_hit.damage,attacker_hit.target_hp),(34.0,66.0));
    let real_line = format!("M201_AUTH_HIT tick={} attacker=1 target=2 damage=34 hp=66",attacker_hit.server_tick);
    assert_eq!(server.lines.lock().unwrap().iter().filter(|line|line.contains(&real_line)).count(),1);
    control(&mut attacker,HitControl {op:HitControlOp::ClientNack,cursor:0,token:attacker_token,aux:0}).await;
    let replay=receipt(&mut attacker).await;
    assert_eq!(replay,attacker_hit,"NACK reuses exact pending receipt without a second World hit");
    no_receipt(&mut spectator).await;
    for _ in 0..2 {
        control(&mut attacker,HitControl {op:HitControlOp::ClientAck,cursor:1,token:attacker_token,aux:0}).await;
    }
    control(&mut victim,HitControl {op:HitControlOp::ClientAck,cursor:1,token:victim_token,aux:0}).await;
    attacker.connection.send_datagram(event(1,1)).unwrap();
    attacker.connection.send_datagram(event(3,2)).unwrap();
    no_receipt(&mut attacker).await;
    no_receipt(&mut victim).await;
    assert_eq!(server.lines.lock().unwrap().iter().filter(|line|line.contains("M201_AUTH_HIT")&&line.contains("attacker=1")).count(),1);
    // Valid bytes from ANOTHER real scope cannot ACK an uninvolved player's
    // channel or gain presentation. This never submits a client HIT packet.
    control(&mut spectator,HitControl {op:HitControlOp::ClientAck,cursor:1,token:attacker_token,aux:0}).await;
    timeout(WAIT,spectator.connection.closed()).await.expect("foreign recipient token must close original actor scope");
    println!("PRIVATE_HIT_THREE_REAL_QUIC_ROLES_PASS actualWorld=true accountAuthentication=false publicActivation=false");
}


#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_death_respawn_closes_old_hit_scope_and_fresh_quic_rejects_old_capability() {
    let (server,url,digest) = real_server();
    let mut attacker = admitted_seat(&url,&digest).await;
    let mut victim = admitted_seat(&url,&digest).await;
    let attacker_token = hit_grant(&mut attacker).await;
    let victim_token = hit_grant(&mut victim).await;
    for gesture in 1..=3 {
        staged_short_light(&attacker,gesture==1,gesture).await;
        let a = receipt(&mut attacker).await;
        let v = receipt(&mut victim).await;
        assert_eq!(a,v);
        assert_eq!(a.sequence,gesture-1);
        assert_eq!((a.attacker,a.target,a.damage),(1,2,34.0));
        assert_eq!(a.target_hp,if gesture==1 {66.0} else if gesture==2 {32.0} else {0.0});
        control(&mut attacker,HitControl {op:HitControlOp::ClientAck,cursor:gesture,token:attacker_token,aux:0}).await;
        control(&mut victim,HitControl {op:HitControlOp::ClientAck,cursor:gesture,token:victim_token,aux:0}).await;
        if gesture<3 {sleep(Duration::from_millis(750)).await;}
    }
    timeout(Duration::from_secs(4),victim.connection.closed()).await
        .expect("original respawn incarnation invalidates old private QUIC scope");
    assert_eq!(server.lines.lock().unwrap().iter().filter(|line|line.contains("M201_AUTH_HIT")&&line.contains("attacker=1 target=2")).count(),3);
    let mut fresh = admitted_seat(&url,&digest).await;
    let fresh_token = hit_grant(&mut fresh).await;
    assert_ne!(fresh_token,victim_token,"fresh original QUIC admission mints fresh CSPRNG capability");
    no_receipt(&mut fresh).await;
    control(&mut fresh,HitControl {op:HitControlOp::ClientAck,cursor:3,token:victim_token,aux:0}).await;
    timeout(WAIT,fresh.connection.closed()).await.expect("old dead incarnation token cannot acknowledge fresh scope");
}


#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn unacknowledged_real_receipt_causes_explicit_gap_and_closes_only_that_scope() {
    let (_server,url,digest) = real_server();
    let mut attacker = admitted_seat(&url,&digest).await;
    let mut victim = admitted_seat(&url,&digest).await;
    let attacker_token = hit_grant(&mut attacker).await;
    let _victim_token = hit_grant(&mut victim).await;
    staged_short_light(&attacker,true,1).await;
    let a = receipt(&mut attacker).await;
    let v = receipt(&mut victim).await;
    assert_eq!(a,v);
    control(&mut attacker,HitControl {op:HitControlOp::ClientAck,cursor:1,token:attacker_token,aux:0}).await;
    let gap = timeout(Duration::from_secs(4),async {
        loop {
            let frame = framed_recv(&mut victim._recv).await;
            if frame.len()==32&&frame[1]==6 { break decode_hit_control(&frame).unwrap(); }
            assert_ne!(frame.get(1),Some(&5),"waiting for ACK cannot duplicate a real receipt");
        }
    }).await.expect("actual same writer must report bounded explicit GAP");
    assert_eq!(gap.op,HitControlOp::ServerGap);
    assert_eq!(gap.cursor,0);
    timeout(WAIT,victim.connection.closed()).await.expect("terminal GAP retires old actual QUIC lease");
    // The independent attacker scope remains valid after victim's timeout.
    control(&mut attacker,HitControl {op:HitControlOp::ClientAck,cursor:1,token:attacker_token,aux:0}).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn hostile_reliable_frame_length_closes_private_scope_without_unbounded_body_read() {
    let (_server,url,digest) = real_server();
    let mut seat = admitted_seat(&url,&digest).await;
    timeout(WAIT,seat._send.write_all(&u16::MAX.to_le_bytes())).await.unwrap().unwrap();
    timeout(Duration::from_secs(2),seat.connection.closed()).await
        .expect("hostile 65535-byte length must fail before any body allocation/read");
}
