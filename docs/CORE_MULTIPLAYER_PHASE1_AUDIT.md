# Core & Multiplayer — Phase 1 audit and first ingress hardening milestone

Date: 2026-10-20
Baseline: `main` at `7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`
Scope: repository-level static architecture review and CI evidence, **not** a production load certification.

## Verified baseline

- Runtime: Rust 2021 authoritative server using Tokio and `wtransport` (`server/Cargo.toml`, `server/src/main.rs`); browser-side ECMAScript modules and Node test tooling.
- Session transport: the Rust server accepts WebTransport sessions at `/game`. Public/LAN binds require an explicit certificate and private-key path. An admission gate bounds concurrent sessions.
- Server simulation: one shared `World` runs at 60 Hz; authoritative replication snapshots are scheduled every 3 server ticks (20 Hz). Client datagrams encode input intentions; the server owns position, combat, death, respawn and kill events.
- Network behavior: bounded three-sample input redundancy, replay-window deduplication, binary snapshots, interest-managed replication, acknowledged baselines/resync and bounded reliable write admission. Browser code provides prediction/reconciliation and remote interpolation. `docs/NETWORKING_ARCHITECTURE.md` also describes a WebSocket fallback, but the inspected Rust server's public entry point is WebTransport-only; do not represent the documented fallback as verified server support.
- Current lifecycle: `GameState::new` builds an in-memory `World`, and each connected player receives an incrementing network ID that is removed on disconnect. The inspected main server has no durable character/world-storage path or reconnect-to-identity flow.
- Existing capacity evidence: `server/src/bin/m8_capacity_probe.rs` and `m8_transport_probe.rs` exist, and `docs/M8_CAPACITY_EVIDENCE.md` specifies 64/128/256/512 simulated-entity and 64 WebTransport-client measurements. These are laboratory probes, **not** measured production realm capacity.
- CI at baseline: protected `main` quality run [39458864085](https://github.com/tehki/myaso/actions/runs/39458864085) **succeeded** at the audited SHA; [alpha-package 39462969713](https://github.com/tehki/myaso/actions/runs/39462969713) also **succeeded**. This establishes green baseline CI, not green CI for this new feature branch.
- Coordination: the repository already contains `server/src/zone.rs`, and World & Buildings PRs #336, #340 and #341 are open. Core must treat active cross-zone transfer and authoritative map isolation as integration-gated.

## Highest-impact gaps, ranked

| Priority | Risk / observation | Needed proof before activation |
| --- | --- | --- |
| P0 | World, character identity and authoritative session ownership are ephemeral in the inspected main server; restart/disconnect cannot provide MMORPG persistence guarantees. | Stable identity binding; crash/restart/reconnect invariant tests; ownership-state restore with versioned storage |
| P0 | Loot, inventory, corpse and property records are not yet integrated as atomic durable transitions in the main server. Without transaction semantics, future full-loot and player trading expose duplication/loss risk. | One-item-one-owner invariant; concurrent looters; crash during transfer; idempotent replay recovery |
| P0 | The v1 input decoder accepted nonzero reserved byte and the signed -128 axis code, although the shipped JS encoder emits reserved zero and only [-127,127] axes. The simulation currently normalizes movement, but malformed packets should still be rejected at the protocol boundary. | Exact Rust/JS decoder parity, all redundant-sample rejection tests and unchanged valid-wire acceptance |
| P1 | The WebTransport server assigns a new transient net ID to each connection. Identity, authentication and reconnect semantics are not yet fit for persistent property/item ownership. | Authenticated session binding, stolen/expired session denial and reconnect under concurrent logins |
| P1 | Multi-zone/world migration is still staged; an in-memory zone registry is not equivalent to atomic cross-world movement. | Two-world authoritative migration, exclusive zone presence, spatial/combat/loot isolation, reconnect and rollback |
| P1 | 512 players is an engineering test target, not a demonstrated Internet/mobile production capacity target. Large battles, adverse networks and public operational SLOs need additional reproducible evidence. | Exact-head load profiles, tick p99, bandwidth, queue and recovery metrics under representative load |
| P2 | Protocol compatibility and parser robustness need sustained cross-language fuzzing and rolling-version coverage as items, magic and zones add message types. | Malformed-frame corpus, cross-version encode/decode fixtures, fuzz bounds and rolling-upgrade tests |

## First milestone: strict v1 input-frame validation

Branch: `feature/core-input-v1-wire-validation-20261020`

Scope:
1. Reject nonzero reserved input-header byte (offset 3) in Rust and JavaScript decoders.
2. Reject raw signed `-128` movement codes in either axis of any of the 1–3 redundant samples. The existing client encoder quantizes to `[-127,127]`.
3. Verify valid signed extremal movement, 34-byte triple-sample packets, redundant samples and malformed-frame rejection in both test suites.
4. Preserve protocol version, packet length, baseline logic, action timing and on-wire encoder behavior.

This is input hygiene and wire-contract parity, **not** a claim of fixing a known live speed exploit: the current simulation already normalizes movement vectors.

## Test and release evidence required

- `node --test tests/networking.test.mjs`
- `cargo fmt --manifest-path server/Cargo.toml -- --check`
- `cargo test --locked --manifest-path server/Cargo.toml --lib`
- Existing full `quality` GitHub Actions against the exact feature-branch head.
- Confirm no regression to M63 redundant action recovery, M194 input/wheel acceptance and authoritative simulation.
- Record the precise head SHA and workflow URL only after CI produces results.

## Ordered follow-up work (separate PRs)

1. **C2 — persistent-identity and reconnect contract**, without activating an accounts/payment system: stable immutable character IDs, session generation/leases, duplicate-login policy, versioned player-state serialization and fail-closed reconnect tests.
2. **C3 — durable world transactions contract** with Magic & Items and Economics: unique item IDs, atomic corpse/ground/inventory transfers, idempotency keys, outbox/inbox or equivalent crash-safe handoff; no live Moon Coin settlement.
3. **C4 — authoritative world zones** with World & Gameplay and Physics: single-zone player ownership at each tick, atomic migration and ACK-bound client reset. Keep dormant zone features inactive until integrated acceptance.
4. **C5 — measured realm capacity**, reusing M8 and CI probes, then WAN packet-loss/jitter tests with action-latency, replication fidelity and memory budgets.
5. **C6 — operating resilience**, snapshots/checkpoints, restore drills, schema migration and rolling-protocol-version safety.

No departmental PR merges, `main` pushes or production deployment are authorized by this audit. Release acceptance stays with the Moon Games Development Center.
