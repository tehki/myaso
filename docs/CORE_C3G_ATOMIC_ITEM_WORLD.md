# Core 8B C3g — one-item + world-state fenced PostgreSQL transaction

This is an **isolated, dormant transaction acceptance prototype** built upon
Core 8C [C4d #393](https://github.com/tehki/myaso/pull/393) and its PostgreSQL
C4c migration. It is NOT production gameplay, player authentication, or an
authorized distributed inventory service.

## Exact dependency and atomic boundary

Required migrations, in **one primary PostgreSQL database**:

1. `server/sql/001_zone_authority_postgres.sql`: C4c authority rows and
   handoff fencing, acquired `FOR UPDATE`.
2. `server/sql/002_fenced_world_mutations.sql`: C4d `commit_world_mutation`,
   immutable world receipt, world revision and globally ordered world outbox.
3. `server/sql/003_atomic_item_world_mutations.sql`: C3g's *single-item*
   ownership state, item-specific immutable receipts and item delta companion
   outbox rows referencing the **same C4d global outbox sequence**.

`commit_item_world_mutation` accepts **two distinct** 16-byte ids: the C3g
item operation id and C4d world mutation id. They may not be reused or
interchanged. For a new request, the function:

- Validates IDs, bounded operation kinds, optimistic item and world revision,
  and the proposed canonical 26-byte C3f location encoding.
- Inserts/locks an immutable **complete item request** and rejects any
  conflicting replay; a completed identical retry returns only its **historical
  result**, without authorizing a new live action.
- Calls C4d `commit_world_mutation` **inside the same outer PostgreSQL
  transaction**. This locks the C4c authority row also locked by handoffs,
  and rejects frozen/retired/stale workers, conflicting world revisions and
  reused C4d mutation IDs. A replay of a prior **world-only** receipt may not
  authorize any fresh item action.
- Applies exactly **one** item create, move or destroy against the expected
  current location and revision, with row locking on updates. Destroyed IDs
  remain as permanently retired tombstones; a later create using the same
  item ID fails. An updated item's revision is monotone.
- Inserts one `item_world_outbox` row linked to C4d's world outbox event
  sequence and stores the final item-world result receipt. Any SQL error
  rolls back **all** item/world/receipt/outbox effects, because they share
  the same PostgreSQL transaction and primary.

The intended lock order is item-operation receipt, C4d world receipt, C4c
authority entity row, then item row. This proof handles **exactly one item
per transaction**; it makes **no claim** to atomic death loot of multiple
items, competing accounts or currency/property settlement.

## Canonical byte layouts

The SQL validates the **proposed**, reviewed-in-parallel [C3f #417]
(https://github.com/tehki/myaso/pull/417) format:

- Item, world, operation and character IDs: 16-byte **big-endian**, nonzero.
- Location: **26 bytes**. Tag 1 inventory, 2 equipped (slot byte 17),
  3 corpse, 4 ground (8-byte BE zone, two signed BE i32 coordinates).
  Unused fields must be **zero**. See `server/src/item_pg_codec.rs` in
  the C3f PR, which has not been merged into this C4d-based branch.

This SQL proposal must be reviewed/versioned by 8C before migration into
production. It must NOT reinterpret the C3b local MYTX little-endian format
as the proposed PostgreSQL format. There is no C3b file-journal migration
here; do not run both stores as independent live authorities.

## Acceptance

`.github/workflows/core-c3g-item-world.yml` provisions a disposable
PostgreSQL 16 primary and runs the three migrations and
`scripts/verify_atomic_item_world_pg.py`:

- One item creation advances world + item revisions and emits linked
  globally ordered events; exact lost-ACK retry is idempotent.
- Reuse of item/world operation IDs with conflicting payloads is rejected.
- Wrong item or world revision, wrong old location, noncanonical padding,
  illegal resurrection of destroyed item ID all roll back completely.
- Preparing/committing authority handoff freezes old worker; the new
  worker/epoch may commit on the same durable primary.
- Two independent `psql` clients competing at one revision produce one
  winner and no phantom receipts/outbox events.
- An explicit outer `ROLLBACK` leaves no item/world/receipts/outbox data.
- Real OS kill of a client with uncommitted changes leaves no partial writes;
  the identical request may be retried by a new client.
- Restricted test-only role can execute selected SECURITY DEFINER functions
  but cannot directly mutate/read underlying state tables.

The existing C4d `verify_fenced_world_mutations.py` acceptance and exact-head
full `quality` checks must also pass. Running the script against anything
other than `MYASO_C3G_TEST_ONLY=1 PGDATABASE=myaso_c3g_test` is prohibited.

## Mandatory blockers and explicit non-goals

- **No verified worker or player credentials**: C4d's existing Rust verifier
  is a test-only stub. Never expose the SECURITY DEFINER function to an
  untrusted client or generic application role. DB role EXECUTE privilege
  alone is not a trustworthy gameplay identity or permission check.
- **No game admission, loot rights, actor/item association or range checks**:
  source-location CAS is NOT sufficient to authorize PvP loot, inventories,
  trades, property transactions, corpse access, equipment rules or currency.
  Real callers must validate identities and permissions on a trusted server.
- **No cross-host availability guarantee**: requires a single fail-closed,
  durable PostgreSQL primary. No partitions, replicas, promotions, credentials,
  TLS, backup restore, schema upgrade or network failure acceptance here.
- **No 60 Hz blocking calls**: the SQL proof has no async driver, bounded queue,
  fairness, batching, backpressure or latency budget.
- **No multi-item batch atomicity**: death and mass loot require deterministic
  locking over every affected entity, every item and economic row in a *single*
  transaction, with one complete immutable request receipt and outbox group.
- **No outbox publisher/ack consumer**: C3g item deltas must be joined by
  outbox sequence with C4d world events; neither delivery nor replay/offsets
  are implemented.
- **No magical live use of local journal**: the C3e flock protects only
  cooperating processes on a trusted local Unix filesystem. It is not a
  distributed item store and must not run alongside this DB as a co-equal
  writer.
- **No real-money Moon Coin**: sandbox-only accounting and simulations until
  separately authorized, audited and integrated.

Keep this PR draft against C4d, not `main`. The Moon Games Development Center
[#360](https://github.com/tehki/myaso/issues/360) coordinates prerequisite
reviews with 8C, Magic & Items, Economics and World departments. No
production deployment, merge, process restart or live gameplay activation.
