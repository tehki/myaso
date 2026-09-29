# Dependency review: wtransport 0.7.2

Status: **M3 spike candidate only — not yet production-approved**

## Concrete need

myaso.io needs a browser-compatible server transport that can expose WebTransport over HTTP/3/QUIC with:

- unreliable datagrams for latency-sensitive realtime traffic;
- reliable independent streams for join/control/resync;
- TLS 1.3-backed transport security;
- connection RTT and maximum datagram size visibility;
- async Rust integration suitable for an authoritative game server.

## Candidate

`wtransport = 0.7.2`

Observed at adoption review time:

- current release published in August 2026;
- implemented in Rust and built on Quinn 0.11.x;
- crate documentation exposes server/client endpoints, datagrams, streams, RTT, maximum datagram size, certificate hashing and request rejection;
- crate documentation reports complete public-item documentation coverage;
- server examples include browser WebTransport interoperability;
- the project itself warns that WebTransport remains evolving and that the library should not yet be treated as unconditionally production-ready.

## Dependency footprint / capability

Direct project dependencies for the spike are intentionally narrow:

- `wtransport = 0.7.2` — QUIC/HTTP3/WebTransport transport;
- `tokio ~1.51` — current LTS async runtime line;
- `anyhow = 1.0.104` — binary-level error context only.

`wtransport` transitively uses Quinn, rustls and related crypto/network crates. Default features are disabled and only `ring` plus `self-signed` are enabled. `self-signed` exists only to support bounded loopback tests and local development; non-loopback server startup refuses to generate a development identity.

## Security posture

- certificate/hostname validation is not disabled;
- the spike does not enable the crate's `dangerous-configuration` feature;
- loopback testing uses a short-lived standards-compatible self-signed ECDSA P-256 identity;
- public/non-loopback binds require explicitly supplied certificate and private-key file paths;
- private key material is never printed or stored in source;
- the game protocol remains server-authoritative; transport security does not confer gameplay authority on client input;
- incoming sessions are path-gated and capacity-gated before gameplay ingress.

## Admission decision

Allowed for **M3 interoperability and load-spike evaluation only**. Production admission requires representative evidence for:

1. Chromium/Firefox/Safari-family browser interoperability where WebTransport is available;
2. WebSocket fallback interoperability;
3. sustained 512-client load with realistic 60 Hz inputs and 20 Hz snapshot opportunities;
4. loss/jitter/reordering/backpressure behavior;
5. reconnect/resync and network migration behavior;
6. bounded memory, CPU and task counts under overload;
7. dependency vulnerability/license review on the locked dependency graph;
8. certificate rotation/reload procedure;
9. confirmation that no known transport defect invalidates combat fairness or availability.

Until those gates pass, `wtransport` is a measured candidate, not a permanent architecture commitment.
