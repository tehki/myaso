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
