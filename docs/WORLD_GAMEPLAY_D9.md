# World & Gameplay D9 — Collision-Certified Offline Expedition Trails

**Status:** independent draft, stacked on D8, D7, D6, D5, D4, D3, D2, D1 and foundation #336. No gameplay- or movement-authoritative multiplayer integration, no deployment, no server changes.

## Why

D8 offered a straight-line bearing and basic cartographic sketch, which can mislead the player across city walls, buildings and unbridged river. D9 adds seven deterministic, authored-geography-certified corridors between **consecutive expedition milestones**. Trails appear as amber paths on the same optional M-map. The compass remains a simple direct bearing; the on-screen caption explicitly differentiates it from the verified corridor.

A certified trail connects the **previous completed milestone to the next**, not the player's actual current location. If a player walks off the corridor, they must physically find and rejoin it. This is not a live route planner, a dynamic NavMesh, permission to cross structures, enemy tracking or server-verified movement.

## Generation contract

`scripts/generate-world-trails.mjs` performs bounded deterministic eight-neighbor A* on the **existing D2 authored collision map**, lattice spacing 32 world units. It uses a priority heap, Euclidean heuristic and stable neighbor/tie ordering. Grid points and every candidate adjacent edge are tested using D2's 18-unit-radius walkability query at <=4 world-unit intervals. Start/end anchors snap to unobstructed lattice points; the output path is greedily simplified only where the long segment passes an independent repeated <=4-unit sweep.

The result is committed in `src/world/certified-trails.mjs`, a deeply frozen generated module. The seven unique ordered legs have **17 total path points**:
- Red Lion → Roadside Herbs
- Roadside Herbs → Greyhaven Market
- Greyhaven Market → Old Mill
- Old Mill → Roadside Stone
- Roadside Stone → River Reeds, via bridge-accessible corridor
- Red Lion → Fallen Watch (5-point path around city wall and geometry)
- Fallen Watch → Watchpost Ore

Reproducible strict CI `node scripts/generate-world-trails.mjs --check` fails if the geometry, A* results or committed module differ. It never alters or regenerates designer-authored terrain, nor does it change live server collision. The generator searches only in development and CI, never in an animation frame. It produces fixed data for a small number of known expedition legs, not an open-world pathfinding service.

## Runtime boundaries

- `src/world/local-trails.mjs` exports `certifiedTrailForNext` and `localTrailDescription`. The latter is purely descriptive and read-only. Lookup is a seven-entry bounded table and uses the D7 local route stage state; none of the functions update player coordinates or route progress.
- `src/world/local-wayfinding.mjs` draws the matched certified polyline in amber where available. The D8 direct player-to-target line remains but is subdued for a route's first stage without a previous milestone; thereafter the correct milestone-anchored swept path replaces it.
- `web/world-preview.html` labels each active state as either "surveyed trail: N waypoints" or "direct bearing only" and warns about rejoining a corridor. Only the optional 248×248 canvas is affected, with its existing ≤4Hz refresh.
- `tests/world-certified-trails.test.mjs` checks deep immutability, exact D7 pair coverage, endpoint identity, 4-unit collision sweeps along all 7 legs, deterministic regen, missing/cross-map/completed route fallback, map renderer stage-aware line geometry, and absence of server/online runtime wiring.
- `.github/workflows/ci.yml` adds an independent strict D9 gate, preserving every inherited Combat, Core and browser acceptance.

## Security/limits

The certification is against one **static client-preview geometry version**, not a future server position, real combat movement, physics, dynamic doors, property placement, NPC obstacles, social structures, world crafting or player-driven terrain change. Swept sample tests use a fixed 18-unit local avatar radius and do not guarantee arbitrary alternative radii. The 32-unit A* lattice may not find every geometrically traversable corridor; a failed generation blocks CI rather than fabricating a path.

Production world routing (if authorized) needs signed versioned static world manifests, authoritative server-owned actor location, dynamic obstacles and zone-state, collision checks under the real tick protocol, memory/time budgets with 512+ players, restart/rollback and multi-client acceptance. No MOCMP/Moon Coin, items or rewards are involved.

## Acceptance

```
node scripts/generate-world-trails.mjs --check
node --test tests/world-certified-trails.test.mjs tests/world-wayfinding.test.mjs
# plus full existing tests, CI and browser acceptance
```

In the offline preview: choose **The Fallen Watch** while at the Red Lion; once stage one is visited the M-map shows a five-point, collision-certified amber path toward the ruins, bending through safe geometry rather than using the old direct diagonal through obstructions. The current bearing remains direct-line NW. Closing M stops map drawing. Switching routes updates the path in lockstep with route progress, and entering the Red Lion interior hides the outside sketch.

### Integration blockers

Parent #336 has strict inherited M151 browser-combat failure; D4 #380 has M144, D6 #389 has M194, D7 #394 has M171, and D8 #398's exact-head quality run #39502203917 failed inherited M194. These must be repaired through Combat/Development Center without weakening gates; D9 remains unmerged, draft, preview-only.
