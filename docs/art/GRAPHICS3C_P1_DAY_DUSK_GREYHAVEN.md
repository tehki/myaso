# Graphics 3C — Greyhaven First Playable P1 day / dusk integration

**Source parent:** P44 World571 [Draft #648](https://github.com/tehki/myaso/pull/648) HEAD `d4f05394f6d45af59ef9cc24f8487d6b5db55f8f`. **Mode:** Development Draft / nonrelease. **Owned:** source-owned Graphics3C practical light / ground overlay only. No production `main`, `web/online-game.mjs`, collision, World9 authoritative map, Combat, Chat, assets/3B roof or Silver files changed.

## Authoritative projection
`src/browser/arena-viewport.mjs` retains `ARENA_VIEW_ZOOM=.84`, world XY +X right / +Y down, 8192-square World9 authored map and nominal 0.025m/world unit from `assets/environment/greyhaven/art-manifest.v1.json`. Source authored tavern `red-lion` [4240,3880,250,170], Blacksmith `smith` [3710,3850,182,162]. These are already-present **visual footprint references**, not approval to enable physics/door portals or new facade replacement IDs.

## The real existing Canvas integration
`createAuthoredWorldRenderer({greyhavenTimeOfDay:"day"|"dusk"})` is an **explicit optional constructor setting** on the original tile renderer; omission retains `"legacy"` with byte-equivalent original visual behavior. The setting is immutable for the renderer lifetime; toggling requires a fresh renderer/cache, so daytime tiles are never silently reused at dusk. No new renderer or network packets.

- Day: authored street and existing tree/building shadows retain original painter palette; small physical iron sconces remain, with the amber glass/glow disabled.
- Dusk: low-opacity `rgba(23,26,35,.14)` ambient wash is applied consistently to **every authored outdoor 512-unit tile**, removing the visible rectangular edge around Greyhaven while keeping a coherent dusk across the overworld. Warm pools remain localized to the original authored sconce anchors. Scene draw remains below players, combat tells and Chat/UI in the existing layer order.
- No client-owned light/vision, physics, collision, stealth, item possession, network time-of-day or animation. No weather. Only original source 3C Canvas code and tests changed.

## 3B/9 dependency and explicit nonclaims
Owner-approved Quaternius [3B #1054](https://github.com/tehki/myaso/pull/1054) actually lights front door glass and windows at dusk in source Blender; this 3C overlay **does not substitute** for that 3B asset and cannot claim a correctly lit Red Lion door. The distinct original Blacksmith [3B #1073](https://github.com/tehki/myaso/pull/1073) is P1 Blender review only, and World9 has not approved a chimney opening anchor or runtime replacement ID. **No fictitious chimney-origin smoke is emitted here.** Request exact signed 3B/World9 chimney-origin and roof occlusion contract for later bounded cosmetic smoke, keeping it out of fighters and windups.

## Acceptance required before integration
Node tests verify opt-in/default legacy, world-wide dusk continuity, World9 map-edge clipping, existing camera projection, cache ownership, fixture behavior and the preserved historical P44 source hashes (only the two scoped P1 renderer/atmosphere modules may diverge). On prior exact source head `52a4dd8065d2c697783225daa52e83f8ef4ad674`, native Chrome `156.0.8078.47` and Firefox `158.0.1` each rendered Red Lion and Blacksmith viewpoints in day and dusk: **8 genuine 960×540 source Canvas PNGs PASS**, artifact [#12925179104](https://github.com/tehki/myaso/actions/runs/40938743024/artifacts/12925179104). Per-image SHA256 and draw p50/p95 are in `original-source-native-report.json`; cache remained 6 tiles. This is renderer-only proof: 0 Rust players, no GPU-present measurement, and not gameplay acceptance. The world-wide dusk correction requires a fresh exact-head native rerun. **Still not independently verified**: 2/4 authoritative humans moving, 3B approved door-glass source art attachment, Blacksmith runtime smoke, physical multi-host, GPU-present FPS/texture/memory, or guarded Combat/Chat occlusion. 60FPS remains a target, not a claim. Full protected quality remains independent and unwaived.

**DRAFT · NO MERGE · NO DEPLOY · P0 default untouched.**
