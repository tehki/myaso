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

Prior old-base 3C exact-head `737b048ab244322a8162a62fc2b8fb295d765a2e` passed focused source tests and real native Chrome 156.0.8078.47 / Firefox 158.0.1 source-renderer capture (eight 960×540 PNGs). This proves the source painter only, not gameplay. **This live-P0 transplant requires fresh exact-head CI and fresh native captures.**

The native script records source SHA, image SHA256, browser versions, cached tile count and draw p50/p95. It honestly records zero Rust players and no GPU-present measurements. Real 2/4-player World/WebTransport, player/building occlusion, Chat/Combat readability, physical-host WAN and GPU-present performance remain separate Main0 acceptance gates.

## Main0 coordination

Main0 #1141 owns one canonical Alpha integration candidate directly from the live P0 SHA. This 3C package is a source-only donor; Graphics 3/Main0 may transplant these reviewed blobs into that candidate. No old branch history is merged.

**DRAFT · DEFAULT OFF · NO MERGE · NO DEPLOY.**
