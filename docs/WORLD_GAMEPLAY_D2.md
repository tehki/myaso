# World & Gameplay D2 — Collision-safe authored walking preview

Status: **local preview only**, stacked above D1 PR #359, which itself depends on World & Buildings PR #336. No live server authority, inventory, economic ledger, or production map transfers are enabled.

## Scope and evidence

The existing authored Moonvale map is the one designed in #336; this milestone consumes its landmarks, buildings, river, bridges, gates and Red Lion Inn furniture, without regenerating terrain or changing gameplay on the authoritative Rust server.

- `src/world/authored-preview-collision.mjs` provides a pure occupancy query and bounded per-frame, substepped movement with independent-axis sliding for the LOCAL preview.
- Buildings, Greyhaven's eight stone wall runs, interior solid furniture and the river are impassable in preview; bridges provide walkable lanes that connect to shore approaches; the rug remains decorative.
- Authoritative map / room spawn positions are checked for valid preview occupancy on local door transitions. No client destination is sent to the multiplayer server.
- Existing D1 landmarks remain reachable; tests walk between Greyhaven, the market, mill, northern watch ruin and across the west bridge.
- Trees, crops and furniture types not modeled here remain decorative; collisions cannot be activated online without a shared server-validated geometry format.

## Safety and authority

This module is intentionally named **preview**: browser collision is not security. Combat snapshots, stamina, movement prediction, server `World::step`, zone authority, and WebTransport packets are untouched. Never use the preview result as a client-asserted authoritative location, wall-pass entitlement, land-claim validation or proof of server reachable movement.

Before shipping buildings as physical multiplayer obstacles, Core & Multiplayer and Graphics must move authored world geometry into a versioned server-owned manifest with matching bounded spatial queries, stable map IDs, correct connected room/door state, safe spawn validation, replay/restart and a rollback path. World & Gameplay supplies traversal scenarios; Core owns movement/zone state correctness.

## Geometry and limits

- Player collision radius: **18 world units**, matching Rust authoritative fighter radius.
- Preview frame delta: maximum **16 world units**; movement steps of at most **4 units**, with slide attempts on blocked diagonals to reduce tunneling.
- Blocked/invalid map, NaN/infinite coordinates, oversized movement and out-of-world positions fail closed locally.
- The river polyline is treated as an impassable band whose half-width is augmented by player radius. A bridge's safe movement corridor covers the deck and extra shoreline clearance to prevent a walkability gap.
- Greyhaven gate coordinates and wall thickness mirror the existing #336 renderer. A single shared authored geometry schema is required before production; D2 does not silently alter visuals or Rust zone assumptions.
- All checks operate on the loaded local map's fixed geometry: up to 15 authored buildings, 8 wall spans, 8 river segments and 2 bridges. No generated physics bodies, map-wide NPC scans or server ticks introduced.

## Reproducible acceptance

`node --test tests/world-preview-collision.test.mjs` checks:
1. Exterior and interior spawns/portals remain reachable; all existing discovery anchors are on walkable ground.
2. Solid roofs, city walls and furniture block movement, with actual open west and north gates.
3. Deep river water remains impassable except at authored bridge decks.
4. Bounded swept movement cannot cross Red Lion walls, but preserves axis sliding.
5. Walking routes from Greyhaven to market, Old Mill and Fallen Watch remain fully traversable.
6. A complete King's Road crossing remains traversable, while a non-bridge river-crossing attempt fails.
7. Invalid map/coordinates and oversized requests fail closed; existing state is not mutated.
8. Deterministic interior movement and portal anchors.

Manual playable acceptance: load `/web/world-preview.html` from the D2 checkout, walk into the Red Lion roof/wall (blocked), use its nearby `E` portal (preview-only), avoid tavern tables, return outdoors, follow Greyhaven gate exits and pass a river bridge without clipping. D1 journal should still grant discoveries exactly once per session. Check that `web/online-game.mjs` is unchanged.

## Next stage

**D3** must be a separately reviewed contract, not an implicit deployment of D2: author a versioned shared collision geometry manifest; run Rust/JS parity fixtures; demonstrate real two-player server-mediated movement and portals with no collision ghosting or outside-room data leakage; add explicit headless-browser acceptance on Chrome and Firefox and measure authoritative 512-player load before enabling it. Do not merge D2 before both D1 and #336 are safely integrated.
