# Core 8B C3p — First Playable canonical gear migration preflight

**P0 cross-department contract review only.** This is NOT a live item
conversion, namespace allocation, dual-writer sync, weapon data migration
or source-of-truth switch. Stacked on Core C3o [#492](https://github.com/tehki/myaso/pull/492)
→ dormant C3e [#406](https://github.com/tehki/myaso/pull/406).
Joint approval is tracked only in [#432](https://github.com/tehki/myaso/issues/432);
shared alpha scenario [#480](https://github.com/tehki/myaso/issues/480);
physical sword acceptance [#460](https://github.com/tehki/myaso/issues/460).

## Verified existing formats (source review, 2026-10-21)

Actual Magic & Items [#424](https://github.com/tehki/myaso/pull/424)
source `server/src/loot.rs` uses nonzero **`u64`** item IDs and
Magic `character_identity.rs` uses nonzero **`u64`** character IDs.
Its checkpoint `server/src/loot_persistence.rs` uses little-endian
`u64` records. Its **existing disk slot codes** are:

| Legacy slot code | Named slot |
| --- | --- |
| 0 | MainHand |
| 1 | OffHand |
| 2 | Body |
| 3 | Head |
| 4 | Feet |

**Important C3o correction:** the isolated four-sword Core 8B fixture
originally used slot 1 as a *provisional* hand slot, which actually
denotes Magic's OffHand. This child PR changes that isolated fixture to
slot **0**, consistent with Magic's existing saved MainHand code.
It is **not yet an approved production Core slot registry**; both owners
must sign off before any live equipment adapter is turned on.

Existing item-kind checkpoint codes must remain unchanged:

| Codes | Kinds |
| --- | --- |
| 0–3 | RustySword, LeatherArmor, Spellbook, FireRuneScroll |
| 4–7 | SulfurAsh, BlackPearl, Gold, HealingPotion |
| 8–10 | IronSword, WoodenClub, ChainmailArmor |
| 11–13 | IronHelmet, LeatherBoots, WoodenShield |

Only **RustySword (0)** and **IronSword (8)** are swords; WoodenClub (9)
is a weapon but must not be misreported as a sword. Unknown future item
and slot codes must fail closed until the versioned schema is reviewed.

**Additional Magic/Items owner issue:** in #424
`server/src/loot_persistence.rs` the checkpoint decoder tests
`if equipped > 3` despite the schema adding Head and Feet (five
possible occupied slots). A valid character with 4–5 different slots
may fail checkpoint recovery. Magic & Items owns this fix and its
versioned backward-compatible tests; Core 8B is **not** altering their
checkpoint writer in this PR.

## P0 preflight implementation

`server/src/legacy_gear_preflight.rs` provides a **dormant explicit**
offline conversion planner, with no real approved namespace values:

- `ProposedLegacyNamespaces` requires **five distinct nonzero**
  high-64 values, one each for character, item, corpse, ground
  entity, and operation. Only test code supplies fixed sample values.
  The planner combines `(high64 << 64) | legacy_u64`, preserving all
  64 source bits, including `u64::MAX`; no lossy `as u64` round-trip
  is performed when converting back into live data.
- `LegacyImportPreflight` receives a **complete set of active and
  retired canonical IDs**, rejects preexisting target collisions,
  zero IDs, duplicate source ownership records, namespace re-use,
  and references to source entities never staged as owners. If the
  existing inventory is incomplete, no collision guarantee exists.
- Explicit typed output for `CharacterId(u128)`, `ItemId(u128)`,
  and `CorpseId(u128)`; any proposed equipped location uses only
  the five known legacy equipment slot codes.
- Explicit ItemKind lookup covers 0–13 and rejects unknown codes.
  Nothing defaults to invisible equipment or a RustySword.
- Tests distinguish `u128::to_le_bytes()` (Core local MYTX journal)
  from `u128::to_be_bytes()` (Core 8C PostgreSQL `bytea`).
  **Never copy serialized Magic checkpoint, MYTX and PostgreSQL
  bytes directly**. Encode from reviewed typed IDs.
- A 4-sword fixture verifies all legacy source IDs 201–204 map
  to stable, distinct Core `ItemId(u128)` values; reuse of the same
  `u64` raw ID in another domain cannot alias an item.
- A **four-row physical sword manifest preflight** takes only source
  records extracted from a trusted, fully inventoried legacy checkpoint.
  It requires four distinct, previously registered ownership rows and
  preserves the explicit item-kind code: **RustySword (0)** or
  **IronSword (8)**. Missing owners, repeated IDs, zero IDs,
  WoodenClub (9), and unsupported/unknown item kinds fail closed.
  This is offline metadata validation, **not** proof of signed
  checkpoint provenance, real rack position, valid ownership zone,
  visual clicking, server-distance checks or a playable gear adapter.
- There is **NO** database insert, live migration, network route,
  authorized sword grant, equipment transition, or writer switch.

The proposed composite format is **not an authoritative ID contract**.
A real migration requires explicit namespace reservation in persistent
metadata, full offline source+target inventories, a collision manifest,
idempotent record backfill, backup/rollback verification and a single
approved live writer under 8C's worker/zone epoch.

## Tests and readiness

Serj Linux Rust 1.89 ran:

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib legacy_gear_preflight
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

**8/8 focused P0 preflight tests passed; 2/2 four-sword ownership tests
passed; entire server library 104 passed, 0 failed, 2 existing
intentionally ignored subprocess helpers; format and strict Clippy passed.** This verifies the typed contract against
our Core code plus manually source-checked Magic code names. It is
NOT a bundled cross-department source/ABI test, nor real browser
alpha, nor proof that live databases have been enumerated.

At implementation head `7aa42da0d4cb96f61aa78c5174d5bb7f16916cc0`,
the revised four-sword manifest and MainHand tests passed locally.
Mandatory full protected Chrome/Firefox/Combat `quality` on the final
PR head remains a **separate gate**.

## Remaining P0 cross-department sign-offs

- **Magic/Items 2B:** slot mapping semantics including new Head/Feet,
  old/new `ItemKind` disk codes, five-equipped-slot checkpoint
  decode limit and its backing records, item provenance, one authoritative
  inventory owner. Must not keep an independent world ledger coequal
  to Core 8B's ownership ledger.
- **Core 8B/8C:** approval of an exact ID namespace or deterministic
  migration manifest, signed-bigint zone bounds, typed local-journal
  versus PG codec, **one** globally current worker/epoch and
  item+world commit receipt.
- **Core 8A:** authenticated actor→character binding, monotonic
  pickup request ID and server ACK/rejection; browser may supply
  targeted item ID, **never author its own owner/gear state**.
- **World/Physics/Graphics/UI/Combat:** actual visible armory sword,
  authoritative LOS/range/zone, click-geometry priority over attack,
  observer replication and native Chrome/Firefox armed/unarmed PvP.
- **Main Orchestrator:** review #432 before integration; no main
  merge or production deploy while protected tests are red or
  independent 4-client M1–M5 proof is incomplete.

**Readiness: EXPERIMENTAL / TESTED offline only; BLOCKED for integration
and PLAYABLE.** Corpse loot/trade/MOCMP remain excluded from the first
alpha critical path.

## 2026-10-22 — C3p child: canonical inventory/expanded slot negative gate

An independent read of the original Magic & Items [#424] `loot_persistence.rs`
confirmed a specific version gap: it **writes** the actual equipment-map
length, supports slot tags **0..4**, but the **decoder rejects `equipped > 3`**.
Therefore a valid owner with four or five pieces can produce a checkpoint
that the same owner implementation cannot recover. **This Core 8B child does
not change or certify that decoder.** Magic & Items 2B must fix its own
versioned 3-slot/5-slot compatibility and test full save/reload on its
branch before approving migration or activating full loot.

The Core-only, offline `preflight_equipment_manifest` accepts explicit source
rows with 0–5 occupied slots and returns typed canonical item IDs with
proposed equipped character/slot locations. It validates original slot
codes exactly, registered source item/character IDs, distinct occupied slot
codes and distinct item IDs; rejects >5, zero, unknown, duplicate and dangling
IDs. It does **not** establish actual item ownership or source-provenance
completeness: caller must independently verify a quiescent authentic source
snapshot and exclusive writer/epoch before any real migration.

`LegacyImportPreflight::new` also rejects duplicated canonical inventory IDs,
instead of silently discarding duplicates when building its set of active +
retired IDs. Canonical IDs remain intentionally unapproved test namespace
values, and a distinct inventory scan can still be incomplete; validation is
necessary but not sufficient for production cutover.

New focused regressions test 3/4/5 gear slots, all slot meanings, old/new
character and item ID bindings, duplicate canonical owner inventory input,
duplicated equipment positions/items, unsupported slot, zero ID, dangling
source reference and >5 occupied entries. Original legacy format, writer,
network, runtime World/Combat, actual item registry, production database and
first combat-only Pre-Alpha remain untouched.

## 2026-10-22 — kind-bound equipment slot preflight (child of #756)

Actual Magic/Items #424 `server/src/loot.rs` defines **`ItemKind::fits(slot)`**
for all 14 persisted codes. The Core8B #756 structural-only equipment
preflight missed the source's kind→slot rule; previously it could propose
mapping a Gold or SulfurAsh item into MainHand, or a helmet into MainHand,
despite actual Magic equip operations rejecting these combinations.

`LegacyEquippedRow` now requires the source checkpoint item's explicit
`checkpoint_kind_code`. `preflight_equipment_manifest` rejects unknown
kind codes, all non-equipment kinds and recognized-but-wrong combinations.
Output preserves that kind next to the canonical typed item and slot.
Source rule exactly: RustySword, IronSword, WoodenClub→MainHand;
LeatherArmor, ChainmailArmor→Body; Spellbook, WoodenShield→OffHand;
IronHelmet→Head; LeatherBoots→Feet. Rust regressions exhaustively check
14 kinds × 5 slots and positive source metadata output.

**Not an authorization or source attestation.** The Magic/Items owner
still must certify this row's kind matches the actual saved unique item,
including quantity and source checkpoint validity; Core8B does not supply
cryptographic identity, real ownership or an item writer. Magic #424 still
rejects 4/5 occupied slots on checkpoint decode and needs owner repair.
No runtime Loot, Combat, database, World, first Pre-Alpha, migration or
production side effects are introduced.

## 2026-10-22 — optional source ID/kind/amount/allocator consistency gate

Original Magic #424 source `loot_persistence.rs` serializes **ItemStack** as
`id:u64 little-endian`, `kind:u8`, `amount:u16 little-endian`; the
`LootStateSnapshot` validator rejects zero item amounts and amounts >1
for all non-stackable kinds, requires nonzero unique IDs strictly below its
`next_id`, and refuses wrong kinds in equipped slots.

The earlier #766 equipment preflight uses its `LegacyEquippedRow`'s own
kind-code as caller-supplied data, so a valid slot could be paired with a
*different* valid kind from the source, e.g. IronSword→WoodenClub in MainHand.
This offline-only child adds `LegacySourceItemCatalog::new(import, next_id,
source_item_rows)` and `preflight_equipment_manifest_against_source` to
compare exact source ID + disk kind + amount + checked allocator-bound and
registered canonical item ID before any *proposed* equipment mapping. The
catalog rejects duplicate source item records, invalid ID/kind/amount and
missing registrations; a bound equipment row cannot substitute another
valid source kind or invent an absent record. Each equipped source item must
have amount=1. Stackable source items may retain amount>1 as non-equipped
records. The original simpler helper remains for comparative/offline tests.

**Crucial trust limit:** both catalog and equipment rows are input from an
external source scan. This check does not attest the scan, prove its
completeness or freshness, authenticate the actor, validate World position,
settle split writers or commit MYTX/PG. In particular an internally coherent
forgery or rollback can still pass. Only a quiesced, authenticated,
anti-rollback source with full active+retired inventory and one approved
global epoch-fenced writer may be considered later for migration.

No live Magic/Items serializer fix, item writer, protected workflow gate
change, Combat, browser, server listener, database migration or Pre-Alpha
release change is included.
