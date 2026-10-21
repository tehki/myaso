# Core 8B C3r — read-only current MainHand item snapshot (First Playable P0)

**Status: IMPLEMENTED / LOCALLY TESTED / NOT INTEGRATED OR PLAYABLE.**

Child of Core 8B [#510](https://github.com/tehki/myaso/pull/510), itself stacked on offline legacy ID preflight #499, four-sword conservation #492 and single-host C3e writer #406. Responds to Graphics 3A [#523](https://github.com/tehki/myaso/pull/523) request for a trustworthy empty-hand/sword sequence, the canonical [#432](https://github.com/tehki/myaso/issues/432) gate, and the mandatory four-player physical armory [#480](https://github.com/tehki/myaso/issues/480).

## Current-read contract — explicitly NOT a wire protocol

`read_current_mainhand(&DurableItemJournal, trusted_character_id)` returns `CurrentMainHandSnapshot` with private fields and read-only accessors:

| Field | Type | Meaning |
| --- | --- | --- |
| `character` | typed `CharacterId(u128)` | Requested **server-verified** character. The function does NOT authenticate it. |
| `journal_sequence` | `u64` | Full committed **local C3e journal** sequence, including drop/empty-hand and unrelated-item transactions. `0` represents a new empty journal. |
| `item_id` | `Option<ItemId(u128)>` | Actual latest `MainHand` slot 0 item, or authoritative **None / empty hand**. |
| `item_mutation_sequence` | `Option<u64>` | Latest touching commit for that equipped item. None if hand is empty. |

This is **one local read** under an immutable Rust `&DurableItemJournal`: the existing indexed `ItemOwnershipLedger::equipped_item(character, MainHand=0)`, `location(item)` and `last_mutation_sequence(item)` must agree, the last mutation must be positive and not exceed the committed journal head. The projection fails if the journal is poisoned or its equipment index contradicts ownership records. It neither allocates another item registry nor mutates an existing writer.

Crucially, a drop changes the **journal sequence** even though the resulting hand has no item-specific mutation value. Thus an older equip record can be suppressed in a future renderer after a newer empty-hand snapshot. ABA equip → drop → equip to the identical owner/item produces a strictly newer journal and item mutation watermark. A different item's transaction may also advance the **global journal sequence** without touching this hand; this is safe but conservatively causes presentation churn.

The snapshot includes **no item kind**. C3e's canonical location ledger does not hold `RustySword`/`IronSword` metadata; **do not draw a sword merely because `item_id` is Some**. Items 2B must supply the same committed item ID with its trusted kind and World/Graphics must bind its valid physical asset only after authority checks.

## Critical authority and ordering limitations

- **Not authenticated:** the `character` argument is NOT proof of a logged-in actor. Core 8A must verify current player session → persistent character ID and session generation, forbid arbitrary client owner IDs, and bind the outgoing record to the current connection. Core 8B #365 memory-only fencing is not a complete authenticator.
- **Not a cross-epoch revision:** `journal_sequence` is monotonic only **within the same C3e local writer's durable lineage**. Never compare it across unrelated journals, restarts with lost data, a worker/zone leadership change, a MYWLD003/MYTX migration, or a switch to 8C PostgreSQL; Core 8C must provide the immutable authoritative **writer-lineage/epoch** and a coherent cross-worker sequence or commit/outbox ID before network activation.
- **Not real item authority yet:** Items 2B [#522](https://github.com/tehki/myaso/pull/522) provides `u64` authenticated visible ground-sword preview and checked pickup, but is backed by a separate MYWLD003 Loot/Magic checkpoint. C3e provides `u128` journal location truth; **both cannot co-write the same physical sword**. [#432](https://github.com/tehki/myaso/issues/432) must approve exactly **one** item/world writer, kind/slot mapping and migration first.
- **No ACK/outbox:** reading a snapshot is not atomic with publishing it to the network. A later mutation can win while an old snapshot is in flight. Core 8A/8C must serialize a committed world+item event with monotonic revision and observer fanout, or revalidate at publication time, and clients must use an authenticated per-character, per-lineage monotonically increasing sequence.
- **No item network encoding chosen:** internal typed IDs use `u128` but the canonical wire contract is **unapproved**. Do not silently downcast 128 → 64, reuse a temporary actor net slot as permanent character identity, or send MYTX little-endian bytes to an 8C PostgreSQL big-endian entity adapter.

**Proposed read-only renderer acceptance shape (for review; not emitted by this PR):** authenticated envelope keyed by immutable character ID + current 8A session generation + 8C writer lineage/epoch + authoritative committed item/world revision, containing `item_id: null|canonical128`, matched trusted `ItemKind` and `MainHand` slot. A drop MUST yield an explicit newer `null` rather than omit the hand field, and old equip frames must be rejected. Graphics 3A [#523](https://github.com/tehki/myaso/pull/523)'s synthetic high-water guard can consume this only **after** real server authenticity and proper epoch semantics are approved. No client `provenance` string is authentication.

## Regression evidence

Source branch adds three Rust tests:

1. A brand-new local journal produces a well-typed **empty-hand sequence 0**.
2. Four distinct rack sword identities, actual equip → drop (**explicit newer empty hand**) → second character re-pick. Read-only views preserve current owner and sequences before/after local journal close/reopen; total ID count stays four.
3. Same item equip → drop → identical equip (**ABA**) always has strictly later commit and item mutation watermarks. An unrelated item commit advances only the global journal sequence, not the item-specific value.

**Serj Linux Rust 1.89, implementation head `8d682768e9d92d671d4f0d2a8864409267216a33`:** 3/3 new tests PASS, complete `cargo test --locked --manifest-path server/Cargo.toml --lib`: **115 passed, 0 failed, 3 intentionally ignored subprocess helper entries**; `cargo fmt --check` PASS; strict `cargo clippy --lib -- -D warnings` PASS. These are local domain tests, **not** browser or networking acceptance.

Protected exact-head full `quality` (Rust/JS/native Chrome/Firefox/Combat) remains mandatory. Parent #510 full protected CI may pass or fail independently. Never waive M194, M161, M144 or item-writer integrity checks.

## Integration/rollback

Core 8B owns this read-only contract; Core 8A owns authenticated connection/ACK/observer protocol, Core 8C owns fenced world/worker/epoch/outbox, Magic & Items owns sword kind/slot rules and exact physical item selection, Graphics 3A owns visuals, World 9 owns rack geometry, Combat owns unarmed/armed mode. Only the Main Development & Deployment Orchestrator can sequence acceptance and merges.

**No live activation, additional item writer, production DB migration, game release, MOCMP or wallet change.** Integration readiness is **BLOCKED** pending one canonical writer, reliable same-tick authenticated snapshots, and real four-independent-browser M1–M5 acceptance.
