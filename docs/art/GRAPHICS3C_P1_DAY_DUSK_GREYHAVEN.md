# Graphics 3C — Greyhaven First Playable P1 day / dusk integration

**Source parent:** P44 World571 [Draft #648](https://github.com/tehki/myaso/pull/648) HEAD `d4f05394f6d45af59ef9cc24f8487d6b5db55f8f`. **Mode:** Development Draft / nonrelease. **Owned:** source-owned Graphics3C practical light / ground overlay only. No production `main`, `web/online-game.mjs`, collision, World9 authoritative map, Combat, Chat, assets/3B roof or Silver files changed.

## Authoritative projection
`src/browser/arena-viewport.mjs` retains `ARENA_VIEW_ZOOM=.84`, world XY +X right / +Y down, 8192-square World9 authored map and nominal 0.025m/world unit from `assets/environment/greyhaven/art-manifest.v1.json`. Source authored tavern `red-lion` [4240,3880,250,170], Blacksmith `smith` [3710,3850,182,162]. These are already-present **visual footprint references**, not approval to enable physics/door portals or new facade replacement IDs.

## The real existing Canvas integration
`createAuthoredWorldRenderer({greyhavenTimeOfDay:"day"|"dusk"})` is an **explicit optional constructor setting** on the original tile renderer; omission retains `"legacy"` with byte-equivalent original visual behavior. The setting is immutable for the renderer lifetime; toggling requires a fresh renderer/cache, so daytime tiles are never silently reused at dusk. No new renderer or network packets.

- Day: authored street and existing tree/building shadows retain original painter palette; small physical iron sconces remain, with the amber glass/glow disabled.
- Dusk: bounded `rgba(23,26,35,.20)` static muted wash **only inside authored Greyhaven city** on cached 512-unit tiles, then the same source-owned warm sconce pools above the wash. Scene draw remains below players, combat tells and Chat/UI in the existing layer order.
- No client-owned light/vision, physics, collision, stealth, item possession, network time-of-day or animation. No weather. Only original source 3C Canvas code and test added.

## 3B/9 dependency and explicit nonclaims
Owner-approved Quaternius [3B #1054](https://github.com/tehki/myaso/pull/1054) actually lights front door glass and windows at dusk in source Blender; this 3C overlay **does not substitute** for that 3B asset and cannot claim a correctly lit Red Lion door. The distinct original Blacksmith [3B #1073](https://github.com/tehki/myaso/pull/1073) is P1 Blender review only, and World9 has not approved a chimney opening anchor or runtime replacement ID. **No fictitious chimney-origin smoke is emitted here.** Request exact signed 3B/World9 chimney-origin and roof occlusion contract for later bounded cosmetic smoke, keeping it out of fighters and windups.

## Acceptance required before integration
Node focused test `node --test tests/greyhaven-p1-day-dusk-3c.test.mjs tests/greyhaven-atmosphere-3c.test.mjs tests/greyhaven-environment-3c.test.mjs` verifies opt-in/default legacy, authored city mask, existing camera projection, cache ownership and dusk-only glows. Fresh exact-source CI required. **Not yet independently verified**: actual Chrome/Firefox world source image captures (day/dusk), 2/4 authoritative humans moving, 3B approved door-glass source art attachment, Blacksmith smoke, physical multi-host, GPU-present FPS/texture/memory, or guarded Combat/Chat occlusion. 60FPS remains a target, not a claim. Full protected quality remains independent and unwaived.

**DRAFT · NO MERGE · NO DEPLOY · P0 default untouched.**
