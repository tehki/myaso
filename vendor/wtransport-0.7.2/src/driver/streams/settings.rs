use crate::driver::streams::unilocal::StreamUniLocalH3;
use crate::driver::streams::uniremote::StreamUniRemoteH3;
use crate::driver::streams::ProtoReadError;
use crate::driver::streams::ProtoWriteError;
use crate::driver::DriverError;
use crate::error::StreamWriteError;
use crate::VarInt;
use std::future::pending;
use tokio::sync::watch;
use wtransport_proto::bytes;
use wtransport_proto::error::ErrorCode;
use wtransport_proto::frame::Frame;
use wtransport_proto::frame::FrameKind;
use wtransport_proto::settings::Settings;
use wtransport_proto::stream_header::StreamKind;

pub struct LocalSettingsStream {
    stream: Option<StreamUniLocalH3>,
    settings: Settings,
}

impl LocalSettingsStream {
    pub fn empty() -> Self {
        let settings = Settings::builder()
            .qpack_max_table_capacity(VarInt::from_u32(0))
            .qpack_blocked_streams(VarInt::from_u32(0))
            .enable_connect_protocol() // TODO(biagio): it would be nice to have this only for server
            .enable_webtransport()
            .enable_h3_datagrams()
            .webtransport_max_sessions(VarInt::from_u32(1))
            .build();

        Self {
            stream: None,
            settings,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.stream.is_none()
    }

    pub fn set_stream(&mut self, stream: StreamUniLocalH3) {
        assert!(matches!(stream.kind(), StreamKind::Control));
        self.stream = Some(stream);
    }

    pub async fn send_settings(&mut self) -> Result<(), DriverError> {
        match self
            .stream
            .as_mut()
            .expect("Cannot send settings on empty stream")
            .write_frame(self.settings.generate_frame())
            .await
        {
            Ok(()) => Ok(()),
            Err(ProtoWriteError::NotConnected) => Err(DriverError::NotConnected),
            Err(ProtoWriteError::Stopped) => {
                Err(DriverError::Proto(ErrorCode::ClosedCriticalStream))
            }
        }
    }

    pub async fn run(&mut self) -> DriverError {
        match self.stream.as_mut() {
            Some(stream) => match stream.stopped().await {
                StreamWriteError::NotConnected => DriverError::NotConnected,
                StreamWriteError::Closed | StreamWriteError::Stopped(_) => {
                    DriverError::Proto(ErrorCode::ClosedCriticalStream)
                }
                StreamWriteError::QuicProto => DriverError::Proto(ErrorCode::ClosedCriticalStream),
            },
            None => pending().await,
        }
    }
}

// The driver restarts run_control_streams() at every outer select! event.
// Frame::read_async consumes header/payload bytes incrementally and is NOT
// cancellation safe. Keep the critical SETTINGS reader in one owned task:
// cancelling the await of its JoinHandle cannot discard a partial HTTP/3 frame.
pub struct RemoteSettingsStream {
    reader: Option<tokio::task::JoinHandle<DriverError>>,
    settings: watch::Sender<Option<Settings>>,
}

impl RemoteSettingsStream {
    pub fn empty() -> Self {
        Self {
            reader: None,
            settings: watch::channel(None).0,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.reader.is_none()
    }

    pub fn set_stream(&mut self, mut stream: StreamUniRemoteH3) {
        assert!(matches!(stream.kind(), StreamKind::Control));
        assert!(
            self.reader.is_none(),
            "remote HTTP/3 control stream already bound"
        );
        let settings = self.settings.clone();
        self.reader = Some(tokio::spawn(async move {
            loop {
                let frame = match Self::read_frame(&mut stream).await {
                    Ok(frame) => frame,
                    Err(driver_error) => return driver_error,
                };
                if let Err(error) = Self::accept_frame(&settings, &frame) {
                    return error;
                }
            }
        }));
    }

    // Shared validation for both production and intentionally fragmented
    // positive/negative tests. No H3 permissions are relaxed.
    fn accept_frame(
        settings: &watch::Sender<Option<Settings>>,
        frame: &Frame<'_>,
    ) -> Result<(), DriverError> {
        if settings.borrow().is_none() {
            if !matches!(frame.kind(), FrameKind::Settings) {
                return Err(DriverError::Proto(ErrorCode::MissingSettings));
            }
            let parsed = Settings::with_frame(frame).map_err(DriverError::Proto)?;
            settings.send_replace(Some(parsed));
        } else if !matches!(frame.kind(), FrameKind::Exercise(_)) {
            return Err(DriverError::Proto(ErrorCode::FrameUnexpected));
        }
        Ok(())
    }

    pub fn subscribe(&self) -> RemoteSettingsWatcher {
        RemoteSettingsWatcher(self.settings.subscribe())
    }

    pub async fn run(&mut self) -> DriverError {
        match self.reader.as_mut() {
            Some(reader) => match reader.await {
                Ok(error) => error,
                Err(_) => DriverError::NotConnected,
            },
            None => pending().await,
        }
    }

    async fn read_frame<'a>(stream: &mut StreamUniRemoteH3) -> Result<Frame<'a>, DriverError> {
        match stream.read_frame().await {
            Ok(frame) => Ok(frame),
            Err(ProtoReadError::H3(error_code)) => Err(DriverError::Proto(error_code)),
            Err(ProtoReadError::IO(io_error)) => match io_error {
                bytes::IoReadError::ImmediateFin
                | bytes::IoReadError::UnexpectedFin
                | bytes::IoReadError::Reset => {
                    Err(DriverError::Proto(ErrorCode::ClosedCriticalStream))
                }
                bytes::IoReadError::NotConnected => Err(DriverError::NotConnected),
            },
        }
    }
}

impl Drop for RemoteSettingsStream {
    fn drop(&mut self) {
        if let Some(reader) = self.reader.take() {
            reader.abort();
        }
    }
}

pub struct RemoteSettingsWatcher(watch::Receiver<Option<Settings>>);

impl RemoteSettingsWatcher {
    pub async fn accept_settings(&mut self) -> Option<Settings> {
        self.0.changed().await.ok()?;

        Some(
            self.0
                .borrow()
                .clone()
                .expect("On change settings must be set"),
        )
    }
}
#[cfg(test)]
mod cancellation_regressions {
    use super::*;
    use std::{
        borrow::Cow,
        pin::Pin,
        task::{Context, Poll},
    };
    use tokio::io::{AsyncRead, AsyncWriteExt, DuplexStream, ReadBuf};
    use tokio::time::{sleep, timeout, Duration};

    struct ProtoReader(DuplexStream);
    impl bytes::AsyncRead for ProtoReader {
        fn poll_read(
            mut self: Pin<&mut Self>,
            cx: &mut Context<'_>,
            dst: &mut [u8],
        ) -> Poll<std::io::Result<usize>> {
            let mut buffer = ReadBuf::new(dst);
            match Pin::new(&mut self.0).poll_read(cx, &mut buffer) {
                Poll::Ready(Ok(())) => Poll::Ready(Ok(buffer.filled().len())),
                Poll::Ready(Err(error)) => Poll::Ready(Err(error)),
                Poll::Pending => Poll::Pending,
            }
        }
    }

    fn encoded_settings() -> Vec<u8> {
        let settings = Settings::builder()
            .enable_connect_protocol()
            .enable_webtransport()
            .enable_h3_datagrams()
            .build();
        let mut bytes = Vec::new();
        settings.generate_frame().write(&mut bytes).unwrap();
        assert!(bytes.len() > 4);
        bytes
    }

    #[tokio::test]
    async fn fragmented_settings_reader_survives_repeated_outer_select_cancellation() {
        let (mut writer, read) = tokio::io::duplex(64);
        let (settings, _) = watch::channel(None);
        let received = settings.clone();
        let mut reader = tokio::spawn(async move {
            let mut read = ProtoReader(read);
            let frame = Frame::read_async(&mut read).await.unwrap();
            RemoteSettingsStream::accept_frame(&settings, &frame)
                .expect("valid fragmented SETTINGS");
        });
        let encoded = encoded_settings();
        // A legitimate SETTINGS frame arrives in many separate QUIC reads.
        // Every unrelated driver event can drop the *awaiting* future, but
        // must not cancel the owned frame reader or consume the partial header.
        for byte in &encoded[..encoded.len() - 1] {
            writer.write_all(&[*byte]).await.unwrap();
            tokio::select! {
                _ = sleep(Duration::from_millis(1)) => {},
                outcome = &mut reader => panic!("partial SETTINGS completed: {outcome:?}"),
            }
        }
        writer
            .write_all(&encoded[encoded.len() - 1..])
            .await
            .unwrap();
        timeout(Duration::from_secs(2), &mut reader)
            .await
            .expect("complete SETTINGS deadline")
            .expect("reader task");
        assert!(received.borrow().is_some(), "SETTINGS authenticated");
    }

    #[tokio::test]
    async fn fragmented_control_reader_keeps_rejecting_missing_and_duplicate_settings() {
        let valid = encoded_settings();
        let invalid = {
            let mut bytes = Vec::new();
            Frame::new_data(Cow::Owned(vec![1]))
                .write(&mut bytes)
                .unwrap();
            bytes
        };
        for (frames, expected) in [
            (vec![invalid], ErrorCode::MissingSettings),
            (
                vec![valid.clone(), valid.clone()],
                ErrorCode::FrameUnexpected,
            ),
        ] {
            let (mut writer, read) = tokio::io::duplex(64);
            let settings = watch::channel(None).0;
            let mut reader = tokio::spawn(async move {
                let mut read = ProtoReader(read);
                loop {
                    let frame = Frame::read_async(&mut read).await.unwrap();
                    if let Err(error) = RemoteSettingsStream::accept_frame(&settings, &frame) {
                        return error;
                    }
                }
            });
            for frame in frames {
                for chunk in frame.chunks(2) {
                    writer.write_all(chunk).await.unwrap();
                    tokio::task::yield_now().await;
                }
            }
            let error = timeout(Duration::from_secs(2), &mut reader)
                .await
                .expect("rejection deadline")
                .expect("reader task");
            assert!(
                matches!(error, DriverError::Proto(code) if code == expected),
                "existing strict HTTP/3 SETTINGS validation remains active"
            );
        }
    }
}
