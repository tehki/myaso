//! Real, disposable four-QUIC-client M1 check for the opt-in Greyhaven spawn.
//! Unlike the AlphaSpawnProfile unit tests, this exercises the actual
//! authoritative server process and its reliable per-connection baseline.
//! Strictly loopback, certificate-pinned, no browser/gameplay/WAN claim.
use anyhow::{bail, Context, Result};
use myaso_server::{
    snapshot::{decode_snapshot, SNAPSHOT_FIELD_POSITION},
    INPUT_HEADER_BYTES, INPUT_SAMPLE_BYTES,
};
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

/// Test the *real* authoritative QUIC stream and replicated state. No direct
/// Rust simulation calls or client-controlled teleports are used. The matched
/// OFF run is a negative control; the ON run must stop before the smith wall.
fn send_held_direction(
    connection: &wtransport::Connection,
    initial_sequence: u16,
    client_tick: u32,
    direction: (i8, i8),
) -> Result<()> {
    let mut input = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    input[0] = 1; // wire protocol version
    input[1] = 1; // INPUT packet
    input[2] = 1; // one actual input sample
    input[4..6].copy_from_slice(&(client_tick as u16).to_le_bytes());
    input[6..8].copy_from_slice(&initial_sequence.to_le_bytes());
    input[8..12].copy_from_slice(&client_tick.to_le_bytes());
    input[16] = 0;
    input[17] = direction.0 as u8;
    input[18] = direction.1 as u8;
    connection.send_datagram(input)?;
    Ok(())
}

async fn next_authoritative_position(
    connection: &wtransport::Connection,
    entity: u32,
    deadline: Instant,
) -> Result<(f32, f32)> {
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("no authoritative replicated position before deadline");
        }
        let message = timeout(remaining, connection.receive_datagram())
            .await
            .context("replication datagram timed out")??;
        let bytes = message.as_ref();
        if bytes.len() < 14 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("invalid authoritative snapshot: {e:?}"))?;
        if let Some(record) = snapshot
            .records
            .iter()
            .find(|record| record.net_id == entity && record.mask & SNAPSHOT_FIELD_POSITION != 0)
        {
            return Ok((record.x as f32 / 4.0, record.y as f32 / 4.0));
        }
    }
}

async fn exercise_real_quic_smith_wall(static_preview: bool) -> Result<()> {
    let (_server, url, pin) = start_private_staging_server(static_preview)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    // Four real coexisting QUIC sessions share one authoritative server tick.
    let mut sessions = Vec::new();
    for player in 1..=4 {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("real QUIC connect timeout")?
            .context("real QUIC connect refused")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("open real game stream timeout")??
            .await
            .context("game stream negotiation failed")?;
        let mut length = [0; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut length))
            .await
            .context("initial baseline frame timeout")??;
        let len = u16::from_le_bytes(length) as usize;
        if !(14..=4096).contains(&len) {
            bail!("invalid baseline bytes: {len}");
        }
        let mut frame = vec![0_u8; len];
        timeout(Duration::from_secs(5), recv.read_exact(&mut frame))
            .await
            .context("initial baseline data timeout")??;
        let snapshot =
            decode_snapshot(&frame).map_err(|e| anyhow::anyhow!("invalid initial frame: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != player {
            bail!("wrong shared-world full baseline for player {player}");
        }
        sessions.push((connection, send, recv, snapshot.sequence));
    }
    // A real client sends west to reach the exterior south-facing Blacksmith
    // approach, then north into the building. This uses only normal protocol
    // direction samples and cannot supply geometry or a target position.
    let actor = &sessions[0].0;
    let baseline = sessions[0].3;
    send_held_direction(actor, baseline, 501, (-127, 0))?;
    let west_deadline = Instant::now() + Duration::from_secs(5);
    let mut last_west = None;
    while Instant::now() < west_deadline {
        let at = next_authoritative_position(actor, 1, west_deadline).await?;
        last_west = Some(at);
        if at.0 <= 3820.0 {
            break;
        }
    }
    let (west_x, west_y) = last_west.context("did not receive west movement proof")?;
    if !(3735.0..=3820.0).contains(&west_x) || (west_y - 4160.0).abs() > 6.0 {
        bail!("real QUIC west entry corridor not reached: ({west_x},{west_y})");
    }
    send_held_direction(actor, baseline, 502, (0, -127))?;
    let north_deadline = Instant::now() + Duration::from_millis(1500);
    let mut observations = 0;
    let mut min_north = f32::INFINITY;
    let mut north_x = west_x;
    while Instant::now() < north_deadline {
        // Once the fighter is blocked, normal delta compression may omit
        // stationary records. Independently, the last replication frame can
        // fall exactly on the deadline. In either case require multiple
        // observed samples and assess actual min-y, never accept silence
        // alone as evidence of a wall.
        let at = match next_authoritative_position(actor, 1, north_deadline).await {
            Ok(at) => at,
            Err(_) if observations >= 5 => break,
            Err(error) => return Err(error),
        };
        observations += 1;
        min_north = min_north.min(at.1);
        north_x = at.0;
    }
    if observations < 8 || !(3730.0..3905.0).contains(&north_x) {
        bail!("not enough real QUIC authoritative movement samples: {observations} x={north_x}");
    }
    if static_preview {
        if !(4029.5..=4080.0).contains(&min_north) {
            bail!("staging static wall was crossed or not reached: min_y={min_north}");
        }
    } else if min_north >= 3990.0 {
        bail!("static-OFF control unexpectedly blocked north motion: min_y={min_north}");
    }
    println!(
        "ALPHA_8C_REAL_QUIC_WALL_PASS static_preview={static_preview}          west_x={west_x:.2} min_north_y={min_north:.2} samples={observations}"
    );
    Ok(())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_real_quic_players_static_on_cannot_walk_through_blacksmith() -> Result<()> {
    exercise_real_quic_smith_wall(true).await
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_real_quic_players_static_off_preserve_legacy_smith_passage() -> Result<()> {
    exercise_real_quic_smith_wall(false).await
}

/// Four independently authenticated transport sessions issue real input
/// datagrams while the same server ticks. Each position is observed from
/// authoritative snapshot traffic; no direct World::step/teleport or browser
/// coordinate claim is used. Strictly a loopback/QUIC M1 staging proof.
async fn observe_westward_authoritative_motion(
    connection: &wtransport::Connection,
    player_id: u32,
    start: (f32, f32),
    sequence: u16,
) -> Result<(f32, f32)> {
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut observed_positions = 0_usize;
    loop {
        let at = next_authoritative_position(connection, player_id, deadline).await?;
        observed_positions += 1;
        if (at.1 - start.1).abs() > 12.0 {
            bail!(
                "player {player_id} unexpectedly drifted on Y during westward input: {:?} -> {:?}",
                start,
                at
            );
        }
        if at.0 < start.0 - 85.0 {
            // Stop through the SAME real gameplay datagram API, not a
            // direct server/world mutation or synthetic state replacement.
            send_held_direction(connection, sequence, 1800 + player_id, (0, 0))?;
            if at.0 >= start.0 - 450.0 && observed_positions >= 2 {
                println!(
                    "ALPHA_8C_FOUR_REAL_QUIC_MOVE id={player_id} start_x={:.1} observed_x={:.1} \
                     observed_y={:.1} samples={observed_positions}",
                    start.0, at.0, at.1
                );
                return Ok(at);
            }
            bail!("player {player_id} movement violated bounded replicated displacement: {at:?}");
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_real_quic_players_concurrently_move_under_static_collision() -> Result<()> {
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for player in 1..=4 {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("real four-player movement QUIC connect timeout")?
            .context("real four-player movement QUIC connect failed")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("open game stream timed out")??
            .await
            .context("negotiating game stream failed")?;
        let mut length = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut length))
            .await
            .context("read authoritative baseline header timeout")??;
        let length = u16::from_le_bytes(length) as usize;
        if !(14..=4096).contains(&length) {
            bail!("client {player}: invalid initial snapshot length {length}");
        }
        let mut bytes = vec![0_u8; length];
        timeout(Duration::from_secs(5), recv.read_exact(&mut bytes))
            .await
            .context("read authoritative baseline body timeout")??;
        let snapshot =
            decode_snapshot(&bytes).map_err(|e| anyhow::anyhow!("bad baseline: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != player {
            bail!("client {player}: not all prior players present in full baseline");
        }
        for record in &snapshot.records {
            let (expected_x, expected_y) = SPAWNS[record.net_id as usize - 1];
            if ((record.x as f32 / 4.0) - expected_x).abs() > 0.5
                || ((record.y as f32 / 4.0) - expected_y).abs() > 0.5
            {
                bail!(
                    "client {player}: bad authoritative peer spawn for {}",
                    record.net_id
                );
            }
        }
        sessions.push((connection, send, recv, snapshot.sequence));
    }

    // All four clients submit their own unmodified version-1 movement
    // packets before any one observer waits for its replicated displacement.
    for (index, session) in sessions.iter().enumerate() {
        send_held_direction(&session.0, session.3, 1700 + index as u32, (-127, 0))?;
    }
    let (one, two, three, four) = tokio::join!(
        observe_westward_authoritative_motion(&sessions[0].0, 1, SPAWNS[0], sessions[0].3),
        observe_westward_authoritative_motion(&sessions[1].0, 2, SPAWNS[1], sessions[1].3),
        observe_westward_authoritative_motion(&sessions[2].0, 3, SPAWNS[2], sessions[2].3),
        observe_westward_authoritative_motion(&sessions[3].0, 4, SPAWNS[3], sessions[3].3),
    );
    let moved = [one?, two?, three?, four?];
    for (i, at) in moved.iter().enumerate() {
        if at.0 >= SPAWNS[i].0 - 85.0 {
            bail!(
                "player {} has no genuine authoritative westward motion",
                i + 1
            );
        }
    }
    println!(
        "ALPHA_8C_FOUR_CONCURRENT_REAL_QUIC_MOVE_PASS clients=4 static_preview=on \
         same_authoritative_server=yes"
    );
    Ok(())
}
