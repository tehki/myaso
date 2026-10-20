# Core C3a — atomic item ownership invariants (dormant)

Stack base: Core C2a [PR #365](https://github.com/tehki/myaso/pull/365).
Independent of C2b durable identity and C2c login recovery.

## Motivation

myaso.io will support physical inventory and **full-loot PvP**. On death,
equipped and carried items must become lootable, usually inside an inspectable
corpse, while selected items scatter as ground entities. Two simultaneous
looters must never obtain the same object; equipment slots must never contain
two items; retrying a timed-out loot action must not duplicate loot.

`server/src/item_ownership.rs` introduces an **inactive in-memory reference
state machine** for transaction semantics. It is not the game's actual
persistent item database or its multiplayer production API.

## Location and transaction model

- Stable nonzero `ItemId`, `OwnershipTxnId`, `CorpseId`, `ZoneId`.
- Each item has exactly **one** location: character inventory, character
  equipment slot, corpse, or ground (zone + deterministic integer coordinates).
- Every `Move` or `Destroy` states the **expected current location**.
  Unknown items and stale expected locations are rejected.
- A transaction is a bounded batch (maximum **1024** item operations) of
  `Create`, `Move`, or `Destroy`. All item preconditions and equipment-slot
  occupancy checks run **before** the first mutation.
- No transaction may mention the same item twice.
- Equipment slot uniqueness is enforced with an index. Atomic swaps from
  occupied equipment to inventory and vice versa are permitted within a batch.
- All valid operations publish as a single in-memory transaction and return a
  monotonic sequence receipt.
- Retrying a **byte-for-byte-equivalent semantic operation batch** under the
  same transaction ID returns the original receipt and makes **zero** changes.
  Reusing that ID with different operations fails with `ConflictingReplay`.
- Sequence overflow fails closed.
- Indexed lookup and validation avoid copying/scanning the entire world state
  for normal per-player transactions.

## Mandatory future release gates

**This implementation is intentionally not sufficient for the massive
production realm.** Before enabling any of these mutations:

1. **Authorization:** verify authenticated CharacterId and current session
   generation; require proximity, server-authoritative loot eligibility,
   safe-zone rules, inventory capacity, encumbrance and death-state proof.
   No browser may directly request arbitrary Create/Destroy or select
   ground/corpse/character ownership IDs without server validation.
2. **Atomic durable commit:** move item state, slot index, idempotency record,
   currency/payment consequences, event outbox and item-version predicates into
   **one serializable transaction**. A process crash or restart must not
   duplicate/deletes loot.
3. **Cross-worker serialization:** enforce uniqueness globally across all
   authoritative zone workers. This in-memory reference is **not** concurrent,
   distributed, transactional on disk, or restart-safe.
4. **World entity linkage:** corpse and ground IDs must correspond to real
   server-managed entities, with deterministic pickup/drop permissions and
   view-interest replication; never silently create phantom ground items.
5. **Transaction retention:** `applied` is an unbounded in-memory receipt map
   in this prototype. Production requires a durable bounded idempotency
   retention window that cannot permit replay while old items/actions are
   still executable, plus monitoring/quotas.
6. **Anti-dupe testing:** stress simultaneous loot claims, death retries,
   network packet reordering, cross-zone moves, server failover, transaction
   commit/ACK interruption, full corpora and inventory-heavy workloads.
7. **Economics safety:** all mint, burn, sale, deed, property, currency and
   Moon Coin settlement boundaries need Economics Department agreement.
   There is no blockchain integration in C3a.

## Test coverage

9 ownership-specific deterministic tests and 5 inherited character identity
regressions ran in a Rust 1.89 isolated test harness:

- Atomic three-item death: equipped sword + carried bag to corpse, another
  inventory item to actual ground-location record.
- Abort the **entire** death transaction when one expected source is wrong.
- Equipment slot collisions fail; legitimate atomic equip swap succeeds.
- Competing looters targeting the same corpse object cannot both succeed.
- Exact transaction retry is idempotent; altered payload is rejected.
- Destroy checks source and cannot be duplicated.
- Empty, duplicate-item and overlarge batches fail with no mutation.
- Sequence overflow fails closed; zero-value IDs cannot exist.

The ground location is only a record here, **not yet** an actual rendered or
collidable world entity.

```bash
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml item_ownership::
cargo test --locked --manifest-path server/Cargo.toml --lib
```

Protected exact-head full GitHub `quality` CI, including browser combat
regressions, remains required before a PR can be considered merge-ready.

## Ownership and collaboration

Core & Multiplayer owns invariants and server-authoritative storage;
Magic & Items owns item definitions, rune/reagent lifecycle and equipment;
Economics owns value flows, trade and sinks; World & Gameplay owns corpse,
ground interaction, zoning and player eligibility. The Development Center
owns integration, merge order and deployment.

No gameplay, WebTransport packet, live wallet, production store, deployment
configuration, server restart or `main` change is activated in this PR.
