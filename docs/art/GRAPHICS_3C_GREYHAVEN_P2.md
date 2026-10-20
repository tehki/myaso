# Graphics 3C — Greyhaven P2.1 natural ground material (review only)

**Branch:** art/3c-greyhaven-ground-p2 — intentionally stacked on authored-world PR #336. **NOT a production-ready multiplayer world.**

## Exact scope

This environment-only milestone adds deterministic muted cobblestone details to Greyhaven's *already authored* King's Road, market lane and connected streets. Packed-earth variation and sparse verge grass appear at existing road edges and building margins. All detail is rendered on the **existing** src/browser/authored-world-renderer.mjs Canvas tile generation path. It adds no game state, zone, geography, travel rights, weather protocol, collision, network traffic, building assets, camera changes, dynamic update loops or new rendering cache. Texturing is procedural *presentation only*, never placement.

The existing Greyhaven city rectangle, roads, Red Lion building and portal positions come entirely from PR #336's src/world/authored-maps.mjs. Existing Graphics 3B A2/A2.24 Blender/Red Lion art in PR #350 is not imported or modified. This is a small ground-surface compatibility refinement, not completion of the cross-PR Silver Knight/T1/Red Lion street composite.

## Determinism and performance contract

- Global 24-unit staggered stone grid; deterministic hash of integer world-grid coordinates, with a restricted set of natural stone colors.
- Global 40-unit ground-cover grid; sparse soil patches and grass accents outside building footprints and protected entrance radii.
- Each new chunk generates at most **900 pavers, 130 grass clumps and 80 soil patches**; nominal 512-unit chunk dimensions are validated and samples outside Greyhaven are fully culled.
- The 20-unit sample margin prevents missing textures across chunk seams. Samples depend on authored world coordinates, never on camera, current frame, time or network entity count.
- No per-frame foliage motion or weather effects; generation runs only inside the existing tile-cache miss path, currently limited by World to **3 new tiles/frame**, **24 cached canvases**, 512-unit tiles.
- The existing world renderer still scans and paints the whole authored world for each tile. **Not solved by this PR**: it requires a separate joint World/Graphics optimization and profiling before production integration.

## Acceptance required before integration

1. Node syntax checks for the new material module and existing renderer.
2. Node tests for Graphics 3C and World PR #336.
3. Real Chromium screenshot of web/world-preview.html served via localhost showing the Red Lion neighbourhood and stone/soil/grass. Include browser version, viewport, sample camera conditions and any errors.
4. Compare browser output against PR #336 baseline. Measure tile generation cost with controlled browser runs; no standalone screenshot counts as validated multiplayer FPS.
5. Require exact-head GitHub quality and protect all existing Combat/Networking regressions. Do not weaken or skip failed checks.

## Ownership

Graphics 3C: cosmetic materials, tile-bounded detail planner and rendering. World & Gameplay: city, streets, buildings, portals and base chunk architecture. Graphics 3B: building geometry and Red Lion appearance. Core/Physics: authoritative geometry, gameplay interactions, weather and gameplay particles.

**Integration disposition:** Draft and stacked; no merge, no main, no live deploy, no activation. Unstack and resolve World PR #336's existing quality failure before central acceptance.


## Measured real-browser evidence, October 21, 2026

Actual Chrome 154.0.8037.99, Windows Machine, viewport 1120x720, DPR 1.0. Both branches served on independent localhost ports, the same offline Greyhaven Red Lion camera (4365,4150), zoom .86, no multiplayer session. Run the included tools/art/verify_greyhaven_3c_browser.mjs with CHROME_EXECUTABLE, PUPPETEER_MODULE_PATH, GREYHAVEN_BASELINE_URL and GREYHAVEN_CANDIDATE_URL pointing at the local original PR #336 and this candidate checkout.

- Both pages: HTTP 200, zero JavaScript page errors.
- Baseline PR #336: seven cold-Canvas measurements for six newly created tiles, median total **16.1 ms**.
- Graphics 3C candidate: same test, median **21.2 ms**, approximately **31.7%** slower, or +5.1 ms for six new tiles (~0.85 ms/tile in this scenario).
- Existing bounds remain 512-unit tile canvases, three new tile canvases/frame and at most 24 in the default cache. No continuous per-frame environment re-generation was added.
- Real Chrome before/after screenshot comparison: **44,950 pixels** differ by luminance >8 (Pillow pixel comparison); this is a visual-change metric, not a quality score.
- Browser screenshots: greyhaven_3c_baseline_chrome.png, greyhaven_3c_candidate_chrome.png, greyhaven_3c_chrome_comparison.png.
- JSON report: greyhaven_3c_browser_report.json. The original #336 screenshot and unchanged PR #336 head are preserved.

This is **not** an acceptable claim of full multiplayer performance. The extra cold-chunk work should be profiled on low-end hardware, especially when moving rapidly and generating the maximum three tiles/frame. Consider further density reductions or a pre-baked atlas if the integration budget cannot absorb the measured delta. In the first experimental version pavers were denser and stroked individually, causing substantially greater overhead; the current implementation uses prefiltered road segments and single-fill stones.


## P2.2 — planner fast path (2026-10-21)

The stone silhouettes and terrain positions remain **pixel-identical** to P2.1 in the real Chrome 1120×720 offline Greyhaven preview (Pillow RGBA before/after image difference: none). The planner now checks authored building rectangles without square roots when emitting pavers, and performs a cheap expanded-bounds rejection before calculating woodland-edge/foundation distances. No extra asset, persistent cache, network call, entity update, extra full-scene pass or per-frame animation is introduced.

Reproduce the **isolated planner benchmark** by checking out exact original P2.1 commit a12045ccf82395ce431316d9ec8264009baff660 into a separate read-only worktree, then set GREYHAVEN_PREVIOUS_MODULE to that worktree's src/browser/greyhaven-terrain-materials.mjs and GREYHAVEN_PREVIOUS_SHA to the pinned SHA. Run:

    node tools/art/benchmark_greyhaven_3c_plan.mjs

On Windows Machine Node v24.19.0 (x64), nine alternating A/B runs, 800 calls per run across four authored tiles, both variants yield **143,000 features summed across 800 plans**. The first comparison had a previous median **200.061 ms** vs optimized **173.722 ms** (13.2% faster). A repeated comparison had previous **122.093 ms** vs optimized **101.448 ms** (16.9% faster); the repo JSON records the second run. Both are *CPU-only material planner* microbenchmarks and must not be reported as gameplay frame-rate improvements. Measured runtime depends on system load.

The repeated Chrome 154 cold-six-chunk benchmark had baseline PR #336 median **26.4 ms** vs optimized candidate median **27.4 ms** (+1.0ms, ~3.8%) and no browser page errors. This measurement is noisy compared with the earlier P2.1 session (16.1ms vs 21.2ms). Real-world chunk-frame performance **remains unqualified**, with no claim of full FPS or production readiness. No multiplayer visual CI was changed, and the M41 parry-tell failure in original #419 exact-head quality 39511746799 is recorded for central Combat triage, not bypassed.


## P2.3 — conservative chunk-local visual culling (2026-10-21)

**Scope:** Graphics-only optimization of the existing authored-world Canvas chunk renderer. No new renderer or cache, no geography, door, portal, physics or Combat changes. A conservative world-coordinate box test skips painting fields, authored roads, bridges, trees, buildings, wall groups and portal indicators outside each 512-unit cache tile, with explicit padding for shadows, roofs, roads and crowns. River and fixed town labels remain unchanged. Existing 3C material planner remains untouched.

**Visual acceptance:** real Chrome 154.0.8037.99 on Windows Machine, Intel Core i7-2700K, NVIDIA GeForce GT 630; offline World preview at 960x600 DPR 1, fixed zoom per scene. Independent localhost comparison to pinned P2.2 head 73ca332cdaab123bd9c75a3321ff5b3dea6f2c7f. Eight scenes: Red Lion/Greyhaven, bridge, grove, Briarford, Stonebrook, farmland, wilderness and city north. All eight pairs of actual Chrome Canvas PNGs are bytewise-equivalent in their decoded RGBA pixels (Pillow ImageChops); browser page errors zero. The source-pinned JSON report also records matching per-scene RGBA hashes.

**First Chrome cold-chunk benchmark pass** (not multiplayer FPS):

| Scene | Tiles | P2.2 cold ms | P2.3 cold ms |
| --- | ---: | ---: | ---: |
| Greyhaven | 6 | 51.9 | 50.9 |
| Bridge | 6 | 31.4 | 17.9 |
| Grove | 6 | 24.0 | 16.6 |
| Briarford | 6 | 33.3 | 17.0 |
| Stonebrook | 9 | 37.8 | 24.2 |
| Farmland | 8 | 39.9 | 25.9 |
| Wilderness | 8 | 24.8 | 15.0 |
| Greyhaven north | 4 | 20.8 | 22.6 |

Across the eight scenes, median new-chunk work **32.35 ms baseline vs 20.25 ms candidate**, ~37.4% less in this one pass. Measurements are load-dependent and must not be claimed as multiplayer, frame-duration or live realm performance. Subsequent run is separately recorded when available.

**Automated regression:** new tests/greyhaven-environment-3c-culling.test.mjs checks that empty remote wilderness chunks omit distant tree/city art while city and grove art still appear. Existing World + 3C tests and chunk budget invariants preserved; CI job adds only a new focused test command. The browser parity tool is tools/art/verify_greyhaven_3c_culling_browser.mjs and requires two localhost URLs and an approved Chrome executable.

**Integration:** PR #419 remains draft and stacked on World #336; Red Lion 3B/knights unchanged. The prior exact-head P2.2 quality run #39513838610 failed at the protected M171 Combat browser acceptance; do not bypass it. Fresh exact-head quality is required before review, with cross-PR character/building scale and low-end camera travel acceptance still pending.

**Second independent Chrome pass:** eight image pairs again have matching RGBA hashes and zero page JS exceptions, with original P2.2 scene-median cold work **17.3ms** vs P2.3 **13.8ms** (~20.2% less). First pass was ~37.4% lower; the range demonstrates measurement sensitivity to device load/JIT. Both exact source reports are committed as p23_culling_chrome.json and p23_culling_chrome_second_pass.json. Pixel-perfect comparison with Pillow ImageChops was performed on all eight first-pass PNG pairs and found zero differences. Preserve the reports instead of selecting only the faster run.
