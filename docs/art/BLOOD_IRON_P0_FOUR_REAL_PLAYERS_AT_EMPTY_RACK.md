# 🌕⚡️🚀 Graphics 3B P0 — four actual Greyhaven players reach the original Blacksmith rack

**Moon Games / myaso.io — 21 October 2026 · First Playable #480 · physical four sword target #488.**

## Scope and exact parent

This is an isolated Graphics 3B **DRAFT** child of [actual client original-empty-rack #603](https://github.com/tehki/myaso/pull/603), exact source `6f90c887821a31e93474051c9eb404b9b82fa862`. Parent [dedicated four-real-native-browser #39634899012](https://github.com/tehki/myaso/actions/runs/39634899012), parent full [protected quality #39634898995](https://github.com/tehki/myaso/actions/runs/39634898995) and combined Core CI #39634899379 all **PASS**. Existing default four-browser test and original client are not replaced or weakened.

**Important distinction:** #603 proved that a real connected browser loads/paints an original source-Blender empty rack somewhere in the Greyhaven scene, but not that a rack is **fully onscreen when a player physically arrives**. Core8A [#608](https://github.com/tehki/myaso/pull/608) independently proved authenticated real browser WASD travel and arrival at the four World-authored approaches. This branch combines those constraints without creating fake gameplay or item identities.

## Exactly original World and Graphics source

Original World9 authored Greyhaven `src/world/alpha-armory.mjs` defines four independent sword racks at `(3740,4038), (3780,4038), (3820,4038), (3860,4038)` and safe player approaches `(3740,4088), (3780,4088), (3820,4088), (3860,4088)`. The original Smith building bottom is y4012; an 18-unit radius fighter can catch the east corner during north-first path. Core8A #608 corrected movement **WEST FIRST along safe southern courtyard and THEN NORTH**, with strict state re-read after each W3C key-up and an extra 220ms post-release fence. This branch uses that exact Core8A pure coordinate planner; original World collisions, geometry, actual Rust server actor movement, Combat, player network packets and Core8A production code remain untouched.

Original Graphics3B fully source-alpha Blender rack WebP SHA `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8` (240×166 pixels). The original separately modeled sword WebP SHA `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31` is decoded, but NO source sword is painted in the actual client because no authenticated Core8B/Items on-rack item feed is available. No asset re-encoding or new scene.

## Graphics 3B-only read-only source visibility

`src/browser/armory-optin-live-rack.mjs` augments its existing source sprite-plan `status()` with `rackScreenRect`, `rackIntersectsViewport`, and **`rackFullyWithinViewport`**, all derived solely from *the original World source camera projection and original 240×166 rack sprite bounds*. These are **rectangle geometry assertions**, NOT a Canvas pixel readback or a proven full-visibility/occlusion test. At all four exact source approach camera positions, the unchanged original rack rectangle fits completely within the 640×640 test viewport with game zoom 0.84; at a far-away camera it is wholly outside.

`web/online-game.mjs` exports these additional read-only fields through the already default-off, localhost-only `?world=1&armoryart=1` diagnostic. It also lists `observedReplicatedFighters:[{netId,x,y}...]` from the **actual current WebTransport replicated server state**, which allows *external W3C native browser QA* to verify positions without altering browser/network/server movement. This read is NEVER an authorization source for World placement, items, collision, pointer pickup, rendering equipment or gameplay. No mock positions, injected network snapshots, `TryPickup` or state setter.

## Separate dedicated real four-browser acceptance

`scripts/alpha_p0_four_native_rack_at_approaches.mjs` is a narrow fork of the already green 3B original four-native-client source flight. It boots one genuine local **Rust pinned-cert WebTransport** authority with reviewed 23 solids, launches **four real W3C Chrome/Firefox browsers**, each authenticates into one shared Greyhaven world and starts with current genuine HUD tick, ACK/snapshot and painted original World checks. AFTER preserving the original four-player W3C keyboard and HUD progress, the new test uses genuine W3C keyDown/keyUp packets (never forced browser actor coordinates) to approach the **four distinct World socket approaches** west-first, north-second. For each it checks full four-actor replicated roster, each freshly observed real position within original <=18 world-unit radius, and the rack's source rectangle FULLY inside the actual browser canvas. It then requires ALL FOUR browsers independently observe ALL FOUR actual final replicated positions within their exact source approach bounds, retain the real rack and 0 swords, and captures FOUR original-browser native screenshots and one JSON evidence report.

**Caveat:** Same-host loopback four genuine browser processes, not separate machines. Rack source bounding rect fully within screen does NOT prove sword-alpha click, hidden-door/character depth, true source pixels read back, server item ownership, MainHand equip or combat. True first playable acceptance still requires server-owned four actual swords, physical sword pointer gestures, unarmed/armed PvP, four independent hosts and X230i low-end acceptance. The original four-player script and protected Combat tests are not changed.

## Strict evidence gate

`tests/armory-optin-four-at-rack.test.mjs` adds 5 local pure original-source tests for verified original World positions, 240x166 rack projection at each approach camera, Core8A west-first bounded W3C planner, real native test structure, no fake net/identity/item mutation, and isolated CI gating. **12/12 total local focused tests PASS** (5 new + 7 protected-green parent test cases); new `.github/workflows/graphics3b-p0-real-rack-approaches.yml` builds the original Rust authority and runs the new four-real-browser test in addition to source and original no-sword tests. The workflow is **mandatory**, failure keeps this draft red; optional screenshot artifact storage errors cannot override the test's exit code.

The test's current exact-head CI and screenshots must be reviewed **before claiming native runtime success**. Don't infer green from parent #603 or Core8A #608. If a browser is obstructed by an original physical solid, preserve actual server positions, W3C key/action and shell logs; never teleport, widen arrival tolerance, bypass geometry or simulate `TryPickup` to obtain a pass.

## Central P0 owners / merge HOLD

Core8B+Items2B: one durable writer for authentic `u128` item/ground identity, actual committed current rack presence, server reach/LOS and revision/epoch; Core8A: authenticated `TryPickup` ACK, observer replay/denial, reliable reconnect; World9/Physics: current same-zone/collision/approaches; UI10+Combat4: one actual WebP alpha gesture owner; Graphics3A: genuine Silver MainHand, complete kick/roll/pickup actions; Graphics3C: X230i module load and first-frame reliability. Main Orchestrator alone merges/deploys only after full end-to-end acceptance.

**Status: IMPLEMENTED + pure local TESTED; separate real-four-browser Blacksmith approach CI PENDING; NOT INTEGRATED, AUTHORITATIVE ITEM-READY OR PLAYABLE.**
