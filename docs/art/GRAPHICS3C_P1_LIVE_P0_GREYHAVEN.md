# Graphics 3C P1 — Greyhaven day/dusk source package on live P0

**Direct parent:** live Pre-Alpha P0 exact SHA `88c4733c90199ab3cabf7bc85ebb58d2f8760c58` (Main0 #1141).
**Workstream:** Graphics 3C / environment and atmosphere.
**Status:** DRAFT source package / no merge / no deployment / not yet an in-game Alpha.

## Source provenance and integration strategy

This branch is created directly from the exact live P0 source commit. It does **not** inherit the old P44/World571 or Chat C1 branch histories.

Only source blobs are transplanted:
- World9 authored map and named facade-replacement contract from the reviewed source of Graphics P1 donor #1106.
- Graphics 3C existing cached Canvas renderer and ground materials from #1106, with the explicit opt-in day/dusk extension from 3C source review #1109.
- P1 day/dusk focused tests and the real Chrome/Firefox source-renderer screenshot harness.
- The existing P0 `src/browser/arena-viewport.mjs` remains unchanged and owns the camera projection.

No `web/online-game.mjs` change is included. The new renderer modules are **not imported by the live P0 client**. The original arena remains the only public/default game path until Main0 creates and qualifies the canonical Alpha integration.

## World9 and renderer contract

- Canonical map `moonvale-overworld`, authored XY +X right / +Y down.
- Existing `ARENA_VIEW_ZOOM=.84`, nominal 0.025m/world unit, 512-unit cached Canvas tiles.
- Original Red Lion footprint [4240,3880,250,170]; original Blacksmith visual reference [3710,3850,182,162].
- World9's immutable facade replacement allowlist remains **only** `red-lion`. Blacksmith remains a visual reference, not an approved facade replacement, portal, collision or item grant.
- `createAuthoredWorldRenderer()` with no option remains `legacy`. Explicit `greyhavenTimeOfDay:"day"|"dusk"` creates a separate immutable cache per mode. Day sconces are unlit; dusk adds a subtle uniform wash to every outdoor tile plus localized original fixture pools.
- No collision, movement, map authority, door transfer, Combat, Chat, server protocol, time-of-day clock, weather or P0 UI behavior changes.

## Art status and holds

- Existing 3B Red Lion original Blender visuals are owner-approved art-source material, but the old integration draft #1111 is not qualified: its native review failed during Rust startup because `MYASO_CHAT_RADIUS` was outside the required 32..160 range; a separate standard M156 native test also retained a genuine timeout. Do not transplant its runtime web integration until corrected and requalified.
- Blacksmith R4 genuine Blender layers in #1110 remain review-only. The signed World9 `smith` replacement/occlusion contract is not approved; do not enable it.
- No runtime chimney smoke is emitted without a source-verified chimney anchor and approved World9 projection/roof occlusion contract.

## Acceptance evidence

**Live-P0 exact-head evidence (`abe62db4cf320d581a5fb5971ede6479e8e726a8`, 31 Oct 2026):** focused tests 13/13 PASS; native Chrome 156.0.8078.47 + Firefox 158.0.1 captured all eight 960×540 PNGs PASS; artifact [#13049545805](https://github.com/tehki/myaso/actions/runs/41218989670/artifacts/13049545805). Both browsers rendered Red Lion and Blacksmith day/dusk with six cached tiles, buildLimit=3, `createdPerDraw=[3,3,0,0,0,0,0,0]`. Warm draw p95: Chrome 0–0.1ms, Firefox 2–3ms. Cold batch timings are separately reported (Chrome 3.1–21.3ms; Firefox 6–64ms). These are headless Canvas source-renderer timings, **not GPU-present frame timings or gameplay acceptance**. Protected quality completed with one failure only: `git diff --check` found two trailing spaces in this document; all preceding source, browser-flight and capacity probes completed. This formatting-only issue is being corrected and the exact-head protected workflow must rerun.

The native script records source SHA, image SHA256, browser versions, cached tile count and draw p50/p95. It honestly records zero Rust players and no GPU-present measurements. Real 2/4-player World/WebTransport, player/building occlusion, Chat/Combat readability, physical-host WAN and GPU-present performance remain separate Main0 acceptance gates.

## Main0 coordination

Main0 #1141 owns one canonical Alpha integration candidate directly from the live P0 SHA. This 3C package is a source-only donor; Graphics 3/Main0 may transplant these reviewed blobs into that candidate. No old branch history is merged.

**DRAFT · DEFAULT OFF · NO MERGE · NO DEPLOY.**

## 31 October — Graphics 3C roadside vegetation pass

The existing 3C cached terrain-material painter now includes a **static, bounded
roadside shrub layer** on the World9 city verge. Source positions come from a
deterministic world-coordinate lattice (62-unit spacing), with a hard maximum
of 14 low shrubs per cached 512-unit tile. Every shrub is outside the authored
road corridor, at least 24 world units clear of every source building footprint,
and outside every portal radius plus 52 units. 60-unit city-edge insets prevent
planting over the fixed city wall. Camera movement and zoom cannot reseed the
plants; the same tile padding preserves consistent seam-crossing leaves.

The shrubs are **2D ground decoration beneath actor, HUD and combat rendering**.
They introduce no collider, pathfinding obstacle, tree/roof occlusion,
gameplay visibility, animation, particles, network messages or clock. Existing
P0 online game remains unchanged and the Greyhaven renderer remains unimported
and default OFF. Red Lion building geometry is intentionally not edited
while Graphics 3B rebuilds the asset.

Focused node/world tests now require reproducible bounded shrubs, source
building/portal clearance, no interior vegetation, and tile-edge agreement.
Exact-head browser source PNGs, new color comparisons and full protected quality
must be reverified on the current SHA; previous green runs are historical only.
