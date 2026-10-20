# Core 8C C4g — PostgreSQL client-crash and durable handoff acceptance

**Status:** dormant, disposable single-primary acceptance only. Stacked on
C4f PR #413, C4e #404, C4d #393 and their earlier authority dependencies.
**No production PostgreSQL, server process or user session is killed.**

## Why

The C4c/C4d acceptance tests cover concurrent rows, fenced stale workers,
idempotency and atomic state/outbox writes under normal client execution.
C4g now forces a **database client process** to terminate while PostgreSQL
has executed a prepared handoff or world mutation, but has not committed.

This is explicitly **not** a PostgreSQL primary crash, OS panic, WAL-durability
test, network partition or HA/failover qualification. It is scoped to
transaction rollback when a client connection disappears.

## Exact failure scenarios

`scripts/verify_zone_crash_recovery.py` runs against one isolated
PostgreSQL 16 service from `.github/workflows/core-c4g-session-crash.yml`.

1. Register a fresh character at epoch 1. Run `prepare_transfer` inside
   `BEGIN` and then leave its transaction open **without COMMIT**. Confirm from
   `pg_stat_activity` the backend is `idle in transaction` after the write.
   Kill **only that spawned `psql` client**. Verify the invisible insert
   and freeze rolled back; source still owns epoch 1; identical operation
   can be retried and committed once to epoch 2; the old worker is fenced.
2. Prepare a second character in an autocommitted call, disconnect that
   client, and verify that **both workers stay frozen**. A fresh client
   can only resolve it with an explicit, authorized abort; the source
   resumes at the same epoch; the old operation ID cannot be reused;
   a separate operation can hand off to a third worker.
3. Execute `commit_world_mutation` in `BEGIN`, leave the transaction open after the mutation, then terminate
   the waiting `psql` client before COMMIT.
   The uncommitted state, receipt and outbox all roll back. Repeating
   the exact mutation ID commits once, then returns its unchanged
   historical receipt and does not duplicate outbox events.

## Safety constraints

- The test refuses to run unless `MYASO_C4G_TEST_ONLY=1`,
  `PGDATABASE=myaso_c4g_test`, `PGUSER=myaso_c4g_test` and `PGHOST`
  equals `127.0.0.1` or `localhost`.
- Each CI invocation provisions a temporary PostgreSQL 16 database.
  No game, prod VPS, remote server, production secret or worker is
  targeted. It uses fixed test IDs and synthetic tiny world payloads.
- The only deliberate SIGKILL is to a `Popen` child `psql`
  process that this script created. Its PostgreSQL backend is not killed.
- Backends are distinguished by the last SQL marker and
  `pg_stat_activity.state='idle in transaction'`, not by an
  unbounded timing guess or a long-running server-side sleep. Child processes are reaped in `finally`.
- No synchronous database round trip is added to the 60 Hz game tick.
- Core 8A/8B must still supply genuine session authentication, Core 8C must
  prove independent-host partition/failover behavior, and Development Center
  must review all exact-head full `quality` acceptance.

## Explicitly out of scope

- A real PostgreSQL service SIGKILL, client/server independent network
  partition or promotion of asynchronous replica.
- Filesystem WAL fsync, disk-full behavior, restore or failover convergence.
- Unknown-commit-outcome across a lost network ACK (C4d already checks
  identical post-commit receipt replay; C4g demonstrates precommit death).
- Durable outbox publication to clients, bounded replication backpressure,
  game-world snapshot handoff and live combat integration.

This evidence supports a small part of crash recovery only. **Do not
merge or activate world authority based on C4g alone.**
