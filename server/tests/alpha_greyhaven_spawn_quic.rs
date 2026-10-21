//! Real, disposable four-QUIC-client M1 check for the opt-in Greyhaven spawn.
//! Unlike the AlphaSpawnProfile unit tests, this exercises the actual
//! authoritative server process and its reliable per-connection baseline.
//! Strictly loopback, certificate-pinned, no browser/gameplay/WAN claim.
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
    ClientConfig, Endpoint,
};

const SPAWNS: [(f32, f32); 4] = [
    (4110.0, 4160.0),
    (4206.0, 4160.0),
    (4110.0, 4256.0),
    (4206.0, 4256.0),
];

struct DisposableServer(Child);

impl Drop for DisposableServer {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn start_private_staging_server(
    static_preview: bool,
) -> Result<(DisposableServer, String, Sha256Digest)> {
    let mut command = Command::new(env!("CARGO_BIN_EXE_myaso-server"));
    if static_preview {
        command.env("MYASO_ALPHA_STATIC_COLLISION", "reviewed-static-only");
    } else {
        command.env_remove("MYASO_ALPHA_STATIC_COLLISION");
    }
    let mut child = command
        .env("MYASO_BIND", "127.0.0.1:0")
        .env("MYASO_MAX_PLAYERS", "4")
        .env("MYASO_ALPHA_SPAWN", "greyhaven")
        .env_remove("MYASO_CERT_PEM")
        .env_remove("MYASO_KEY_PEM")
        .env_remove("MYASO_FLIGHT_BACKGROUND_PLAYERS")
        .env_remove("MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS")
        .env_remove("MYASO_FLIGHT_RELIABLE_DELAY_MS")
        .env_remove("MYASO_FLIGHT_DROP_NEW_ACTION_DATAGRAMS")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("launch exact Cargo-built staging-only myaso-server")?;
    let stdout = child
        .stdout
        .take()
        .context("missing isolated server stdout")?;
    let stderr = child
        .stderr
        .take()
        .context("missing isolated server stderr")?;
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(|line| line.ok()) {
            eprintln!("ALPHA_8C_SPAWN_SERVER_ERR {line}");
        }
    });
    let (tx, rx) = mpsc::channel::<String>();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(|line| line.ok()) {
            eprintln!("ALPHA_8C_SPAWN_SERVER_OUT {line}");
            // Keep draining, even after the startup channel is dropped.
            let _ = tx.send(line);
        }
    });
    let guarded = DisposableServer(child);
    let mut url = None;
    let mut pin = None;
    let mut cap = false;
    let mut opted_in = false;
    let mut static_confirmed = false;
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        let line = rx
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .context("server never confirmed private bind, cap, TLS pin and staging flag")?;
        if let Some(value) = line.strip_prefix("myaso M6 authoritative server listening on ") {
            if !value.starts_with("https://127.0.0.1:") || !value.ends_with("/game") {
                bail!("staging process attempted a nonloopback listener: {value}");
            }
            url = Some(value.to_owned());
        }
        if let Some(value) = line.strip_prefix("development certificate SHA-256: ") {
            pin = Some(
                Sha256Digest::from_str_fmt(value, Sha256DigestFmt::DottedHex)
                    .context("invalid server-issued TLS certificate pin")?,
            );
        }
        if line == "myaso admission cap: 4 concurrent players" {
            cap = true;
        }
        if line == "staging-only Greyhaven spawn selected; no server obstacle/portal authority" {
            opted_in = true;
        }
        if line == "staging-only Greyhaven fixed static sweep enabled; river/dynamic solids NOT authoritative" {
            static_confirmed = true;
        }
        if cap && opted_in && (!static_preview || static_confirmed) {
            if let (Some(url), Some(pin)) = (&url, &pin) {
                return Ok((guarded, url.clone(), pin.clone()));
            }
        }
    }
    bail!("staging server did not prove exact 4-player private opt-in")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_real_quic_clients_get_exact_server_owned_greyhaven_spawns() -> Result<()> {
    exercise_real_four_quic_clients(false).await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_quic_clients_admitted_with_greyhaven_static_collision_active() -> Result<()> {
    exercise_real_four_quic_clients(true).await
}

async fn exercise_real_four_quic_clients(static_preview: bool) -> Result<()> {
    let (_server, url, pin) = start_private_staging_server(static_preview)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut live = Vec::new();
    for (index, &(expected_x, expected_y)) in SPAWNS.iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("staging QUIC connection timeout")?
            .with_context(|| format!("staging client {} refused", index + 1))?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("game stream request timeout")?
            .context("game stream request rejected")?
            .await
            .context("game reliable stream opening failed")?;
        let body = timeout(Duration::from_secs(5), async {
            let mut header = [0_u8; 2];
            recv.read_exact(&mut header).await?;
            let len = u16::from_le_bytes(header) as usize;
            if !(14..=4096).contains(&len) {
                bail!("invalid baseline length {len}");
            }
            let mut body = vec![0_u8; len];
            recv.read_exact(&mut body).await?;
            Ok::<_, anyhow::Error>(body)
        })
        .await
        .context("game initial baseline timeout")??;
        let snapshot = decode_snapshot(&body).map_err(|e| anyhow::anyhow!("{e:?}"))?;
        if !snapshot.full {
            bail!(
                "client {} received delta instead of full baseline",
                index + 1
            );
        }
        let observed: BTreeSet<u32> = snapshot.records.iter().map(|r| r.net_id).collect();
        let expected: BTreeSet<u32> = (1..=index as u32 + 1).collect();
        if observed != expected || observed.len() != snapshot.records.len() {
            bail!("client {} saw wrong authoritative identities", index + 1);
        }
        for (j, record) in snapshot.records.iter().enumerate() {
            let (x, y) = SPAWNS[record.net_id as usize - 1];
            let actual_x = record.x as f32 / 4.0;
            let actual_y = record.y as f32 / 4.0;
            if (actual_x - x).abs() > 0.5 || (actual_y - y).abs() > 0.5 {
                bail!(
                    "client {} record {} has wrong server spawn ({actual_x},{actual_y}), expected ({x},{y})",
                    index + 1,
                    j + 1
                );
            }
        }
        println!(
            "ALPHA_8C_QUIC_SPAWN id={} x={expected_x} y={expected_y}",
            index + 1
        );
        live.push((connection, send, recv));
    }

    // Admission cap must apply to actual fifth QUIC connection, not a mock.
    match timeout(Duration::from_secs(6), endpoint.connect(url.as_str())).await {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => bail!("fifth QUIC client admitted past staging cap four"),
        Err(_) => bail!("staging fifth connection was not explicitly rejected"),
    }

    // First real player must still be alive and receive its gameplay ACK.
    let mut input = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    input[0] = 1;
    input[1] = 1;
    input[2] = 1;
    input[4..6].copy_from_slice(&1_u16.to_le_bytes());
    input[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    input[8..12].copy_from_slice(&501_u32.to_le_bytes());
    live[0].0.send_datagram(input)?;
    timeout(Duration::from_secs(7), async {
        loop {
            let incoming = live[0].0.receive_datagram().await?;
            let data = incoming.as_ref();
            if data.len() == 16
                && data[0] == 1
                && data[1] == 3
                && u32::from_le_bytes(data[4..8].try_into().unwrap()) == 501
            {
                break Ok::<_, anyhow::Error>(());
            }
        }
    })
    .await
    .context("original player lost gameplay ACK after rejecting fifth")??;
    println!(
        "ALPHA_8C_FOUR_QUIC_GREYHAVEN_PASS cap=4 no_fifth=yes static_preview={static_preview}"
    );
    Ok(())
}
