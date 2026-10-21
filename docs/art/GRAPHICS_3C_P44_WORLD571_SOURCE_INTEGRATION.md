# 🌕⚡️🚀 Graphics 3C P44 — World #571 + Graphics 3C first integration gate

**21 October 2026** · myaso.io / Moon Games First Playable Alpha · **draft integration candidate only**

## Scope and exact source

- Base: [World/Core integration #571](https://github.com/tehki/myaso/pull/571), exact parent `9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59` (World #521 consolidated + Core #560 scratch branch; not accepted on `main`).
- Visual source: unmodified original Graphics 3C [P43 #628](https://github.com/tehki/myaso/pull/628) at `ef78df8b065a03399c0047e785587e707852bc07` for terrain, atmosphere, authored painter. The combined branch adapts **only its source interface** to canonical World #521; no artist WebPs, World maps, collision or network changes.
- Real authored World map SHA256 on Linux: `d48c495f3a23881154ce6c93452c44cb7587ebd3707f9434098439d1a67d1987` — identical across #571 and P43 original source.

## What broke on naive merge, and why

Directly substituting the original P43 renderer into #571 produced **50/54 passed, four World-owned contract failures**. Earlier 3C P43 was stacked on a World version without canonical `building-presentation.mjs` and required a separately injected validator for any facade suppression. World #571 already requires `normalizeWorldBuildingReplacementIds` as its canonical fail-closed allowlist and expects all authored building and portal drawing operations on every Greyhaven **cached city tile**.

The integration fix does **not weaken, delete or skip any World test**:

1. Import `normalizeWorldBuildingReplacementIds` from the *actual* World module, invoke it unconditionally for the original replacement list, and freeze the approved IDs. Optional caller-provided stricter callbacks may reject/validate further, but cannot authorize even a single World-forbidden ID, duplicate or unknown building.
2. Retain World #571's exact original city-tile placeholder contract: on each tile that overlaps Greyhaven city bounds, draw every original World building except canonically approved suppressed IDs, and draw authored portal arcs. Still cull the whole presentation group when the tile is *outside* the city. Preserve streets, terrain/river, 3C lighting/materials, city walls, tree culling, tile build limit 3, cache cap 24, collision and portal coordinates unchanged.
3. Adapt only the newly copied 3C source-level test to call the **real** World validator rather than assume an absent API. The World test suite, including its exact original caller-visible drawing counts and statically asserted code shape, remains intact.

**Corrected cross-department tests: 54/54 PASS** on the native Linux X230i with all unchanged #571 original World tests and new Graphics 3C art/validator tests. Naive source merge had 50/54; no masking.

## Native art parity against original P43

Original P43 renderer source and new integrated P44 source are served from distinct read-only localhost URLs, with the actual World #571 authored maps and original World validator shared across both modules. In **real native Chromium 152 on X230i**, the full 640×480 RGBA surface using the original opaque Canvas with independent readback has **zero changed RGBA bytes on all six tested camera scenes** after five original 512×512 tile-cache draws per case (buildLimit 3, cacheCap 24):

- Red Lion default / Red Lion replacement at zoom 0.84
- Red Lion pan at zoom 1.0
- Blacksmith at zoom 0.84
- South Greyhaven at zoom 1.2
- Northern wilderness at zoom 0.84

Original portal/facade split and World canonical only-one-building suppression remain unchanged in pixel outcomes for these limited real browser scenes. This does **not** prove all map cameras/zooms, full actors/occlusion, four players, authored physical sword racks, browser present/FPS, full world item/Combat integration or actual matchmaking.

Committed source-exact native JSON: `assets/environment/greyhaven/3c-p44-world571-parity/x230i-chromium-native.json`; optional reproducer: `tools/art/probe_p44_world571_3c_render_parity.mjs`. The original baseline source and integrated source are identified by recorded SHA256, not fabricated pictures. X230i has no Firefox browser; no Linux Firefox claims. Windows native **Chrome 154.0.8037.99** and **Firefox 153.4.0** have now independently completed the same source-pinned **six scenes each = 12 exact RGBA A/B comparisons**, with **0 changed pixels/bytes in all 12**, zero HTTP/JS errors. Raw Windows report is committed at `assets/environment/greyhaven/3c-p44-world571-parity/windows-chrome-firefox-native.json`. The optional harness also now skips redundant directory creation when a report path is directly in the Windows drive root; report writing no longer masks successful browser comparisons as a test failure. This bounded source-only parity **still does not demonstrate full online-game performance, physical swords or multiplayer gameplay**.

## Governance and remaining blockers

- World #571 itself is a **scratch open draft**, not `main` or an accepted full playable. This child PR stays **DRAFT** for the Graphics and Core orchestrators, not an automatic release candidate.
- Do **not** turn on facade suppression for `web/online-game.mjs` until approved 3B visual facade/roof and true depth are present; game still opt-in `?world=1`, actual 4-authoritative-player cities / racks/pickup / fists+sword PvP are not accepted.
- Protected exact-head full CI including Combat remains required; earlier related P43, P42 and P41 branches had inherited/intermittent mandatory Combat failures and no causal clearance.
- Main orchestrator #360 + Alpha gate #480 govern integration and deployment. No independent merge, deploy, network change, token/wallet action or production restart.

**Result: 3C source-to-World #571 integration contract fixed locally and isolated native Chromium pixel parity demonstrated; First Playable still NOT accepted.**
