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
