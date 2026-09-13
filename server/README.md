# myaso authoritative server spike

M3 introduces a real Rust WebTransport/HTTP3/QUIC server boundary for the M2 protocol.

## Local loopback

```bash
cargo run --manifest-path server/Cargo.toml
```

The default bind is `127.0.0.1:4433` and the endpoint is `/game`. Loopback mode generates a short-lived development certificate and prints only its SHA-256 certificate hash for browser pinning.

## Non-loopback

A public/LAN bind refuses to start without explicit TLS identity paths:

```bash
MYASO_BIND=0.0.0.0:4433 \
MYASO_CERT_PEM=/secure/path/cert.pem \
MYASO_KEY_PEM=/secure/path/key.pem \
cargo run --manifest-path server/Cargo.toml
```

Never place the private key in the repository, logs, screenshots, or client code.

## Scope

This spike proves transport ingress and server-side timing/admission boundaries. It does not yet drive the authoritative combat simulation or emit M2 snapshot deltas. See `docs/M3_AUTHORITATIVE_SERVER_SPIKE.md`.
