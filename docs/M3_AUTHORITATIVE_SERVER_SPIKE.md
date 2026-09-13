# M3 — Authoritative server + real transport spike

## Goal

Turn the M2 protocol design into a real server-side transport boundary without pretending that synthetic protocol tests alone prove production scale.

M3 is intentionally narrow. It proves that the selected Rust candidate can accept browser-compatible WebTransport sessions, enforce admission/security boundaries, receive the existing myaso input datagram format, and run a fixed-rate authoritative clock. It does **not** yet connect the Rust server to the combat simulation or emit production snapshots.

## Runtime contract

- server transport: WebTransport over HTTP/3/QUIC;
- candidate implementation: `wtransport 0.7.2` on Quinn;
- async runtime: Tokio 1.51 LTS line;
- authoritative clock: 60 Hz;
- session path: `/game`;
- target admission ceiling for one logical map instance: 512 sessions;
- conservative realtime datagram budget: 1100 bytes;
- malformed client datagrams are rejected as data, never interpreted as authority;
- session inputs remain client *intentions* only.

## TLS boundary

Local development may generate a short-lived self-signed identity only when bound to a loopback address. The certificate SHA-256 is printed so a browser/client can pin the development certificate.

For a non-loopback bind, startup fails unless both `MYASO_CERT_PEM` and `MYASO_KEY_PEM` are explicitly supplied. The spike never silently generates a public-facing server key and never disables certificate verification.

## Overload behavior

The session admission gate is bounded. Once 512 sessions hold permits, new `/game` requests receive HTTP 429 before gameplay ingress. The permit is RAII-scoped, so disconnects release capacity automatically.

The transport path also requires support for at least the M2 conservative datagram budget. A negotiated path below that budget is closed rather than silently fragmenting latency-sensitive state.

## What CI must prove for M3

1. Rust dependency graph resolves under the pinned toolchain.
2. `cargo check` and `cargo test` pass.
3. Rust unit tests decode the exact JavaScript input packet layout.
4. Admission gating is bounded and releases slots.
5. A real loopback QUIC/WebTransport server and client establish a session over `/game`.
6. A JS-compatible input datagram traverses the QUIC/WebTransport path and is decoded by the server.
7. A return datagram traverses the same connection.

The loopback smoke is transport evidence, not a 512-player production-capacity claim.

## Next integration boundary

M4 should connect validated inputs to a server-owned simulation state and emit M2 snapshot deltas. Then we can run a representative multi-client harness with injected latency/loss/reordering and measure tick-time, packet-build time, memory, scheduler pressure and combat reconciliation error.
