# Core C3b — durable item-ownership journal, idempotency and restart recovery

Base: Core C3a [PR #375](https://github.com/tehki/myaso/pull/375),
stacked on Core C2a [PR #365](https://github.com/tehki/myaso/pull/365).

## Contract and scope

The new `server/src/item_journal.rs` is a **dormant single-process writer**
for `item_ownership.rs`. It demonstrates one crash-consistent way to preserve
full-loot ownership and idempotency receipts across process restarts.

- Each transaction has a globally unique nonzero `OwnershipTxnId`. Its
  bounded batch includes all equipped/inventory/corpse/ground item moves.
- `preview()` checks **the whole batch** and returns the anticipated
  sequence **without mutating** the in-memory ledger. Reused IDs with
  identical operations return the original receipt; conflicting reuse fails.
- New commits are encoded into a bounded, versioned journal record containing
  their transaction ID, monotonic sequence, and complete operation batch.
  Each item location and source precondition is included in the record.
- Staged files use exclusive creation and Unix owner-only permissions (0600),
  followed by file `sync_all`. An immutable canonical sequence file is
  published with a same-directory **hard link**, then the directory is synced.
  Only once that succeeds is the in-memory transaction made visible.
- Errors during persistence **poison the current journal handle**. The
  caller must stop writes and **reopen/recover from disk**; never assume an
  uncertain file/directory sync left a transaction uncommitted.
- Restart scans sequential canonical records, validates all bytes, version,
  reserved fields, strict sequence, checksum and semantic preconditions,
  then reconstructs item locations, equipment-slot index, destroyed-item
  tombstones, and original idempotency receipts.
- Interrupted `.pending-*` staging files are ignored and cannot create
  duplicate items during recovery. Damaged committed records or missing
  sequences **fail closed**; the journal never guesses a partial world state.
- **Destroyed `ItemId`s are never reissued**, even with a different
  transaction ID, including after restart. A tombstone is reconstructed by
  the journal replay.

The v1 binary record has a 36-byte header (magic `MYTX`, version, sequence,
transaction ID, operation count and reserved fields), a fixed 69-byte payload
for each operation, and a 4-byte FNV-1a accidental-corruption checksum.
The maximum transaction size is 1024 operations. This checksum is **not**
cryptographic authentication or tamper resistance.

## Test evidence

An isolated Rust 1.89 harness on the connected Linux device, compiling
`identity.rs`, `item_ownership.rs` and `item_journal.rs`, passed
**23/23 tests**, including:

- Crash after canonical publish but before in-memory apply: reopen replays
  once and produces the original receipt.
- Three-item full-loot death to both corpse and ground survives restart,
  and identical retries never duplicate loot.
- Conflicting replay and competing looter claims fail.
- Permanent item-ID tombstones survive journal recovery.
- Torn, mismatched, corrupted or missing canonical records fail closed.
- Orphan staging files do not change committed ownership.
- Equipment-slot uniqueness and all-or-nothing mixed-validity batches.
- Negative/positive ground coordinates, all location variants, zero IDs.
- Journal files are mode 0600 on Unix.
- Bounded input batches and sequence overflow fail without mutation.

Required integration checks:

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml item_ownership::
cargo test --locked --manifest-path server/Cargo.toml item_journal::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

Exact-head full GitHub `quality` CI, including existing real-browser
combat acceptance, is required before merge consideration.

## Explicit limitations and production blockers

**This is NOT a production-ready MMO ledger.**

1. **Single-writer only:** `&mut` prevents overlapping calls on one Rust
   instance but is **not** a cross-process lock. Parallel instances on the
   same filesystem are unsafe. Production needs a serializable transactional
   database or equally provable distributed CAS/unique-constraint authority.
2. **Authorization not implemented:** game actions must prove the current
   authenticated session/character, death events, safe-zone rules, legal
   trade/corpse ownership, item access distance, inventory/weight capacity,
   and anti-bot and cooldown rules before creating a proposed batch.
3. **Memory and disk growth:** this proof stores full idempotency history,
   item tombstones and all committed transaction files indefinitely.
   Production needs bounded retention rules proven safe for retries,
   snapshots/checkpoints, compaction, backups and full recovery benchmarks.
4. **Filesystem assumptions:** use a protected **local** directory and
   filesystem with correct atomic hard-link semantics and durable file and
   directory fsync; no hostile symlinks, NFS/shared storage, unsupported
   directory sync, or untrusted processes modifying the journal.
5. **Crash and power-loss acceptance:** a real deployment requires forced
   process termination and storage-error fault injection before/after
   staging, publication, directory sync, memory apply and client ACK,
   including hard power loss and disk-full/permission failures.
6. **World integration:** corpse IDs and ground locations are only durable
   ownership records here; they are **not** yet spawned/replicated physical
   world objects or persistent player bags.
7. **Multi-system atomicity:** item changes, currency balances, trades,
   resource creation/destruction, world-event outbox and character state
   must eventually share one atomic durable transaction boundary. The
   current journal has no cross-subsystem transaction/rollback guarantee.
8. **Tick safety:** journal sync/replay I/O must not execute inside the 60 Hz
   simulation tick or low-latency WebTransport hot path.
9. **Economy and Moon Coin:** no real wallet, trade settlement, MOCMP token,
   player housing, financial custody or live asset operations are enabled.

Coordinate item schema and lifecycle with **Magic & Items**, economic sinks
and trades with **Economics**, physical corpse and ground entities with
**World & Gameplay**, and session/zone ownership with **Core & Multiplayer**.
The Moon Games Development Center alone owns integration, merge and deploy.

## Release status

No live routes, client protocol, gameplay, database, production credential,
payment system, deployment config, `main` commit or game-server restart is
introduced by C3b. The PR must remain a draft until full quality CI and
cross-department review.
