# Core C4c — PostgreSQL transactional zone authority (dormant)

Base: C4b [PR #388](https://github.com/tehki/myaso/pull/388),
stacked on C4a [PR #381](https://github.com/tehki/myaso/pull/381)
and C2a [PR #365](https://github.com/tehki/myaso/pull/365).

## Scope

C4a defines an in-memory worker/zone/epoch lease contract. C4b adds
single-machine crash recovery and OS locking, but separate VPS nodes cannot
rely on the same filesystem lock.

C4c introduces a **separate and inactive PostgreSQL 15+ reference authority**
in `server/sql/001_zone_authority_postgres.sql`. It stores durable entity
ownership and idempotent handoff operation receipts in one database primary,
and serializes different worker sessions using PostgreSQL unique constraints,
row locks and transaction rollback. It does not activate any login, combat,
loot, realm shard, MOCMP coin, or client protocol.

`core_zone.entities` has a unique compound entity identity: kind
(character or ground item) plus an opaque 16-byte ID, with current
`owner_worker`, `owner_zone`, `authority_epoch`, optional pending operation
and permanent retirement tombstone.

`core_zone.handoffs` retains each unique 16-byte operation ID, the entire
source worker/zone/epoch, destination and a durable phase:
`prepared`, `committed` or `aborted`. IDs are never recycled.

All mutations are **database functions**, intended to be invoked in
transactions by an authenticated, authorized server service:

- `register_entity`: fail on duplicate/retired ID.
- `prepare_transfer`: consume a globally unique operation ID, verify exact
  source lease, reserve the entity and freeze both workers.
- `commit_transfer`: compare current pending operation and source lease,
  then atomically update owner/zone/epoch and transaction receipt.
- `abort_transfer`: only cancel an exactly pending and uncommitted transfer.
- `is_current`: read-only diagnostic; it is **not** an authorization gate.
- `assert_mutation_authority`: acquire a row lock and verify the epoch.
  The actual state-changing SQL must execute **in that same transaction**.
  A handoff cannot commit between the check and the protected DB mutation.
- `retire_entity`: permanently tombstone the identity, fencing stale workers.

**Never accept these function parameters directly from the browser.**
They are inputs to a trusted service-side transaction after credential,
character ownership, worker identity, item/zone/physics and permission checks.
Default schema/table and function grants are revoked from PUBLIC. Authority
functions use `SECURITY DEFINER` with an explicit fixed `search_path`; a
restricted server role can receive only schema USAGE + function EXECUTE,
without direct authority table DML. The acceptance test verifies this denial.
For production, the migration's function owner must be a dedicated NOLOGIN
role with minimum necessary privileges rather than a superuser. A later
deployment must establish narrowly scoped service roles, TLS, secret rotation,
connection restrictions, audit trails and role ownership verification.

The entity IDs are opaque 16-byte identifiers. Before Rust integration,
define one canonical serialization convention for `CharacterId`/item IDs,
including byte order, and prove Rust-to-SQL round trips. The SQL
`bigint` worker, zone and epoch fields limit IDs to positive signed 63-bit
values, whereas earlier Rust types allow nonzero unsigned 64-bit values;
an integration adapter must check those bounds and reject overflow.

## Test setup and evidence

`.github/workflows/core-c4c-postgres.yml` runs a disposable PostgreSQL 16
service, installs/uses `psql`, applies the migration to a test-only database
and runs `scripts/verify_zone_authority_postgres.py` with Python standard
library tools (independent `psql` client processes).

The acceptance scenarios cover:

1. Register, prepare, exact prepare retry and one durable epoch increment.
2. Pending state freezes old and prospective owners.
3. Conflicting transaction ID and competing operation denial.
4. Retry of committed ACK does not consume another epoch.
5. Delayed abort/commit cannot roll back later ownership.
6. Abort and old operation-ID replay fail closed; a fresh transfer can commit.
7. Retirement preserves an entity tombstone.
8. Two independently connected concurrent clients racing to prepare one
   entity yield exactly one winner.
9. `assert_mutation_authority` holds a database row lock within a transaction:
   another client with a short lock timeout cannot prepare until commit.
10. A restricted database service role may call vetted authority functions
    but cannot SELECT/UPDATE the authority tables directly.

This is **one PostgreSQL primary shared by independent connections**. It is
not a two-host network test, multi-primary transaction proof, replication
failover test, physically disconnected WAN acceptance, or proof that the
actual world update is atomically committed with ownership.

## Security and lifecycle blockers

- **Real authenticated network adapter:** worker identity and gameplay
  sessions must be verified and bound to an allowed zone before any SQL call.
- **Atomic world/entity/outbox commit:** authority and authoritative character,
  inventory, item, corpse and economic state must be updated atomically.
  In-memory game changes following a SQL check are NOT fenced by the DB.
- **Failover model:** only a synchronous/durability-reviewed PostgreSQL
  primary may authorize writes; async replica lag, split brain, stale reads,
  and unknown commit outcomes must never activate two owners.
- **Transaction discipline:** every mutation must hold a row lock in the
  *same DB transaction*. A separate read-only `is_current` check is not
  sufficient.
- **Crash/retry acceptance:** SIGKILL and network blackholes during
  prepare/commit/ACK, server restart, primary failover, delayed messages,
  and replay after backup restore need production-like qualification.
- **Scale:** dead operation history is intentionally unbounded. Plan safe
  retention, snapshot/compaction, partitioning, indexes, bounded retry
  windows and monitoring without permitting ID reuse or resurrection.
- **Mapping:** physical ground items, inventory, player combat state,
  snapshot/interest replication, zone manifests and portal lifecycle are
  not wired to these routines.
- **Migration safety:** the reference schema has no deployment grants,
  database credentials or production DDL execution, and no production
  database is created by the project branch.

The test's PostgreSQL password is an ephemeral literal for GitHub Actions
only; it is not a production secret.

## Next phases

C4d: implement a trusted async game-server database adapter and an atomic
world-update/outbox transactional boundary; run end-to-end reconnection
and multi-process tests against a controlled database.

C4e: independent VPS/VM tests over actual network isolation, primary
failover/restore drills, snapshot correctness, latency/throughput
measurements, staging and rollback plans.

This PR remains draft until the exact-head PostgreSQL acceptance workflow
and full repository quality CI succeed and the Moon Games Development Center
reviews integration order. **No changes to main or production are authorized.**
