# myaso.io — Full-loot inventory and Magic Alpha foundation

Status: **domain foundation only — NOT live-game enabled**. Approved design direction, 2026-10-20.

## Gameplay contract

- Every player starts without magic. Runes, spells and mana access are earned through NPC teachers, quests, epic monsters and rare chests.
- Ultima Online-style backpack and paper-doll equipment: equipment, gold, reagents, spellbooks and scrolls are physical item stacks, each with a server-minted identity.
- Free-for-all PvP: anybody may attack, kill or loot anybody. No temporary exclusive corpse protection in FFA.
- **Full loot on death**: the entire physical backpack and every equipped item move into a corpse or onto nearby ground. No physical item stays with the defeated character. A bounded small quantity of item objects scatters around the corpse; the majority remains in it. Reagent/gold stacks may scatter a single unit with the remainder kept in the corpse. Every object is interactable with range, zone and capacity checks.
- **Knowledge survives death**: learned rune/spell knowledge is an attribute of the character, not an item. A physical spellbook or rune scroll, however, is droppable and lootable.
- Server decides death, every item transfer, collision/interaction location and decay. Client inventory or ground entity descriptions are never authoritative.

## Implemented isolated model

- [Rust server loot domain](../server/src/loot.rs) defines backpack inventory, equippable objects, server-minted item identities, world-positioned corpses and ground loot.
- Confirmed death drains possessions once. Ground/corpse interactions validate server-side Fighter identity, current location, authoritative ZoneId, interaction distance, decay and backpack capacity. Stale pickup and repeated death fail closed. No item can be consumed twice by competing player interactions.
- Alpha-only tunable defaults: 64 backpack stacks, up to 3 scattered objects per death, 56-unit interaction radius, 15-minute ground decay and 20-minute corpse decay.
- Partial stack drops and contested ground/corpse pickups preserve item quantities and unique server-minted fragment IDs; stale or overlarge grabs fail without modifying the world stack.
- Backpack stack split/merge operations preserve exact quantities and stable destination identities, check capacity and 16-bit quantity overflow before mutation, and reject non-stackable or mismatched items.
- An internal-only `consume_reagent` operation allows future spell casting to spend Sulfur Ash or Black Pearl from multiple stacks atomically; an insufficient or invalid request changes nothing. It does not itself authorize spells or accept network commands.
- Read-only `visible_loot` queries return up to 128 nearest non-expired objects within 550 world units of a verified live fighter, in one server-selected zone. Ground previews expose item kind and quantity; corpse previews expose only a corpse entity and victim ID, never the corpse's contents before an authorized loot interaction. Ordering is deterministic (distance, entity ID).
- `LootStateSnapshot` now allows **integrity-checked, in-memory** state export/restore with a schema version, monotonic item/entity ID allocator, globally unique instance IDs, valid positions, stack amounts/equipment slots and dead-player inventory invariants. Corrupt state is rejected before restoration; unit tests exercise full-loot round trips and hostile/corrupt snapshots.
- [Character/session identity registry](../server/src/character_identity.rs) models nonzero durable character IDs and generation-stamped `SessionLease` identities separately from numeric fighter IDs. Duplicate active bindings, stale lookups, replayed leases, and delayed disconnects for reused numeric IDs fail closed. Epochs must be minted by trusted admission and increase for each reuse, with restart-safe uniqueness defined before live activation. It requires an independent trusted account verifier and is **not yet wired to LootAuthority or the live WebTransport server**.
- **In-memory reconnect ownership** now uses `LootAuthority::park_inventory` and `resume_inventory` with exact generation-stamped, verified session leases. On disconnect, inventory is **moved**, not cloned, into a character-ID-keyed parked map; an authenticated reconnect moves it into the new session. Items keep their IDs, newly minted items advance the same global allocator, dead characters reconnect dead, and previously dropped loot remains in the world. Parked possessions participate in snapshot ID/capacity/state validation. Snapshot schema is now **v2**, intentionally rejecting incompatible v1 snapshots rather than silently misreading them. Four new Rust tests cover reconnect, stale sessions, death and duplicate ID corruption.
- **Activation boundary:** connection handlers have not been wired; the caller must serialize disconnect with in-flight gameplay actions, park before releasing the session binding, and checkpoint the whole updated state transactionally. This process-local map is **not** crash-safe account inventory storage, and migrating existing v1 snapshots requires an explicit reviewed migration plan.
- [Quiescent checkpoint storage](../server/src/loot_persistence.rs) now encodes the complete parked-character, ground-item, corpse and global-ID state in a strictly bounded, schema-versioned binary snapshot with an unkeyed corruption checksum. Saves use a same-directory exclusive staging file, file sync, atomic rename and Unix parent-directory sync; loads validate checksum, enum codes, length limits, unique item IDs and world geometry before restoring anything. Active ephemeral sessions are **refused** until all inventories are parked. This is a domain-only recovery path, not an enabled production store.
- [Staged verified loot checkpoint transactions](../server/src/loot_transaction.rs) add a non-activated single-writer API. It clones the loot state, applies one internal action, maps all active inventories onto trusted character identities in a recovery-only copy, writes and syncs the checkpoint, then publishes the staged live state. Invalid/partial identity mapping, a rejected action, or I/O failure leaves the original in-memory inventory and allocator unchanged. Tests cover recovery, failed writes, unverified sessions and contested pickups.
- **Activation gaps:** there is no server lifecycle hook, account verifier, global world lock, persisted command nonce/idempotency ledger or cross-component transaction with combat events. Whole-world checkpointing is not a scalable write-ahead log. In-memory failure does not guarantee the previous disk file survives an error after an atomic rename. Do not enable the protocol until these boundaries are addressed.
- **Checkpointed operation watermarks (schema v3):** `loot_transaction::transact_operation` stages a verified session's loot mutation together with a strictly increasing per-character operation sequence. The sequence is stored in the same full-world checkpoint as the item transfer, so equal/older commands are rejected after successful recovery and a newly verified reconnect. Rejected actions and pre-commit disk failures leave the live watermark and possessions unchanged. Old schema-v2 checkpoints are intentionally rejected; adoption requires an explicit reviewed migration and safe rollout. Watermarks are bounded to 4096 distinct characters and do not store past response payloads.
- **Still not live-safe:** no durable account authentication, real command transport, world-wide lock, atomic combat+loot commit, replay response receipts, post-rename storage-failure reconciliation or scalable write-ahead log. Client sequence numbers alone do not prove authorization. All magic and loot persistence endpoints remain non-activated.
- **No production-grade per-action durable persistence yet.** The snapshot has no disk encoding, transaction log, durable-account binding, atomic storage commit, encryption or crash recovery. Ephemeral fighter IDs must not become storage keys. A later adapter must authenticate durable characters and commit inventory/corpse/ground changes atomically, preserving global ID allocation across restarts.
- These are **domain-level APIs only**, not durable storage or the realtime replication wire format; they must not be invoked using client-provided actor positions, character identities or zone IDs.
- The domain is **not** connected to transport, live simulation events, renderer or storage. No new dependencies or changes to authoritative melee, snapshots, game controls, certificates, production data or deployed code.

## Earned Magic Alpha progression (isolated)

- The new [Magic domain](../server/src/magic.rs) stores runes, taught spells and unlocked mana per trusted CharacterId, outside physical full-loot inventories. At spawn all are empty; the first earned rune awakens mana. Fire and the first Ember spell require separate lessons.
- NPC teacher, quest and rare-discovery lesson awards use globally unique nonzero server-minted receipt IDs. Duplicate receipts, duplicate learned runes and spell lessons without prerequisite runes are rejected. The caller must still verify the teacher, quest, character and reward; there is no player-facing grant command.
- Read-only Ember preparation verifies the exact authenticated session lease, learned Fire rune and Ember spell, equipped lootable Spellbook, Sulfur Ash reagent and mana. It costs 15 mana and one Sulfur Ash if eventually cast, but the preview consumes nothing and produces no effects.
- Tests cover no-free-magic spawn, rewards, replayed receipts, casting prerequisites and rune/spell knowledge surviving full-loot death when the spellbook is taken. The knowledge ledger is **in memory only** and must be persisted transactionally with items before activating NPC lessons or spells. No live Magic integration, projectiles or combat changes.

## Durable no-damage Ember resolution (domain only)

- The outbox now retains distinct `Pending`, `Interrupted`, and `Cancelled` statuses for each Ember intent ID. Interrupt/Cancel are terminal **no-effect** outcomes: the record and committed operation sequence survive recovery, so the same intent cannot become pending again or be cancelled twice.
- The trusted offline-only `resolve_ember_without_damage` operation verifies an exact server-issued SessionLease and the authoritative ZoneAuthority zone, stages a terminal status, and writes a new joint loot-and-magic checkpoint **before** publishing in-memory state. Corrupt status codes, wrong sessions, wrong zones and repeated transitions fail closed.
- Magic progression is versioned `MYMAG003` and the combined checkpoint is `MYWLD003`. Previous experimental versions need a reviewed migration; standalone loot format remains `MYASOL03`. No records can be discarded without a durable retention/garbage-collection policy; the global 4096-intent limit remains.
- **Applied damage is not representable yet.** Combat must persist damage, death/loot, effect resolution and player feedback as one coordinated world transaction before that terminal state is allowed. This module never applies effects and is not wired to WebTransport.

## Durable pending Ember intent (non-activated)

- The MagicAuthority progression ledger now holds a bounded outbox of pending Ember effects keyed by durable CharacterId and committed operation sequence. Each record includes a server-verified ZoneId, finite in-bounds origin and facing, encoded deterministically without applying projectile collision or damage.
- `commit_ember_cost` stages its intent **together** with replay watermark, mana and Sulfur Ash in the same joint loot+magic checkpoint. Recovery restores pending intent without executing it. Invalid geometry, duplicated intents and corrupt/unknown zone data fail closed. A future Combat resolver must persist completion/failure and coordinate exactly-once application before effect activation; no consumer or acknowledgement path is enabled yet.
- Magic progression format bumps from `MYMAG001` to `MYMAG002`, joint checkpoint from `MYWLD001` to `MYWLD002`; the old nonproduction format needs an explicit migration if any stored saves are retained. Standalone loot-only format `MYASOL03` is unchanged. Pending intents are bounded to 4096 globally and intentionally cannot be pruned without a durable resolution protocol.

## Ember resource commit (experimental, non-activated)

- The isolated `magic_cast.rs` adds a server-authoritative cost transaction: exact verified session lease, matching Fighter, registered ZoneAuthority and finite in-bounds alive/idle position are mandatory. A staged world must have learned Fire + Ember, an equipped physical Spellbook, one Sulfur Ash and at least 15 mana.
- The transaction stages a strictly increasing per-character operation sequence, consumes one Sulfur Ash, debits 15 mana, and checkpoints both MagicAuthority and LootAuthority in one MYWLD001 file before publishing the two live in-memory states. Tests cover exact recovery, replay rejection, missing requirements, combat locks, spoofed fighters and failed writes.
- The returned EmberCostReceipt proves only a resource debit, **not a spell projectile, hit, cooldown or damage effect**. Do not wire into production until combat effects, session admission, death handling, world locking and post-rename crash reconciliation are atomic with this operation.

## Server-owned NPC teacher eligibility (domain only)

- Added `server/src/magic_teacher.rs` with a trusted NPC spawn registry and typed teacher IDs. A lesson is eligible only when an exact verified session lease matches the server-simulated Fighter, the authoritative ZoneAuthority agrees with the NPC zone, the character has a valid active LootAuthority inventory and is alive/idle, and the server Fighter is within 48 world units of a valid manifested trainer.
- `transact_teacher_lesson` in the joint checkpoint module determines the **lesson from the registered NPC**, never a client-selected reward, mints a unique receipt from the saved MagicAuthority receipt ledger, and atomically stages the lesson + loot + magic recovery bundle before publishing. Lesson prerequisites, duplication and corrupt state fail closed. Tests cover proximity, wrong fighter/session, cross-zone NPCs, dead/combat-locked actors, invalid trainer spawns, recovery and repeat-lesson denial.
- **No actual NPCs are spawned in the live world** by this module; production content/quest authorization and real server tick locking are mandatory. Do not expose `register_trusted` or lesson receipt creation in a client protocol. Live magic, combat effects and deployment remain disabled.

## Joint loot + magic checkpoint, experimental

- Added a versioned **MYWLD001** combined recovery file in [`server/src/magic_checkpoint.rs`](../server/src/magic_checkpoint.rs). It packages a validated quiescent loot snapshot and the learned-rune/spell/mana/claimed-receipt ledger into one atomically replaced file. Load rejects corruption or unsupported formats without returning partial items or magic. The underlying standalone loot schema remains v3 and is deliberately not interchangeable with the joint file.
- `transact_lesson` clones MagicAuthority, verifies the authoritative session lease matches the rewarded CharacterId, applies a unique server-minted lesson, saves **both** loot and magic, and only then publishes the new knowledge and receipt in memory. A failed lesson or pre-rename filesystem failure leaves live progression unchanged. Tests cover restart recovery with physical spellbook/reagents intact, duplicate-reward denial after reconnect, invalid sessions and corrupted joint files.
- **Not production-ready:** caller must provide real NPC/quest eligibility, authenticated durable character binding and an exclusive world lock; standalone loot checkpoint writes must never overwrite joint checkpoints. There is no production schema migration, storage locking, atomic multi-service combat transition, crash reconciliation after rename/fsync errors, or live multiplayer integration. This does **not** activate casting, award gameplay, or production persistence.

## Magic follows the item foundation

1. Server validates reward and records rune knowledge independent of inventory.
2. First rune awakens mana. Fire and Ember are the first planned rune/spell.
3. Players combine learned runes into recipes; teachers teach spells, but experimentation can discover them.
4. Mana and reagent checks, cast time/cooldown, explicit interrupt/counterplay and zone-aware effects are server-owned.
5. Reagents, spellbooks and written scrolls remain physical and subject to full loot. Rune *knowledge* cannot be looted.

Proposed later runes: Fire, Water, Air, Earth, Life, Arcane. Each rune and spell needs explicit tuning before PvP activation.

## Mandatory integration prerequisites

1. **Accounts and durable character identity**. Today's alpha uses ephemeral numeric fighter IDs; no account/progression/inventory storage exists. Save items, learned runes, mana progression and world loot transactionally against verified persistent character identities before calling the system live.
2. **World hookup and atomic recovery**. Tie one loot death event to authoritative CombatEvent::Death and verified respawn, with correct behavior for disconnects, restarts, transfers and resets. Avoid double drops and disappearance.
3. **Protocol & authoritative interaction**. Introduce versioned, replay-resistant commands for equip/unequip, pickup, corpse loot and intentional world drop. Never trust client-provided positions/zone or support client grants. Prove simultaneous looting cannot duplicate items.
4. **Real world rendering**. Display loot sprites with accurate positions, item targeting and collision constraints, interest-filtered per zone. Implement backpack, paper doll, ground pickup and corpse window, and test across actual Chrome/Firefox clients.
5. **PvP regression**. Preserve all existing LMB, RMB, wheel, heavy release, jump, parry and dodge controls and combat phase requirements; add corpse-contest and item race cross-browser acceptance.
6. **Review/release**. Finish Rustfmt, clippy, tests, full exact-head CI and review before merge. No release or VPS changes without a separate authorized deployment.

## Design tuning

Final thresholds for stack weight, loot decay, number of scattered objects, corpse windows, safe-city restrictions and item rarity require gameplay testing. Current numbers are domain-level defaults, **not** finalized product rules.