//! P0 M1 acceptance of the **real** myaso-server process at a four-player cap.
//! This is pinned-certificate QUIC loopback regression, not a cross-host/browser
//! or authored-city walkability qualification. No production-facing toggle.
use anyhow::{bail, Context, Result};
use myaso_server::{snapshot::decode_snapshot, INPUT_HEADER_BYTES, INPUT_SAMPLE_BYTES};
use std::{
    collections::BTreeSet,
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use tokio::time::timeout;
use wtransport::{
    tls::{Sha256Digest, Sha256DigestFmt},
    ClientConfig, Connection, Endpoint,
};

const FOUR_PLAYERS: usize = 4;

struct TestServer(Child);

impl Drop for TestServer {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn start_actual_server() -> Result<(TestServer, String, Sha256Digest)> {
    let mut child = Command::new(env!("CARGO_BIN_EXE_myaso-server"))
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_MAX_PLAYERS", "4")
        .env_remove("MYASO_CERT_PEM")
        .env_remove("MYASO_KEY_PEM")
        .env_remove("MYASO_FLIGHT_BACKGROUND_PLAYERS")
        .env_remove("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS")
        .env_remove("MYASO_FLIGHT_RELIABLE_DELAY_MS")
        .env_remove("MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("launch exact Cargo-built authoritative myaso-server")?;
    let stdout = child.stdout.take().context("server stdout unavailable")?;
    let (tx, rx) = mpsc::channel::<String>();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            match line {
                Ok(line) => {
                    if tx.send(line).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });
    let guarded = TestServer(child);
    let mut address = None;
    let mut certificate = None;
    let mut admission_cap = false;
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let line = rx
            .recv_timeout(remaining)
            .context("real server did not report URL, certificate and cap 4")?;
        if let Some(url) = line.strip_prefix("myaso M6 authoritative server listening on ") {
            if url.starts_with("https://127.0.0.1:") && url.ends_with("/game") {
                address = Some(url.to_owned());
            } else {
                bail!("test server unexpectedly listened outside localhost: {url}");
            }
        }
        if let Some(hash) = line.strip_prefix("development certificate SHA-256: ") {
            certificate = Some(
                Sha256Digest::from_str_fmt(hash, Sha256DigestFmt::DottedHex)
                    .context("parse server-reported SHA-256 certificate pin")?,
            );
        }
        if line == "myaso admission cap: 4 concurrent players" {
            admission_cap = true;
        }
        if address.is_some() && certificate.is_some() && admission_cap {
            return Ok((guarded, address.unwrap(), certificate.unwrap()));
        }
    }
    bail!("server startup never proved explicit cap 4 and pinned loopback TLS")
}

fn input_packet(sequence: u16, tick: u32) -> Vec<u8> {
    let mut packet = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    packet[0] = 1; // protocol v1
    packet[1] = 1; // authoritative INPUT
    packet[2] = 1; // one input sample
    packet[4..6].copy_from_slice(&sequence.to_le_bytes());
    packet[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    packet[8..12].copy_from_slice(&tick.to_le_bytes());
    packet[17] = 127; // move right
    packet
}

async fn authoritative_input_ack(connection: &Connection, tick: u32) -> Result<()> {
    timeout(Duration::from_secs(7), async {
        loop {
            let incoming = connection.receive_datagram().await?;
            let bytes = incoming.as_ref();
            if bytes.len() == 16 && bytes[0] == 1 && bytes[1] == 3 {
                let acknowledged_tick = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
                if acknowledged_tick == tick {
                    break Ok::<(), anyhow::Error>(());
                }
            }
        }
    })
    .await
    .context("no authoritative gameplay INPUT_ACK while four connected")?
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn actual_server_preserves_four_distinct_players_and_denies_fifth() -> Result<()> {
    let (_server, url, pin) = start_actual_server()?;
    let config = ClientConfig::builder()
        .with_bind_default()
        .with_server_certificate_hashes([pin])
        .build();
    let endpoint = Endpoint::client(config)?;
    let mut live = Vec::with_capacity(FOUR_PLAYERS);

    for index in 0..FOUR_PLAYERS {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("pinned QUIC client connection timeout")??;
        let (_send, mut recv) = timeout(Duration::from_secs(4), connection.open_bi())
            .await
            .context("reliable game stream creation timeout")??
            .await?;
        let baseline = timeout(Duration::from_secs(4), async {
            let mut header = [0_u8; 2];
            recv.read_exact(&mut header).await?;
            let body_len = u16::from_le_bytes(header) as usize;
            if body_len < 14 || body_len > 4096 {
                bail!("invalid reliable game baseline length {body_len}");
            }
            let mut body = vec![0_u8; body_len];
            recv.read_exact(&mut body).await?;
            Ok::<_, anyhow::Error>(body)
        })
        .await
        .context("initial authoritative baseline timeout")??;
        let snapshot = decode_snapshot(&baseline)
            .map_err(|error| anyhow::anyhow!("decode real game baseline: {error:?}"))?;
        if !snapshot.full {
            bail!("player {} did not receive a full baseline", index + 1);
        }
        let observed: BTreeSet<u32> = snapshot.records.iter().map(|r| r.net_id).collect();
        let expected: BTreeSet<u32> = (1..=(index as u32 + 1)).collect();
        if observed != expected || observed.len() != snapshot.records.len() {
            bail!(
                "player {} saw wrong authoritative identities: {:?}, expected {:?}",
                index + 1,
                observed,
                expected
            );
        }
        live.push(connection);
    }

    for (index, connection) in live.iter().enumerate() {
        let tick = 501 + index as u32;
        connection.send_datagram(input_packet(index as u16 + 1, tick))?;
        authoritative_input_ack(connection, tick).await?;
    }

    // A fifth authenticated connection must be refused by the *real* server
    // while all four game sessions are still held by live QUIC connections.
    match timeout(Duration::from_secs(6), endpoint.connect(url.as_str())).await {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => bail!("fifth QUIC session admitted past configured cap 4"),
        Err(_) => bail!("fifth admission did not explicitly reject within 6 seconds"),
    }

    // Confirm the admission rejection did not evict the original player #1.
    live[0].send_datagram(input_packet(5, 601))?;
    authoritative_input_ack(&live[0], 601).await?;
    println!("ALPHA_M1_FOUR_PLAYER_REAL_SERVER_QUIC_PASS cap=4 ids=1,2,3,4 rejected=5");
    Ok(())
}
