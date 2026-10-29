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
        .env("MYASO_CHAT_C1_ENABLED", "1")
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


#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_four_connections_route_only_to_same_world_nearby_peers() {
    let (_server, url, digest) = start_server();
    let mut first = Player::connect(&url, &digest).await;
    let mut second = Player::connect(&url, &digest).await;
    let mut third = Player::connect(&url, &digest).await;
    let mut fourth = Player::connect(&url, &digest).await;

    // Four genuine distinct QUIC/WebTransport sessions in the original
    // authoritative World. Spawn x=42,138,234,330: near-neighbor 96,
    // next-neighbor 192 > server-owned local-chat radius160.
    first.send(401, b"near-first-second", 1).await;
    let id1 = assert_result(&first.receive().await, 401, 0);
    assert_eq!(assert_received(&second.receive().await, 1, "near-first-second"), id1);
    assert!(timeout(Duration::from_millis(250), third.receive()).await.is_err());
    assert!(timeout(Duration::from_millis(250), fourth.receive()).await.is_err());

    third.send(402, b"near-second-third-fourth", 1).await;
    let id2 = assert_result(&third.receive().await, 402, 0);
    assert_eq!(assert_received(&second.receive().await, 3, "near-second-third-fourth"), id2);
    assert_eq!(assert_received(&fourth.receive().await, 3, "near-second-third-fourth"), id2);
    assert!(timeout(Duration::from_millis(250), first.receive()).await.is_err(),
        "far player must never receive another actor's local chat");

    // Sender identities are constructed by original Rust World admission;
    // no client may impersonate fourth by appending an unframed ID.
    let mut forged = vec![0x31, 1, 1];
    forged.extend_from_slice(&403_u32.to_le_bytes());
    forged.extend_from_slice(&5_u16.to_le_bytes());
    forged.extend_from_slice(b"forge");
    forged.extend_from_slice(&4_u32.to_le_bytes());
    first.send_raw(&forged).await;
    assert_eq!(assert_result(&first.receive().await, 403, 3), 0);
    assert!(timeout(Duration::from_millis(250), second.receive()).await.is_err());

    // The optional chat protocol cannot claim its own sender identity, and
    // the original game transport remains available on every connection.
    for connection in [&first.connection, &second.connection, &third.connection, &fourth.connection] {
        assert!(connection.max_datagram_size().unwrap_or(0) > 0);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn versioned_client_preface_is_not_chat_and_legacy_peer_still_receives() {
    let (_server, url, digest) = start_server();
    let mut firefox_style = Player::connect(&url, &digest).await;
    let mut legacy_peer = Player::connect(&url, &digest).await;
    // A real nonempty 4-byte QUIC stream-open marker: length 2, 0x30, v1.
    // It MUST NOT consume a sender correlation or deliver a blank message.
    firefox_style.send_raw(&[0x30, 1]).await;
    assert!(
        timeout(Duration::from_millis(250), legacy_peer.receive())
            .await
            .is_err(),
        "stream preface must not fan out a chat message"
    );
    firefox_style.send(702, b"Hello from Firefox", 1).await;
    assert_ne!(assert_result(&firefox_style.receive().await, 702, 0), 0);
    let received = legacy_peer.receive().await;
    assert_eq!(assert_received(&received, 1, "Hello from Firefox"), 1);
    // Legacy client without any preface can reply on its existing stream.
    legacy_peer.send(703, b"Hello from legacy", 1).await;
    assert_ne!(assert_result(&legacy_peer.receive().await, 703, 0), 0);
    assert_eq!(
        assert_received(&firefox_style.receive().await, 2, "Hello from legacy"),
        2
    );
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

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn truncated_chat_payload_times_out_without_closing_gameplay_datagrams() {
    let (_server, url, digest) = start_server();
    let mut player = Player::connect(&url, &digest).await;

    // An admitted peer announces a valid-sized frame, sends only two body
    // bytes, and never completes it. This must not pin its chat task forever.
    player
        .chat_send
        .write_all(&(20_u16).to_le_bytes())
        .await
        .expect("announce partial chat frame");
    player
        .chat_send
        .write_all(&[0x31, 1])
        .await
        .expect("send only partial chat body");

    let mut buffer = [0_u8; 1];
    let outcome = timeout(
        Duration::from_secs(14),
        player.chat_recv.read_exact(&mut buffer),
    )
    .await
    .expect("chat reply must close after bounded partial-body deadline");
    assert!(
        outcome.is_err(),
        "partial chat body must end optional server chat stream"
    );

    // The existing game QUIC connection remains usable after the isolated
    // malformed/stalled chat stream is torn down.
    let mut input = [0_u8; 22];
    input[0] = 1; // game protocol
    input[1] = 1; // INPUT type
    input[2] = 1; // sample count
    input[4..6].copy_from_slice(&1_u16.to_le_bytes());
    input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    input[8..12].copy_from_slice(&101_u32.to_le_bytes());
    input[17] = 127; // movement X
    player
        .connection
        .send_datagram(input)
        .expect("gameplay datagram after chat-only timeout");
    timeout(Duration::from_secs(5), async {
        loop {
            let packet = player
                .connection
                .receive_datagram()
                .await
                .expect("gameplay still receives snapshots and input ACKs");
            if packet.len() == 16 && packet[0] == 1 && packet[1] == 3 {
                assert_eq!(u32::from_le_bytes(packet[4..8].try_into().unwrap()), 101);
                break;
            }
        }
    })
    .await
    .expect("game input ACK survives chat-only timeout");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn interleaved_outbound_chat_does_not_discard_half_read_inbound_frame() {
    let (_server, url, digest) = start_server();
    let mut alice = Player::connect(&url, &digest).await;
    let mut bob = Player::connect(&url, &digest).await;

    let text = "Partly sent message survives another player's chat";
    let mut payload = vec![0x31, 1, 1];
    payload.extend_from_slice(&400_u32.to_le_bytes());
    payload.extend_from_slice(&(text.len() as u16).to_le_bytes());
    payload.extend_from_slice(text.as_bytes());

    // Alice's QUIC chat frame header arrives, but its body is deliberately
    // incomplete. Her server task is now in the middle of read_exact().
    alice
        .chat_send
        .write_all(&(payload.len() as u16).to_le_bytes())
        .await
        .expect("chat frame length");
    alice
        .chat_send
        .write_all(&payload[..5])
        .await
        .expect("partial chat body");
    tokio::time::sleep(Duration::from_millis(40)).await;

    // Bob sends to Alice while the first read is suspended. Servicing Bob's
    // outbound delivery must resume (not reconstruct) Alice's partial read.
    bob.send(201, b"Interleaving incoming chat", 1).await;
    assert!(assert_result(&bob.receive().await, 201, 0) > 0);
    assert!(assert_received(&alice.receive().await, 2, "Interleaving incoming chat") > 0);

    alice
        .chat_send
        .write_all(&payload[5..])
        .await
        .expect("remainder of the original chat frame");
    let id = assert_result(&alice.receive().await, 400, 0);
    assert!(id > 0);
    assert_eq!(assert_received(&bob.receive().await, 1, text), id);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn truncated_chat_length_prefix_times_out_but_gameplay_stays_live() {
    let (_server, url, digest) = start_server();
    let mut player = Player::connect(&url, &digest).await;

    // A malicious/failed peer sends the first length byte only. The chat
    // task must time out, even though an otherwise idle chat remains valid.
    player
        .chat_send
        .write_all(&[20_u8])
        .await
        .expect("send first chat length byte");
    let mut one = [0_u8; 1];
    let reply = timeout(
        Duration::from_secs(14),
        player.chat_recv.read_exact(&mut one),
    )
    .await
    .expect("partial chat header must close optional reply stream");
    assert!(reply.is_err(), "partial chat header must not live forever");

    // A chat-only protocol failure must not close/reallocate the game socket.
    let mut input = [0_u8; 22];
    input[0] = 1;
    input[1] = 1;
    input[2] = 1;
    input[4..6].copy_from_slice(&1_u16.to_le_bytes());
    input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    input[8..12].copy_from_slice(&202_u32.to_le_bytes());
    input[17] = 127;
    player
        .connection
        .send_datagram(input)
        .expect("genuine unchanged input after partial chat header");
    timeout(Duration::from_secs(5), async {
        loop {
            let packet = player
                .connection
                .receive_datagram()
                .await
                .expect("gameplay remains connected");
            if packet.len() == 16 && packet[0] == 1 && packet[1] == 3 {
                assert_eq!(u32::from_le_bytes(packet[4..8].try_into().unwrap()), 202);
                break;
            }
        }
    })
    .await
    .expect("gameplay input ACK survives stalled chat header");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn repeated_chat_submissions_do_not_starve_authoritative_game_input_ack() {
    let (_server, url, digest) = start_server();
    let mut sender = Player::connect(&url, &digest).await;
    let _neighbor = Player::connect(&url, &digest).await;
    let mut accepted = 0;
    let mut rate_limited = 0;

    // Interleave chat with unchanged v1 gameplay input over the SAME active
    // connection. Rate-limited chat must not interrupt authoritative INPUT_ACK.
    // This is genuine loopback QUIC concurrency, not independent-network or
    // native browser acceptance.
    for round in 0..24_u32 {
        let correlation = 600 + round;
        let client_tick = 101 + round;
        sender
            .send(correlation, b"Chat beside realtime movement", 1)
            .await;

        let mut input = [0_u8; 22];
        input[0] = 1; // gameplay protocol v1
        input[1] = 1; // INPUT
        input[2] = 1; // one input sample
        input[4..6].copy_from_slice(&1_u16.to_le_bytes());
        input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
        input[8..12].copy_from_slice(&client_tick.to_le_bytes());
        input[17] = 127; // forward/right movement
        sender
            .connection
            .send_datagram(input)
            .expect("game input while chat is active");

        let chat_result = sender.receive().await;
        assert_eq!(&chat_result[..2], &[0x33, 1]);
        assert_eq!(
            u32::from_le_bytes(chat_result[2..6].try_into().unwrap()),
            correlation
        );
        match chat_result[6] {
            0 => accepted += 1,
            5 => rate_limited += 1,
            code => panic!("unexpected chat response {code} while combat input is live"),
        }

        let ack = timeout(Duration::from_secs(5), async {
            loop {
                let packet = sender
                    .connection
                    .receive_datagram()
                    .await
                    .expect("game input acknowledgment channel remains alive");
                if packet.len() == 16 && packet[0] == 1 && packet[1] == 3 {
                    break packet;
                }
            }
        })
        .await
        .expect("game input ACK must not stall behind chat");
        assert_eq!(
            u32::from_le_bytes(ack[4..8].try_into().unwrap()),
            client_tick,
            "every chat/input round must retain authoritative ACK"
        );
    }
    assert!(accepted >= 1, "the server accepted initial live chat");
    assert!(rate_limited >= 1, "chat burst limit is still authoritative");
}
