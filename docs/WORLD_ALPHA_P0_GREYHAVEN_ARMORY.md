# World & Gameplay P0 — Four-Sword Greyhaven Armory Layout

**Department 9 / First Playable Alpha.** Owner requirement: [armory gate #488](https://github.com/tehki/myaso/issues/488), with central [alpha gate #480](https://github.com/tehki/myaso/issues/480). **Draft** branch `feat/world-alpha-p0-greyhaven-armory-sockets`, directly based on World foundation [#336](https://github.com/tehki/myaso/pull/336); deliberately does not depend on D1–D19 exploration or the separate Red Lion art-replacement PR #484.

## Minimum player experience and zone decision

All four players join **one shared Greyhaven overworld**. They walk from Core 8C's proposed four **server-assigned** staging spawns to the existing authored building `smith` (Blacksmith) at **(3710,3850), width 182, height 162**. The simplest P0 armory is an **open-front weapons rack along the south side** of the existing Blacksmith building, outside its collidable rectangle, without a zone transfer or second server-world interior. This preserves the established city layout and avoids importing optional tavern transfer semantics into First Playable.

| Fixed socket ID (NOT world-item ID) | Sword render/world anchor | Walkable player pickup position |
| --- | --- | --- |
| `greyhaven-rack-1` | (3740,4038) | (3740,4088) |
| `greyhaven-rack-2` | (3780,4038) | (3780,4088) |
| `greyhaven-rack-3` | (3820,4038) | (3820,4088) |
| `greyhaven-rack-4` | (3860,4038) | (3860,4088) |

All coordinates are in **`moonvale-overworld` world units**. There are exactly four stable, frozen slot definitions with `displayCategory:"sword"`; these IDs only identify **rack sockets**. **Core 8B + Items 2B** must mint/recover four different canonical authoritative **world-item IDs**, associate one item with each socket, atomically transact socket → equipped hand and replicate equip/removal/denial to all players. This World module does **not** define item kinds, real loot IDs, client inventory, player ownership, click hitbox, pickup rights, PVP hit/damage or a network packet.

The player's rendered click target **must be the actual sword pixels**, not a whole rack or menu. Graphics 3A/3B/3C owns four distinct sword drawings and hand attachments. UI/Combat owns one gesture arbitration path: valid sword LMB selects `TryPickup` without performing light/heavy; blank-area LMB retains the existing combat input. Actual server range/LOS/zone/death checks and player motion come from Core/Physics, not from this document or a client-side distance check. Unarmed punches remain a Combat-owned first-class fallback.

## Collision and reachability evidence

The fixed authored World #336 building `smith` ends at y=4012. Rack anchors y=4038 are 26 units south of its colliding rectangle, and player stands y=4088 are 76 units south. The four adjacent anchors and player stands are spaced **40 units** horizontally, allowing four distinct **18-unit-radius** player circles to stand next to one another without overlap.

Verified against the existing *independent D2 authored-preview collision implementation* on the previously unmerged World D17 review branch, with default radius **18** and the D17 **32-unit graph / ≤4-unit sampled edges**:
- All eight rack and standing coordinates returned **walkable=true**.
- Core 8C staging proposals `(4110,4160), (4206,4160), (4110,4256), (4206,4256)` all returned **walkable=true**.
- D17 deterministic `auditAuthoredConnectivity` from (4110,4160) found **8/8 rack/stand targets reachable**; **62,648/66,049** graph vertices visited.
- A second independent, strict foundation-only test checks four player spawn-to-rack paths via existing unobstructed city waypoints (3990,4180) → (3980,4090), sampling every ≤4 units against **all 15 existing authored building rectangles** with 18-unit avatar clearance, and bounds the whole path within the city wall interior. It does not replace D2 river/wall collision or Core's authoritative collision proof.

**Critical qualification:** D2's preview geometry is *not* wired into the authoritative server. The P0 server cannot trust these coordinates without a matching versioned server-side wall/building geometry and actual tested client/server movement. These tests establish a geometrically plausible layout and a shared contract, not gameplay/pickup success.

## Files and interfaces

- `src/world/alpha-armory.mjs`: immutable `WORLD_ALPHA_ARMORY`, `WORLD_ALPHA_SWORD_RACK_SOCKETS`, four Core 8C proposed staging spawns, `getWorldAlphaSwordSocket(socketId)`, and authoring-only layout self-validation. All are pure immutable data/function exports; no client or server activation.
- `tests/world-alpha-armory.test.mjs`: six strict tests for layout, ID uniqueness, no implicit items, physical clearance, four simultaneous stand positions, 16 independently sampled spawn→rack approach paths and no accidental coupling to live server, WebTransport or combat.
- `.github/workflows/ci.yml`: additive strict P0 World armory gate. Existing Rust, Combat, browser, server authority and networking validation retained without modification.

## Required cross-department signoff

1. **Core 8C + Physics:** accept/propose source-of-truth version for server collision, actual spawn occupancy and reachability; agree whether open-front rack is valid for First Playable. If the map layout conflicts with the actual server physics, **block integration** and jointly revise authored coordinates.
2. **Graphics:** place the actual four visible swords and rack on those exact anchors, align to actor silhouette/zoom and preserve hit shapes at arbitrary viewport/camera. Confirm 40-unit spacing is visually usable in Chrome/Firefox and equipment attaches correctly to all four Silver Knights.
3. **UI + Combat:** mouse click on rendered sword (not rack background) suppresses attack for that gesture; clicks elsewhere preserve original combat. No fake inventory menu or auto equip.
4. **Core 8B + Items 2B:** supply authoritative item IDs/loot transaction, range+LOS+epoch proof, same-sword race safety, hand visual replication, drop/re-pickup and reconnect/death invariants.
5. **Main Orchestrator:** coordinate one actual **4 independent-client** shared-world test, exact-head full quality and current-main rebase, no independent merge, production restart or deployment.

**Readiness:** IMPLEMENTED + TESTED (world-only static authored contract); **INTEGRATION-READY: NO**, **INTEGRATED: NO**, **PLAYABLE: NOT PROVEN**. This does not itself render swords, implement pickup, connect 4 browsers or enable collision/server authority. Keep optional Economy/Moon Coin disabled.
