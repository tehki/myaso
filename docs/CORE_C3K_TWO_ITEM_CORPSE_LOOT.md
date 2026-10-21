# Core 8B C3k — one-corpse, two-item atomic transfer prototype

**DORMANT persistence acceptance only**; not live loot, permission to
loot other players' corpses, or production-ready combat inventory.

This draft is stacked directly on [C3j #452](https://github.com/tehki/myaso/pull/452),
then C3i #447 → C3h #439 → C3g #434 → Core 8C C4d #393. Migration 006
requires all of migrations 001–005 on the **same PostgreSQL primary**.

## Strict transaction boundary

`core_zone.commit_two_item_corpse_loot` accepts:

- One globally unique item operation ID, one distinct C4d world-mutation
  ID, and **one requesting character world entity**;
- One nonzero corpse ID and **exactly two different item IDs in ascending
  canonical 16-byte order**, each with a positive expected revision;
- Expected C4d world revision, trusted worker/zone/epoch **values as
  arguments** (not actual verified credentials), and one bounded world
  payload.

A transaction succeeds only when:

1. The C3j global registry reserves the item operation ID for **family 3**
   within the same transaction as the immutable C3k request/receipt. C3g
   family 1 and C3i family 2 cannot reuse it; committed registry rows are
   permanent historical tombstones.
2. C4d `commit_world_mutation` verifies the exact worker, zone, epoch,
   frozen/retired state and expected world revision, taking **the same C4c
   owner row lock as handoff**. It prepares one immutable world receipt and
   one world outbox event in the same PostgreSQL transaction.
3. Both existing, nonretired item rows are locked in **ascending item ID
   order**. Each row must still belong to **the same canonical C3f corpse
   location** and have the exact expected positive revision. A changed,
   missing, already-looted or destroyed item rejects the **entire batch**.
4. Both item locations change to the **single requesting character's
   canonical inventory location**; both item revisions increase once.
   Two item delta outbox rows reference the **same** C4d world outbox
   sequence and one complete C3k receipt becomes immutable.
5. Any SQL error, competing winner, client crash before outer COMMIT, or
   conflicting idempotency retry rolls back **both** item changes, world
   revision, C4d receipt, C3k receipt, outbox rows and uncommitted registry
   reservation. Lost-ACK identical retries return the historical receipt
   without authorizing new gameplay.

The migration `006_two_item_corpse_loot.sql` changes C3j's global
`operation_family` CHECK from (1,2) to (1,2,3), and safely replaces
the existing registry trigger function to recognize the third receipt
table; old C3g and C3i trigger behavior is preserved.

## Isolated PostgreSQL acceptance

`.github/workflows/core-c3k-corpse-loot.yml` provisions a fresh
PostgreSQL 16 primary and runs `verify_two_item_corpse_loot_pg.py`,
requiring `PGDATABASE=myaso_c3k_test` and
`MYASO_C3K_TEST_ONLY=1`:

- Two items at one corpse atomically move to the requesting inventory,
  produce **one** world outbox event plus **two** item deltas.
- Exact receipt replay, changed payload, stale source revisions and
  partial pre-looting are rejected without duplicate events.
- Prepared handoff freezes the old authority, and a new worker epoch
  can complete the batch; the old worker cannot.
- Old world-only receipt cannot authorize a fresh corpse batch.
  Existing C3g/C3i item operation IDs cannot become family-3 receipts.
- Two independent SQL clients using different valid character authority
  rows racing for the *same two corpse items* yield one complete
  winner, never a split item batch.
- A client **SIGKILL before outer COMMIT** restores both source items,
  world revision, receipts, outbox and uncommitted family-3 registry ID.
- Restricted test role cannot read or forge SQL receipts/outbox/ID registry.

The test does not execute production game logic or use real player
credentials. Full protected exact-head `quality` is additionally
mandatory.

## Material blockers before live corpse looting

- **No authenticated character-to-player proof** or real worker
  credential verification. C4d accepts raw worker/zone/epoch arguments
  into a SECURITY DEFINER SQL function. If an untrusted caller gets
  EXECUTE privileges it may impersonate an authority. Never grant this
  function directly to web clients or broad roles.
- **No corpse access rights, distance checks, ownership, death ticket
  validation, cooldowns, anti-cheat or loot distribution policy.**
  Source-location CAS alone proves an item was at a corpse, **not** that
  the requesting character may loot it.
- **Not arbitrary large looting:** this is precisely a two-item proof.
  Multi-entity combat/death, cross-character trades, multiple items or
  currencies require a further bounded batching protocol, deterministic
  lock order and a globally stable complete request receipt.
- Item provenance and C3a/C3b local journal migration to the PostgreSQL
  ownership authority are not implemented. Local MYTX and the C4d
  PostgreSQL database must never be used as co-equal live writers.
- The C3f proposed 26-byte big-endian location layout still requires
  explicit 8B/8C schema-version and deployment review.
- No outbox consumer/ACKs, 60 Hz-safe asynchronous adapter, network
  partition/failover testing, production schema grants/TLS/backups,
  hot-path budgets, real wallet/MOCMP settlement or live game rollout.

Do not merge, deploy, restart servers, activate live corpse looting or
weaken any protected browser/combat quality checks. Handoff coordination:
[Moon Games Development Center #360](https://github.com/tehki/myaso/issues/360),
Core 8C, Magic & Items, Combat, Economics and World & Gameplay.
