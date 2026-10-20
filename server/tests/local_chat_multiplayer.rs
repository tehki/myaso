//! Genuine WebTransport acceptance: three independent client connections
//! against the real Rust server, with authoritative spawn positions.
//! This is LOOPBACK acceptance, not an independent-network/WAN claim.
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};
use tokio::time::timeout;
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
    let mut process = Command::new(env!("CARGO_BIN_EXE_myaso-server"))
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_CHAT_RADIUS", "160")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("start actual game server");
    let output = process.stdout.take().expect("server output");
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut url = None;
        let mut digest = None;
        let mut announced = false;
        for line in BufReader::new(output).lines().map_while(Result::ok) {
            eprintln!("real-server: {line}");
            if let Some(value) = line.split("listening on ").nth(1) {
                url = Some(value.trim().to_owned());
            }
            if let Some(value) = line.split("development certificate SHA-256: ").nth(1) {
                digest = Some(value.trim().parse::<Sha256Digest>().expect("cert digest"));
            }
            if !announced && url.is_some() && digest.is_some() {
                let _ = sender.send((url.take().expect("URL"), digest.take().expect("digest")));
                announced = true;
            }
        }
    });
    let (url, digest) = receiver
        .recv_timeout(Duration::from_secs(15))
        .expect("actual game server listening URL and pinned TLS cert");
    assert!(url.starts_with("https://127.0.0.1:"));
    (TestServer(process), url, digest)
}

struct Player {
    _endpoint: Endpoint<endpoint_side::Client>,
    connection: Connection,
    _game_send: SendStream,
    _game_recv: RecvStream,
    chat_send: SendStream,
    chat_recv: RecvStream,
}
impl Player {
    async fn connect(url: &str, digest: &Sha256Digest) -> Self {
        // Pin the actual short-lived server certificate even in loopback tests.
        let endpoint = Endpoint::client(
            ClientConfig::builder()
                .with_bind_default()
                .with_server_certificate_hashes([digest.clone()])
                .build(),
        )
        .expect("test endpoint");
        let connection = timeout(Duration::from_secs(8), endpoint.connect(url))
            .await
            .expect("connect timeout")
            .expect("connect");
        let (game_send, game_recv) = timeout(Duration::from_secs(8), async {
            connection
                .open_bi()
                .await
                .expect("game bi")
                .await
                .expect("game init")
        })
        .await
        .expect("game bi timeout");
        let chat_send = timeout(Duration::from_secs(8), async {
            connection
                .open_uni()
                .await
                .expect("chat uni")
                .await
                .expect("chat init")
        })
        .await
        .expect("chat open timeout");
        let chat_recv = timeout(Duration::from_secs(8), connection.accept_uni())
            .await
            .expect("server chat reply timeout")
            .expect("server chat reply");
        Self {
            _endpoint: endpoint,
            connection,
            _game_send: game_send,
            _game_recv: game_recv,
            chat_send,
            chat_recv,
        }
    }
    async fn send(&mut self, correlation: u32, text: &[u8], channel: u8) {
        let mut frame = vec![0x31, 1, channel];
        frame.extend_from_slice(&correlation.to_le_bytes());
        frame.extend_from_slice(&(text.len() as u16).to_le_bytes());
        frame.extend_from_slice(text);
        self.send_raw(&frame).await;
    }
    async fn send_raw(&mut self, frame: &[u8]) {
        let len = u16::try_from(frame.len()).expect("test bounded frame");
        self.chat_send
            .write_all(&len.to_le_bytes())
            .await
            .expect("frame size write");
        self.chat_send.write_all(frame).await.expect("frame write");
    }
    async fn receive(&mut self) -> Vec<u8> {
        timeout(Duration::from_secs(6), async {
            let mut len = [0_u8; 2];
            self.chat_recv
                .read_exact(&mut len)
                .await
                .expect("chat length");
            let size = u16::from_le_bytes(len) as usize;
            assert!((9..=512).contains(&size), "chat response must be bounded");
            let mut bytes = vec![0; size];
            self.chat_recv
                .read_exact(&mut bytes)
                .await
                .expect("chat frame");
            bytes
        })
        .await
        .expect("chat frame timeout")
    }
}
fn assert_result(frame: &[u8], correlation: u32, code: u8) -> u64 {
    assert_eq!(frame.len(), 15);
    assert_eq!(&frame[..2], &[0x33, 1]);
    assert_eq!(
        u32::from_le_bytes(frame[2..6].try_into().unwrap()),
        correlation
    );
    assert_eq!(frame[6], code);
    u64::from_le_bytes(frame[7..15].try_into().unwrap())
}
fn assert_received(frame: &[u8], sender: u32, text: &str) -> u64 {
    assert_eq!(&frame[..3], &[0x32, 1, 1]);
    assert_eq!(
        u32::from_le_bytes(frame[11..15].try_into().unwrap()),
        sender
    );
    let len = u16::from_le_bytes(frame[19..21].try_into().unwrap()) as usize;
    assert_eq!(len, text.len());
    assert_eq!(std::str::from_utf8(&frame[21..]).unwrap(), text);
    u64::from_le_bytes(frame[3..11].try_into().unwrap())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn real_three_connection_local_chat_and_distant_isolation() {
    let (_server, url, digest) = start_server();
    let mut alice = Player::connect(&url, &digest).await;
    let mut bob = Player::connect(&url, &digest).await;
    let mut distant = Player::connect(&url, &digest).await;

    // Server-assigned IDs are 1, 2, 3, with spawn X=42, 138, 234.
    // A-B separation is 96 units, A-C separation is 192.
    alice
        .send(100, b"Greetings! Have you seen the blacksmith?", 1)
        .await;
    let accepted = alice.receive().await;
    let message_id = assert_result(&accepted, 100, 0);
    assert!(message_id != 0);
    let received = bob.receive().await;
    assert_eq!(
        assert_received(&received, 1, "Greetings! Have you seen the blacksmith?"),
        message_id
    );
    assert!(
        timeout(Duration::from_millis(350), distant.receive())
            .await
            .is_err(),
        "distant player must receive no local chat"
    );

    bob.send(101, b"Yes, near the market.", 1).await;
    assert!(assert_result(&bob.receive().await, 101, 0) > 0);
    assert!(assert_received(&alice.receive().await, 2, "Yes, near the market.") > message_id);

    alice
        .send(100, b"Greetings! Have you seen the blacksmith?", 1)
        .await;
    assert_eq!(assert_result(&alice.receive().await, 100, 8), message_id);
    assert!(
        timeout(Duration::from_millis(250), bob.receive())
            .await
            .is_err(),
        "duplicate request must not fan out twice"
    );

    alice.send(102, &[0xff, 0xfe], 1).await;
    assert_eq!(assert_result(&alice.receive().await, 102, 3), 0);
    alice.send(103, b"bad channel", 3).await;
    assert_eq!(assert_result(&alice.receive().await, 103, 6), 0);
    alice.send(104, &vec![b'x'; 241], 1).await;
    assert_eq!(assert_result(&alice.receive().await, 104, 4), 0);
    // Coordinates and forged sender identity are not part of ChatSend.
    let mut forged = vec![0x31, 1, 1];
    forged.extend_from_slice(&105_u32.to_le_bytes());
    forged.extend_from_slice(&2_u16.to_le_bytes());
    forged.extend_from_slice(b"ok");
    forged.extend_from_slice(&2_u32.to_le_bytes()); // unrecognized sender extension
    alice.send_raw(&forged).await;
    assert_eq!(assert_result(&alice.receive().await, 105, 3), 0);
    assert!(
        timeout(Duration::from_millis(250), bob.receive())
            .await
            .is_err(),
        "invalid forged request must not deliver"
    );

    // Chat never consumes the realtime input/datagram channel.
    assert!(alice.connection.max_datagram_size().unwrap_or(0) > 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reconnect_binds_new_sender_without_reusing_an_old_chat_session() {
    let (_server, url, digest) = start_server();
    let mut original = Player::connect(&url, &digest).await;
    let mut neighbor = Player::connect(&url, &digest).await;
    original.send(1, b"old session", 1).await;
    assert!(assert_result(&original.receive().await, 1, 0) > 0);
    assert!(assert_received(&neighbor.receive().await, 1, "old session") > 0);
    original
        .connection
        .close(VarInt::from_u32(0), b"test disconnect");
    let mut replacement = Player::connect(&url, &digest).await;
    replacement.send(1, b"new session", 1).await;
    let accepted = assert_result(&replacement.receive().await, 1, 0);
    assert!(accepted > 0);
    assert_eq!(
        assert_received(&neighbor.receive().await, 3, "new session"),
        accepted
    );
    neighbor.send(2, b"welcome back", 1).await;
    assert!(assert_result(&neighbor.receive().await, 2, 0) > accepted);
    assert!(assert_received(&replacement.receive().await, 2, "welcome back") > accepted);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn genuine_realtime_input_ack_coexists_with_reliable_chat() {
    let (_server, url, digest) = start_server();
    let mut sender = Player::connect(&url, &digest).await;
    let mut neighbor = Player::connect(&url, &digest).await;
    sender.send(10, b"Checking chat and movement", 1).await;
    assert!(assert_result(&sender.receive().await, 10, 0) > 0);
    assert!(assert_received(&neighbor.receive().await, 1, "Checking chat and movement") > 0);
    // Unchanged binary v1 input datagram; chat never consumes this path.
    let mut input = [0_u8; 22];
    input[0] = 1; // game protocol
    input[1] = 1; // INPUT packet type
    input[2] = 1; // sample count
    input[4..6].copy_from_slice(&1_u16.to_le_bytes());
    input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    input[8..12].copy_from_slice(&101_u32.to_le_bytes());
    input[17] = 127; // move X
    sender
        .connection
        .send_datagram(input)
        .expect("send genuine game input");
    let acknowledged = timeout(Duration::from_secs(5), async {
        loop {
            let packet = sender
                .connection
                .receive_datagram()
                .await
                .expect("game datagram");
            if packet.len() == 16 && packet[0] == 1 && packet[1] == 3 {
                break packet;
            }
        }
    })
    .await
    .expect("gameplay input ACK under chat traffic");
    assert_eq!(
        u32::from_le_bytes(acknowledged[4..8].try_into().unwrap()),
        101
    );
    assert_eq!(
        u32::from_le_bytes(acknowledged[12..16].try_into().unwrap()),
        1
    );
    neighbor.send(11, b"Movement still works", 1).await;
    assert!(assert_result(&neighbor.receive().await, 11, 0) > 0);
    assert!(assert_received(&sender.receive().await, 2, "Movement still works") > 0);
}
