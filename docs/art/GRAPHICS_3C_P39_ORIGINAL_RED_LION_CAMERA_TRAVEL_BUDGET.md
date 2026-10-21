# Graphics 3C P0 — actual Red Lion three-source moving-camera Canvas budget

**Moon Games / myaso.io First Playable Alpha · 2026-10-21**
**Readiness:** isolated source browser PERFORMANCE MEASURED; low-end Firefox frame budget **NOT PASSED**; First Playable integration **BLOCKED**.

## Source and test boundaries

Independent unchanged, SHA-verified original sources: World [#521](https://github.com/tehki/myaso/pull/521) head `3178b9aad8757ceb3594ff04b9e3099dced6b729`, original Graphics 3B Red Lion [#481](https://github.com/tehki/myaso/pull/481) head `c107f613c2f646e99693bc0af0f76ba4795c5364`, original day/dusk facade + byte-identical historical roof WebPs (SHA-checked), Graphics 3C's [draft #419](https://github.com/tehki/myaso/pull/419) cached authored World renderer head `350f12698aa1852594a25da023f4c27e7c42afe2` at capture. The original World #521 `normalizeWorldBuildingReplacementIds` validates the only visual replacement, and original Graphics 3B `createRedLionAlphaArtAttachment` computes facade/roof placement at game zoom `0.84`. No original source, geometry, WebP, Combat/Physics, server, inventory or live client is edited.

The optional test-only `tools/art/benchmark_p0_world521_3b481_3c_moving_camera_browser.mjs` builds **actual 3C cached 512-world-unit tiles, max 3 new per draw and 24 retained**, together with the original 3B day/dusk facade and roof. Separate mode cohorts:

- `placeholder`: original World Red Lion authored building still present;
- `facade-day`: canonical World-approved removal + original 3B day WebP + roof;
- `facade-dusk`: same with original dusk WebP + unchanged roof.

The original real Chrome/Firefox P38 four-panel pixel acceptance is repeated as an invariant (authentic art changes the facade, simulated missing-art fallback equals the original placeholder, all source errors rejected). **Performance sampling is additional**: each run performs 2 camera routes (`red-lion-local` and `red-lion-to-street`), 72 draws per route, 2 trials, 3 modes = **864 Canvas calls per browser**, with mode order reversed on trial 2 to reduce order effects. Every sample includes `performance.now()` elapsed synchronous Canvas self-time, whether a new world tile was created and cache size, before/after source mode, route and trial. New tile cap 3 / cache cap 24 are checked on every draw. Screen width 640, height 480, 0.84 zoom, DPR1. No throttling, screenshot capture, page automation, network call or actor rendering occurs **inside** timed draws.

This is **not** game FPS: it omits game loop, player input, actor animations, network, physics, UI, layout/compositor GPU presentation and two-to-four-person load, and the benchmark runs on a fixed machine/browser without independent full-game replication. Hardware conditions, Firefox timer granularity, Canvas buffering, JIT/GC and asset scheduling can change the result. The measured threshold `16.7 ms` is only a useful provisional Canvas budget marker, **not** a test assertion or a waiver of full frame-performance acceptance.

## Authentic native Chrome/Firefox evidence — two independent complete runs

| Synchronous Canvas call measurement | Chrome 154 / initial | Chrome 154 / repeat | Firefox 153.4 / initial | Firefox 153.4 / repeat |
|---|---:|---:|---:|---:|
| Timed draws | 864 | 864 | 864 | 864 |
| Cold calls with at least one tile created | 30 | 30 | 30 | 30 |
| Warm calls with zero new tiles | 834 | 834 | 834 | 834 |
| All draws exceeding 16.7 ms | **0** | **0** | **18** | **39** |
| Cold calls exceeding 16.7 ms | **0/30** | **0/30** | **17/30** | **20/30** |
| Warm calls exceeding 16.7 ms | **0/834** | **0/834** | **1/834** | **19/834** |
| Worst measured draw | 15 ms | 10.7 ms | **432 ms** | **106 ms** |

The duplicate cold-tile regime is a **consistent Firefox risk**, even though the magnitude and warm-call stall counts vary across runs. Chrome's isolated draws never exceeded 16.7ms in these two trials, but that is not a Chrome full-game 60FPS pass. Firefox's largest spike occurred while new tiles were being constructed; a few warm redraws also exceeded the threshold in one run. The data do **not** establish that original 3B facade WebP overdraw, 3C roads, or a specific canvas operation caused the spikes; the initial *placeholder-only* mode also had cold spikes. Do not use this to reduce quality or blindly change source/world cache behavior.

Full recorded source hashes, original browser screenshots, bounded routes, per-frame timings, `coldCreated` and `cached` measurements are preserved at:

- Initial run: `assets/environment/greyhaven/3c-p39-travel-budget-review/world521_3b481_3c_moving_camera_profile.json`.
- Repeat: `assets/environment/greyhaven/3c-p39-travel-budget-repeat-review/world521_3b481_3c_moving_camera_profile.json`.

Each directory includes original native Chrome and Firefox source-composite screenshots (4 authentic panels each); all unchanged-source visual fallbacks still passed, and no unexpected browser HTTP/JS error occurred.

## Reproduce

```bash
GRAPHICS_3C_EXPECTED_HEAD=<exact-3c-parent-commit> \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
CHROME_EXECUTABLE=/path/to/chrome \
FIREFOX_EXECUTABLE=/path/to/firefox \
node tools/art/benchmark_p0_world521_3b481_3c_moving_camera_browser.mjs \
  /path/to/exact-world521-worktree \
  /path/to/exact-graphics3b481-worktree \
  assets/environment/greyhaven/3c-p39-travel-budget-review
```

This optional verifier is syntax-checked in Graphics CI; these performance measurements do **not** replace the existing protected Rust/Combat/Chrome/Firefox game gates. Existing focused Graphics/World tests must stay green.

## P0 handoff and next safe step

1. **Graphics 3C and World 9** own a bounded profiler for first-time 512-unit tile construction in Firefox, measuring original source tile paint phases (background/roads/city/material pools/portal), not just the outer draw. Any optimization must keep pixel-exact Chrome and Firefox source images including World edge, tile seam and Red Lion/Blacksmith occlusion, preserve tile cap 3/cache cap 24, and not change World geometry or `world=0` fallback. Never choose cache-throttle values purely from one time sample without checking missing-tile pop-in.
2. **Graphics 3B and Graphics Orchestrator** must verify actual Knight/roof depth on the selected composite and ensure original facade/roof art is loaded before World-only placeholder suppression, with a genuine failed-asset fall-back test in actual online client.
3. **Core/Combat/UI/Main** own the mandatory protected CI fail and the real four-client authoritative City→Blacksmith→four different swords→fist/sword PvP→death/reconnect acceptance. First Playable remains **BLOCKED**. This test does not demonstrate actual player synchronisation, animations or server item transactions.
4. Independent low-end X230i Chromium full-review `ERR_INSUFFICIENT_RESOURCES` remains open; these runs were native Chrome and Firefox **on Windows Machine only**.

**No merge, deployment, staging GO or protected acceptance change is justified by this benchmark.**
