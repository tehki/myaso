# World & Gameplay D8 — Traveler's Compass and Moonvale Sketch

**State:** isolated, draft **OFFLINE PREVIEW** milestone stacked on D7 #394; no live simulation, navigation authority, identity, economy, loot, land claims or network changes.

## What players see

When a local expedition is selected, the optional Wayfinding strip shows the next stage's *straight-line cardinal bearing* (N/NE/E/SE/S/SW/W/NW), distance in authored world units, and target name. Press **M** to open or close a small 248 × 248 sketch of Moonvale. The map contains only already-authored fixed rivers, roads, bridges, city walls, buildings and the player's position. It marks the next selected expedition target with an amber dot and draws a line to it. The current player is a white dot.

The line **is not a navigable route**: it can pass through buildings or water. Follow real authored roads, bridge decks and gates to travel safely. This deliberately avoids a misleading turn-by-turn path solver without graph validation. The map must never reveal server-side actor positions or economic resource stock; the only possible remote point shown is the target already revealed by the selected local expedition narrative.

No route chosen or a completed route: only a player map dot, without any target. Inside the Red Lion interior the full-world sketch is hidden and compass shows no overworld bearing.

## Architecture and performance

- `src/world/local-wayfinding.mjs`: two pure browser-preview-only helpers, `localWayfindingHint` and `drawLocalWayfindingSketch`. Geometry and valid player position reuse D2's local collision check, while the destination comes from D7's *next* ordered stage. Invalid/nonfinite coordinates, wrong zone, unknown/complete routes return no target; malformed canvas/size/location rejects rendering.
- `web/world-preview.html`: lightweight compass text and opt-in **M** toggle; open/closed sketch state is kept in one nonpersistent boolean. It updates at most once per 250 ms while rendering and never creates new world geometry or tile canvases. The map draws O(number of static authored roads, bridges, buildings) shapes only when visible. Closing the panel stops all additional map drawing. Existing D7 path events and D6 field notes remain unchanged.
- `tests/world-wayfinding.test.mjs`: eight-direction geography, coordinate distances, state change and completion, invalid/cross-zone positions, deterministic bounded canvas geometry, no target leakage without a route, user-controlled toggling and no production networking references.
- Additive `.github/workflows/ci.yml` D8 gate with no test removal.

The sketch contains *visual map content*, not a navigation mesh. There is no pathfinding, line-of-sight promise, dynamic collision, procedural terrain, NPC tracking, enemy locations, currency, quest credit, inventory, on-chain settlement, loot or persistent UI state.

## Reviewer acceptance

Run `node --test tests/world-wayfinding.test.mjs tests/world-local-expeditions.test.mjs`, and full required GitHub quality. Serve repo root and open `/web/world-preview.html`, choose **Greyhaven Circuit**: at the Red Lion, the next target after its auto-visit is Roadside Herbs with a compass bearing toward the east. Press **M**: sketch appears. Press M again: sketch disappears, while compass continues. Walk east and inspect herbs with F: compass advances to Greyhaven Market. Enter the Red Lion: sketch is hidden and no overworld bearing appears. Exit: the route target returns. Finish route: no target. Reload: map closed and route cleared. All work is session-only.

Strict upstream CI blockers remain unrelated Combat browser acceptance gates: authored world #336 M151, D4 #380 M144, D6 #389 M194, D7 #394 M171. Do not bypass or merge this PR independently. Core & Multiplayer owns actual server position, authoritative interaction and any production navigation design. All merges and deployment remain centrally coordinated.
