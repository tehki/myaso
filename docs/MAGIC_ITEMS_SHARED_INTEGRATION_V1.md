# myaso.io — Magic & Items Shared Integration Contract V1 (PROPOSED)

**Owner:** Department 2 Magic & Items Orchestrator (shared integration only).
**Reviewers:** Magic 2A, Items 2B, Core 8A/8B/8C, Combat, Graphics 3A, UI, World, Economics.
**Status:** Design and compatibility gate, **not** a live protocol, approved migration, Combat implementation, or permission to merge.
**Audit baseline:** October 21, 2026; protected `main` `4ed368d911eb5250a0a09a133500037ff5518c12`.
**Integration tracker:** [Development Center #360](https://github.com/tehki/myaso/issues/360).

## 1. One physical item truth, one durable character truth

- Players begin with an **empty backpack, empty equipment, no spellbook, no reagents, and no learned spells/runes**. Visible adult unclothed appearance does not mint items.
- **Items 2B** owns `ItemKind`, individual item identities, backpacks, slots, ground entities, corpses, full-loot transitions, and stack semantics. A sword cannot occupy ground and a backpack or two players' inventories at once.
- **Magic 2A** owns learned Fire/Ember, mana, lessons, intents, cast and interrupt semantics. Earned knowledge must survive loss of a physical spellbook and reagents.
- **Core 8B** must define the eventual canonical stable character ID, item ID, ownership ledger, durable receipt, migration and restart-safe recovery. Do not run Magic's whole-file checkpoint and Core's journal/SQL as two independent canonical writers.
- **Core 8C** owns zone location, world entity identity, writer epoch and mutation fencing. **Core 8A** authenticates the network and delivers commands, ACKs and committed observer state.
- **Combat** resolves unarmed vs equipped attack/damage and atomic death transitions. Graphics and UI consume trusted state; never grant, delete or duplicate gear client-side.

### Provisional source ownership

| Source | Owner | Joint review required from |
| --- | --- | --- |
| `server/src/magic.rs`, `magic_teacher.rs`, `magic_cast.rs`, `magic_combat_preview.rs`, `magic_combat_interrupt.rs` | Magic 2A | Items 2B / Combat for reagent, equipment and effect boundaries |
| `server/src/loot.rs`, `loot_persistence.rs` | Items 2B | Core 8B / Core 8C for durable IDs, schemas and ground entities |
| `server/src/loot_transaction.rs` | Items 2B with orchestrator review | Magic 2A + Core 8B/8C: the present file also writes Magic and uses World leases |
| `server/src/magic_checkpoint.rs`, `magic_combat_death.rs` | Shared, one orchestrator-coordinated integration owner per change | 2A, 2B, Core 8B/8C, Combat |
| `server/src/character_identity.rs` (experimental) | Shared **provisional only** | Core 8B owns canonical identity and session admission |
| `server/src/combat_loadout.rs` in Combat draft #426 | Combat | Items 2B / Core / Graphics |
| `src/browser/character-appearance.mjs` in Graphics draft #423 | Graphics 3A | Items 2B / UI |

No parallel implementation of an inventory database, spell ledger, item allocator, Combat damage engine or graphics renderer inside this department. Each shared file has **one writing team per change**.

## 2. Identity and serialization mismatch: hard integration blocker

These are **different currently isolated types**, not interchangeable wire contracts:

| Domain | Verified draft type and representation | Action |
| --- | --- | --- |
| Magic #354 `character_identity.rs` | `CharacterId(NonZeroU64)`, `SessionLease` with `u32` session + `u64` epoch | Prototype only; use Core-admitted verified identity, never client ID |
| Items #354/#424 `loot.rs` | `ItemStack.id: u64`; local world/corpse entity ID `u64`; `EquipmentSlot` Rust enum | No implicit cast into canonical journal namespace |
| Core 8B #417 `identity.rs`, `item_ownership.rs` | `CharacterId: u128`, `ItemId: u128`, `CorpseId: u128`, independent operation IDs | Core 8B defines authoritative namespaces and collision policy |
| Core 8B C3b / C3f #417 | `MYTX` journal fields little-endian; PostgreSQL `bytea` ID representation proposed as big-endian 16-byte | Typed encode/decode at the boundary; no raw-byte reinterpretation |
| Core 8C C4d #393 | Fenced PostgreSQL world-entity transactions; 16-byte entity/operation IDs and single-entity mutation scope | Extend joint death/transfer transaction only with reviewed 8C API |
| Magic/Items #354 | `MYASOL03` local Loot snapshot, `MYWLD003` joint Loot + Magic checkpoint | Versioned migration/rollback and item conservation proof required |

**Required review before any live migration:**
1. Decide canonical item, character, corpse, operation and ground-entity namespaces (with zero/overflow/collision rejection).
2. Specify an explicit `u64` prototype-to-canonical mapping or a one-time migration with immutable provenance; **do not silently zero-pad, truncate, reinterpret bytes or remint**.
3. Specify equipment slot numeric mapping (`MainHand`, `OffHand`, `Body`, `Head`, `Feet`) and version it; Core's `slot: u8` is not yet an agreed live cross-domain schema.
4. Validate cross-version encode/decode, item identity uniqueness, corrupt-record refusal, crash before/after commit, and old/new rollback.
5. Choose one canonical durable writer, world fencing token, idempotent receipt and recovery ordering. Local exclusive flock from 8B cannot be treated as a distributed multi-host lock.
6. Define authoritative Combat HP/death + Magic interruption + item/corpse mutation as **one recoverable logical transaction**; C4d's single-world-entity atomic receipt alone does not prove a multi-entity death commit.

No real database schema migration, production account identity change, or on-chain asset conversion is approved by this draft.

## 3. Proposed internal operation and durable outcome boundary

A client may request only a **kind and selection**: `pickup(entity_id, amount)`, `take(corpse_id, item_id, amount)`, `equip(item_id, slot)`, `unequip(slot)`, `drop(item_id, amount)`, or `prepare_cast(spell, target_intent)`. The client **must not supply** an authoritative owner/actor ID, character ID, inventory contents, caster mana, world position, session lease, trusted teacher receipt, or damage result.

Core-authenticated admission derives stable character identity, current session incarnation, writer epoch and serialized world tick; World validates fighter/zone, distance and action state; Items validates item existence, exclusive ownership, correct slot/capacity and conservation; Magic checks owned knowledge, physical spellbook/reagents, mana, spell intent and interruptions. A durable transaction must commit the operation receipt and *every participating state change* before ACK/replication; ambiguous persistence must reconcile from the canonical store rather than merely retrying mutation in RAM.

The current `commit_verified_pickup` (#409), `commit_verified_equipment` (#424), and `MYWLD003` checkpoints are **isolated server-domain experiments**; their Rust tests do not prove real authentication, distributed fencing, cross-domain Combat HP atomicity, post-rename recovery or independent multiplayer execution. No live handler activation.

## 4. Visual and Combat contract

- Graphics #423 currently supports `RustySword`, `LeatherArmor`, `Spellbook` and `mainHand/offHand/body`, while Items #424 adds `IronSword`, `WoodenClub`, `ChainmailArmor`, `IronHelmet`, `LeatherBoots`, `WoodenShield` and `head/feet`. Graphics must extend its render-only compatibility map and safe fallback *after item taxonomy review*, **not** invent ownership.
- Combat #426 has a dormant read-only loadout view. Define a genuinely **unarmed** baseline rather than portraying the existing arena's fixed 34HP attack as an unarmed fist. Damage, blocking, mitigation and fairness remain Combat-owned and server-authoritative.
- A visible skin or asset key can never create a physical item. Rendered equipment updates only from committed server snapshots/receipts, not client guesses.

## 5. PR integration map and current test gates

| PR | Changes | Dependency |
| --- | --- | --- |
| [#354](https://github.com/tehki/myaso/pull/354) | Combined initial Magic/Items domains and experiments | `main` |
| [#397](https://github.com/tehki/myaso/pull/397) | Death timestamp overflow validation | #354 |
| [#409](https://github.com/tehki/myaso/pull/409) | Typed pickup + joint checkpoint and single-winner contests | #397 |
| [#424](https://github.com/tehki/myaso/pull/424) | Empty starter, physical gear, slot/codec extensions, typed equip/unequip/drop | #409 |
| [#426](https://github.com/tehki/myaso/pull/426) | Dormant read-only Combat loadout | #424 |
| [#427](https://github.com/tehki/myaso/pull/427) | Dormant verified read-only Magic knowledge | #354 |
| [#423](https://github.com/tehki/myaso/pull/423) | Dormant adult body/equipment rendering contract | independent on `main` |
| [#417](https://github.com/tehki/myaso/pull/417), [#393](https://github.com/tehki/myaso/pull/393) | Core 8B canonical PostgreSQL item codec; Core 8C fenced world mutation | separate Core chains |

All Magic branches remain drafts. Passing nested child CI **does not** replace a failed or missing parent acceptance or prove a legal merge order. Never rebase/force-push department heads without coordination.

**Smallest safe integration order:** agree namespace/operation/slot contracts → fix and revalidate parent stack failures → integrate #354 then #397, #409, #424 in dependency order with fresh merged-head CI after each → integrate Combat/Graphics/UI/Core only after their own independent review → exercise *real* two-client sword pickup/equip/transfer, corpse contention, teacher+Ember resources, reconnect/crash/replay/multiwriter defenses → central release decision. Alternative stack surgery requires the Development Center's explicit approval; preserve existing commits/reviews.

## 6. Acceptance that must not be diluted

- **Naked start:** no free equipment, items, runes or spells; identity cannot be forged.
- **Single sword:** valid obtain/pickup/equip/drop/take; exactly one owner/position, identical stable ID through transitions; no ghost rendering or stale acknowledgement.
- **Death:** physical gear/reagents/spellbook transfer to corpse/ground; no duplicated bodies/items; learned Fire/Ember retained; pending spell safely interrupted.
- **Spell:** verified teacher/lesson; owned Spellbook and Sulfur Ash; one mana/reagent expenditure, one authoritative Combat outcome.
- **Durability:** precommit rollback, postcommit confirmation, ambiguous ACK, restart/epoch fence, competing writers, duplicate receipts and incompatible/corrupt schema refusal.
- **Live clients:** >=2 independent browsers and a real authoritative server, observed committed ground/corpse/equipment state and no item duplication.
- **CI:** exact-head Rust fmt/check/Clippy/tests and full protected Chrome/Firefox Combat acceptance; do not weaken failing M143/M121/M147 assertions to accelerate activation.
- **Performance:** bounded zone loot queries, no whole-world disk writes per trivial pickup as a final performance design without Core 8B/8C measurement, conservative Combat tick latency.

The main R2 multiplayer release must not be blocked by unfinished Magic/Items. **No production activation, irreversible migration, real-money trading, real MOCMP wallet/custody or main merge under this document alone.**
