# M8 — Authoritative Capacity Evidence

M8 turns the 512-player single-map goal into measured server-side evidence. It does not claim production capacity from architecture diagrams or JavaScript-only planner probes.

## Scope

M8 adds two bounded probes:

1. `m8_capacity_probe`
   - runs the real Rust `World` simulation;
   - maintains one real `SnapshotSession` per simulated player;
   - drives deterministic movement/combat inputs;
   - builds authoritative snapshots at the production 20 Hz cadence;
   - immediately acknowledges each delivered snapshot to exercise delta baselines;
   - measures 64, 128, 256 and 512-player scenarios in separate processes.

2. `m8_transport_probe`
   - creates real loopback HTTP/3/WebTransport connections with `wtransport`;
   - drives concurrent client input datagrams;
   - waits until accepted input is represented by a later authoritative server tick;
   - receives authoritative snapshots and processed-input acknowledgements;
   - drops sessions and reconnects a bounded subset to measure fresh full-resync cost.

No public bind, deployment, account system, persistence, gameplay progression, or production traffic is introduced.

## Capacity measurements

`M8_CAPACITY` records:

- authoritative simulation tick p50/p95/p99/max;
- all-player replication-batch p50/p95/p99/max;
- average and maximum snapshot payload bytes;
- snapshot payload bytes/player/second;
- estimated application payload bytes/player/second, adding the current 60 Hz 34-byte input and 20 Hz 16-byte processed-input ACK payloads;
- records emitted per snapshot;
- records omitted because of the 1100-byte conservative datagram budget;
- fresh-session reconnect/resync build p95, bytes and omission pressure;
- Linux process RSS growth while per-session snapshot histories warm up, when `/proc/self/status` is available;
- whether measured p95 tick work fits the 60 Hz 16.67 ms budget;
- whether one all-player replication batch fits its 20 Hz 50 ms cadence.

The target booleans are evidence, not hidden pass/fail rewriting. CI fails on broken invariants such as malformed output, missing snapshots, non-finite measurements, incomplete real transport exchanges, non-full fresh resync snapshots, or datagrams exceeding the protocol budget. A performance target miss is reported truthfully so the next optimization milestone can attack the measured bottleneck.

## Real transport measurements

`M8_WEBTRANSPORT_LOAD` records a bounded 64-client concurrent loopback flight by default:

- complete snapshot and processed-input-ACK counts;
- snapshot payload bytes/player/second;
- ACK round-trip p50/p95/p99/max;
- first-round p95;
- maximum snapshot datagram size.

`M8_RECONNECT` repeats the same wire path with fresh sessions so every reconnect must receive a full authoritative baseline.

This complements M7. M7 proves the browser/render/prediction path in Chrome and Firefox; M8 isolates authoritative server and transport scaling without pretending headless browser counts are server capacity.

## Reproduction

From the repository root:

```bash
cargo run --locked --release --quiet --manifest-path server/Cargo.toml --bin m8_capacity_probe -- 64 15 60
cargo run --locked --release --quiet --manifest-path server/Cargo.toml --bin m8_capacity_probe -- 128 15 60
cargo run --locked --release --quiet --manifest-path server/Cargo.toml --bin m8_capacity_probe -- 256 15 60
cargo run --locked --release --quiet --manifest-path server/Cargo.toml --bin m8_capacity_probe -- 512 15 60
cargo run --locked --release --quiet --manifest-path server/Cargo.toml --bin m8_transport_probe -- 64 6
```

The first argument to `m8_capacity_probe` is player count, followed by warm-up and measured authoritative ticks. The transport probe arguments are concurrent clients and input/snapshot rounds per client.

## Interpretation boundary

These probes are repeatable CI evidence on one hosted Linux runner. They do **not** establish a production hardware SLO, public-internet packet-loss behavior, mobile client capacity, geographic latency, or safe 512-client public deployment.

The important M8 question is narrower:

> At which measured layer does the current architecture stop fitting its real-time budget as player count approaches 512?

That answer determines the next optimization work unit. Performance work should follow the measured bottleneck rather than speculative rewrites.
