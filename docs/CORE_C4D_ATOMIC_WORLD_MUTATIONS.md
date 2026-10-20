# Core C4d — fenced world mutations, immutable receipts and outbox

Stacked on [Core C4c PR #390](https://github.com/tehki/myaso/pull/390)
and the earlier C4a/C4b milestones. This is the **dormant database-backed
world-mutation transaction foundation**, not production-enabled gameplay.

## The problem

An authoritative server that merely checks `is_current` and then updates
an in-memory world can still execute after a newer worker takes ownership.
C4c already demonstrates PostgreSQL as one durable authority and a
row-locking mutation gate. C4d puts the consequential state transition
**inside that same PostgreSQL transaction**.

## New schema and transaction contract

`server/sql/002_fenced_world_mutations.sql` is layered on migration
`001_zone_authority_postgres.sql` and introduces:

- `core_zone.world_state`: one versioned, opaque, bounded
  (1–4096-byte) world-state payload per typed character/ground-item ID.
- `core_zone.world_mutation_receipts`: immutable complete request,
  globally unique nonzero 16-byte mutation ID (SQL and Rust both reject all-zero IDs), verified worker/zone/authority
  generation, expected revision and committed state/outbox receipt.
- `core_zone.world_event_outbox`: append-only event with its committed
  state revision, same mutation ID, payload and authoritative generation.

The `commit_world_mutation` PostgreSQL function performs, as **one
transaction**:

1. Validate all identifiers, positive 63-bit epoch/worker/zone, expected
   revision and payload bounds.
2. Insert or lock a unique idempotency receipt; any attempted reuse with
   different bytes or authority fails. An identical **committed** retry
   returns the original receipt with `replay=true` and creates no new state.
3. Lock the `core_zone.entities` row with `FOR UPDATE` — the **same row
   serialized by C4c handoff**. Reject retired, prepared/frozen or stale
   worker/zone/epoch claims.
4. Check the exact world-state revision and refuse an unexpected revision
   or overflow.
5. Update the versioned state, append its outbox event and fill the receipt
   before the PostgreSQL transaction commits. Any failure rolls back all
   three data changes together.

Historical replay is only an idempotency result; it never proves the old
worker has current authority. The outbox is **not** automatically dispatched,
acknowledged or replicated to browsers.

## Server-side binding contract

`server/src/world_mutation_contract.rs` defines a Rust-1.88-compatible,
network-independent typed binding contract:

- A `TrustedWorkerVerifier` trait with **no accept-all production
  implementation**. It must be implemented by authenticated server code;
  client-provided worker/epoch claims are not trusted.
- `WorldMutationCommand::admit` accepts a verified authority and an
  immutable command, rejects payloads outside 1–4096 bytes and all
  signed-`bigint` overflow, and carries binary fields for prepared DB
  parameters rather than string-formatted SQL.
- Stable 128-bit character/item/operation ID mapping uses **big-endian**
  16-byte form, matching the PostgreSQL `bytea` contract.
- Typed result parsing refuses zero/negative revision/outbox sequences.
  The `replayed` flag must never activate a stale live session.

**This is not a production DB driver.** It intentionally does not add a
database pool, external credential provider, RPC, WebTransport route,
simulation hook or game-player identity mapping. The verifier used in unit
tests is a local fake, not real authentication.

## CI acceptance

`.github/workflows/core-c4d-world-mutations.yml` provisions an
**isolated ephemeral PostgreSQL 16 primary**, initializes the C4c and C4d
schemas and runs `scripts/verify_fenced_world_mutations.py` with separate
`psql` clients. Scenarios include:

- First versioned update atomically writes state, receipt and outbox.
- Exact ACK-loss retry returns its original receipt and never duplicates
  an outbox event; conflicting transaction-ID reuse fails.
- Wrong expected revision and oversized payload fail without changing
  state or writing a receipt/outbox.
- Prepared handoffs freeze world writes, including from the source; after
  commit, the old epoch is rejected and the new worker can advance state.
- Two independent database clients competing at the same revision produce
  **exactly one successful update**.
- A mutation transaction holding the entity row lock prevents another
  client's handoff from overtaking it.
- A restricted database role can invoke vetted authority functions but
  cannot directly read world state or insert forged outbox events.

The Rust isolated harness compiles `identity.rs`, `zone_lease.rs` and the
new binding contract and covers zero/untrusted claims, big-endian ID layout,
signed conversion, payload bounds and receipt parsing.

### C4e legacy-schema upgrade path

After applying 001 and 002, `server/sql/003_nonzero_authority_ids.sql`
adds named nonzero-ID CHECK constraints to **all eight** authority, handoff,
world-state, receipt and outbox identifier columns. Simply rerunning
`CREATE TABLE IF NOT EXISTS` from 001/002 **does not upgrade existing
tables**. The versioned migration is a single transaction, validates
preexisting rows, and fails without deleting or rewriting bad legacy IDs.
It is idempotent when rerun. Before any approved deployment, inventory
preexisting rows, arrange a controlled maintenance/locking window,
verify backups and test rollback; it is **not approved for production use**.

The dedicated C4d workflow first simulates a legacy invalid row inside
its disposable PostgreSQL database. It proves the upgrade fails closed
and rolls back, removes the test-only bad row, applies the upgrade twice,
and verifies all constraints and normal mutation acceptance.

The full existing `quality` suite must pass at the exact PR head in
addition to this dedicated PostgreSQL acceptance.

## Mandatory production blockers

- **Actual server credential verification and DB adapter**: no real worker
  authentication, PostgreSQL driver/pool or trusted per-character/zone
  admission exists yet. The Rust trait and SQL function are NOT a security
  boundary if an untrusted caller is given EXECUTE.
- **One primary only**: a PostgreSQL primary with durable commits is assumed.
  Split-brain, asynchronous follower promotion and independent VPS network
  partitions are not tested and must never yield simultaneous writers.
- **Game-world schema**: the payload is a 4KiB opaque snapshot placeholder,
  not a complete 60 Hz simulation snapshot. Actual player movement,
  combat/hits, magic, inventory, corpse ground physics, trades and housing
  must all be classified before persistence wiring.
- **Per-entity only**: a single world-state entity and its outbox event are
  atomic. Multi-entity combat, trades, item transfer, currency and economics
  will require **larger serializable transactions** that lock every affected
  entity/ledger row in deterministic order; do not claim atomic loot/trades.
- **Tick budgets**: no synchronous database round-trip may block the 60 Hz
  simulation hot path. A future async adapter must batch/coalesce safely,
  backpressure, preserve ownership predicates and protect failure recovery.
- **Outbox lifecycle**: immutable events are written but no consumer,
  replication ACK, bounded retention or exactly-once delivery protocol
  exists. Implement durable publisher offsets and reconciliation.
- **Database governance**: use dedicated NOLOGIN definer owner, least
  privilege roles, TLS, credential rotation, approved migrations,
  backups, monitoring and retention. The proof uses an ephemeral CI DB.
- **Failure acceptance**: test real SIGKILL before/after database commit,
  ACK loss, replica/failover mode, disk full, restore, partition, idempotency
  replay, unknown commit outcomes and delayed workers on independent hosts.

Coordinate with World & Gameplay, Magic & Items, Economics, Combat and the
Moon Games Development Center. Do **not** merge or deploy these stacked PRs
before successful exact-head checks and integration approval.

No changes to production VPS, main, wallets/Moon Coin or live gameplay.
