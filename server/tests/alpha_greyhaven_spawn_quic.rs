//! Real, disposable four-QUIC-client M1 check for the opt-in Greyhaven spawn.
//! Unlike the AlphaSpawnProfile unit tests, this exercises the actual
//! authoritative server process and its reliable per-connection baseline.
//! Strictly loopback, certificate-pinned, no browser/gameplay/WAN claim.
use anyhow::{bail, Context, Result};
use myaso_server::{
    is_sequence_newer16,
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
    ClientConfig, Endpoint, VarInt,
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

/// Real-session disconnect/rejoin proof (not persistent account recovery):
/// the old QUIC identity is removed, its server-owned immutable respawn
/// anchor can be reclaimed by a new *different* network identity, and the
/// three survivors retain one shared authoritative World. Still loopback.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_quic_players_reclaim_only_departed_greyhaven_slot_after_abrupt_leave() -> Result<()> {
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for (index, spawn) in SPAWNS.into_iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("pre-leave join connect timeout")?
            .context("pre-leave connection rejected")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("pre-leave game stream timeout")??
            .await
            .context("pre-leave game stream rejected")?;
        let mut header = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut header))
            .await
            .context("pre-leave baseline length timeout")??;
        let size = u16::from_le_bytes(header) as usize;
        if !(14..=4096).contains(&size) {
            bail!("pre-leave invalid baseline length {size}");
        }
        let mut bytes = vec![0_u8; size];
        timeout(Duration::from_secs(5), recv.read_exact(&mut bytes))
            .await
            .context("pre-leave baseline receive timeout")??;
        let snapshot = decode_snapshot(&bytes)
            .map_err(|e| anyhow::anyhow!("pre-leave invalid snapshot: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != index + 1 {
            bail!("pre-leave player {} did not join same World", index + 1);
        }
        let own = snapshot
            .records
            .iter()
            .find(|record| record.net_id == (index + 1) as u32)
            .context("pre-leave identity missing from server baseline")?;
        let observed = (own.x as f32 / 4.0, own.y as f32 / 4.0);
        if observed != spawn {
            bail!(
                "pre-leave player {} at {observed:?} instead of {spawn:?}",
                index + 1
            );
        }
        sessions.push((connection, send, recv, snapshot.sequence));
    }
    // Vacate player #1's visual spawn coordinates WITHOUT relinquishing
    // its immutable respawn anchor. Admission must not reclaim this now
    // visually empty first slot while its original owner is still alive.
    let first = &sessions[0].0;
    send_held_direction(first, sessions[0].3, 10_900, (-127, 0))?;
    let move_deadline = Instant::now() + Duration::from_secs(3);
    let moved = loop {
        let position = next_authoritative_position(first, 1, move_deadline).await?;
        if position.0 <= 4058.0 {
            break position;
        }
    };
    send_held_direction(first, sessions[0].3, 10_901, (0, 0))?;
    if moved.0 >= SPAWNS[0].0 - 44.0 || (moved.1 - SPAWNS[0].1).abs() > 6.0 {
        bail!("pre-leave fighter #1 never vacated visual spawn coordinates: {moved:?}");
    }

    // No fifth actual connection while all four slots are occupied.
    if let Ok(Ok(extra)) = timeout(Duration::from_secs(3), endpoint.connect(url.as_str())).await {
        extra.close(VarInt::from_u32(0), b"rejoin cap violation");
        bail!("pre-leave server admitted a fifth player");
    }

    // Drop player #2 and its reliable stream, explicitly closing only this
    // player's QUIC connection. The three existing users stay connected.
    let (departed, departed_send, departed_recv, _) = sessions.remove(1);
    departed.close(VarInt::from_u32(0), b"private alpha slot release");
    drop((departed_send, departed_recv));
    drop(departed);

    // Wait for the server to process the real transport leave and revoke its
    // world slot and admission permit, never mutate the Rust World from test.
    let deadline = Instant::now() + Duration::from_secs(5);
    let replacement = loop {
        if Instant::now() >= deadline {
            bail!("authoritative QUIC leave did not free exactly one admission slot");
        }
        match timeout(Duration::from_millis(900), endpoint.connect(url.as_str())).await {
            Ok(Ok(connection)) => break connection,
            Ok(Err(_)) | Err(_) => tokio::time::sleep(Duration::from_millis(50)).await,
        }
    };
    let (replacement_send, mut replacement_recv) =
        timeout(Duration::from_secs(5), replacement.open_bi())
            .await
            .context("replacement reliable stream timeout")??
            .await
            .context("replacement reliable stream rejected")?;
    let mut length = [0_u8; 2];
    timeout(
        Duration::from_secs(5),
        replacement_recv.read_exact(&mut length),
    )
    .await
    .context("replacement baseline length timeout")??;
    let len = u16::from_le_bytes(length) as usize;
    if !(14..=4096).contains(&len) {
        bail!("replacement received invalid baseline len {len}");
    }
    let mut bytes = vec![0_u8; len];
    timeout(
        Duration::from_secs(5),
        replacement_recv.read_exact(&mut bytes),
    )
    .await
    .context("replacement baseline body timeout")??;
    let snapshot = decode_snapshot(&bytes)
        .map_err(|e| anyhow::anyhow!("replacement initial baseline invalid: {e:?}"))?;
    if !snapshot.full || snapshot.records.len() != 4 {
        bail!("replacement did not see three survivors and itself");
    }
    let ids: BTreeSet<u32> = snapshot
        .records
        .iter()
        .map(|record| record.net_id)
        .collect();
    let expected = BTreeSet::from([1, 3, 4, 5]);
    if ids != expected {
        bail!(
            "old departed identity retained or survivors lost: ids={ids:?}, expected={expected:?}"
        );
    }
    for record in &snapshot.records {
        let actual = (record.x as f32 / 4.0, record.y as f32 / 4.0);
        if record.net_id == 1 {
            if actual.0 > SPAWNS[0].0 - 44.0 || (actual.1 - SPAWNS[0].1).abs() > 6.0 {
                bail!("existing player #1 lost its valid post-movement coordinate {actual:?}");
            }
            continue;
        }
        let expected_anchor = match record.net_id {
            3 => SPAWNS[2],
            4 => SPAWNS[3],
            5 => SPAWNS[1],
            other => bail!("unexpected replacement player net id {other}"),
        };
        if actual != expected_anchor {
            bail!("player {} changed authoritative spawn after slot replacement: {actual:?} expected {expected_anchor:?}", record.net_id);
        }
    }
    if let Ok(Ok(extra)) = timeout(Duration::from_secs(3), endpoint.connect(url.as_str())).await {
        extra.close(VarInt::from_u32(0), b"replacement overcap violation");
        bail!("replacement bypassed four-player cap");
    }

    // Every continuing user AND the new fifth session must still receive its
    // own correctly fenced real server-input ACK. This cannot pass if users
    // were moved to independent isolated Worlds.
    for (index, (connection, _, _, initial_seq)) in sessions.iter().enumerate() {
        let owner = [1, 3, 4][index];
        let tick = 11_000 + owner;
        send_held_direction(connection, *initial_seq, tick, (0, 0))?;
        require_quic_input_ack(connection, tick, owner).await?;
    }
    send_held_direction(&replacement, snapshot.sequence, 11_005, (0, 0))?;
    require_quic_input_ack(&replacement, 11_005, 5).await?;
    println!(
        "ALPHA_8C_FOUR_QUIC_RECLAIM_PASS departed=2 replacement=5          reclaimed_x={} reclaimed_y={} survivor1_vacated_spawn=yes cap=4",
        SPAWNS[1].0, SPAWNS[1].1
    );
    drop((replacement_send, replacement_recv));
    Ok(())
}

async fn require_quic_input_ack(
    connection: &wtransport::Connection,
    client_tick: u32,
    expected_id: u32,
) -> Result<()> {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("player {expected_id} missing current ACK for tick {client_tick}");
        }
        let incoming = timeout(remaining, connection.receive_datagram())
            .await
            .context("current player ACK timeout")??;
        let data = incoming.as_ref();
        if data.len() == 16
            && data[0] == 1
            && data[1] == 3
            && u32::from_le_bytes(data[4..8].try_into().unwrap()) == client_tick
            && u32::from_le_bytes(data[12..16].try_into().unwrap()) == expected_id
        {
            return Ok(());
        }
    }
}

/// The new occupant's initial full roster isn't enough: every surviving
/// real QUIC client must ALSO be told to erase the departed fighter, then
/// discover replacement #5. Test the actual delta tombstone on the wire,
/// not direct Rust World state or a reset full snapshot.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn three_live_quic_peers_receive_departed_tombstone_and_new_player() -> Result<()> {
    use myaso_server::snapshot::SNAPSHOT_FIELD_REMOVED;

    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for index in 0..4 {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("tombstone baseline connect timeout")?
            .context("tombstone baseline connection refused")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("tombstone reliable opening timeout")??
            .await
            .context("tombstone reliable opening rejected")?;
        let mut header = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut header))
            .await
            .context("tombstone baseline frame length timeout")??;
        let size = u16::from_le_bytes(header) as usize;
        if !(14..=4096).contains(&size) {
            bail!("tombstone baseline invalid frame size {size}");
        }
        let mut payload = vec![0; size];
        timeout(Duration::from_secs(5), recv.read_exact(&mut payload))
            .await
            .context("tombstone baseline payload timeout")??;
        let snapshot = decode_snapshot(&payload)
            .map_err(|e| anyhow::anyhow!("tombstone baseline invalid: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != index + 1 {
            bail!("client {} initial roster is not server-authored", index + 1);
        }
        let mut view = [None; 4];
        fold_quic_peer_positions(&mut view, &snapshot.records);
        sessions.push((connection, send, recv, snapshot.sequence, view));
    }

    // Before disconnection, every survivor must actually SEE and ACK the
    // old fighter #2. An initial baseline for player #1 may predate #2
    // joining; without this priming, absence is not an observed removal.
    for index in [0_usize, 2, 3] {
        let id = index as u32 + 1;
        let session = &mut sessions[index];
        send_held_direction(&session.0, session.3, 40_000 + id, (0, 0))?;
        let deadline = Instant::now() + Duration::from_secs(5);
        let latest_snapshot_sequence = loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("client {id} did not observe full old four-player roster");
            }
            let received = timeout(remaining, session.0.receive_datagram())
                .await
                .context("prime four-player roster timeout")??;
            let bytes = received.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("prime roster decode: {e:?}"))?;
            fold_quic_peer_positions(&mut session.4, &snapshot.records);
            if session.4.iter().all(Option::is_some) {
                break snapshot.sequence;
            }
        };
        if session.4[1] != Some(SPAWNS[1]) {
            bail!("survivor {id} never observed original fighter #2 spawn");
        }
        // A current acknowledged snapshot containing #2 is essential:
        // the server's delta history then has an actual removal baseline.
        send_held_direction(&session.0, latest_snapshot_sequence, 41_000 + id, (0, 0))?;
        require_quic_input_ack(&session.0, 41_000 + id, id).await?;
    }

    let (departed, departed_send, departed_recv, _) = {
        let (connection, send, recv, sequence, _view) = sessions.remove(1);
        (connection, send, recv, sequence)
    };
    departed.close(VarInt::from_u32(0), b"delta removal proof");
    drop((departed_send, departed_recv, departed));

    // Check each survivor got the explicit authoritative REMOVED flag
    // for exactly departed #2; preserve peers #1/#3/#4 in local replica.
    for (index, (connection, _, _, _, view)) in sessions.iter_mut().enumerate() {
        let id = [1, 3, 4][index];
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("surviving QUIC client {id} never received #2 REMOVED tombstone");
            }
            let received = timeout(remaining, connection.receive_datagram())
                .await
                .context("survivor tombstone receive timeout")??;
            let bytes = received.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("survivor tombstone invalid: {e:?}"))?;
            let old_departed = snapshot
                .records
                .iter()
                .any(|record| record.net_id == 2 && record.mask & SNAPSHOT_FIELD_REMOVED != 0);
            fold_quic_peer_positions(view, &snapshot.records);
            if old_departed {
                if view[1].is_some() {
                    bail!("survivor {id} retained stale player #2 after REMOVED frame");
                }
                println!(
                    "ALPHA_8C_REAL_QUIC_REMOVAL observer={id} removed=2 tick={}",
                    snapshot.server_tick
                );
                break;
            }
        }
    }

    let replacement = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
        .await
        .context("replacement after tombstones connect timeout")?
        .context("replacement after tombstones refused")?;
    let (_send, mut recv) = timeout(Duration::from_secs(5), replacement.open_bi())
        .await
        .context("replacement roster stream timeout")??
        .await
        .context("replacement roster stream refused")?;
    let mut length = [0_u8; 2];
    timeout(Duration::from_secs(5), recv.read_exact(&mut length))
        .await
        .context("replacement baseline length timeout")??;
    let size = u16::from_le_bytes(length) as usize;
    if !(14..=4096).contains(&size) {
        bail!("replacement invalid baseline size {size}");
    }
    let mut payload = vec![0_u8; size];
    timeout(Duration::from_secs(5), recv.read_exact(&mut payload))
        .await
        .context("replacement baseline body timeout")??;
    let snapshot = decode_snapshot(&payload)
        .map_err(|e| anyhow::anyhow!("replacement baseline invalid: {e:?}"))?;
    let expected: BTreeSet<u32> = [1, 3, 4, 5].into_iter().collect();
    let ids: BTreeSet<u32> = snapshot.records.iter().map(|r| r.net_id).collect();
    if !snapshot.full || ids != expected {
        bail!("replacement did not see exact new authoritative roster: {ids:?}");
    }

    for (index, (connection, _, _, baseline, view)) in sessions.iter_mut().enumerate() {
        let id = [1, 3, 4][index];
        // The survivors are already realtime-ready: no second join
        // handshake and no restart of their existing World identity.
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut seen_new = false;
        while !seen_new {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("survivor {id} never received replacement net ID #5");
            }
            let received = timeout(remaining, connection.receive_datagram())
                .await
                .context("survivor replacement snapshot timeout")??;
            let bytes = received.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("survivor replacement invalid: {e:?}"))?;
            fold_quic_peer_positions(view, &snapshot.records);
            if let Some(actual) = snapshot
                .records
                .iter()
                .find(|record| record.net_id == 5 && record.mask & SNAPSHOT_FIELD_POSITION != 0)
            {
                let observed = (actual.x as f32 / 4.0, actual.y as f32 / 4.0);
                if observed != SPAWNS[1] || view[1].is_some() {
                    bail!("survivor {id} saw ghost #2 or incorrect new fighter position");
                }
                seen_new = true;
                println!(
                    "ALPHA_8C_REAL_QUIC_REPLACEMENT observer={id} new_id=5 tick={}",
                    snapshot.server_tick
                );
            }
        }
        send_held_direction(connection, *baseline, 42_000 + id, (0, 0))?;
        require_quic_input_ack(connection, 42_000 + id, id).await?;
    }
    send_held_direction(&replacement, snapshot.sequence, 42_005, (0, 0))?;
    require_quic_input_ack(&replacement, 42_005, 5).await?;
    println!("ALPHA_8C_REAL_QUIC_TOMBSTONES_PASS survivors=1,3,4 departed=2 replacement=5");
    Ok(())
}

/// Cross-disciplinary P0 proof: actual four-session WebTransport QUIC,
/// server-owned movement and unarmed hit results replicated to every peer.
/// No Combat code or server authority override; merely test existing wire.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_live_quic_players_share_one_authoritative_fist_hit() -> Result<()> {
    use myaso_server::snapshot::SNAPSHOT_FIELD_VITALS;
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for (index, &spawn) in SPAWNS.iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("four-fist connect timeout")?
            .context("four-fist connection refused")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("four-fist reliable handshake timeout")??
            .await
            .context("four-fist reliable handshake rejected")?;
        let mut header = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut header))
            .await
            .context("four-fist baseline header timeout")??;
        let size = u16::from_le_bytes(header) as usize;
        if !(14..=4096).contains(&size) {
            bail!("four-fist invalid reliable baseline {size}");
        }
        let mut payload = vec![0; size];
        timeout(Duration::from_secs(5), recv.read_exact(&mut payload))
            .await
            .context("four-fist baseline payload timeout")??;
        let snapshot = decode_snapshot(&payload)
            .map_err(|e| anyhow::anyhow!("four-fist baseline corrupt: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != index + 1 {
            bail!(
                "four-fist client {} does not see same authoritative world",
                index + 1
            );
        }
        let self_record = snapshot
            .records
            .iter()
            .find(|record| record.net_id == (index + 1) as u32)
            .context("four-fist missing own server identity")?;
        if (self_record.x as f32 / 4.0, self_record.y as f32 / 4.0) != spawn {
            bail!(
                "four-fist initial server spawn mismatch for player {}",
                index + 1
            );
        }
        sessions.push((connection, send, recv, snapshot.sequence));
    }
    // Explicitly prime live datagram replication for all four clients.
    for (index, session) in sessions.iter().enumerate() {
        let player = index as u32 + 1;
        send_held_direction(&session.0, session.3, 5000 + player, (0, 0))?;
        require_quic_input_ack(&session.0, 5000 + player, player).await?;
    }

    // Player #1 approaches #2 only by normal movement INPUT packets; distance
    // shrinks from 96 to ~64 world units, within the unarmed light's 76 reach
    // but outside the radius-18 two-fighter collision buffer. Players #3,#4
    // stay well outside reach. All static solids stay server-authoritative.
    send_held_direction(&sessions[0].0, sessions[0].3, 6001, (127, 0))?;
    let deadline = Instant::now() + Duration::from_secs(4);
    let mut attacker_position = SPAWNS[0];
    while attacker_position.0 < 4142.0 {
        if Instant::now() >= deadline {
            bail!("attacker never reached authoritative melee test distance");
        }
        attacker_position = next_authoritative_position(&sessions[0].0, 1, deadline).await?;
    }
    send_held_direction(&sessions[0].0, sessions[0].3, 6002, (0, 0))?;
    if !(4142.0..=4154.0).contains(&attacker_position.0)
        || (attacker_position.1 - SPAWNS[0].1).abs() > 5.0
    {
        bail!("server-authoritative melee geometry invalid: {attacker_position:?}");
    }
    // One genuine edge-triggered *fist* light attack facing east: the normal
    // 1-bit attack button at the existing wire sample offset. The test does
    // not invoke any Combat implementation directly.
    let mut light = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    light[0] = 1;
    light[1] = 1;
    light[2] = 1;
    light[4..6].copy_from_slice(&6003_u16.to_le_bytes());
    light[6..8].copy_from_slice(&sessions[0].3.to_le_bytes());
    light[8..12].copy_from_slice(&6003_u32.to_le_bytes());
    light[21] = 1;
    sessions[0].0.send_datagram(light)?;

    // Every player must independently SEE the same hit in its own real QUIC
    // snapshot stream. The expected 66HP is the existing server's 34HP light
    // damage against a 100HP unarmored target, not fabricated client damage.
    for (index, session) in sessions.iter().enumerate() {
        let observer = index as u32 + 1;
        let deadline = Instant::now() + Duration::from_secs(4);
        let mut seen_damage = None;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("observer {observer} never saw server-authoritative 34HP fist hit: {seen_damage:?}");
            }
            let received = timeout(remaining, session.0.receive_datagram())
                .await
                .context("fist damage replication timed out")??;
            let bytes = received.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("fist damage snapshot corrupt: {e:?}"))?;
            for record in &snapshot.records {
                if record.net_id != 2 || record.mask & SNAPSHOT_FIELD_VITALS == 0 {
                    continue;
                }
                seen_damage = Some(record.hp);
                if record.hp == 66 {
                    println!(
                        "ALPHA_8C_REAL_QUIC_PVP_HIT observer={observer} attacker=1 target=2                          target_hp=66 server_tick={}",
                        snapshot.server_tick
                    );
                    break;
                }
                if record.hp < 66 {
                    bail!("target HP dropped below single light strike: {}", record.hp);
                }
            }
            if seen_damage == Some(66) {
                break;
            }
        }
    }
    // Successful combat must not disconnect any other survivor or route its
    // input ACK through the attacker's identity.
    for (index, session) in sessions.iter().enumerate() {
        let actor = index as u32 + 1;
        send_held_direction(&session.0, session.3, 8000 + actor, (0, 0))?;
        require_quic_input_ack(&session.0, 8000 + actor, actor).await?;
    }
    println!("ALPHA_8C_FOUR_QUIC_REAL_FIST_PASS clients=4 attacker=1 target=2 damage=34 hp=66");
    Ok(())
}

/// Paired NEGATIVE CONTROL for the four-session successful 34HP fist test:
/// a genuine unarmed swing from the unchanged 96-unit initial separation
/// must become AttackActive on the real server but damage nobody. This is
/// not an ignored input or a directly mutated/mock World.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_live_quic_players_see_real_out_of_range_fist_miss() -> Result<()> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_ACTION, SNAPSHOT_FIELD_VITALS};
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for (index, &spawn) in SPAWNS.iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("out-of-range client QUIC connect timeout")?
            .context("out-of-range client QUIC connection refused")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("out-of-range baseline reliable stream timeout")??
            .await
            .context("out-of-range baseline reliable stream refused")?;
        let mut header = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut header))
            .await
            .context("out-of-range baseline header timeout")??;
        let size = u16::from_le_bytes(header) as usize;
        if !(14..=4096).contains(&size) {
            bail!("out-of-range invalid baseline bytes {size}");
        }
        let mut body = vec![0_u8; size];
        timeout(Duration::from_secs(5), recv.read_exact(&mut body))
            .await
            .context("out-of-range baseline payload timeout")??;
        let baseline = decode_snapshot(&body)
            .map_err(|e| anyhow::anyhow!("out-of-range baseline corrupt: {e:?}"))?;
        if !baseline.full || baseline.records.len() != index + 1 {
            bail!(
                "out-of-range client {} is not in original authoritative four-player World",
                index + 1
            );
        }
        let own = baseline
            .records
            .iter()
            .find(|r| r.net_id == index as u32 + 1)
            .context("out-of-range own server identity missing")?;
        if (own.x as f32 / 4.0, own.y as f32 / 4.0) != spawn || own.hp != 100 {
            bail!("out-of-range player {} baseline is incorrect", index + 1);
        }
        sessions.push((connection, send, recv, baseline.sequence));
    }
    // Prime each distinct client's regular input+snapshot channels.
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        send_held_direction(&session.0, session.3, 50_000 + id, (0, 0))?;
        require_quic_input_ack(&session.0, 50_000 + id, id).await?;
    }
    // The server-issued spawns guarantee nearest enemies are 96 apart,
    // beyond normal light reach 76. Send a REAL attack with face east from
    // fighter #1 at (4110,4160), aimed toward fighter #2 (4206,4160).
    // This packet has the exact same attack bit as the positive hit test.
    let mut attack = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    attack[0] = 1;
    attack[1] = 1;
    attack[2] = 1;
    attack[4..6].copy_from_slice(&51_001_u16.to_le_bytes());
    attack[6..8].copy_from_slice(&sessions[0].3.to_le_bytes());
    attack[8..12].copy_from_slice(&51_001_u32.to_le_bytes());
    attack[21] = 1;
    sessions[0].0.send_datagram(attack)?;

    // Wait for the real server INPUT_ACK, but DO NOT send a button release
    // before the server commits the attack state. The real server can
    // coalesce opposite input datagrams in one tick. A premature release
    // could erase the valid rising edge and falsely label a dropped
    // attack as a miss. The per-client AttackActive witness is mandatory.
    // Only the server can choose combat action state and target HP.
    let ack_deadline = Instant::now() + Duration::from_secs(5);
    let attack_server_tick = loop {
        let remaining = ack_deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("out-of-range attack was never accepted by real server");
        }
        let received = timeout(remaining, sessions[0].0.receive_datagram())
            .await
            .context("out-of-range attack acknowledgement timeout")??;
        let bytes = received.as_ref();
        if bytes.len() == 16
            && bytes[0] == 1
            && bytes[1] == 3
            && u32::from_le_bytes(bytes[4..8].try_into().unwrap()) == 51_001
            && u32::from_le_bytes(bytes[12..16].try_into().unwrap()) == 1
        {
            break u32::from_le_bytes(bytes[8..12].try_into().unwrap());
        }
    };
    // Observe each real QUIC client independently: active light attack
    // action 2 must have occurred, but every replicated HP field must
    // remain 100 until >40 server ticks after the accepted attack.
    for (index, session) in sessions.iter().enumerate() {
        let observer = index + 1;
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut active_seen = false;
        let mut latest_tick = 0_u32;
        let mut hp = [100_u8; 4];
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!(
                    "observer {observer} failed 40-tick real-server miss proof: active={active_seen},                      last_tick={latest_tick}, start_tick={attack_server_tick}, hp={hp:?}"
                );
            }
            let received = timeout(remaining, session.0.receive_datagram())
                .await
                .context("out-of-range miss snapshot timed out")??;
            let bytes = received.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("out-of-range miss invalid snapshot: {e:?}"))?;
            latest_tick = latest_tick.max(snapshot.server_tick);
            for record in snapshot.records {
                if !(1..=4).contains(&record.net_id) {
                    continue;
                }
                if record.net_id == 1
                    && record.mask & SNAPSHOT_FIELD_ACTION != 0
                    && record.action == 2
                {
                    active_seen = true;
                }
                if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
                    hp[record.net_id as usize - 1] = record.hp;
                }
            }
            if hp != [100; 4] {
                bail!("observer {observer} saw unauthorized out-of-range fist damage: hp={hp:?}");
            }
            if active_seen && latest_tick >= attack_server_tick + 40 {
                println!(
                    "ALPHA_8C_REAL_QUIC_FIST_RANGE_MISS observer={observer}                      light_active=yes hp=100,100,100,100 latest_tick={latest_tick}"
                );
                break;
            }
        }
    }
    // Release the held button only AFTER the accepted attack was observed
    // as actually active and out of reach in all four independent views.
    send_held_direction(&sessions[0].0, sessions[0].3, 51_002, (0, 0))?;
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        send_held_direction(&session.0, session.3, 52_000 + id, (0, 0))?;
        require_quic_input_ack(&session.0, 52_000 + id, id).await?;
    }
    println!("ALPHA_8C_FOUR_QUIC_FIST_RANGE_FENCE_PASS players=4 miss_outside_76=yes no_victim_hp_change=yes");
    Ok(())
}

/// The existing World death/respawn unit tests cannot prove that four
/// independent clients receive the SAME real authoritative terminal state.
/// This test drives three committed HEAVY fists through ordinary QUIC input
/// to kill player #2, then requires each session to see death and immutable
/// server-owned respawn. No direct World mutation or sword claim.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_real_quic_players_observe_kill_and_immutable_greyhaven_respawn() -> Result<()> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_ACTION, SNAPSHOT_FIELD_VITALS};
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for (index, spawn) in SPAWNS.iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("death/respawn client QUIC connect timeout")?
            .context("death/respawn client QUIC connection refused")?;
        let (send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("death/respawn reliable stream timeout")??
            .await
            .context("death/respawn reliable stream rejected")?;
        let mut header = [0_u8; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut header))
            .await
            .context("death/respawn initial baseline header timeout")??;
        let len = u16::from_le_bytes(header) as usize;
        if !(14..=4096).contains(&len) {
            bail!("death/respawn invalid reliable baseline bytes {len}");
        }
        let mut payload = vec![0; len];
        timeout(Duration::from_secs(5), recv.read_exact(&mut payload))
            .await
            .context("death/respawn baseline body timeout")??;
        let snapshot = decode_snapshot(&payload)
            .map_err(|e| anyhow::anyhow!("death/respawn baseline corrupt: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != index + 1 {
            bail!("death/respawn player {} not in shared World", index + 1);
        }
        let own = snapshot
            .records
            .iter()
            .find(|record| record.net_id == index as u32 + 1)
            .context("death/respawn own authority identity missing")?;
        if (own.x as f32 / 4.0, own.y as f32 / 4.0) != *spawn || own.hp != 100 {
            bail!("death/respawn player {} baseline mismatch", index + 1);
        }
        sessions.push((connection, send, recv, snapshot.sequence));
    }
    // Enable actual live datagram replication for all four client sessions.
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        send_held_direction(&session.0, session.3, 61_000 + id, (0, 0))?;
        require_quic_input_ack(&session.0, 61_000 + id, id).await?;
    }
    // Only the attacker moves. Position ~4164 gives <76 light and <130
    // heavy reach to player #2 at (4206,4160); player #4 at (4206,4256)
    // lies *outside* the normal east-facing heavy attack half-arc.
    send_held_direction(&sessions[0].0, sessions[0].3, 62_000, (127, 0))?;
    let deadline = Instant::now() + Duration::from_secs(4);
    let position = loop {
        let actual = next_authoritative_position(&sessions[0].0, 1, deadline).await?;
        if actual.0 >= 4160.0 {
            break actual;
        }
    };
    send_held_direction(&sessions[0].0, sessions[0].3, 62_001, (0, 0))?;
    if !(4160.0..=4175.0).contains(&position.0) || (position.1 - 4160.0).abs() > 5.0 {
        bail!("death/respawn attacker invalid authentic attack location {position:?}");
    }
    // The unmodified server has 46 damage per heavy unarmed strike, and
    // action commitment prevents immediate repeat. Three honest heavy
    // attacks should reduce 100 -> 54 -> 8 -> 0 (Dead), not an injected kill.
    for (attempt, expected_hp) in [54_u8, 8].into_iter().enumerate() {
        let tick = 63_000 + 100 * attempt as u32;
        send_quic_heavy_fist(&sessions[0].0, sessions[0].3, tick)?;
        require_quic_input_ack(&sessions[0].0, tick, 1).await?;
        send_held_direction(&sessions[0].0, sessions[0].3, tick + 1, (0, 0))?;
        let deadline = Instant::now() + Duration::from_secs(4);
        let mut saw_committed_attack = false;
        let mut saw_expected_hp = false;
        let mut hit_tick = None;
        let mut latest_tick = 0_u32;
        let mut count = 0_usize;
        // Returning to Idle equals the initial ACKed snapshot baseline and
        // may therefore be intentionally ELIDED by delta compression.
        // Timebox via authoritative ticks instead of requiring an absent
        // redundant Idle record from the server.
        while !(saw_committed_attack && hit_tick.is_some_and(|tick| latest_tick >= tick + 40)) {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!(
                    "heavy fist #{attempt} never settled: commit={saw_committed_attack},                      target_hp={saw_expected_hp}, hit_tick={hit_tick:?} latest_tick={latest_tick}"
                );
            }
            let incoming = match timeout(remaining, sessions[0].0.receive_datagram()).await {
                Ok(Ok(incoming)) => incoming,
                Ok(Err(error)) => bail!("heavy #{attempt} QUIC disconnected: {error:#}"),
                Err(_) => bail!(
                    "heavy #{attempt} exhausted result window: frames={count},                      committed={saw_committed_attack}, expected_hp={saw_expected_hp},                      hit_tick={hit_tick:?}, latest_tick={latest_tick}"
                ),
            };
            let bytes = incoming.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("heavy attack snapshot decode failed: {e:?}"))?;
            count += 1;
            latest_tick = snapshot.server_tick;
            for record in snapshot.records {
                if record.net_id == 1
                    && record.mask & SNAPSHOT_FIELD_ACTION != 0
                    && [9, 10, 11].contains(&record.action)
                {
                    saw_committed_attack = true;
                }
                if record.net_id == 2 && record.mask & SNAPSHOT_FIELD_VITALS != 0 {
                    if record.hp < expected_hp {
                        bail!(
                            "unexpected extra damage on heavy exchange {}: hp={} expected={expected_hp}",
                            attempt + 1, record.hp
                        );
                    }
                    if record.hp == expected_hp {
                        saw_expected_hp = true;
                        hit_tick.get_or_insert(snapshot.server_tick);
                    }
                }
            }
        }
        println!(
            "ALPHA_8C_QUIC_HEAVY_DAMAGE step={} target_hp={expected_hp} committed=yes elapsed_ticks=40",
            attempt + 1
        );
    }
    // Third real heavy strike should trigger the server's existing Dead
    // state and timed respawn. Do not drain snapshots through the attacker's
    // own stream after the third ACK, or we might discard its short Dead
    // state before starting the four independent observers.
    let tick = 63_200;
    send_quic_heavy_fist(&sessions[0].0, sessions[0].3, tick)?;
    require_quic_input_ack(&sessions[0].0, tick, 1).await?;
    send_held_direction(&sessions[0].0, sessions[0].3, tick + 1, (0, 0))?;

    // Capture all four viewpoints concurrently: real death lasts only 1.25s.
    // A local-only kill or a mock respawn cannot satisfy any observer.
    let (one, two, three, four) = tokio::try_join!(
        observe_quic_target_death_and_respawn(&sessions[0].0, 1),
        observe_quic_target_death_and_respawn(&sessions[1].0, 2),
        observe_quic_target_death_and_respawn(&sessions[2].0, 3),
        observe_quic_target_death_and_respawn(&sessions[3].0, 4)
    )?;
    let server_ticks = [one, two, three, four];
    for &(death_tick, respawn_tick) in &server_ticks {
        if respawn_tick < death_tick + 60 {
            bail!("authoritative respawn occurred implausibly before bounded death delay: {server_ticks:?}");
        }
    }
    println!("ALPHA_8C_QUIC_KILL_RESPAWN_SERVER_TICKS {server_ticks:?}");

    // The server's KillEvent packet is carried on each authenticated
    // RELIABLE bidirectional stream, not the best-effort snapshot datagrams.
    // All four clients must independently read the genuine server's same
    // ordered, framed kill event after its 3rd heavy hit. This proves the
    // shared-world kill-feed fanout, not just replicated 0HP/Dead state.
    let mut kill_event_sequences = [None; 4];
    for (index, session) in sessions.iter_mut().enumerate() {
        let observer = index as u32 + 1;
        let kill = receive_real_quic_kill_event(&mut session.2, observer).await?;
        if kill.killer != 1 || kill.victim != 2 {
            bail!("observer {observer} received incorrect reliable kill event: {kill:?}");
        }
        kill_event_sequences[index] = Some(kill.sequence);
        println!(
            "ALPHA_8C_QUIC_RELIABLE_KILL observer={observer} sequence={} killer=1 victim=2",
            kill.sequence
        );
    }
    if kill_event_sequences != [Some(0); 4] {
        bail!("all four clients did not see same first sequenced kill: {kill_event_sequences:?}");
    }

    // Critically, all FOUR old connections must remain authorized and live
    // after death and respawn: no session swap or position spoofing occurs.
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        send_held_direction(&session.0, session.3, 66_000 + id, (0, 0))?;
        require_quic_input_ack(&session.0, 66_000 + id, id).await?;
    }
    println!(
        "ALPHA_8C_FOUR_QUIC_KILL_RESPAWN_PASS players=4 killer=1 victim=2          death_hp=0 respawn_hp=100 spawn_x=4206 spawn_y=4160 same_sessions=4"
    );

    // A newly joined fifth network identity must NOT inherit a reliable
    // death event that occurred BEFORE its session was created. Current
    // roster authority and historical event delivery are separate fences.
    let (departed, departed_send, departed_recv, _) = sessions.remove(1);
    departed.close(VarInt::from_u32(0), b"historical kill-feed scope");
    drop((departed_send, departed_recv, departed));

    // QUIC transport close acknowledgement happens before the shared World
    // removal/permit revocation completes. Prove exact authoritative
    // retirement via each surviving *wire* tombstone before re-admission,
    // instead of racing the server or directly mutating its player list.
    for (index, session) in sessions.iter().enumerate() {
        let observer = [1, 3, 4][index];
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("surviving observer {observer} never saw retired #2 before late join");
            }
            let incoming = timeout(remaining, session.0.receive_datagram())
                .await
                .context("pre-late-join old fighter retirement timed out")??;
            let bytes = incoming.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("pre-late-join tombstone invalid: {e:?}"))?;
            if snapshot.records.iter().any(|record| {
                record.net_id == 2
                    && record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_REMOVED != 0
            }) {
                println!(
                    "ALPHA_8C_KILL_LATE_JOIN_RETIREMENT observer={observer} removed=2 tick={}",
                    snapshot.server_tick
                );
                break;
            }
        }
    }
    // Even after an actor is removed, a *physically present* survivor may
    // temporarily obstruct the free respawn anchor. The Greyhaven admission
    // profile deliberately requires >=44u clearance from all living player
    // positions AND their immutable anchors. The killer is still ~40u from
    // #2's spawn after its last heavy; move it away using ordinary gameplay
    // input before asking the server to place newcomer #5.
    send_held_direction(&sessions[0].0, sessions[0].3, 68_001, (-127, 0))?;
    let move_deadline = Instant::now() + Duration::from_secs(4);
    let cleared_position = loop {
        let current = next_authoritative_position(&sessions[0].0, 1, move_deadline).await?;
        if current.0 <= 4120.0 {
            break current;
        }
    };
    send_held_direction(&sessions[0].0, sessions[0].3, 68_002, (0, 0))?;
    if (cleared_position.0 - SPAWNS[1].0).hypot(cleared_position.1 - SPAWNS[1].1) < 44.0 {
        bail!("rejoin attempted before attacker vacated released fighter's anchor");
    }
    println!(
        "ALPHA_8C_KILL_LATE_JOIN_FREE_ANCHOR fighter=1 x={:.2} y={:.2}          reserved_44u_clearance=yes",
        cleared_position.0, cleared_position.1
    );

    let deadline = Instant::now() + Duration::from_secs(5);
    let replacement = loop {
        if Instant::now() >= deadline {
            bail!("departed player #2 never freed the collision-safe admission slot");
        }
        match timeout(Duration::from_millis(900), endpoint.connect(url.as_str())).await {
            Ok(Ok(connection)) => break connection,
            _ => tokio::time::sleep(Duration::from_millis(50)).await,
        }
    };
    let (_replacement_send, mut replacement_recv) =
        timeout(Duration::from_secs(5), replacement.open_bi())
            .await
            .context("late-join reliable stream timeout")??
            .await
            .context("late-join reliable stream rejected")?;
    let mut header = [0_u8; 2];
    timeout(
        Duration::from_secs(5),
        replacement_recv.read_exact(&mut header),
    )
    .await
    .context("late-join initial reliable length timeout")??;
    let bytes = u16::from_le_bytes(header) as usize;
    if !(14..=4096).contains(&bytes) {
        bail!("late-join invalid authoritative baseline size {bytes}");
    }
    let mut body = vec![0_u8; bytes];
    timeout(
        Duration::from_secs(5),
        replacement_recv.read_exact(&mut body),
    )
    .await
    .context("late-join initial reliable body timeout")??;
    let baseline =
        decode_snapshot(&body).map_err(|e| anyhow::anyhow!("late-join baseline invalid: {e:?}"))?;
    let ids: BTreeSet<_> = baseline.records.iter().map(|r| r.net_id).collect();
    if !baseline.full || ids != BTreeSet::from([1, 3, 4, 5]) {
        bail!("late-joining observer inherited departed identity: roster={ids:?}");
    }
    let newcomer = baseline
        .records
        .iter()
        .find(|r| r.net_id == 5)
        .context("late-join server failed to assign independent net ID #5")?;
    if (newcomer.x as f32 / 4.0, newcomer.y as f32 / 4.0) != SPAWNS[1] || newcomer.hp != 100 {
        bail!("late-join server did not allocate exact freed #2 spawn to new #5");
    }
    send_held_direction(&replacement, baseline.sequence, 67_005, (0, 0))?;
    require_quic_input_ack(&replacement, 67_005, 5).await?;
    tokio::try_join!(
        observe_replacement_server_ticks(&replacement, baseline.server_tick, 5),
        assert_no_retroactive_quic_kill_event(&mut replacement_recv, 5)
    )?;
    println!(
        "ALPHA_8C_QUIC_RELIABLE_KILL_JOIN_SCOPE_PASS event=0 original_peers=4          late_join_id=5 replayed_events=0 current_roster=1,3,4,5"
    );

    // A newly joined client's feed must also deliver NEW server events.
    // After spawn admission the attacker may safely move back into close
    // melee range. Doing so is necessary because genuine heavy knockback
    // otherwise pushes #5 outside the server's attack reach by hit three.
    // This is ordinary client movement, never a privileged World teleport.
    send_held_direction(&sessions[0].0, sessions[0].3, 69_001, (127, 0))?;
    let approach_deadline = Instant::now() + Duration::from_secs(4);
    let second_fight_position = loop {
        let position = next_authoritative_position(&sessions[0].0, 1, approach_deadline).await?;
        if position.0 >= 4160.0 {
            break position;
        }
    };
    send_held_direction(&sessions[0].0, sessions[0].3, 69_002, (0, 0))?;
    if !(4160.0..=4175.0).contains(&second_fight_position.0)
        || (second_fight_position.1 - SPAWNS[1].1).abs() > 5.0
    {
        bail!("attacker did not reapproach new fighter through real movement: {second_fight_position:?}");
    }
    println!(
        "ALPHA_8C_QUIC_NEW_TARGET_APPROACH x={:.1} y={:.1} original_victim=5",
        second_fight_position.0, second_fight_position.1
    );
    for (round, target_hp) in [54_u8, 8].into_iter().enumerate() {
        let tick = 70_000 + 100 * round as u32;
        send_quic_heavy_fist(&sessions[0].0, sessions[0].3, tick)?;
        require_quic_input_ack(&sessions[0].0, tick, 1).await?;
        send_held_direction(&sessions[0].0, sessions[0].3, tick + 1, (0, 0))?;
        let deadline = Instant::now() + Duration::from_secs(4);
        let mut committed = false;
        let mut hit_tick = None;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("newcomer #5 real heavy strike {} did not settle: target={target_hp}, committed={committed}, hit_tick={hit_tick:?}", round + 1);
            }
            let incoming = timeout(remaining, sessions[0].0.receive_datagram())
                .await
                .context("fresh post-join heavy result timeout")??;
            let bytes = incoming.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("fresh post-join heavy snapshot invalid: {e:?}"))?;
            for record in snapshot.records {
                if record.net_id == 1
                    && record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_ACTION != 0
                    && [9, 10, 11].contains(&record.action)
                {
                    committed = true;
                }
                if record.net_id == 5
                    && record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_VITALS != 0
                {
                    if record.hp < target_hp {
                        bail!(
                            "post-join heavy strike overdamaged newcomer: {} < {target_hp}",
                            record.hp
                        );
                    }
                    if record.hp == target_hp {
                        hit_tick.get_or_insert(snapshot.server_tick);
                    }
                }
            }
            if committed && hit_tick.is_some_and(|start| snapshot.server_tick >= start + 40) {
                break;
            }
        }
        println!(
            "ALPHA_8C_QUIC_FRESH_KILL_WINDUP round={} victim=5 hp={target_hp}",
            round + 1
        );
    }
    let second_kill_tick = 70_200;
    send_quic_heavy_fist(&sessions[0].0, sessions[0].3, second_kill_tick)?;
    require_quic_input_ack(&sessions[0].0, second_kill_tick, 1).await?;
    send_held_direction(&sessions[0].0, sessions[0].3, second_kill_tick + 1, (0, 0))?;

    // Both old survivors and the NEW spectator must independently observe
    // the new fighter's real 0HP/Dead state, from their own datagram stream.
    let (dead1, dead3, dead4, dead5) = tokio::try_join!(
        observe_real_quic_dead_target(&sessions[0].0, 1, 5),
        observe_real_quic_dead_target(&sessions[1].0, 3, 5),
        observe_real_quic_dead_target(&sessions[2].0, 4, 5),
        observe_real_quic_dead_target(&replacement, 5, 5)
    )?;
    println!(
        "ALPHA_8C_QUIC_SECOND_DEATH_TICKS [{:?},{:?},{:?},{:?}]",
        dead1.0, dead3.0, dead4.0, dead5.0
    );
    for (index, session) in sessions.iter_mut().enumerate() {
        let observer = [1, 3, 4][index];
        let event = receive_real_quic_kill_event(&mut session.2, observer).await?;
        if event.sequence != 1 || event.killer != 1 || event.victim != 5 {
            bail!("survivor {observer} failed next historical kill sequence: {event:?}");
        }
        println!("ALPHA_8C_QUIC_NEW_KILL observer={observer} sequence=1 killer=1 victim=5");
    }
    let next = receive_real_quic_kill_event(&mut replacement_recv, 5).await?;
    if next.sequence != 1 || next.killer != 1 || next.victim != 5 {
        bail!("new spectator replayed a stale kill or missed fresh kill: {next:?}");
    }
    println!("ALPHA_8C_QUIC_NEW_KILL observer=5 sequence=1 killer=1 victim=5");

    // This authenticated newcomer is still Dead. Deliberately submit an
    // otherwise valid heavy-attack + eastward-movement sample on its OWN
    // live QUIC session. The server must ACK the input but must neither
    // execute an attack nor move a Dead actor before its respawn timer.
    let mut dead_probe = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    dead_probe[0] = 1;
    dead_probe[1] = 1;
    dead_probe[2] = 1;
    dead_probe[4..6].copy_from_slice(&(70_850_u32 as u16).to_le_bytes());
    dead_probe[6..8].copy_from_slice(&dead5.1.to_le_bytes());
    dead_probe[8..12].copy_from_slice(&70_850_u32.to_le_bytes());
    dead_probe[12..16].copy_from_slice(&dead5.0.to_le_bytes());
    dead_probe[17] = 127; // request unauthorized eastward displacement
    dead_probe[19..21].copy_from_slice(&32768_u16.to_le_bytes()); // WEST toward living #1
    dead_probe[21] = 0b1000; // request unauthorized heavy attack
    replacement.send_datagram(dead_probe)?;
    require_quic_input_ack(&replacement, 70_850, 5).await?;
    // Every actual peer must verify that the attempted WEST-facing heavy
    // cannot hurt living #1 at <130 world units. This is a real in-range
    // negative control: facing east would make the no-damage claim trivial.
    let (guard1, guard3, guard4, guard5) = tokio::try_join!(
        observe_fenced_dead_quic_input(&sessions[0].0, 1, dead1.0),
        observe_fenced_dead_quic_input(&sessions[1].0, 3, dead3.0),
        observe_fenced_dead_quic_input(&sessions[2].0, 4, dead4.0),
        observe_fenced_dead_quic_input(&replacement, 5, dead5.0),
    )?;
    println!(
        "ALPHA_8C_NO_POSTMORTEM_DAMAGE witnesses=4 hp1=100 dead_player=5          ticks={},{},{},{}",
        guard1.1, guard3.1, guard4.1, guard5.1
    );
    let (dead_probe_sequence, dead_probe_tick) = guard5;
    send_held_direction_with_server_ack(
        &replacement,
        dead_probe_sequence,
        70_851,
        dead_probe_tick,
        (0, 0),
    )?;

    // The killer still occupies x~4174, only 32 units from #5's original
    // 4206 anchor. The real server's fighter separation would push the
    // newly respawned victim by a few units. Clear this physical overlap
    // using real westward movement BEFORE expecting exact anchor bytes;
    // never turn off collision or adjust the expected server coordinate.
    send_held_direction(&sessions[0].0, sessions[0].3, 70_500, (-127, 0))?;
    let clearance_deadline = Instant::now() + Duration::from_millis(900);
    let clear_position = loop {
        let observed = next_authoritative_position(&sessions[0].0, 1, clearance_deadline).await?;
        if observed.0 <= 4120.0 {
            break observed;
        }
    };
    send_held_direction(&sessions[0].0, sessions[0].3, 70_501, (0, 0))?;
    if (clear_position.0 - SPAWNS[1].0).hypot(clear_position.1 - SPAWNS[1].1) < 44.0 {
        bail!("killer still overlaps new victim's immutable anchor: {clear_position:?}");
    }
    println!(
        "ALPHA_8C_SECOND_RESPAWN_ANCHOR_CLEAR x={:.1} y={:.1}",
        clear_position.0, clear_position.1
    );

    // Verify that this is not a terminal notification: all FOUR existing
    // sessions must progress from the newly joined victim's actual Dead
    // snapshot to the server's timed original-anchor respawn. ACK each real
    // Dead snapshot sequence to fence delta baseline compression, and
    // require individually addressed post-respawn input ACKs as well.
    for (index, session) in sessions.iter().enumerate() {
        let observer = [1, 3, 4][index];
        let (_, dead_sequence) = [dead1, dead3, dead4][index];
        send_held_direction(&session.0, dead_sequence, 71_000 + observer, (0, 0))?;
    }
    send_held_direction_with_server_ack(
        &replacement,
        dead_probe_sequence,
        71_005,
        dead_probe_tick,
        (0, 0),
    )?;
    let (respawn1, respawn3, respawn4, respawn5) = tokio::try_join!(
        observe_real_quic_respawned_target(&sessions[0].0, 1, 5, dead1.0),
        observe_real_quic_respawned_target(&sessions[1].0, 3, 5, dead3.0),
        observe_real_quic_respawned_target(&sessions[2].0, 4, 5, dead4.0),
        observe_real_quic_respawned_target(&replacement, 5, 5, dead5.0)
    )?;
    println!(
        "ALPHA_8C_QUIC_SECOND_RESPAWN_TICKS [{},{},{},{}]",
        respawn1.0, respawn3.0, respawn4.0, respawn5.0
    );
    for (index, session) in sessions.iter().enumerate() {
        let observer = [1, 3, 4][index];
        let respawn_sequence = [respawn1, respawn3, respawn4][index].1;
        let respawn_tick = [respawn1, respawn3, respawn4][index].0;
        send_held_direction_with_server_ack(
            &session.0,
            respawn_sequence,
            72_000 + observer,
            respawn_tick,
            (0, 0),
        )?;
        require_quic_input_ack(&session.0, 72_000 + observer, observer).await?;
    }
    send_held_direction_with_server_ack(&replacement, respawn5.1, 72_005, respawn5.0, (0, 0))?;
    require_quic_input_ack(&replacement, 72_005, 5).await?;

    // Dead-state movement denial is only half of the lifecycle contract.
    // AFTER the real 100HP/Idle respawn and own correctly addressed ACK,
    // fighter #5 must regain normal movement authority on exactly the
    // same session and all three survivors must see that server movement.
    // x=4230 is 24u east of the exact 4206 immutable respawn anchor in
    // open Greyhaven; no target, direct World mutation or client prediction.
    send_held_direction_with_server_ack(&replacement, respawn5.1, 73_005, respawn5.0, (127, 0))?;
    require_quic_input_ack(&replacement, 73_005, 5).await?;
    let (move1, move3, move4, move5) = tokio::try_join!(
        observe_reborn_fighter_live_movement(&sessions[0].0, 1, respawn1.0),
        observe_reborn_fighter_live_movement(&sessions[1].0, 3, respawn3.0),
        observe_reborn_fighter_live_movement(&sessions[2].0, 4, respawn4.0),
        observe_reborn_fighter_live_movement(&replacement, 5, respawn5.0),
    )?;
    println!(
        "ALPHA_8C_QUIC_REBORN_MOVEMENT_ALL_PEERS x1={:.1} x3={:.1} x4={:.1} x5={:.1}",
        move1.0, move3.0, move4.0, move5.0
    );
    send_held_direction_with_server_ack(&replacement, move5.1, 73_006, move5.2, (0, 0))?;
    require_quic_input_ack(&replacement, 73_006, 5).await?;

    // The original Dead-state abuse test tried a heavy attack from #5,
    // which the server must ignore while Dead. Prove the complement:
    // the SAME authentic net ID #5, on the SAME QUIC connection, may now
    // perform a normal heavy attack after server-owned respawn.
    // Attacker #5 at (>=4230,4160) faces WEST toward living opponent #1
    // near (4116,4160) within normal 130-unit heavy reach. #3/#4 remain
    // outside the west-facing heavy arc and must remain unharmed.
    let heavy_tick = 74_005_u32;
    let mut reborn_attack = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    reborn_attack[0] = 1;
    reborn_attack[1] = 1;
    reborn_attack[2] = 1;
    reborn_attack[4..6].copy_from_slice(&(heavy_tick as u16).to_le_bytes());
    reborn_attack[6..8].copy_from_slice(&move5.1.to_le_bytes());
    reborn_attack[8..12].copy_from_slice(&heavy_tick.to_le_bytes());
    reborn_attack[12..16].copy_from_slice(&move5.2.to_le_bytes());
    reborn_attack[19..21].copy_from_slice(&32768_u16.to_le_bytes()); // face west (PI)
    reborn_attack[21] = 0b1000; // actual heavy unarmed action
    replacement.send_datagram(reborn_attack)?;
    require_quic_input_ack(&replacement, heavy_tick, 5).await?;
    let (hit1, hit3, hit4, hit5) = tokio::try_join!(
        observe_reborn_heavy_fist_hit(&sessions[0].0, 1, respawn1.0),
        observe_reborn_heavy_fist_hit(&sessions[1].0, 3, respawn3.0),
        observe_reborn_heavy_fist_hit(&sessions[2].0, 4, respawn4.0),
        observe_reborn_heavy_fist_hit(&replacement, 5, respawn5.0),
    )?;
    println!(
        "ALPHA_8C_QUIC_REBORN_FIST_ALL_PEERS victim=1 hp=54 witnesses=4 ticks={hit1},{hit3},{hit4},{hit5}"
    );
    // Do not prematurely release the action edge: all four must first
    // observe committed heavy animation AND actual 46HP victim damage.
    send_held_direction_with_server_ack(&replacement, move5.1, 74_006, hit5, (0, 0))?;
    require_quic_input_ack(&replacement, 74_006, 5).await?;

    println!(
        "ALPHA_8C_QUIC_KILL_HISTORY_FENCE_PASS old_seq=0 new_seq=1          late_join_id=5 old_replays=0 new_event_fanout=4 respawn_peers=4 live_postrespawn_acks=4 reborn_movement_peers=4 reborn_heavy_hit_witnesses=4"
    );
    Ok(())
}

/// The positive complement to the Dead actor's rejected heavy request.
/// Every independently connected QUIC client MUST observe real committed
/// Heavy state for resurrected #5 and its real 46HP damage to player #1.
/// None of the witness clients may derive HP from an attack input.
async fn observe_reborn_heavy_fist_hit(
    connection: &wtransport::Connection,
    observer: u32,
    after_respawn_tick: u32,
) -> Result<u32> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_ACTION, SNAPSHOT_FIELD_VITALS};
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut committed_heavy = false;
    let mut observed_hp = None::<u8>;
    let mut frames = 0_usize;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!(
                "observer {observer} missing rebuilt fighter's authentic heavy hit:                  committed={committed_heavy}, hp={observed_hp:?}, frames={frames}"
            );
        }
        let incoming = timeout(remaining, connection.receive_datagram())
            .await
            .context("postrespawn real heavy snapshot timeout")??;
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("postrespawn heavy snapshot invalid: {e:?}"))?;
        if snapshot.server_tick <= after_respawn_tick {
            continue;
        }
        frames += 1;
        for record in snapshot.records {
            if record.mask & SNAPSHOT_FIELD_ACTION != 0
                && record.net_id == 5
                && [9, 10, 11].contains(&record.action)
            {
                committed_heavy = true;
            }
            if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
                if record.net_id == 1 {
                    if record.hp < 54 {
                        bail!(
                            "observer {observer} saw excess reborn heavy damage: {}",
                            record.hp
                        );
                    }
                    if record.hp == 54 {
                        observed_hp = Some(record.hp);
                    }
                }
                if [3, 4, 5].contains(&record.net_id) && record.hp != 100 {
                    bail!(
                        "observer {observer} saw collateral heavy damage: actor={} hp={}",
                        record.net_id,
                        record.hp
                    );
                }
            }
        }
        if committed_heavy && observed_hp == Some(54) {
            println!(
                "ALPHA_8C_QUIC_REBORN_HEAVY observer={observer} attacker=5 victim=1                  damage=46 victim_hp=54 tick={}",
                snapshot.server_tick
            );
            return Ok(snapshot.server_tick);
        }
    }
}

/// Genuine client DATAGRAM observation of the newly respawned fighter's
/// positive movement. This is complementary to the Dead-state negative
/// input fence, and must pass for each independently connected peer.
async fn observe_reborn_fighter_live_movement(
    connection: &wtransport::Connection,
    observer: u32,
    after_respawn_tick: u32,
) -> Result<(f32, u16, u32)> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_REMOVED, SNAPSHOT_FIELD_VITALS};
    let deadline = Instant::now() + Duration::from_secs(4);
    let mut greatest_x = SPAWNS[1].0;
    let mut frames = 0_usize;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!(
                "observer {observer} never saw revived #5 move east through the real server:                  max_x={greatest_x} frames={frames}"
            );
        }
        let incoming = timeout(remaining, connection.receive_datagram())
            .await
            .context("revived fighter authoritative movement timeout")??;
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("revived movement snapshot invalid: {e:?}"))?;
        if snapshot.server_tick <= after_respawn_tick {
            continue;
        }
        frames += 1;
        for record in snapshot.records {
            if record.net_id != 5 {
                continue;
            }
            if record.mask & SNAPSHOT_FIELD_REMOVED != 0 {
                bail!("observer {observer} saw revived #5 improperly removed");
            }
            if record.mask & SNAPSHOT_FIELD_VITALS != 0 && record.hp != 100 {
                bail!(
                    "observer {observer} saw injured revived #5 HP={}",
                    record.hp
                );
            }
            if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
                let x = record.x as f32 / 4.0;
                let y = record.y as f32 / 4.0;
                if (y - SPAWNS[1].1).abs() > 5.0 {
                    bail!("observer {observer} saw incorrect postrespawn y={y}");
                }
                greatest_x = greatest_x.max(x);
                if greatest_x >= SPAWNS[1].0 + 24.0 {
                    println!(
                        "ALPHA_8C_QUIC_REBORN_MOVEMENT observer={observer}                          player=5 x={greatest_x:.1} hp=100 server_tick={}",
                        snapshot.server_tick
                    );
                    return Ok((greatest_x, snapshot.sequence, snapshot.server_tick));
                }
            }
        }
    }
}

/// A valid input ACK alone isn't proof that gameplay accepted a heavy
/// command. Through a real server-produced delta stream, establish that
/// this defeated fighter stays Dead, HP=0, and emits NO position change
/// for 28 new authoritative ticks after the attempted valid attack.
/// All four independent real-QUIC peers also prohibit damage to a living
/// in-range target (#1), making a directionally valid Dead attack a
/// meaningful negative control rather than a harmless attack into space.
async fn observe_fenced_dead_quic_input(
    connection: &wtransport::Connection,
    observer: u32,
    death_tick: u32,
) -> Result<(u16, u32)> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_ACTION, SNAPSHOT_FIELD_VITALS};

    let deadline = Instant::now() + Duration::from_secs(3);
    let mut first_tick = None;
    let mut last = (0_u16, 0_u32);
    let mut packets = 0_usize;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!(
                "observer {observer} dead QUIC input was not observably fenced: packets={packets} first_tick={first_tick:?} last_tick={}",
                last.1
            );
        }
        let incoming = timeout(remaining, connection.receive_datagram())
            .await
            .context("dead-input authoritative snapshot timeout")??;
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("dead-input snapshot invalid: {e:?}"))?;
        if snapshot.server_tick <= death_tick {
            continue;
        }
        if snapshot.server_tick >= death_tick + 60 {
            bail!(
                "dead-input fence attempted too late to prove pre-respawn state: death={death_tick}, current={}",
                snapshot.server_tick
            );
        }
        for record in &snapshot.records {
            if record.net_id == 1 && record.mask & SNAPSHOT_FIELD_VITALS != 0 && record.hp != 100 {
                bail!(
                    "observer {observer} saw forbidden postmortem damage to in-range fighter #1: hp={}",
                    record.hp
                );
            }
            if record.net_id != 5 {
                continue;
            }
            if record.mask & SNAPSHOT_FIELD_POSITION != 0 && observer == 5 {
                bail!("dead fighter #5 saw own movement delta after authenticated input");
            }
            if record.mask & SNAPSHOT_FIELD_VITALS != 0 && record.hp != 0 {
                bail!(
                    "observer {observer} saw dead fighter #5 regain HP early: {}",
                    record.hp
                );
            }
            if record.mask & SNAPSHOT_FIELD_ACTION != 0 && record.action != 8 {
                bail!(
                    "observer {observer} saw dead fighter #5 execute action {}",
                    record.action
                );
            }
        }
        let current_tick = snapshot.server_tick;
        first_tick.get_or_insert(current_tick);
        last = (snapshot.sequence, current_tick);
        packets += 1;
        if current_tick >= first_tick.unwrap() + 28 {
            println!(
                "ALPHA_8C_QUIC_DEAD_INPUT_FENCED observer={observer} victim=5                  near_target=1 hp=100 blocked_movement=yes blocked_heavy=yes ticks=28"
            );
            return Ok(last);
        }
    }
}

/// Match a *new* authenticated attack against actual network-published
/// target death; no fabricated damage or inferred kill-feed result.
async fn observe_real_quic_dead_target(
    connection: &wtransport::Connection,
    observer: u32,
    target: u32,
) -> Result<(u32, u16)> {
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut hp = 100_u8;
    let mut action = 0_u8;
    let mut seen_frames = 0_usize;
    let mut last_tick = 0_u32;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("observer {observer} never saw real network Dead for target {target}: hp={hp} action={action}");
        }
        let incoming = match timeout(remaining, connection.receive_datagram()).await {
            Ok(Ok(incoming)) => incoming,
            Ok(Err(error)) => bail!("observer {observer} lost QUIC during second kill: {error:#}"),
            Err(_) => bail!("observer {observer} never received second Dead target={target}: hp={hp}, action={action}, frames={seen_frames}, last_server_tick={last_tick}"),
        };
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("post-join combat snapshot invalid: {e:?}"))?;
        seen_frames += 1;
        last_tick = snapshot.server_tick;
        for record in snapshot.records.iter().filter(|r| r.net_id == target) {
            if record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_VITALS != 0 {
                hp = record.hp;
            }
            if record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_ACTION != 0 {
                action = record.action;
            }
        }
        if hp == 0 && action == 8 {
            println!(
                "ALPHA_8C_QUIC_SECOND_DEATH observer={observer} target={target} tick={}",
                snapshot.server_tick
            );
            return Ok((snapshot.server_tick, snapshot.sequence));
        }
    }
}

/// Read a real server-owned, original-anchor respawn AFTER a specific
/// observed Dead frame, without creating or modifying any Rust World object.
async fn observe_real_quic_respawned_target(
    connection: &wtransport::Connection,
    observer: u32,
    target: u32,
    death_tick: u32,
) -> Result<(u32, u16)> {
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut hp = 0_u8;
    let mut action = 8_u8;
    let mut position = None::<(f32, f32)>;
    let mut latest_tick = 0_u32;
    let mut frames = 0_usize;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!(
                "observer {observer} failed live target {target} respawn: hp={hp} action={action} position={position:?}"
            );
        }
        let incoming = match timeout(remaining, connection.receive_datagram()).await {
            Ok(Ok(incoming)) => incoming,
            Ok(Err(error)) => bail!("observer {observer} lost QUIC during new respawn: {error:#}"),
            Err(_) => bail!("observer {observer} second respawn timeout: hp={hp}, action={action}, position={position:?}, latest_tick={latest_tick}, death_tick={death_tick}, frames={frames}"),
        };
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("second respawn snapshot invalid: {e:?}"))?;
        latest_tick = snapshot.server_tick;
        frames += 1;
        for record in &snapshot.records {
            if record.net_id == 2
                && snapshot.server_tick >= death_tick
                && record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_REMOVED == 0
            {
                bail!("observer {observer} saw departed network identity #2 at second death/respawn tick {}", snapshot.server_tick);
            }
            if record.net_id != target {
                continue;
            }
            if record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_VITALS != 0 {
                hp = record.hp;
            }
            if record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_ACTION != 0 {
                action = record.action;
            }
            if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
                position = Some((record.x as f32 / 4.0, record.y as f32 / 4.0));
            }
        }
        if snapshot.server_tick > death_tick
            && hp == 100
            && action == 0
            && position == Some(SPAWNS[1])
        {
            if snapshot.server_tick < death_tick + 60 {
                bail!("observer {observer} saw server victim {target} respawn too early");
            }
            println!(
                "ALPHA_8C_QUIC_SECOND_RESPAWN observer={observer} target={target} tick={}",
                snapshot.server_tick
            );
            return Ok((snapshot.server_tick, snapshot.sequence));
        }
    }
}

/// Prove the real authoritative World advanced by at least 60 ticks after
/// new player #5 joined, and that #2 stays removed from its live stream.
async fn observe_replacement_server_ticks(
    connection: &wtransport::Connection,
    initial_server_tick: u32,
    observer: u32,
) -> Result<()> {
    let deadline = Instant::now() + Duration::from_secs(4);
    // Initial full server baseline already proved #5's position. A later
    // unchanged position is legitimately omitted by delta replication.
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("late-join client {observer} did not see 60 real server ticks");
        }
        let incoming = timeout(remaining, connection.receive_datagram())
            .await
            .context("late-join server progress snapshot timeout")??;
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("late-join progress snapshot invalid: {e:?}"))?;
        for record in snapshot.records {
            if record.net_id == 2 {
                bail!("late-joining client saw ghost departed player #2");
            }
            if record.net_id == observer && record.mask & SNAPSHOT_FIELD_POSITION != 0 {
                let position = (record.x as f32 / 4.0, record.y as f32 / 4.0);
                if position != SPAWNS[1] {
                    bail!("replacement #5 changed spawn without player input: {position:?}");
                }
            }
        }
        if snapshot.server_tick >= initial_server_tick + 60 {
            println!(
                "ALPHA_8C_KILL_LATE_JOIN_WORLD_PROGRESS observer={observer}                  baseline_tick={initial_server_tick} current_tick={}",
                snapshot.server_tick
            );
            return Ok(());
        }
    }
}

/// Consume real reliable frames for >1.2s after the new session is
/// input-authorized. Ordinary type-2 catch-up is fine; historical type-4
/// kill delivery is a privacy/chronology violation, not a game notification.
async fn assert_no_retroactive_quic_kill_event(
    receiver: &mut wtransport::RecvStream,
    observer: u32,
) -> Result<()> {
    let deadline = Instant::now() + Duration::from_millis(1250);
    let mut background_frames = 0_usize;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            println!(
                "ALPHA_8C_KILL_LATE_JOIN_RELIABLE_CLEAR observer={observer}                  background_frames={background_frames}"
            );
            return Ok(());
        }
        let mut len = [0_u8; 2];
        let length_read = timeout(remaining, receiver.read_exact(&mut len)).await;
        match length_read {
            Err(_) => return Ok(()), // no historic frame within evidence window
            Ok(Err(error)) => bail!("late-join reliable transport closed: {error:#}"),
            Ok(Ok(_)) => {}
        }
        let size = u16::from_le_bytes(len) as usize;
        if !(14..=4096).contains(&size) {
            bail!("late-join reliable frame length invalid: {size}");
        }
        let mut frame = vec![0; size];
        let remaining = deadline.saturating_duration_since(Instant::now());
        timeout(remaining, receiver.read_exact(&mut frame))
            .await
            .context("late-join reliable body incomplete")??;
        if frame[0] != 1 {
            bail!("late-join reliable protocol version mismatch");
        }
        match frame[1] {
            2 => {
                decode_snapshot(&frame)
                    .map_err(|e| anyhow::anyhow!("late-join catch-up invalid: {e:?}"))?;
                background_frames += 1;
            }
            4 => bail!("late join #5 replayed a kill committed BEFORE its session existed"),
            other => bail!("late join #5 received unknown reliable type {other}"),
        }
    }
}

/// Read real length-prefixed server reliable frames, rather than forging
/// an event from a fighter snapshot or querying Rust World state. Reliable
/// background catch-up frames (type=2) are legitimate and are skipped.
async fn receive_real_quic_kill_event(
    receiver: &mut wtransport::RecvStream,
    observer_id: u32,
) -> Result<myaso_server::kill_event::KillEventPacket> {
    use myaso_server::kill_event::{KillEventPacket, KILL_EVENT_BYTES, KILL_EVENT_PACKET_TYPE};
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("observer {observer_id} did not receive server reliable kill event");
        }
        let mut length = [0_u8; 2];
        timeout(remaining, receiver.read_exact(&mut length))
            .await
            .context("reliable kill-feed frame length timed out")??;
        let bytes = u16::from_le_bytes(length) as usize;
        if !(14..=4096).contains(&bytes) {
            bail!("observer {observer_id} received impossible reliable frame size {bytes}");
        }
        let mut body = vec![0_u8; bytes];
        let remaining = deadline.saturating_duration_since(Instant::now());
        timeout(remaining, receiver.read_exact(&mut body))
            .await
            .context("reliable kill-feed frame body timed out")??;
        if body[0] != 1 {
            bail!("observer {observer_id} received wrong reliable protocol version");
        }
        if body[1] == 2 {
            // Background reliable state catch-up is distinct from kill feed.
            decode_snapshot(&body)
                .map_err(|e| anyhow::anyhow!("invalid reliable background snapshot: {e:?}"))?;
            continue;
        }
        if body[1] != KILL_EVENT_PACKET_TYPE || bytes != KILL_EVENT_BYTES {
            bail!("observer {observer_id} received invalid reliable kill-feed frame kind={}, size={bytes}", body[1]);
        }
        if body[2] != 0 || body[3] != 0 {
            bail!("observer {observer_id} received invalid reserved kill-feed bytes");
        }
        return Ok(KillEventPacket {
            sequence: u32::from_le_bytes(body[4..8].try_into().unwrap()),
            killer: u32::from_le_bytes(body[8..12].try_into().unwrap()),
            victim: u32::from_le_bytes(body[12..16].try_into().unwrap()),
        });
    }
}

fn send_quic_heavy_fist(
    connection: &wtransport::Connection,
    baseline_sequence: u16,
    tick: u32,
) -> Result<()> {
    let mut packet = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    packet[0] = 1;
    packet[1] = 1;
    packet[2] = 1;
    packet[4..6].copy_from_slice(&(tick as u16).to_le_bytes());
    packet[6..8].copy_from_slice(&baseline_sequence.to_le_bytes());
    packet[8..12].copy_from_slice(&tick.to_le_bytes());
    packet[21] = 0b1000; // existing heavy attack sample button (face east)
    connection.send_datagram(packet)?;
    Ok(())
}

async fn observe_quic_target_death_and_respawn(
    connection: &wtransport::Connection,
    observer_id: u32,
) -> Result<(u32, u32)> {
    use myaso_server::snapshot::{SNAPSHOT_FIELD_ACTION, SNAPSHOT_FIELD_VITALS};
    let deadline = Instant::now() + Duration::from_secs(6);
    let mut victim_hp = 100_u8;
    let mut victim_action = 0_u8;
    let mut victim_position = None::<(f32, f32)>;
    let mut death_tick = None;
    let mut death_ack_confirmed = false;
    let mut respawn_tick = None;
    let own_dead_ack_tick = 65_000 + observer_id;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!(
                "QUIC observer {observer_id} never saw genuine Dead->Respawn:                  death_tick={death_tick:?} last_hp={victim_hp} action={victim_action}                  position={victim_position:?}"
            );
        }
        let message = timeout(remaining, connection.receive_datagram())
            .await
            .context("live four-peer death/respawn timeout")??;
        let bytes = message.as_ref();
        if bytes.len() == 16
            && bytes[0] == 1
            && bytes[1] == 3
            && u32::from_le_bytes(bytes[4..8].try_into().unwrap()) == own_dead_ack_tick
            && u32::from_le_bytes(bytes[12..16].try_into().unwrap()) == observer_id
        {
            death_ack_confirmed = true;
            if let (Some(death), Some(respawn)) = (death_tick, respawn_tick) {
                if respawn > death {
                    println!(
                        "ALPHA_8C_QUIC_RESPAWN observer={observer_id} victim=2 server_tick={respawn} ack_confirmed=yes"
                    );
                    return Ok((death, respawn));
                }
            }
            continue;
        }
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot = decode_snapshot(bytes)
            .map_err(|e| anyhow::anyhow!("death/respawn snapshot decode failed: {e:?}"))?;
        for record in snapshot.records.iter().filter(|r| r.net_id == 2) {
            if record.mask & SNAPSHOT_FIELD_VITALS != 0 {
                victim_hp = record.hp;
            }
            if record.mask & SNAPSHOT_FIELD_ACTION != 0 {
                victim_action = record.action;
            }
            if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
                victim_position = Some((record.x as f32 / 4.0, record.y as f32 / 4.0));
            }
        }
        if death_tick.is_none() && victim_hp == 0 && victim_action == 8 {
            death_tick = Some(snapshot.server_tick);
            // ACK the real Dead baseline and REQUIRE the server to process
            // that input packet. A lossy unconfirmed acknowledgment could
            // leave the server on the pre-death baseline, causing a false
            // missing-respawn delta because Idle/100HP equals that baseline.
            // This preserves the original all-four real respawn assertion.
            send_held_direction_with_server_ack(
                connection,
                snapshot.sequence,
                own_dead_ack_tick,
                snapshot.server_tick,
                (0, 0),
            )?;
            // Do NOT use a separate ACK waiter on this same datagram
            // stream. It may consume (and silently discard) the brief
            // 100HP/Idle respawn snapshot while waiting for the ACK.
            // Handle BOTH frames in this one observable stream instead.
            println!(
                "ALPHA_8C_QUIC_DEAD observer={observer_id} victim=2 server_tick={}",
                snapshot.server_tick
            );
        }
        if let Some(death) = death_tick {
            if snapshot.server_tick > death
                && victim_action == 0
                && victim_hp == 100
                && victim_position == Some(SPAWNS[1])
            {
                respawn_tick = Some(snapshot.server_tick);
                if death_ack_confirmed {
                    println!(
                        "ALPHA_8C_QUIC_RESPAWN observer={observer_id} victim=2 server_tick={} ack_confirmed=yes",
                        snapshot.server_tick
                    );
                    return Ok((death, snapshot.server_tick));
                }
            }
        }
    }
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
    send_held_direction_with_server_ack(connection, initial_sequence, client_tick, 0, direction)
}

/// Pass a genuine on-wire server tick alongside the snapshot sequence.
/// The existing non-ACK experiment calls use zero, while post-respawn
/// liveness must show CURRENT server tick ACK (avoid false stale warnings).
fn send_held_direction_with_server_ack(
    connection: &wtransport::Connection,
    initial_sequence: u16,
    client_tick: u32,
    server_ack_tick: u32,
    direction: (i8, i8),
) -> Result<()> {
    let mut input = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    input[0] = 1; // wire protocol version
    input[1] = 1; // INPUT packet
    input[2] = 1; // one actual input sample
    input[4..6].copy_from_slice(&(client_tick as u16).to_le_bytes());
    input[6..8].copy_from_slice(&initial_sequence.to_le_bytes());
    input[8..12].copy_from_slice(&client_tick.to_le_bytes());
    input[12..16].copy_from_slice(&server_ack_tick.to_le_bytes());
    input[16] = 0;
    input[17] = direction.0 as u8;
    input[18] = direction.1 as u8;
    connection.send_datagram(input)?;
    Ok(())
}

/// Preserve unchanged peers from delta packets, as a real client does.
fn fold_quic_peer_positions(
    state: &mut [Option<(f32, f32)>; 4],
    records: &[myaso_server::snapshot::SnapshotRecord],
) {
    for record in records {
        if !(1..=4).contains(&record.net_id) {
            continue;
        }
        let slot = record.net_id as usize - 1;
        if record.mask & myaso_server::snapshot::SNAPSHOT_FIELD_REMOVED != 0 {
            state[slot] = None;
        } else if record.mask & SNAPSHOT_FIELD_POSITION != 0 {
            state[slot] = Some((record.x as f32 / 4.0, record.y as f32 / 4.0));
        }
    }
}

async fn next_authoritative_position(
    connection: &wtransport::Connection,
    entity: u32,
    deadline: Instant,
) -> Result<(f32, f32)> {
    let (position, _) =
        next_authoritative_position_with_snapshot_ack(connection, entity, deadline, None).await?;
    Ok(position)
}

/// Return the actual server snapshot sequence along with the authoritative
/// own position, so the QUIC acceptance driver ACKs the LATEST received
/// replication frame instead of endlessly pinning to its initial baseline.
async fn next_authoritative_position_with_snapshot_ack(
    connection: &wtransport::Connection,
    entity: u32,
    deadline: Instant,
    mut view: Option<&mut [Option<(f32, f32)>; 4]>,
) -> Result<((f32, f32), u16)> {
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
        if let Some(cache) = view.as_deref_mut() {
            fold_quic_peer_positions(cache, &snapshot.records);
        }
        if let Some(record) = snapshot
            .records
            .iter()
            .find(|record| record.net_id == entity && record.mask & SNAPSHOT_FIELD_POSITION != 0)
        {
            return Ok((
                (record.x as f32 / 4.0, record.y as f32 / 4.0),
                snapshot.sequence,
            ));
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

/// The server-owned spawn-to-rack paths were validated for all 16 pairs
/// against the pinned 23 static solids in Core #527. This extends the M1/M2
/// proof across actual QUIC INPUT packets and authoritative replicated
/// positions for one distinct rack approach per simultaneous client.
const BLACKSMITH_RACK_APPROACHES: [(f32, f32); 4] = [
    (3740.0, 4088.0),
    (3780.0, 4088.0),
    (3820.0, 4088.0),
    (3860.0, 4088.0),
];

async fn drive_real_quic_fighter_to(
    connection: &wtransport::Connection,
    baseline_sequence: u16,
    id: u32,
    initial_position: (f32, f32),
    goals: &[(f32, f32)],
    mut view: [Option<(f32, f32)>; 4],
) -> Result<((f32, f32), [Option<(f32, f32)>; 4])> {
    let mut at = initial_position;
    let mut last_snapshot_ack = baseline_sequence;
    let mut tick = 1000 + id * 10;
    let mut total_samples = 0_usize;
    for &goal in goals {
        let deadline = Instant::now() + Duration::from_secs(6);
        let mut route_samples = 0_usize;
        while (at.0 - goal.0).hypot(at.1 - goal.1) > 14.0 {
            if Instant::now() >= deadline {
                bail!("player {id} cannot reach approach waypoint {goal:?}; at={at:?}, samples={route_samples}");
            }
            let dx = goal.0 - at.0;
            let dy = goal.1 - at.1;
            let distance = dx.hypot(dy);
            let dir_x = ((dx / distance * 127.0).round() as i32).clamp(-127, 127) as i8;
            let dir_y = ((dy / distance * 127.0).round() as i32).clamp(-127, 127) as i8;
            tick += 1;
            send_held_direction(connection, last_snapshot_ack, tick, (dir_x, dir_y))?;
            let (next, snapshot_sequence) = next_authoritative_position_with_snapshot_ack(
                connection,
                id,
                deadline,
                Some(&mut view),
            )
            .await?;
            if is_sequence_newer16(snapshot_sequence, last_snapshot_ack) {
                last_snapshot_ack = snapshot_sequence;
            }
            if !next.0.is_finite()
                || !next.1.is_finite()
                || next.0 < 0.0
                || next.0 > 8192.0
                || next.1 < 0.0
                || next.1 > 8192.0
                || (next.0 - at.0).hypot(next.1 - at.1) > 80.0
            {
                bail!("player {id} received untrusted or discontinuous authoritative motion {at:?}->{next:?}");
            }
            if myaso_server::alpha_greyhaven_geometry::overlaps_known_static_solid(
                next.0, next.1, 18.0,
            ) != Ok(false)
            {
                bail!("player {id} was replicated *inside* a reviewed static obstacle at {next:?}");
            }
            route_samples += 1;
            total_samples += 1;
            at = next;
        }
        tick += 1;
        send_held_direction(connection, last_snapshot_ack, tick, (0, 0))?;
        if route_samples == 0 && (at.0 - goal.0).hypot(at.1 - goal.1) > 2.0 {
            bail!("player {id} skipped evidence for route waypoint {goal:?}");
        }
    }
    if total_samples < 15 {
        bail!("player {id} supplied too few real on-wire movements: {total_samples}");
    }
    Ok((at, view))
}

/// Concurrent physical arrivals can push another fighter off a nearby
/// rack stand. A first matching self-snapshot is not proof of a *stable*
/// approach. Read late authoritative state, then issue a normal network
/// correction for any displacement; no privileged teleport/test setter.
async fn correct_displaced_rack_fighter(
    connection: &wtransport::Connection,
    net_id: u32,
    start: (f32, f32),
    start_snapshot_sequence: u16,
    stand: (f32, f32),
) -> Result<(f32, f32)> {
    let mut position = start;
    let mut sequence = start_snapshot_sequence;
    let mut client_tick = 20_000 + net_id * 100;
    let deadline = Instant::now() + Duration::from_secs(4);
    let mut samples = 0_usize;
    while (position.0 - stand.0).hypot(position.1 - stand.1) > 12.0 {
        if Instant::now() >= deadline {
            bail!(
                "fighter {net_id} unable to correct real physical rack drift                  start={start:?} current={position:?} stand={stand:?} samples={samples}"
            );
        }
        let dx = stand.0 - position.0;
        let dy = stand.1 - position.1;
        let magnitude = dx.hypot(dy);
        let direction = (
            ((dx / magnitude * 127.0).round() as i32).clamp(-127, 127) as i8,
            ((dy / magnitude * 127.0).round() as i32).clamp(-127, 127) as i8,
        );
        client_tick += 1;
        send_held_direction(connection, sequence, client_tick, direction)?;
        let (next, received_sequence) =
            next_authoritative_position_with_snapshot_ack(connection, net_id, deadline, None)
                .await?;
        if is_sequence_newer16(received_sequence, sequence) {
            sequence = received_sequence;
        }
        if (next.0 - position.0).hypot(next.1 - position.1) > 80.0
            || myaso_server::alpha_greyhaven_geometry::overlaps_known_static_solid(
                next.0, next.1, 18.0,
            ) != Ok(false)
        {
            bail!("fighter {net_id} received invalid corrected movement {position:?}->{next:?}");
        }
        position = next;
        samples += 1;
    }
    client_tick += 1;
    send_held_direction(connection, sequence, client_tick, (0, 0))?;
    println!(
        "ALPHA_8C_QUIC_RACK_PHYSICAL_CORRECTION fighter={net_id} from={start:?}          to={position:?} samples={samples}"
    );
    Ok(position)
}

#[test]
fn four_player_replica_preserves_unchanged_deltas_and_applies_removals() {
    use myaso_server::snapshot::{SnapshotRecord, SNAPSHOT_FIELD_REMOVED, SNAPSHOT_FIELD_VITALS};
    let record = |net_id, mask, x, y| SnapshotRecord {
        net_id,
        mask,
        x,
        y,
        facing: 0,
        hp: 100,
        guard: 100,
        stamina: 100,
        action: 0,
        flags: 0,
    };
    let mut cache = [None; 4];
    fold_quic_peer_positions(
        &mut cache,
        &[
            record(1, SNAPSHOT_FIELD_POSITION, 15000, 16000),
            record(2, SNAPSHOT_FIELD_POSITION, 15100, 16000),
        ],
    );
    assert_eq!(cache[0], Some((3750.0, 4000.0)));
    assert_eq!(cache[1], Some((3775.0, 4000.0)));
    fold_quic_peer_positions(
        &mut cache,
        &[
            record(1, SNAPSHOT_FIELD_VITALS, 0, 0),
            record(3, SNAPSHOT_FIELD_POSITION, 15300, 16000),
        ],
    );
    assert_eq!(cache[0], Some((3750.0, 4000.0)));
    assert_eq!(cache[1], Some((3775.0, 4000.0)));
    assert_eq!(cache[2], Some((3825.0, 4000.0)));
    fold_quic_peer_positions(&mut cache, &[record(2, SNAPSHOT_FIELD_REMOVED, 0, 0)]);
    assert_eq!(cache[1], None, "removed peer must not remain visible");
    assert_eq!(cache[0], Some((3750.0, 4000.0)));
    assert_eq!(cache[2], Some((3825.0, 4000.0)));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn four_live_quic_players_each_reach_a_distinct_blacksmith_rack_approach() -> Result<()> {
    let (_server, url, pin) = start_private_staging_server(true)?;
    let endpoint = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([pin])
            .build(),
    )?;
    let mut sessions = Vec::new();
    for (index, &spawn) in SPAWNS.iter().enumerate() {
        let connection = timeout(Duration::from_secs(6), endpoint.connect(url.as_str()))
            .await
            .context("rack route QUIC connection timeout")?
            .context("rack route QUIC client refused")?;
        let (_send, mut recv) = timeout(Duration::from_secs(5), connection.open_bi())
            .await
            .context("rack route reliable handshake timeout")??
            .await
            .context("rack route reliable stream rejected")?;
        let mut length = [0; 2];
        timeout(Duration::from_secs(5), recv.read_exact(&mut length))
            .await
            .context("rack route baseline length timeout")??;
        let size = u16::from_le_bytes(length) as usize;
        if !(14..=4096).contains(&size) {
            bail!("invalid rack route baseline size {size}");
        }
        let mut packet = vec![0; size];
        timeout(Duration::from_secs(5), recv.read_exact(&mut packet))
            .await
            .context("rack route baseline payload timeout")??;
        let snapshot = decode_snapshot(&packet)
            .map_err(|e| anyhow::anyhow!("rack route baseline decode: {e:?}"))?;
        if !snapshot.full || snapshot.records.len() != index + 1 {
            bail!(
                "rack route client {} has incomplete initial authoritative roster",
                index + 1
            );
        }
        let owner = snapshot
            .records
            .iter()
            .find(|record| record.net_id == index as u32 + 1)
            .context("rack route own real server identity absent")?;
        let start = (owner.x as f32 / 4.0, owner.y as f32 / 4.0);
        if (start.0 - spawn.0).abs() > 0.5 || (start.1 - spawn.1).abs() > 0.5 {
            bail!("rack route did not start at Core-approved immutable spawn");
        }
        let mut initial_view = [None; 4];
        fold_quic_peer_positions(&mut initial_view, &snapshot.records);
        sessions.push((
            connection,
            _send,
            recv,
            snapshot.sequence,
            start,
            initial_view,
        ));
    }

    // All four independently controlled players must ACTUALLY move
    // concurrently on a shared server. Keeping four sessions connected
    // while driving their movement sequentially is insufficient M1 proof.
    // Separate futures read their own genuine QUIC snapshot streams.
    // Shared intermediate checkpoints would temporarily stack all four
    // physical fighters on the same coordinates. That is a real collision,
    // and later arrivals can shove an earlier player off its rack stand.
    // Instead use disjoint diagonal lanes, with two checkpoints on each
    // individually server-reviewed, static-clear city-to-rack segment.
    let route_for = |index: usize| {
        let spawn = SPAWNS[index];
        let target = BLACKSMITH_RACK_APPROACHES[index];
        let waypoint = |f: f32| {
            (
                spawn.0 + (target.0 - spawn.0) * f,
                spawn.1 + (target.1 - spawn.1) * f,
            )
        };
        [waypoint(0.35), waypoint(0.70), target]
    };
    let routes = [route_for(0), route_for(1), route_for(2), route_for(3)];
    for (index, route) in routes.iter().enumerate() {
        let mut from = SPAWNS[index];
        for &to in route {
            if myaso_server::alpha_greyhaven_geometry::swept_circle_hits_known_static_solid(
                from, to, 18.0,
            ) != Ok(false)
            {
                bail!("4-QUIC dedicated lane {index} is not clear against reviewed static solids: {from:?} -> {to:?}");
            }
            from = to;
        }
    }
    let (player1, player2, player3, player4) = tokio::try_join!(
        drive_real_quic_fighter_to(
            &sessions[0].0,
            sessions[0].3,
            1,
            sessions[0].4,
            &routes[0],
            sessions[0].5
        ),
        drive_real_quic_fighter_to(
            &sessions[1].0,
            sessions[1].3,
            2,
            sessions[1].4,
            &routes[1],
            sessions[1].5
        ),
        drive_real_quic_fighter_to(
            &sessions[2].0,
            sessions[2].3,
            3,
            sessions[2].4,
            &routes[2],
            sessions[2].5
        ),
        drive_real_quic_fighter_to(
            &sessions[3].0,
            sessions[3].3,
            4,
            sessions[3].4,
            &routes[3],
            sessions[3].5
        ),
    )?;
    let arrivals = [player1, player2, player3, player4];
    let mut peer_caches = arrivals.map(|entry| entry.1);
    for (index, final_position) in arrivals.map(|entry| entry.0).into_iter().enumerate() {
        let id = index as u32 + 1;
        let target = BLACKSMITH_RACK_APPROACHES[index];
        if (final_position.0 - target.0).hypot(final_position.1 - target.1) > 18.0 {
            bail!("player {id} failed simultaneous Blacksmith approach target {target:?}: {final_position:?}");
        }
        println!(
            "ALPHA_8C_REAL_QUIC_RACK_APPROACH id={id} x={:.2} y={:.2} target_x={} target_y={}",
            final_position.0, final_position.1, target.0, target.1
        );
    }
    // All four QUIC sessions must remain alive and input-authorized after
    // the entire city-to-rack journey, rather than merely having connected.
    // This also proves server ticks keep making progress after the 4th arrival.
    let mut final_ack_server_tick = 0_u32;
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        let proof_tick = 10_000 + id;
        send_held_direction(&session.0, session.3, proof_tick, (0, 0))?;
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("player {id} lost final authoritative input ACK after rack arrival");
            }
            let datagram = timeout(remaining, session.0.receive_datagram())
                .await
                .context("final on-wire QUIC proof ACK timed out")??;
            let data = datagram.as_ref();
            if data.len() >= 14 && data[0] == 1 && data[1] == 2 {
                let snapshot = decode_snapshot(data)
                    .map_err(|e| anyhow::anyhow!("initial ACK replica decode: {e:?}"))?;
                fold_quic_peer_positions(&mut peer_caches[index], &snapshot.records);
            }
            if data.len() == 16
                && data[0] == 1
                && data[1] == 3
                && u32::from_le_bytes(data[4..8].try_into().unwrap()) == proof_tick
                && u32::from_le_bytes(data[12..16].try_into().unwrap()) == id
            {
                let server_tick = u32::from_le_bytes(data[8..12].try_into().unwrap());
                final_ack_server_tick = final_ack_server_tick.max(server_tick);
                break;
            }
        }
    }

    // Do not trust only the first own arrival: the four physical players
    // can genuinely bump during their simultaneous travel through a city.
    // Recheck their *late* authoritative server state after all ACKs.
    // One single authoritative observer can see all four actual server
    // fighters without accidentally requiring a redundant unchanged OWN
    // position field in every delta snapshot (delta elision is legitimate).
    let mut late_positions = [((0.0_f32, 0.0_f32), 0_u16); 4];
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            bail!("four-player authoritative post-arrival roster never converged");
        }
        let incoming = timeout(remaining, sessions[0].0.receive_datagram())
            .await
            .context("four-player late roster timeout")??;
        let bytes = incoming.as_ref();
        if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
            continue;
        }
        let snapshot =
            decode_snapshot(bytes).map_err(|e| anyhow::anyhow!("late roster decode: {e:?}"))?;
        if snapshot.server_tick < final_ack_server_tick + 30 {
            continue;
        }
        fold_quic_peer_positions(&mut peer_caches[0], &snapshot.records);
        let mut seen = [false; 4];
        for record in snapshot.records.iter().filter(|record| {
            (1..=4).contains(&record.net_id) && record.mask & SNAPSHOT_FIELD_POSITION != 0
        }) {
            let index = record.net_id as usize - 1;
            seen[index] = true;
            late_positions[index] = (
                (record.x as f32 / 4.0, record.y as f32 / 4.0),
                sessions[index].3,
            );
        }
        if seen.iter().all(|value| *value) {
            println!(
                "ALPHA_8C_LATE_ROSTER tick={} authoritative_positions={:?}",
                snapshot.server_tick,
                late_positions.map(|state| state.0)
            );
            break;
        }
    }

    // Repair any genuine collision-related post-arrival displacement using
    // ordinary QUIC input on that fighter's own session. All other sessions
    // remain connected; the four stands are radius-18 separated by >=40u.
    for (index, session) in sessions.iter().enumerate() {
        let position = late_positions[index].0;
        let stand = BLACKSMITH_RACK_APPROACHES[index];
        if (position.0 - stand.0).hypot(position.1 - stand.1) > 18.0 {
            let corrected_position = correct_displaced_rack_fighter(
                &session.0,
                index as u32 + 1,
                position,
                late_positions[index].1,
                stand,
            )
            .await?;
            // This position came from the player's own real server snapshot,
            // not a prediction. Its unchanged following deltas may be empty.
            peer_caches[index][index] = Some(corrected_position);
        }
    }
    // Fence mutual visibility after both first arrivals and any corrected
    // post-arrival positions, with four fresh server-acknowledged stop packets.
    final_ack_server_tick = 0;
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        let proof_tick = 30_000 + id;
        send_held_direction(&session.0, late_positions[index].1, proof_tick, (0, 0))?;
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("fighter {id} lost authoritative post-correction ACK");
            }
            let datagram = timeout(remaining, session.0.receive_datagram())
                .await
                .context("post-correction proof ACK timeout")??;
            let data = datagram.as_ref();
            if data.len() >= 14 && data[0] == 1 && data[1] == 2 {
                let snapshot = decode_snapshot(data)
                    .map_err(|e| anyhow::anyhow!("final ACK replica decode: {e:?}"))?;
                fold_quic_peer_positions(&mut peer_caches[index], &snapshot.records);
            }
            if data.len() == 16
                && data[0] == 1
                && data[1] == 3
                && u32::from_le_bytes(data[4..8].try_into().unwrap()) == proof_tick
                && u32::from_le_bytes(data[12..16].try_into().unwrap()) == id
            {
                final_ack_server_tick =
                    final_ack_server_tick.max(u32::from_le_bytes(data[8..12].try_into().unwrap()));
                break;
            }
        }
    }

    // Gameplay is multiplayer only if all four distinct clients receive a
    // fresh server-authored snapshot of the SAME four living players after
    // all four have reached different rack positions. Client #1 cannot pass
    // merely by observing itself while the other sessions remain invisible.
    // Compare snapshots newer than the last post-arrival ACK's server tick;
    // the baseline sequence is acknowledged via normal input so the server
    // uses its existing delta replication, not a privileged test channel.
    for (index, session) in sessions.iter().enumerate() {
        let id = index as u32 + 1;
        let deadline = Instant::now() + Duration::from_secs(6);
        let mut visible = [false; 4];
        let mut observed_snapshot_tick = 0_u32;
        let mut snapshot_packets = 0_usize;
        let mut eligible_packets = 0_usize;
        let mut observed_records = 0_usize;
        let mut last_known = [None::<(f32, f32)>; 4];
        let mut position_counts = [0usize; 4];
        while !visible.iter().all(|flag| *flag) {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!(
                    "QUIC observer {id} did not see all four living players after last ACK tick                      {final_ack_server_tick}: visible={visible:?} newest_tick={observed_snapshot_tick}"
                );
            }
            let incoming = match timeout(remaining, session.0.receive_datagram()).await {
                Ok(Ok(incoming)) => incoming,
                Ok(Err(error)) => bail!("observer {id} QUIC closed: {error:#}"),
                Err(_) => bail!(
                    "observer {id} timed out: seen={visible:?} min_tick={final_ack_server_tick}                     latest_eligible_tick={observed_snapshot_tick}, snapshots={snapshot_packets}                     eligible={eligible_packets} matching_records={observed_records}                     last_known={last_known:?} position_counts={position_counts:?}"
                )
            };
            let bytes = incoming.as_ref();
            if bytes.len() < 14 || bytes[0] != 1 || bytes[1] != 2 {
                continue;
            }
            let snapshot = decode_snapshot(bytes)
                .map_err(|e| anyhow::anyhow!("observer {id} received invalid snapshot: {e:?}"))?;
            snapshot_packets += 1;
            if snapshot.server_tick < final_ack_server_tick {
                continue;
            }
            observed_snapshot_tick = snapshot.server_tick;
            eligible_packets += 1;
            observed_records += snapshot.records.len();
            fold_quic_peer_positions(&mut peer_caches[index], &snapshot.records);
            for record in snapshot.records {
                if !(1..=4).contains(&record.net_id) || record.mask & SNAPSHOT_FIELD_POSITION == 0 {
                    continue;
                }
                let actual = (record.x as f32 / 4.0, record.y as f32 / 4.0);
                last_known[record.net_id as usize - 1] = Some(actual);
                position_counts[record.net_id as usize - 1] += 1;
            }
            for peer in 0..4 {
                let target = BLACKSMITH_RACK_APPROACHES[peer];
                visible[peer] = peer_caches[index][peer]
                    .is_some_and(|actual| (actual.0 - target.0).hypot(actual.1 - target.1) <= 24.0);
            }
        }
        println!(
            "ALPHA_8C_QUIC_MUTUAL_RACK_VISIBILITY observer={id} peers=4              server_tick={observed_snapshot_tick} min_tick={final_ack_server_tick}"
        );
    }
    println!("ALPHA_8C_FOUR_QUIC_DISTINCT_RACK_ROUTES_PASS players=4 unique_approaches=4 surviving_input_acks=4 mutual_peer_views=4 geometry=reviewed-static-only");
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
