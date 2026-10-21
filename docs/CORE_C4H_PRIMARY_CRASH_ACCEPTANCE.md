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
idle-in-transaction. This demonstrates those in-flight statements executed
but did not commit before the PostgreSQL process was killed.

## Post-crash concurrent fencing

After the same primary process restarts and completes its seven recovery
checks, two independently connected PostgreSQL clients are released through
a Python thread barrier at the same time. This tests **database transactional
serialization**, not synthetic sequential authorization.

- **Character 78:** both callers hold the same worker, authority epoch
  and expected revision zero, but different immutable mutation IDs.
  Exactly one wins revision one. The loser must fail the revision CAS
  and leave **no receipt or outbox**; winner replay is historical-only.
- **Character 79:** after one durable ownership transfer to worker 2 at
  epoch 2, retired worker 1 and new owner 2 race with the same expected
  revision zero. Only worker 2 may commit. The old source cannot leave
  any receipt or outbox, even when retried after the valid commit.

Additional post-restart races exercise the handoff boundary:
- **Character 80:** different handoff operation IDs target different workers
  from the same epoch. Exactly one transfer may become prepared; the other
  operation must fail as stale, with no leaked row or authority grant.
- **Character 81:** a source world mutation and distinct handoff prepare
  race. The mutation may commit *before* the freeze or be rejected *after*
  it; its receipt and outbox must match that committed outcome atomically.
  After commit of the transfer, only the successor can write.
- **Character 82 (forced FK lock interleaving):** two disposable SQL
  transactions explicitly insert separate uncommitted handoff rows, each
  taking a foreign-key KEY SHARE on the same parent entity. Each session
  is proven `idle in transaction` via a unique last-SQL marker. They are
  then simultaneously released to call the real `prepare_transfer` function.
  This forces overlapping FK locks before the function's row-lock request,
  rather than depending on timing chance. One must prepare; the other
  must fail stale, **not deadlock**. The staged loser transaction must
  roll back its provisional handoff row.

Two additional **same-operation-ID acknowledgment replay** races cover
cases that differ from the competing-ID tests:

- **Character 83:** two independent SQL clients concurrently submit the
  *same immutable world mutation ID*, expected revision, worker/epoch and
  payload after database restart. Exactly one receives a fresh receipt,
  the other a historical replay with the same sequence. The database
  retains one state revision, one receipt and one outbox event; a later
  attempt to change the payload under the same ID is rejected.
- **Character 84:** two clients concurrently submit an identical handoff
  prepare ID and both receive a durable prepared acknowledgment. Two
  clients then concurrently commit that same transfer ID; both receive
  the same epoch 2, and exactly one owner transition persists. Reusing
  the original operation ID with conflicting target data must fail.

These are **seven post-restart contention/replay cases**, not seven separate
primary crashes. All contenders use distinct real `psql` connections to
one disposable primary. Character 82's direct DML is **test-only staging**
of a held FK row lock; the authority grant still happens strictly through
the original `prepare_transfer` stored function.

The added same-ID concurrency acceptance passed in dedicated exact-code
[C4h run #39527147376](https://github.com/tehki/myaso/actions/runs/39527147376).
Companion C4c, C4d and C4g database acceptance workflows passed on that
same code head.

## C4d concurrency deadlock correction (review required)

The first live two-client test failed on the original C4d implementation
with a **real PostgreSQL deadlock**. Both distinct mutation IDs insert a
receipt referencing the entity. Its foreign-key check takes a KEY SHARE
lock on that same entity. Two concurrent callers can each hold KEY SHARE,
then try to promote their own lock to FOR UPDATE, producing a cycle.
The failed CI log showed one process waiting on the other while both
were locking a tuple in `core_zone.entities`.

The narrow `002_fenced_world_mutations.sql` correction changes only the
authority entity-row SELECT in `commit_world_mutation` to
`FOR NO KEY UPDATE`. It is compatible with the preexisting foreign-key
KEY SHARE locks but mutually excludes other NO KEY UPDATE or UPDATE
writers. The authoritative owner, epoch and revision are **still checked
inside the same SQL transaction and under a conflicting writer lock**.
The primary key is never changed by this operation. Neither the mutation
inputs/results nor receipt/outbox schema are changed.

## C4c prepare-transfer FK deadlock correction (review required)

A subsequent real concurrent-handoff test failed in [C4h #39524569708]
(https://github.com/tehki/myaso/actions/runs/39524569708):
different `prepare_transfer` operation IDs each inserted a handoff row
referring to the same entity. Both FK checks acquired KEY SHARE locks,
then both attempted `FOR UPDATE` of the parent. PostgreSQL reported
a reciprocal transaction deadlock **inside `prepare_transfer`**, not
an ordinary stale-authority denial.

The narrow `001_zone_authority_postgres.sql` correction changes only
the parent authority-row SELECT inside `prepare_transfer` to
`FOR NO KEY UPDATE`. This lock is compatible with the held FK KEY SHARE
but conflicts with other writers, including the `FOR NO KEY UPDATE`
world-mutation lock, handoff updates, and retirement. The operation ID
and parent-entity locking, owner/zone/epoch checks, pending freeze,
strict one-operation rule and returned phases are unchanged. Neither
the entity primary key nor handoff primary key is changed by the
operation.

[Corrected dedicated CI #39524676290]
(https://github.com/tehki/myaso/actions/runs/39524676290) PASSED all
seven primary-crash scenarios and the five post-restart races, including
forced two-FK lock contention. Same-code C4c, C4d and C4g PostgreSQL
acceptance also passed.

These SQL files are reference migrations, **not automatic upgrades** of
any already-running database. Existing deployments would need an
explicitly approved controlled stored-function replacement. Other
8B inventory and downstream SQL lock paths require further audit;
these regressions do not establish global deadlock freedom.

Regression evidence: initial exact-head C4h [run #39518862247]
(https://github.com/tehki/myaso/actions/runs/39518862247) exposed the
deadlock. Corrected exact-head [run #39519078738]
(https://github.com/tehki/myaso/actions/runs/39519078738) passes both
post-crash real-client races, and separately the C4d world mutation and
C4g client-crash workflows pass on the same head.

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
