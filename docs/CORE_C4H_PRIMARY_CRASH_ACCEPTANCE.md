# Core 8C C4h — isolated PostgreSQL primary SIGKILL recovery

**DORMANT, TEST-ONLY.** Stacked on C4g #416 and the previous
identity, zone lease and durable authority milestones. This changes no
network, simulation or gameplay code and never touches production.

## Purpose

C4g proves that terminating a PostgreSQL **client** rolls back its
uncommitted transaction and that a lost ACK can be replayed safely.
C4h tests a different failure: **the PostgreSQL 16 primary process itself
is SIGKILLed** in a disposable GitHub Actions service container and then
the same container/data directory is restarted.

The script validates ALL the following before Docker control: GitHub
Actions CI identity, explicit C4h opt-in, localhost port 5432, exact
disposable myaso_c4h_test DB/user, the exact service container ID supplied
by the workflow, postgres:16 image, matching test-only environment,
fsync enabled and synchronous commits enabled.

The only destructive action is Docker SIGKILL against that validated
CI service container, then start on the same ID. No host process,
unrelated container, remote database, live VPS or game player is targeted.

## Crash barrier and scenarios

1. **Committed owner/epoch, state, outbox and receipts.** Character 71
   commits revision one, transfers from worker 1 to worker 2 at epoch 2,
   commits revision two and two outbox events. All must survive primary
   restart. Historical retries must return receipts without duplicate
   mutation events or restoring the previous owner.
2. **Committed prepare but unresolved handoff.** Character 72 has a
   durable pending transfer when the DB dies. After restart both source
   and target remain frozen until an explicit abort or commit. Aborting
   must restore the original source epoch; reusing the aborted operation
   ID must fail; a fresh handoff ID can advance once.
3. **Uncommitted world mutation.** Character 73 has an open transaction
   that has executed a world update but not committed. Post-crash, no
   mutation receipt, state revision or outbox event may survive. A retry
   then commits one revision and returns a stable historical receipt.
4. **Uncommitted prepare/freeze.** Character 74 has an open transaction
   that prepared a transfer without committing. Post-crash, there can
   be no recorded handoff or frozen authority. A safe retry commits the
   transfer once and fences the old worker.
5. **Uncommitted transfer commit.** Character 75 has an existing durable
   prepared handoff. A separate connection executes commit_transfer but
   does not COMMIT its SQL transaction. After primary SIGKILL/restart,
   the handoff must still be prepared and both workers frozen; a fresh
   coordinator can commit it exactly once to epoch 2.
6. **Uncommitted entity retirement.** Character 76 has an open
   retirement transaction. On primary restart, it must remain living
   and writable by its original owner. A later committed retirement
   permanently tombstones the identity, forbidding re-registration.
7. **Uncommitted transfer abort.** Character 77 has a durable prepared
   transfer and an in-flight abort that did not COMMIT. After restart
   the handoff must remain prepared/frozen; exact abort retry restores
   the source at epoch 1 with no operation ID reuse.

For all five independent open transactions, the test observes distinct
last-statement markers in the database's pg_stat_activity with state
idle-in-transaction.
This proves that each transaction executed but had not committed before
PostgreSQL is killed; there is no fixed-delay guess.

## Explicit production blockers and failure limits

Evidence is limited to one containerized PostgreSQL primary with fsync
and synchronous commits enabled, restarted on its existing disk volume.
It does **not** establish host power-loss durability, real disk/media
fault tolerance, replica promotion, failover, multi-primary consensus,
WAN network partitions, split-brain safety or cryptographic worker
authentication. It does not migrate the live game, add a DB driver,
change the 60 Hz loop, or dispatch persistent outbox events to clients.

All exact-head CI tests and ancestor authority PRs remain strict gates.
Native Chrome/Firefox Combat acceptance is never weakened. The central
Development Center controls sequential integration and deployment.

**No merge, production restart or migration is authorized by C4h.**
