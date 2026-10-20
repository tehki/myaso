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