use anyhow::{bail, Context, Result};
use myaso_server::{
    decode_input_packet, AdmissionGate, CONSERVATIVE_DATAGRAM_BYTES, TARGET_PLAYERS_PER_MAP,
};
use std::{env, net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::watch;
use wtransport::{Connection, Endpoint, Identity, ServerConfig, VarInt};

const GAME_PATH: &str = "/game";
const CLOSE_SERVER_FULL: u32 = 0x10;
const CLOSE_DATAGRAM_UNAVAILABLE: u32 = 0x11;

#[tokio::main]
async fn main() -> Result<()> {
    let bind: SocketAddr = env::var("MYASO_BIND")
        .unwrap_or_else(|_| "127.0.0.1:4433".to_string())
        .parse()
        .context("MYASO_BIND must be a socket address")?;

    let identity = load_identity(bind).await?;
    let certificate_hash = identity
        .certificate_chain()
        .as_slice()
        .first()
        .map(|certificate| certificate.hash().to_string());

    let config = ServerConfig::builder()
        .with_bind_address(bind)
        .with_identity(identity)
        .keep_alive_interval(Some(Duration::from_secs(2)))
        .build();
    let endpoint = Arc::new(Endpoint::server(config).context("create WebTransport endpoint")?);
    let local_addr = endpoint.local_addr().context("read server address")?;

    println!("myaso M3 WebTransport spike listening on https://{local_addr}{GAME_PATH}");
    if let Some(hash) = certificate_hash {
        println!("development certificate SHA-256: {hash}");
    }

    let gate = AdmissionGate::new(TARGET_PLAYERS_PER_MAP);
    let (tick_tx, tick_rx) = watch::channel(0_u32);
    tokio::spawn(run_authoritative_clock(tick_tx));

    loop {
        let incoming = endpoint.accept().await;
        let gate = Arc::clone(&gate);
        let tick_rx = tick_rx.clone();
        tokio::spawn(async move {
            let request = match incoming.await {
                Ok(request) => request,
                Err(error) => {
                    eprintln!("handshake failed: {error}");
                    return;
                }
            };

            if request.path() != GAME_PATH {
                request.not_found().await;
                return;
            }

            let Some(_permit) = gate.try_acquire() else {
                request.too_many_requests().await;
                return;
            };

            let connection = match request.accept().await {
                Ok(connection) => connection,
                Err(error) => {
                    eprintln!("session accept failed: {error}");
                    return;
                }
            };

            if connection.max_datagram_size().unwrap_or(0) < CONSERVATIVE_DATAGRAM_BYTES {
                connection.close(
                    VarInt::from_u32(CLOSE_DATAGRAM_UNAVAILABLE),
                    b"datagram budget unavailable",
                );
                return;
            }

            if let Err(error) = handle_connection(connection, tick_rx).await {
                eprintln!("session ended: {error:#}");
            }
        });
    }
}

async fn load_identity(bind: SocketAddr) -> Result<Identity> {
    match (env::var("MYASO_CERT_PEM"), env::var("MYASO_KEY_PEM")) {
        (Ok(cert), Ok(key)) => Identity::load_pemfiles(cert, key)
            .await
            .context("load MYASO_CERT_PEM/MYASO_KEY_PEM"),
        (Err(_), Err(_)) if bind.ip().is_loopback() => {
            Identity::self_signed(&["localhost", "127.0.0.1", "::1"])
                .context("generate loopback-only development identity")
        }
        (Ok(_), Err(_)) | (Err(_), Ok(_)) => {
            bail!("MYASO_CERT_PEM and MYASO_KEY_PEM must be supplied together")
        }
        (Err(_), Err(_)) => bail!(
            "non-loopback binds require explicit MYASO_CERT_PEM and MYASO_KEY_PEM; refusing to generate a public-facing development key"
        ),
    }
}

async fn run_authoritative_clock(tick_tx: watch::Sender<u32>) {
    let mut interval = tokio::time::interval(Duration::from_secs_f64(1.0 / 60.0));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut tick = 0_u32;
    loop {
        interval.tick().await;
        tick = tick.wrapping_add(1);
        let _ = tick_tx.send(tick);
    }
}

async fn handle_connection(connection: Connection, tick_rx: watch::Receiver<u32>) -> Result<()> {
    let stable_id = connection.stable_id();
    let remote = connection.remote_address();
    println!("session {stable_id} connected from {remote}");

    loop {
        let datagram = connection.receive_datagram().await?;
        let packet = match decode_input_packet(datagram.as_ref()) {
            Ok(packet) => packet,
            Err(error) => {
                eprintln!("session {stable_id} invalid input datagram: {error:?}");
                continue;
            }
        };

        let server_tick = *tick_rx.borrow();
        let newest_sample_tick = packet
            .samples
            .first()
            .map(|sample| sample.tick)
            .unwrap_or(0);
        if server_tick.wrapping_sub(packet.ack_server_tick) > 600 {
            eprintln!(
                "session {stable_id} stale server acknowledgement: client={} newest_input={} server={}",
                packet.ack_server_tick, newest_sample_tick, server_tick
            );
        }

        // M3 deliberately stops at validated authoritative ingress. M4 will feed these
        // samples into the server-owned combat simulation and emit acknowledged snapshots.
    }
}

#[allow(dead_code)]
fn close_server_full(connection: &Connection) {
    connection.close(VarInt::from_u32(CLOSE_SERVER_FULL), b"server full");
}
