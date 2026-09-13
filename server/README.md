# myaso authoritative server

M4 extends the Rust WebTransport/HTTP3/QUIC boundary into a server-owned gameplay loop while preserving the M2 v1 realtime wire format.

## Local loopback

```bash
cargo run --locked --manifest-path server/Cargo.toml
```

The default bind is `127.0.0.1:4433` and the endpoint is `/game`. Loopback mode generates a short-lived development certificate and prints only its SHA-256 certificate hash for browser pinning.

The runtime advances one shared authoritative world at 60 Hz and emits per-client snapshot datagrams at 20 Hz. Client input is treated as intention; position, health, guard, action state, combat outcomes, death, and respawn remain server-owned.

## Non-loopback

A public/LAN bind refuses to start without explicit TLS identity paths:

```bash
MYASO_BIND=0.0.0.0:4433 \
MYASO_CERT_PEM=/secure/path/cert.pem \
MYASO_KEY_PEM=/secure/path/key.pem \
cargo run --locked --manifest-path server/Cargo.toml
```

Never place the private key in the repository, logs, screenshots, or client code.

## Realtime boundaries

- `/game` WebTransport sessions only;
- bounded 512-session admission gate;
- negotiated datagram capability must support the 1100-byte M2 budget;
- bounded replay-window input deduplication;
- acknowledged snapshot baseline history with full-resync fallback;
- snapshot interest/budget prioritization instead of fragmentation;
- loopback development identity only unless explicit certificate/key paths are supplied.

## Validation

CI keeps the inherited governance, M1 combat, and M2 networking suites, then validates the Rust server with formatting, `cargo check --locked`, clippy with warnings denied, and `cargo test --locked`.

M4 additionally covers Rust combat parity, a Rust-encoder/browser-decoder wire fixture, snapshot loss/resync behavior, a dense 512-player packet-bound scenario, and an eight-client real WebTransport snapshot smoke.

This is not a 512-live-client production capacity claim and it is not a deployment. See `docs/M4_AUTHORITATIVE_SIMULATION.md` for the exact evidence and remaining reconciliation protocol gap.
