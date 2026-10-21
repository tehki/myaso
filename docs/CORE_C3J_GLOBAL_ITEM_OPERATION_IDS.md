# Core C3j — immutable global item operation-ID namespace

**Department 8B · DORMANT transaction hardening.** Stacked on
[Core C3i PR #447](https://github.com/tehki/myaso/pull/447), which is
stacked on C3h #439 → C3g #434 → Core 8C C4d #393. No production
migration, client interface, real gameplay or Moon Coin is enabled.

## Problem

C3g has a unique item-operation receipt ID **within**
`core_zone.item_world_receipts`. C3i has the same property **within**
`core_zone.item_swap_receipts`. Nothing prevented one opaque
`operation_id` being committed simultaneously by *both* protocol
families. Independent world receipts would not catch this: each family
has its **own separate** C4d world-mutation ID.

To extend to corpse loot/trade/death batches, operation IDs need a common
durable namespace that does not depend on a particular mutation family.

## New fail-closed transaction boundary

Migration `005_global_item_operation_ids.sql`:

1. In **one PostgreSQL transaction**, acquires write-blocking locks on
   both existing immutable receipt tables.
2. Creates `core_zone.item_operation_ids (operation_id BYTEA[16]
   PRIMARY KEY, operation_family)`, reserving kind 1 = single-item C3g
   and kind 2 = two-item C3i. These reservations are historical
   tombstones and cannot be recycled after item retirement.
3. Backfills committed receipts while the locks are held. Any
   cross-family duplicate operation ID raises and **aborts the entire
   migration**; the upgrade never silently assigns ownership to one.
4. Attaches `BEFORE INSERT` row triggers to *both* receipt tables.
   The `SECURITY DEFINER` trigger function performs a transactional
   `INSERT ... ON CONFLICT DO NOTHING` into the **same global registry**,
   then locks the registry row `FOR UPDATE`. If its protocol family
   differs from the calling receipt table it raises a conflict.
   The lock spans receipt creation, world mutation, item updates,
   result finalization and the outer transaction COMMIT/ROLLBACK.
5. Exact same-family retries remain legitimate. If a client loses its
   acknowledgement, the original family receipt supplies the
   immutable result. A conflicting cross-family attempt can never
   create its own committed receipt, world event, or item delta.
6. All registry entries and trigger execution are closed to PUBLIC;
   only trusted schema owners can modify the table. A test-only
   restricted role is denied direct table read/write/delete.

The authority checks, C3h unique equipment slots and C3i sorted
item locks are **not altered or bypassed**.

## Disposable PostgreSQL acceptance

`.github/workflows/core-c3j-global-item-ids.yml` uses an isolated
PostgreSQL 16 primary with explicit test-only environment
`PGDATABASE=myaso_c3j_test` and `MYASO_C3J_TEST_ONLY=1`:

- Installs baseline migrations 001–004 and commits **actual C3g and C3i
  receipts before migration**, then migrates 005 and verifies backfilled
  families and historical exact-ACK-loss replay.
- Checks both collision directions: C3g ID reused by C3i swap, and
  C3i swap ID reused by C3g item allocation. Both fail without any
  phantom world, item, receipt, or outbox mutation.
- Proves a rolled-back registry reservation leaves no tombstone;
  the same ID may subsequently be committed by another protocol.
- Starts two **independent PostgreSQL clients**, one C3g single-item
  create and one C3i two-item swap against independent authoritative
  world rows using the **same item operation ID**. Exactly one
  protocol may commit; the other fully rolls back.
- Proves restricted DB roles cannot forge or remove reservations.

Existing C3g/C3h/C3i dedicated PostgreSQL acceptance and full exact-head
protected `quality` CI remain mandatory.

## Explicit limits

- **Not a global identity across all of C4d.** The new registry
  intentionally covers the **two currently implemented item operation
  protocols**. The separate 8C C4d world-mutation IDs are already
  unique within C4d. Unifying item and world ID *domains* with other
  forthcoming multi-item protocols needs 8B/8C schema review.
- No authenticated actor/worker verifier, loot/equip rights, provenance,
  multi-item corpse death/drop/trading transaction, economics/currency
  settlement, reliable outbox publisher or ACK consumer, distributed DB
  failover, production DB migration strategy, local MYTX journal cutover,
  or 60 Hz-safe asynchronous runtime exists.
- The canonical 26-byte ownership-location SQL format remains the
  **proposed** contract in C3f #417 and needs version/migration review.
- SECURITY DEFINER database access must never be granted directly to
  untrusted users. A receipt ID is **not authorization**.
- One trusted PostgreSQL primary is assumed. A successful isolated
  acceptance run must not be interpreted as a live deployment.
- Do not weaken protected combat/Firefox browser tests or merge to
  `main` without Development Center review.

Coordinate integration via
[Moon Games Development Center #360](https://github.com/tehki/myaso/issues/360).
