# Items 2B ↔ Core 8B / Core 8C: durable ownership integration gate

Status: **engineering evidence and required decisions, NOT an activated adapter**. This is a non-executable handoff for the Magic & Items orchestrator, Core 8B and Core 8C.

## Exact versions and reproducible smoke test

- Items 2B branch: [draft #449](https://github.com/tehki/myaso/pull/449), head `3bea91026c38f51799a7a4c027cb896e6760d604`, carrying #444 → #437 → #428 → #424.
- Core 8B C3f: [draft #417](https://github.com/tehki/myaso/pull/417), head `a033609bbf8d3c4c1217fe8bc3e27853ce776c51`.
- Core 8C C4d: [draft #393](https://github.com/tehki/myaso/pull/393), head `ed5e96f8c92eb33c2b996678426a50c75e6214e7`.

In a **temporary Serj Linux worktree only**, fetch both exact heads and their merge-base `3b29026b9899e4b30f31b3d631c67cdfc92f3911`. A noncommitting merge of #417 into #449 found exactly one textual conflict: `server/src/lib.rs` lists different module registrations. Resolve it locally by retaining BOTH sets of module declarations:

```rust
pub mod character_identity; // Items 2B session projection
pub mod identity;           // Core 8B canonical identity
pub mod item_journal;
pub mod item_ownership;
pub mod item_pg_codec;
```

After this resolution, Linux Rust 1.89:
- `cargo test --manifest-path server/Cargo.toml --lib --quiet`: **193 passed, 0 failed, 2 ignored** (the 2 intentionally ignored subprocess helpers are exercised by parent tests).
- `cargo clippy --manifest-path server/Cargo.toml --all-targets -- -D warnings`: **PASS**.
- This tests the **combined Rust library module graph only**, not a functioning bridge, durable transactional PostgreSQL commit, two browser clients or full protected CI. The scratch merge **must not be merged or deployed**.

## Incompatible contracts (must not be hidden by casts)

| Concern | Items 2B (#449) | Core 8B (#417) | Required bridge |
|---|---|---|---|
| Character | `character_identity::CharacterId(NonZeroU64)` | `identity::CharacterId(u128 nonzero)` | Resolve one authenticated durable 128-bit identity. No lossy downcast. |
| Item | `loot::ItemStack.id: u64` | `item_ownership::ItemId(u128)` | Assign canonical globally unique IDs with durable allocation/claim; never just cast independently minted local counters. |
| Session | `SessionLease { server_session: NonZeroU32, epoch: NonZeroU64 }` | Core authenticated character lease/generation/connection | Core must own admission and epoch fencing; translation only under active verified binding, not client IDs. |
| Equipment | `EquipmentSlot` Rust enum | `ItemLocation::Equipped { character_id, slot: u8 }` | Agree a stable, versioned slot tag table before persisting. |
| Zone/position | `zone::ZoneId`, `Point { x: f32, y: f32 }` | `item_ownership::ZoneId(u64)`, signed centimeter `i32` coordinates | Agree stable zone mapping, exact rounding/overflow policy and worker fence before converting. |
| Stacks and deaths | `ItemStack.amount: u16`, split/merge/scatter/corpse decay | One canonical `ItemId → ItemLocation`, typed operations + tombstones | Atomically record quantity changes, new fragment IDs, retired merged/consumed IDs, corpse/ground entities and receipts. |
| Persistence | Copy-on-write MYWLD003 joint Magic/Loot snapshot and per-character sequence | MYTX journal, writer lock, canonical PG codec, eventual zone atomic outbox | **One** writer and one durable commit protocol; never run file-journal + remote PostgreSQL as co-equal writers. |

The 8B PG codec uses **big-endian** 16-byte nonzero identity bytes while the journal uses **little-endian**. A memcpy between these encodings can silently change a valid owner or item. Use typed canonical conversion and reject noncanonical bytes; do not truncate 128-bit values to the legacy 64-bit IDs.

## Required atomic command boundary

1. Under Core 8A-authenticated account identity and Core 8C fenced authoritative World/Zone tick, derive the actor, zone and legal action from trusted state. The browser supplies at most a selected visible item/corpse/slot and a bounded command sequence, never actor/position/time.
2. Verify the **expected item source location**, living actor, range, corpse lifetime, equipment slot, capacities, item amount and unique canonical IDs. Reject stale leases, replay, out-of-zone requests and worker-fence loss **before mutation**.
3. Stage physical Loot, learned Magic, item ownership and tombstones as **one** transaction: exact changed quantities, source/destination items, ground/corpse world entities, durable per-character command receipt, world mutation receipt and outbox.
4. Commit atomically in the Core-selected single authoritative persistence backend and fence writer/worker epochs. **Only after durable success** publish RAM changes or client acknowledgements. Define an idempotent result for post-commit acknowledgement loss and fsync/commit ambiguity.
5. On restart, reconcile all item IDs, amounts and their one-and-only-one locations against receipts/outbox. No ghost equipment, dupe swords, lost reagents or double-looted corpses.

## Mandatory integration acceptance before any live path

- Two independently authenticated characters: naked spawn → legal sword pickup → equip → unequip → drop → another player's pickup **of the same canonical ID** → reconnect; verify ownership and appearance before/after all steps.
- Concurrent two-player attempt on the same ground entity and same corpse item; exactly one durable winner, loser fails closed.
- Kill/restart across pre-commit, post-durable-commit/pre-ACK and reconnect boundaries; exact replay/idempotent receipts and no duplication.
- Full loot on death including worn armor, partial stack split/merge, reagent consumption, expired ground/corpses, retired ID tombstones and caps.
- 128-bit high-range identity vectors, little↔big-endian PG encoding vectors, invalid slot mappings, bad float positions, cross-zone transfer/ABA, worker fence expiration and network replay.
- Both browsers and real Core protocol/DB runtime under protected exact-head CI. Do not weaken unrelated Combat browser tests.

## Ownership / scope

- **Core 8B:** canonical ID allocation, one item ownership ledger, durable idempotent transaction and journal/database selection.
- **Core 8C:** authoritative World tick, zone/location and worker/epoch fencing, world mutation/outbox integration.
- **Core 8A:** authenticated session, routing/commands and replay denial.
- **Items 2B:** physical inventory/ground/corpse/equipment invariants, deterministic full-loot scenarios and authority reads.
- **Magic 2A / Combat:** spell resources, death, damage and gear behavior inside the same committed operation.
- **Deployment / central issue #360:** protected CI, parent-first reviewed merge, production gating and rollback.

No production DB migration, new wallet, live loot API, independent merge or deployment is authorized by this document. Both departments must approve the common schema and single-writer transaction contract before implementation is exposed to network clients.
