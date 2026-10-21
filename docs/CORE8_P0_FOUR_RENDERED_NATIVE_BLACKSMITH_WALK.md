# Core 8 P0 — four genuine rendered Greyhaven browsers physically walk to the original Blacksmith rack

**DRAFT / ONE CI HOST / PRIVATE LOOPBACK ONLY / NOT FIRST PLAYABLE / DEFAULT OFF**

## Why this gate exists

Previously Core 8A's four-real-Chrome/Firefox walk to the four original Blacksmith approaches and the authentic Graphics3B Blacksmith rack inside the original city were proven in **separate** native sessions. Independent green tests on one source tree do not prove players actually travel while the authored Greyhaven city and rack stay visible in the SAME four browsers.

This test combines them in one real Chrome1 / Firefox2 / Chrome3 / Firefox4 browser flight, with one actual Rust WebTransport server using TLS pin, four server-owned fighters at real Greyhaven spawns and 23 reviewed static obstacle rectangles.

## Source boundaries

- New `scripts/alpha_p0_four_native_rendered_rack_walk.mjs` is an opt-in QA fork of the unchanged Graphics3B real-browser empty-rack preview, not a runtime gameplay handler. It preserves the exact authentic World canvas / original Blender rack / strict Rx, ACK, HUD and Canvas painting acceptance before it walks.
- `web/online-game.mjs` provides `window.__MYASO_NATIVE_RACK_WALK_READONLY__` **only** for `world=1&armoryart=1&nativeRackWalkProbe=1`, no `scenario`, on explicit loopback origin. The closure snapshots actual received `networkClient.state` actor positions and `networkClient.latestServerTick` into freshly frozen copies. No mutable map, item ID allocator, ownership writer, action modification, privileged movement, or observer-fed authority.
- Four original `WORLD_ALPHA_SWORD_RACK_SOCKETS` and same Core 8A `nextNativeWalkPulse` west-first, then north route. Each of four **real browsers** W3C clicks actual `#arena`, sends real W/A/S/D down/up keyboard events, and individually verifies the resulting new Rust-owned position/tick. At end all four browsers must independently see **all four actual fighters at four distinct original World sword approaches** within 18 units while the original city Canvas stays painted and the first-party rack remains visibly present.
- Preserve real WebDriver before/after PNG and original-world proof, plus 4 additional arrival screenshots; emit `ALPHA_P0_FOUR_REAL_RENDERED_BLACKSMITH_WALK_PASS` only after all checks.

## Hard gates

`node --check` web + acceptance program, `node --test tests/core8-real-rendered-rack-walk-contract.test.mjs tests/alpha_p0_rack_walk_math.test.mjs tests/armory-optin-live-rack.test.mjs`, pin original 23-static-solid SHA, compile actual Rust, then complete the genuine native browser journey under the focused Actions workflow. The exact combined source also requires original full protected `quality`, Core combined and independent UI/Graphics native checks.

Local Windows source result: **15/15** focused Node tests PASS, source syntax PASS and static source SHA `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43` PASS. The live four-browser journey needs its own exact-head CI and is not a PASS until that workflow completes successfully.

## Critical nonclaims

No physical swords exist on the drawn rack. It intentionally renders **zero** sword sprites because no selected globally exclusive Core8B/Items writer and server-authoritative item feed exists. No pickup, sword alpha-click, canonical `u128` equipment, durable transaction, MainHand ACK/outbox, armed Combat or death/drop/rejoin can be inferred.

Only 23 reviewed static solids have authority; river and dynamic objects are not complete. Four browser processes share ONE CI machine, not four independent player computers or a separate private staging host. This QA-only opt-in is neither main branch integration nor production approval. Do not widen listener, weaken TLS, relax Combat tests, bypass World/Physics/Item approval or fabricate sword states.
