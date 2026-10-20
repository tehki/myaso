# Core 8B C3i — atomic two-item equipped-slot swap

**Status: DORMANT PostgreSQL proof, not live gameplay.** Stacked on
[C3h #439](https://github.com/tehki/myaso/pull/439), ultimately dependent
on [Core 8C C4d #393](https://github.com/tehki/myaso/pull/393).
Requires disposable PostgreSQL 16, C4c (001), C4d (002), C3g/C3h (003),
then C3i (004) migration **on the same primary**.

## Why two-item swaps need an atomic transaction

C3g supports only one item CAS and world mutation per transaction. C3h
ensures `(equipped character ID, slot)` uniqueness globally with an
**immediate** unique index. Independently moving item A from equipped
slot 3 to currently occupied slot 4 cannot succeed; temporarily moving it
away and committing would expose a half-completed swap. Core C3i
supports a **bounded, exactly-two-item** operation instead.

## Atomic protocol

`commit_two_item_equipment_swap`:

1. Rejects zero/invalid IDs, noncanonical ordering (`item_a < item_b` is
   required), invalid source revisions, invalid C3f 26-byte canonical
   equipment locations, mixed character IDs or equal slots.
2. Inserts/locks a **full immutable request** keyed by operation ID,
   rejects conflicting retries and returns exact historical receipts for
   completed identical retries. A historical result never grants fresh
   authority. A separate C4d world mutation ID must be supplied.
3. Calls C4d's `commit_world_mutation` **in the same SQL transaction**;
   C4d serializes the character's owner worker/zone/epoch handoff fence,
   checks world revision and emits exactly one world outbox event.
4. Locks the **two item rows in canonical ascending ID order** and checks
   expected current locations/revisions and no retired IDs.
5. Moves both rows into the same character's canonical inventory location
   **inside the uncommitted transaction**; that releases both equipment
   unique-index entries. Then writes their **swapped** equipment locations
   and increments both item revisions once. Other transactions cannot
   observe this staged state, and the outer database rollback restores
   the original occupied slots.
6. Inserts **two** `item_swap_outbox` deltas referencing the **same C4d
   world-event sequence**, then finalizes one immutable C3i receipt.
   Any SQL error undoes all item updates, world version, all receipts and
   all outbox effects as one database transaction.

No new independent zone authority is invented. No application/worker
credentials are accepted by this function. The existing C3h partial unique
index remains active and unweakened.

## Acceptance

`.github/workflows/core-c3i-equipment-swap.yml` uses an explicitly gated
**disposable PostgreSQL 16 primary** (`PGDATABASE=myaso_c3i_test`,
`MYASO_C3I_TEST_ONLY=1`). The script covers:

- Two equipped items with different slots swap as **one** world and **two**
  item updates, with two companion outbox rows.
- Exact ACK-loss retry returns the same immutable receipt and does not
  duplicate outbox records; changed-payload, wrong-revision, or reversed
  item ordering fails closed.
- A pre-existing C4d world-only receipt cannot be used to claim an item
  swap, including an exact world-request replay.
- One character cannot mutate the occupied equipment slots of another
  through the swap contract.
- Prepared handoff freezes the old worker; after commit only the new
  worker/zone/epoch may swap.
- Independent PostgreSQL clients racing the same swap produce **one**
  winner with both items moved; loser leaves no world/item receipts/outbox.
- A separate client killed with SIGKILL before the outer COMMIT leaves
  **neither item swapped**, no world revision/outbox, and permits retry.
- Restricted database test role cannot directly read or forge state,
  receipts or outbox, although it can invoke the trusted definer function
  in the isolated test.

**Full protected `quality` CI** remains a separate gate.

## Explicit non-goals / safety boundaries

- Only **two already-equipped items belonging to the same character**.
  Not arbitrary corpse loot, ground pickup, player-to-player trade, multi-
  entity combat death, economy or future Moon Coin settlement. Such
  operations need a larger serializable protocol with authorization,
  deterministic cross-entity locks and a shared request receipt.
- C3i's operation IDs are currently unique *within C3i receipts*, not
  globally reserved across all prototype item operation types. The
  C4d world-mutation ID is globally unique. Before production unify
  the operation-ID namespace and independently verify all actor/worker
  claims; merely possessing a receipt identifier is not authorization.
- The C3f proposed 26-byte location representation must be versioned and
  approved with 8C. The C3b local MYTX little-endian file journal must
  not act as a co-equal writer to PostgreSQL or be copied as SQL bytes.
- No outbox consumer/ACK, fully durable broker, DB failover/partition test,
  verified session authority, item provenance, loot/equipment permissions,
  migration/backup validation or 60Hz-safe async adapter exists.
- No production deployment, live economy, active game inventory, main
  merge, server restart or CI bypass is authorized. Department 8B hands
  PR review to [Development Center #360](https://github.com/tehki/myaso/issues/360)
  and coordinates with Core 8C, Magic & Items, Economics and Combat.
