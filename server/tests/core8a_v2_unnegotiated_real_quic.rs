//! Core8A actual QUIC NEGATIVE: proposed v2 gesture packets are NOT enabled.
//! Against the unchanged original v1 Rust server, a speculative 0x11 EVENT,
//! nor incompatible 0x52, may gain a Combat/gameplay ACK without negotiation.
//! Two independent pinned QUIC players must still receive separate v1 INPUT_ACK.
//! No server route/flag is activated, no HP claim, no internet/WAN exposure.
use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::Duration,
};
use tokio::time::timeout;
use wtransport::{
    endpoint::endpoint_side, tls::Sha256Digest, ClientConfig, Connection, Endpoint, RecvStream,
    SendStream,
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
    .expect("one real server-owned INPUT_ACK after rejected v2 packets");
    assert_eq!(
        u32::from_le_bytes(ack[12..16].try_into().unwrap()),
        net_id,
        "ACK must bind to correct original server-issued net ID"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn current_v1_server_rejects_both_unnegotiated_v2_proposals_but_keeps_two_players() {
    let (_server, url, digest) = start_server();
    let (_ep1, one, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, two, _send2, _recv2) = connect(&url, &digest).await;

    // Exact independent Combat4/Core8A proposed 16-byte PRESS. This is NOT
    // a valid v1 INPUT datagram, nor a negotiated client capability.
    let one_lmb: [u8; 16] = [2, 0x11, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
    // Future typed KeyE in byte3=1 also cannot bypass current v1 rejection.
    let one_key_e: [u8; 16] = [2, 0x11, 1, 1, 3, 0, 0, 0, 2, 0, 0, 0, 43, 0, 0, 0];
    // Other department's incompatible v2 0x52 alternative is also forbidden.
    let alternative: [u8; 48] = [
        2, 0x52, 2, 0, 8, 7, 6, 5, 4, 3, 2, 1, 9, 0, 0, 0, 1, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 1,
        1, 0, 0, 2, 0, 0, 0, 7, 0, 0, 0, 100, 0, 0, 0, 3, 1, 0, 0,
    ];
    for packet in [
        one_lmb.as_slice(),
        one_key_e.as_slice(),
        alternative.as_slice(),
    ] {
        one.send_datagram(packet)
            .expect("actual injected v2 QUIC datagram");
        two.send_datagram(packet)
            .expect("second actual client independently sends v2");
    }

    // Other game snapshots may still arrive. None may be a server v2 gesture
    // acceptance or edge ACK. Silence alone is NOT sufficient: below we
    // independently require real original v1 ACK from BOTH live connections.
    for client in [&one, &two] {
        let unwanted = timeout(Duration::from_millis(450), async {
            loop {
                let frame = client
                    .receive_datagram()
                    .await
                    .expect("v2 rejection must not close original game connection");
                if frame.len() >= 2 && frame[0] == 2 && frame[1] == 0x12 {
                    break frame;
                }
            }
        })
        .await;
        assert!(
            unwanted.is_err(),
            "non-negotiated v2 transport ACK MUST NOT exist"
        );
    }
    assert_original_v1_input_ack(&one, 1, 501).await;
    assert_original_v1_input_ack(&two, 2, 502).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn current_v1_server_ignores_unnegotiated_reliable_gesture_streams_without_closing_game() {
    // The proposed future v2 delivery path is a separate, reliable stream
    // within an ALREADY-admitted WebTransport session. Prove the current
    // default-off v1 server does NOT accidentally activate such a stream.
    // This is an actual two-client native QUIC test, not a codec unit mock.
    let (_server, url, digest) = start_server();
    let (_ep1, one, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, two, _send2, _recv2) = connect(&url, &digest).await;
    let lmb: [u8; 16] = [2, 0x11, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 42, 0, 0, 0];
    let key_e: [u8; 16] = [2, 0x11, 1, 1, 3, 0, 0, 0, 2, 0, 0, 0, 43, 0, 0, 0];
    let alt: [u8; 16] = [2, 0x52, 1, 0, 1, 0, 0, 0, 2, 0, 0, 0, 44, 0, 0, 0];

    for (client, frames) in [(&one, [lmb, key_e]), (&two, [alt, lmb])] {
        let mut stream = timeout(Duration::from_secs(4), async {
            client
                .open_uni()
                .await
                .expect("actual same-session client uni stream")
                .await
                .expect("QUIC uni stream open")
        })
        .await
        .expect("genuine optional gesture stream opening bounded");
        for event in frames {
            timeout(Duration::from_secs(4), stream.write_all(&event))
                .await
                .expect("bounded illegal frame stream send")
                .expect("real stream write");
        }
        // Keeping the SendStream live allows the original game to continue;
        // a browser cannot force capability negotiation by sending bytes.
        // No response means NO v2 activation, but the proof also requires
        // two real subsequent v1 INPUT_ACKs below.
        let unwanted = timeout(Duration::from_millis(550), client.accept_uni()).await;
        assert!(
            unwanted.is_err(),
            "original default-v1 server MUST NOT issue a v2 reply/ACK stream"
        );
        drop(stream);
    }
    assert_original_v1_input_ack(&one, 1, 701).await;
    assert_original_v1_input_ack(&two, 2, 702).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn one_unnegotiated_v2_sender_cannot_starve_another_legacy_v1_player() {
    // Source-real, loopback-only peer isolation: the attacker does not hold a
    // privileged v2 lease and must never block a separate admitted actor.
    // This is a bounded burst, NOT a benchmark or hostile-WAN load test.
    let (_server, url, digest) = start_server();
    let (_ep1, noisy, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, quiet, _send2, _recv2) = connect(&url, &digest).await;

    let flood = async {
        for sequence in 1..=32_u32 {
            let mut packet = [2_u8, 0x11, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
            packet[4..8].copy_from_slice(&sequence.to_le_bytes());
            if sequence % 4 == 0 {
                // Also inject the incompatible proposed wire family.
                packet[1] = 0x52;
            }
            if sequence % 4 == 1 {
                // Future KeyE must be rejected before capability negotiation.
                packet[3] = 1;
            }
            noisy
                .send_datagram(packet)
                .expect("bounded unnegotiated gesture datagram");
            tokio::task::yield_now().await;
        }
    };
    let independent_v1 = assert_original_v1_input_ack(&quiet, 2, 901);
    timeout(Duration::from_secs(8), async {
        tokio::join!(flood, independent_v1);
    })
    .await
    .expect("one invalid v2 sender must not block independent v1 ACK");

    // The noisy peer's authentic gameplay connection must also remain usable.
    assert_original_v1_input_ack(&noisy, 1, 902).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_original_players_retain_distinct_acks_during_one_peer_v2_burst() {
    // P0 Pre-Alpha original-arena four-actor negative. These are genuinely
    // independent pinned QUIC connections but share one local Rust server.
    // No live v2 admission, synthetic Combat ACK, or host-to-host WAN claim.
    let (_server, url, digest) = start_server();
    let (_ep1, noisy, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, quiet2, _send2, _recv2) = connect(&url, &digest).await;
    let (_ep3, quiet3, _send3, _recv3) = connect(&url, &digest).await;
    let (_ep4, quiet4, _send4, _recv4) = connect(&url, &digest).await;

    let noise = async {
        for sequence in 1..=48_u32 {
            let mut packet = [2_u8, 0x11, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
            packet[4..8].copy_from_slice(&sequence.to_le_bytes());
            if sequence % 3 == 0 {
                packet[1] = 0x52; // incompatible Core8C proposal
            } else if sequence % 3 == 1 {
                packet[3] = 1; // dormant future KeyE source
            }
            noisy
                .send_datagram(packet)
                .expect("real bounded unnegotiated QUIC input");
            tokio::task::yield_now().await;
        }
    };
    // Run all distinct actor receipts concurrently with invalid peer traffic,
    // rather than sequentially checking actor #4 only after the noise ends.
    timeout(Duration::from_secs(9), async {
        tokio::join!(
            noise,
            assert_original_v1_input_ack(&quiet2, 2, 1002),
            assert_original_v1_input_ack(&quiet3, 3, 1003),
            assert_original_v1_input_ack(&quiet4, 4, 1004),
        );
    })
    .await
    .expect("four-player QUIC input isolation exceeded bounded timeout");

    // Noisy actor remains a normal admitted v1 player after all invalid v2.
    assert_original_v1_input_ack(&noisy, 1, 1001).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn short_v1_press_release_packets_get_a_server_receipt_but_not_a_hit_receipt() {
    // Core8A diagnostic control for strict real-browser M156: if v1 INPUT
    // datagrams are EXPLICITLY sent 10ms apart, a real authoritative QUIC
    // connection can still return a processed-input ACK for the latest tick.
    // Current v1 ACKs may coalesce several admitted samples into one newest
    // clientTick; receiving this ACK does NOT prove both source DOM edges,
    // either intermediate World action, or any Combat HIT/HP.
    let (_server, url, digest) = start_server();
    let (_ep1, actor, _send1, _recv1) = connect(&url, &digest).await;
    let (_ep2, other, _send2, _recv2) = connect(&url, &digest).await;

    let packet = |sequence: u16, tick: u32, attack: bool| {
        let mut input = [0_u8; 22];
        input[0] = 1; // original admitted v1 transport
        input[1] = 1; // original INPUT packet
        input[2] = 1; // one original compressed sample
        input[4..6].copy_from_slice(&sequence.to_le_bytes());
        input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
        input[8..12].copy_from_slice(&tick.to_le_bytes());
        input[21] = u8::from(attack); // original LMB light bit, not v2
        input
    };

    actor
        .send_datagram(packet(1, 1201, true))
        .expect("genuine native first v1 PRESS sample sent");
    tokio::time::sleep(Duration::from_millis(10)).await;
    actor
        .send_datagram(packet(2, 1202, false))
        .expect("genuine native v1 RELEASE sample 10ms later sent");

    let (processed_tick, server_tick) = timeout(Duration::from_secs(5), async {
        loop {
            let message = actor
                .receive_datagram()
                .await
                .expect("original QUIC session alive");
            if message.len() != 16 || message[0] != 1 || message[1] != 3 {
                continue; // real snapshots may be interleaved
            }
            assert_eq!(
                u32::from_le_bytes(message[12..16].try_into().unwrap()),
                1,
                "receipt must be scoped to actor #1, never actor #2"
            );
            let tick = u32::from_le_bytes(message[4..8].try_into().unwrap());
            if tick == 1202 {
                break (
                    tick,
                    u32::from_le_bytes(message[8..12].try_into().unwrap()),
                );
            }
            assert_eq!(tick, 1201, "unknown or cross-actor input receipt");
        }
    })
    .await
    .expect("real QUIC native 10ms packet pair must yield newest v1 ACK");
    assert_eq!(processed_tick, 1202);
    assert!(server_tick > 0, "only a real authoritative clock may ACK");

    // A different concurrent authenticated actor still retains normal INPUT.
    assert_original_v1_input_ack(&other, 2, 1203).await;
}
