use anyhow::Result;
use myaso_server::{
    decode_input_packet,
    simulation::World,
    snapshot::{decode_snapshot, SnapshotSession},
    InputIngressWindow, CONSERVATIVE_DATAGRAM_BYTES, INPUT_HEADER_BYTES, INPUT_SAMPLE_BYTES,
};
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};
use tokio::sync::Mutex;
use wtransport::{ClientConfig, Endpoint, Identity, ServerConfig};

const CLIENTS: usize = 8;

fn input_datagram(sequence: u16, client_tick: u32) -> Vec<u8> {
    let mut bytes = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    bytes[0] = 1;
    bytes[1] = 1;
    bytes[2] = 1;
    bytes[4..6].copy_from_slice(&sequence.to_le_bytes());
    bytes[6..8].copy_from_slice(&u16::MAX.to_le_bytes());
    bytes[8..12].copy_from_slice(&client_tick.to_le_bytes());
    bytes[12..16].copy_from_slice(&0_u32.to_le_bytes());
    bytes[16] = 0;
    bytes[17] = 127_u8;
    bytes[18] = 0;
    bytes[19..21].copy_from_slice(&0_u16.to_le_bytes());
    bytes[21] = 0;
    bytes
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn multiple_webtransport_clients_receive_authoritative_snapshots() -> Result<()> {
    let identity = Identity::self_signed(["localhost", "127.0.0.1"])?;
    let certificate_hash = identity.certificate_chain().as_slice()[0].hash();
    let server_config = ServerConfig::builder()
        .with_bind_address("127.0.0.1:0".parse()?)
        .with_identity(identity)
        .build();
    let server = Arc::new(Endpoint::server(server_config)?);
    let port = server.local_addr()?.port();
    let world = Arc::new(Mutex::new(World::new(2000.0, 2000.0)));
    let next_player = Arc::new(AtomicU32::new(1));

    let server_task = {
        let server = Arc::clone(&server);
        let world = Arc::clone(&world);
        let next_player = Arc::clone(&next_player);
        tokio::spawn(async move {
            let mut sessions = Vec::new();
            for _ in 0..CLIENTS {
                let incoming = server.accept().await;
                let world = Arc::clone(&world);
                let player_id = next_player.fetch_add(1, Ordering::Relaxed);
                sessions.push(tokio::spawn(async move {
                    let request = incoming.await?;
                    assert_eq!(request.path(), "/game");
                    let connection = request.accept().await?;
                    assert!(connection.max_datagram_size().unwrap_or(0) >= CONSERVATIVE_DATAGRAM_BYTES);
                    world.lock().await.add_player(player_id);

                    let datagram = connection.receive_datagram().await?;
                    let packet = decode_input_packet(datagram.as_ref()).expect("valid M2 input datagram");
                    let mut ingress = InputIngressWindow::default();
                    let accepted = ingress.ingest(&packet);
                    let newest = accepted.last().copied().expect("one accepted sample");

                    let snapshot = {
                        let mut world = world.lock().await;
                        world.set_input(player_id, newest.into());
                        world.step();
                        let mut session = SnapshotSession::default();
                        session.build(
                            packet.ack_snapshot_sequence,
                            world.tick,
                            player_id,
                            world.fighters(),
                            CONSERVATIVE_DATAGRAM_BYTES,
                        )
                    };
                    connection.send_datagram(snapshot.bytes)?;
                    let ack = connection.receive_datagram().await?;
                    assert_eq!(ack.as_ref(), b"m4-ack");
                    Ok::<(), anyhow::Error>(())
                }));
            }
            for session in sessions {
                session.await??;
            }
            Ok::<(), anyhow::Error>(())
        })
    };

    let client_config = ClientConfig::builder()
        .with_bind_default()
        .with_server_certificate_hashes([certificate_hash])
        .build();
    let client = Endpoint::client(client_config)?;

    for index in 0..CLIENTS {
        let connection = client
            .connect(format!("https://127.0.0.1:{port}/game"))
            .await?;
        connection.send_datagram(input_datagram(index as u16, 100 + index as u32))?;
        let reply = connection.receive_datagram().await?;
        let snapshot = decode_snapshot(reply.as_ref()).expect("authoritative snapshot datagram");
        assert!(snapshot.full);
        assert!(snapshot.records.iter().any(|record| record.net_id == index as u32 + 1));
        assert!(reply.len() <= CONSERVATIVE_DATAGRAM_BYTES);
        connection.send_datagram(b"m4-ack")?;
    }

    server_task.await??;
    assert_eq!(world.lock().await.fighters().len(), CLIENTS);
    Ok(())
}
