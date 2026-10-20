# Core C2a — dormant character identity and reconnect lease fencing

Base branch: `main` at `7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`

## Purpose and boundaries

The current authoritative server assigns a new ephemeral network ID on each connection and removes the fighter on disconnect. This cannot yet support persistent world ownership, full-loot items or account-bound reconnects.

C2a introduces **dormant, dependency-free Rust primitives** in `server/src/identity.rs` for a future authenticated reconnect boundary:

- A nonzero 128-bit `CharacterId` distinct from the transient network ID.
- A fixed 36-byte, versioned character identity record (`MYCH` magic, v1, zero reserved bytes, full 128-bit ID, 64-bit session generation and FNV-1a 32-bit accidental-corruption checksum).
- Explicit fail-closed handling for zero IDs, truncation/extra bytes, unsupported schema versions, nonzero reserved fields and corrupted records.
- Checked generation increments: overflow fails rather than wrapping to an old token value.
- An in-memory `SessionLeaseRegistry` whose authoritative generation increases on each successfully committed reconnect; old connections cannot authorize actions or release newer connections, and spent generations remain invalid after disconnect.
- Deterministic tests for all these invariants and for a single live connection not claiming two characters.

This is **not** active character persistence, login, recovery or authentication. The runtime's existing session allocation, WebTransport wire protocol, simulation and combat behavior remain unchanged. The checksum is not a signature, MAC or access credential.

## Record contract

| Offset | Length | Field |
| --- | ---: | --- |
| 0 | 4 | ASCII `MYCH` |
| 4 | 1 | schema version = 1 |
| 5 | 3 | reserved = 0 |
| 8 | 16 | server-issued nonzero character ID, little-endian |
| 24 | 8 | session generation, little-endian |
| 32 | 4 | FNV-1a checksum over bytes 0–31, little-endian |

A decoder rejects any record that is not exactly 36 bytes. Future schema migrations must explicitly convert records rather than silently read old/unknown layouts.

## Safety-critical integration sequence

**Do not attach `SessionLeaseRegistry` to the live server until all these steps exist and are tested:**

1. A trusted login/account service resolves a stable `CharacterId`. Never accept an arbitrary ID supplied by a browser as evidence of ownership.
2. A transactional durable store loads and validates the current character record and atomically advances its generation. Enforce a uniqueness/compare-and-swap predicate so concurrent servers cannot both claim the same generation.
3. Commit the new record durably, then invoke `activate_committed(record, connection_id)`; **never** invert this order.
4. Check `is_current(lease)` on every world-changing input or owned-item operation. On delayed disconnect, call `release` with the exact lease.
5. Gate player-state restore and reconnect on authenticated identity and the committed generation, with an old owner fenced before new ownership is visible.
6. On reboot, restore the persisted generation before admitting sessions. Do not use an empty registry as proof of persistent ownership.
7. Validate concurrency across process boundaries, crash between transaction/ACK, migrations, stolen ticket rejection and real two-browser reconnect.

At this milestone, these integrations are blockers by design. C2a cannot prevent replay across a server reboot by itself because the registry is memory-only.

## Acceptance

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml identity::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

Then full exact-head `quality` GitHub Actions, including existing WebTransport and combat suites. No live deployment or main branch merge is authorized by this PR.

## Related work

- Core C1 strict v1 input validation: [PR #362](https://github.com/tehki/myaso/pull/362).
- Core C2b should provide transactional backing storage and authenticated reconnect integration, not just another in-memory cache.
- Magic & Items, Economics and World & Gameplay depend on these invariants for unique item ownership, corpses, housing deeds and seamless region transitions.
