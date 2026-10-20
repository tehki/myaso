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
- **No durable persistence yet.** The snapshot has no disk encoding, transaction log, durable-account binding, atomic storage commit, encryption or crash recovery. Ephemeral fighter IDs must not become storage keys. A later adapter must authenticate durable characters and commit inventory/corpse/ground changes atomically, preserving global ID allocation across restarts.
- These are **domain-level APIs only**, not durable storage or the realtime replication wire format; they must not be invoked using client-provided actor positions, character identities or zone IDs.
- The domain is **not** connected to transport, live simulation events, renderer or storage. No new dependencies or changes to authoritative melee, snapshots, game controls, certificates, production data or deployed code.

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