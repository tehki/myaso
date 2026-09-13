use anyhow::Result;
use myaso_server::{decode_input_packet, INPUT_HEADER_BYTES, INPUT_SAMPLE_BYTES};
use wtransport::{ClientConfig, Endpoint, Identity, ServerConfig};

fn input_datagram(sequence: u16) -> Vec<u8> {
    let mut bytes = vec![0_u8; INPUT_HEADER_BYTES + INPUT_SAMPLE_BYTES];
    bytes[0] = 1;
    bytes[1] = 1;
    bytes[2] = 1;
    bytes[4..6].copy_from_slice(&sequence.to_le_bytes());
    bytes[6..8].copy_from_slice(&0xffff_u16.to_le_bytes());
    bytes[8..12].copy_from_slice(&123_u32.to_le_bytes());
    bytes[12..16].copy_from_slice(&120_u32.to_le_bytes());
    bytes[16] = 0;
    bytes[17] = 127_u8;
    bytes[18] = 0;
    bytes[19..21].copy_from_slice(&0_u16.to_le_bytes());
    bytes[21] = 1;
    bytes
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn quic_webtransport_datagram_roundtrip() -> Result<()> {
    let identity = Identity::self_signed(["localhost", "127.0.0.1"])?;
    let certificate_hash = identity.certificate_chain().as_slice()[0].hash();
    let server_config = ServerConfig::builder()
        .with_bind_address("127.0.0.1:0".parse()?)
        .with_identity(identity)
        .build();
    let server = Endpoint::server(server_config)?;
    let port = server.local_addr()?.port();

    let server_task = tokio::spawn(async move {
        let incoming = server.accept().await;
        let request = incoming.await?;
        assert_eq!(request.path(), "/game");
        let connection = request.accept().await?;
        let datagram = connection.receive_datagram().await?;
        let decoded = decode_input_packet(datagram.as_ref()).expect("decode JS-compatible input");
        assert_eq!(decoded.sequence, 77);
        connection.send_datagram(b"m3-ok")?;
        Ok::<(), anyhow::Error>(())
    });

    let client_config = ClientConfig::builder()
        .with_bind_default()
        .with_server_certificate_hashes([certificate_hash])
        .build();
    let client = Endpoint::client(client_config)?;
    let connection = client
        .connect(format!("https://127.0.0.1:{port}/game"))
        .await?;
    connection.send_datagram(input_datagram(77))?;
    let reply = connection.receive_datagram().await?;
    assert_eq!(reply.as_ref(), b"m3-ok");

    server_task.await??;
    Ok(())
}
