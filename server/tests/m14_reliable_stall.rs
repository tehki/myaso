use anyhow::{bail, Context, Result};
use myaso_server::reliable::try_enqueue_reliable;
use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::mpsc;
use wtransport::{ClientConfig, Endpoint, Identity, ServerConfig, VarInt};

const GAME_PATH: &str = "/game";
const RELIABLE_PAYLOAD_BYTES: usize = 60_000;
const REALTIME_DATAGRAMS: u32 = 24;
const ENQUEUE_ATTEMPTS: usize = 256;
const TEST_TIMEOUT: Duration = Duration::from_secs(8);

fn bulk_payload(sequence: usize) -> Vec<u8> {
    let mut payload = vec![0xA5; RELIABLE_PAYLOAD_BYTES];
    payload[..4].copy_from_slice(&(sequence as u32).to_le_bytes());
    payload
}

fn final_payload() -> Vec<u8> {
    let mut payload = vec![0x5A; RELIABLE_PAYLOAD_BYTES];
    payload[..8].copy_from_slice(b"M14FINAL");
    payload
}
async fn write_framed(stream: &mut wtransport::SendStream, payload: &[u8]) -> Result<()> {
    if payload.len() > u16::MAX as usize {
        bail!("M14 reliable payload exceeds frame limit");
    }
    let mut framed = Vec::with_capacity(payload.len() + 2);
    framed.extend_from_slice(&(payload.len() as u16).to_le_bytes());
    framed.extend_from_slice(payload);
    stream.write_all(&framed).await?;
    Ok(())
}

async fn read_framed(stream: &mut wtransport::RecvStream) -> Result<Vec<u8>> {
    let mut header = [0_u8; 2];
    stream.read_exact(&mut header).await?;
    let length = u16::from_le_bytes(header) as usize;
    let mut payload = vec![0_u8; length];
    stream.read_exact(&mut payload).await?;
    Ok(payload)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn reliable_stall_preserves_realtime_and_eventually_drains() -> Result<()> {
    tokio::time::timeout(TEST_TIMEOUT, run_reliable_stall()).await??;
    Ok(())
}
async fn run_reliable_stall() -> Result<()> {
    let identity = Identity::self_signed(["localhost", "127.0.0.1"])?;
    let certificate_hash = identity.certificate_chain().as_slice()[0].hash();
    let server = Arc::new(Endpoint::server(
        ServerConfig::builder()
            .with_bind_address("127.0.0.1:0".parse()?)
            .with_identity(identity)
            .build(),
    )?);
    let port = server.local_addr()?.port();
    let built = Arc::new(AtomicUsize::new(0));
    let skipped = Arc::new(AtomicUsize::new(0));
    let writes_completed = Arc::new(AtomicUsize::new(0));

    let server_task = {
        let server = Arc::clone(&server);
        let built = Arc::clone(&built);
        let skipped = Arc::clone(&skipped);
        let writes_completed = Arc::clone(&writes_completed);
        tokio::spawn(async move {
            let request = server.accept().await.await?;
            if request.path() != GAME_PATH {
                bail!("unexpected M14 path {}", request.path());
            }
            let connection = request.accept().await?;
            let (mut reliable_send, _reliable_recv) = connection.accept_bi().await?;
            let (reliable_tx, mut reliable_rx) = mpsc::channel::<Vec<u8>>(1);
            let writer_completed = Arc::clone(&writes_completed);
            let writer = tokio::spawn(async move {
                while let Some(payload) = reliable_rx.recv().await {
                    write_framed(&mut reliable_send, &payload).await?;
                    writer_completed.fetch_add(1, Ordering::Relaxed);
                }
                Ok::<(), anyhow::Error>(())
            });

            let producer = {
                let reliable_tx = reliable_tx.clone();
                let built = Arc::clone(&built);
                let skipped = Arc::clone(&skipped);
                tokio::spawn(async move {
                    for sequence in 0..ENQUEUE_ATTEMPTS {
                        let queued = try_enqueue_reliable(&reliable_tx, || {
                            built.fetch_add(1, Ordering::Relaxed);
                            bulk_payload(sequence)
                        })?;
                        if !queued {
                            skipped.fetch_add(1, Ordering::Relaxed);
                        }
                        tokio::time::sleep(Duration::from_millis(1)).await;
                    }
                    Ok::<(), myaso_server::reliable::ReliableQueueError>(())
                })
            };
            for sequence in 0..REALTIME_DATAGRAMS {
                connection.send_datagram(sequence.to_le_bytes())?;
                tokio::time::sleep(Duration::from_millis(5)).await;
            }

            let marker = connection
                .receive_datagram()
                .await
                .context("receive M14 drain marker")?;
            if marker.as_ref() != b"drain-reliable" {
                bail!("unexpected M14 drain marker");
            }

            producer
                .await
                .context("join M14 reliable producer")?
                .map_err(|_| anyhow::anyhow!("M14 reliable queue closed"))?;
            if built.load(Ordering::Relaxed) < 4 {
                bail!("M14 reliable writer never entered sustained delivery");
            }
            if skipped.load(Ordering::Relaxed) == 0 {
                bail!("M14 did not observe reliable queue backpressure");
            }

            loop {
                if try_enqueue_reliable(&reliable_tx, final_payload)
                    .map_err(|_| anyhow::anyhow!("M14 reliable queue closed"))?
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
            drop(reliable_tx);
            let final_seen = connection
                .receive_datagram()
                .await
                .context("receive M14 final confirmation")?;
            if final_seen.as_ref() != b"final-seen" {
                bail!("unexpected M14 final confirmation");
            }
            writer.await.context("join M14 reliable writer")??;
            connection.close(VarInt::from_u32(0), b"m14 complete");
            Ok::<(), anyhow::Error>(())
        })
    };

    let client = Endpoint::client(
        ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([certificate_hash])
            .build(),
    )?;
    let connection = client
        .connect(format!("https://127.0.0.1:{port}{GAME_PATH}"))
        .await?;
    let (_reliable_send, mut reliable_recv) = connection.open_bi().await?.await?;

    for expected in 0..REALTIME_DATAGRAMS {
        let datagram = connection.receive_datagram().await?;
        let expected_bytes = expected.to_le_bytes();
        if datagram.as_ref() != expected_bytes.as_slice() {
            bail!("M14 realtime datagram ordering mismatch");
        }
    }
    tokio::time::sleep(Duration::from_millis(350)).await;
    if built.load(Ordering::Relaxed) < 4 {
        bail!("M14 reliable producer did not build enough payloads");
    }
    if skipped.load(Ordering::Relaxed) == 0 {
        bail!("M14 reliable queue never saturated before drain");
    }
    if built.load(Ordering::Relaxed) <= writes_completed.load(Ordering::Relaxed) {
        bail!("M14 reliable writer was not backpressured before drain");
    }

    connection.send_datagram(b"drain-reliable")?;
    let mut frames_read = 0_usize;
    loop {
        let payload = read_framed(&mut reliable_recv).await?;
        frames_read += 1;
        if payload.starts_with(b"M14FINAL") {
            break;
        }
    }
    if frames_read < 2 {
        bail!("M14 did not drain a meaningful reliable backlog");
    }

    connection.send_datagram(b"final-seen")?;
    connection.close(VarInt::from_u32(0), b"m14 client complete");
    server_task.await.context("join M14 server task")??;
    Ok(())
}
