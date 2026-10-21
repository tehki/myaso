# Graphics 3C P0 P40 — Firefox cold-tile paint versus screen blit

**Moon Games / myaso.io First Playable Alpha · 2026-10-21**
**Classification:** TESTED isolated browser source profiler; **INTEGRATION-READY / PLAYABLE BLOCKED**.
**QA-only change:** no production renderer, cache limit, World placement, original source art, Combat, server, item, game input or online client changed.

## Context and pinned original sources

The [P39 moving-camera budget](GRAPHICS_3C_P39_ORIGINAL_RED_LION_CAMERA_TRAVEL_BUDGET.md) showed unstable Firefox synchronous Canvas draw spikes, especially first-time 512-unit world tiles. This P40 test distinguishes stage cost inside the original 3C world paint, complete tile construction, and final cached tile `CanvasRenderingContext2D.drawImage` copying to screen. Exact sources are:

- World consolidated authored map and official Red Lion replacement validator: draft [#521](https://github.com/tehki/myaso/pull/521) `3178b9aad8757ceb3594ff04b9e3099dced6b729`.
- Original Graphics 3B 228×297 day/dusk facades and unchanged 238×197 roof plus presentation bridge: draft [#481](https://github.com/tehki/myaso/pull/481) `c107f613c2f646e99693bc0af0f76ba4795c5364`.
- Graphics 3C renderer baseline: draft [#419](https://github.com/tehki/myaso/pull/419) head `a8a0fd7e51338d026313fe40b8d4066f0282a584` at test capture.

The optional `tools/art/profile_p0_world521_3c_cold_tile_phases_browser.mjs` reads the exact, checked-in 3C renderer and adds a strictly source-marker-guarded stage timer transformation **only to the original JavaScript served via localhost with `?profile=1`**. An uninstrumented module is separately loaded from the same exact source. The QA test creates two equal 640×480 Canvas scenes at 0.84 zoom and tests **byte-for-byte identical RGBA pixels**; Chrome and Firefox reported **zero differing bytes**. No on-disk source module or asset changes. The first stage-only preliminary pass did not include tile allocation/blit markers; the second pass extended the same in-memory instrumentation and is the final measured variant.

P40 retains P39's two routes, 72 camera frames, two trial orders, three modes (World default / original 3B daytime facade+roof / original 3B dusk facade+roof): **864 synchronous Canvas `draw` calls per browser**, 30 cold calls creating 72 real 512×512 cached tiles, 834 draws with no new tiles, `buildLimit=3` and `cacheCap=24`. Each mode uses the real World allowlist callback for Red Lion-only suppression, with original loaded day/dusk and roof, and the simulated original-placeholder fallback remains exactly pixel-identical to the default.

## Browser stage evidence, genuine native Windows Chrome 154 and Firefox 153.4

| Phase aggregate over 72 new 512-unit world tiles or 4,080 cached screen blits | Chrome | Firefox |
|---|---:|---:|
| **Whole tile creation**, including Canvas allocation and paint | 93.4 ms | **338 ms** |
| Ground material stroke/fill stage within that paint | 31 ms | 82 ms |
| Warm light-pool stage within that paint | 3.7 ms | **68 ms** |
| Roads stage within that paint | 3.8 ms | 31 ms |
| **Screen `drawImage`** across 4,080 visible cached-tile copies | 57.4 ms | **2,177 ms** |
| Worst individual tile creation | 10.8 ms | 32 ms |
| Worst individual `drawImage` copy | 0.5 ms | 26 ms |
| Total 864 synchronous Canvas frame draws over 16.7 ms | 1 | 10 |
| Original-renderer vs instrumented Canvas RGBA mismatch | **0 bytes** | **0 bytes** |

Both engines painted 72 source-traced tiles with 13 recorded original paint phases per tile (**936 original stage samples**), and additional whole-tile and screen-copy timings. Firefox's per-stage timestamps have coarse granularity, and instrumentation itself adds JavaScript/array overhead. The 4,080 blit calls include **cold and reused** canvas tiles and are **not** direct GPU present completion metrics. Whole-tile time includes inner paint stage time: do not add its total to the individual stage totals as if independent work. `drawImage` time is another distinct screen operation. The larger Firefox screen-copy aggregate across the 864 calls is compelling for the **next experiment**, not conclusive evidence of an optimal GPU/cache fix.

**Independent complete repeat with the same final instrumentation and all original source SHAs unchanged:** 864 calls/browser again, exact original-vs-profiled **0 RGBA differing bytes** each. Chrome whole-tile creation **106 ms**, 4,080 screen blits **77.7 ms**, 0/864 calls over 16.7ms. Firefox whole-tile creation **298 ms**, 4,080 screen blits **2,170 ms**, 7/864 over 16.7ms. This supports a **repeatable screen-copy cost difference in the instrumented isolated Canvas pipeline**, not a statistically valid production GPU/FPS conclusion. Its report is `assets/environment/greyhaven/3c-p40-paint-blit-repeat-review/world521_3b481_3c_cold_paint_phases.json`.

The initial stage-only exploratory pass independently measured 864 calls per browser, 0 Chrome / 11 Firefox calls over 16.7 ms, and 72 source paint traces. Firefox's initial ground and pool totals were 91 / 62 ms, reasonably close in scale to the final fuller probe's 82 / 68 ms; this is **not** a statistically rigorous before/after comparison because instrumentation differed. P39's uninstrumented repeated runs are the primary frame-budget reference: Firefox **18/864 and 39/864** over 16.7ms; Chrome **0/864** both times.

**Critical conclusion:** both constructing first-time tiles and copying cached canvases to the visible Canvas have higher measured cost in Firefox on this Windows host. The immediate safe next step is a **Canvas copy-path experiment with exact pixel parity**, e.g. 2D source canvas, `ImageBitmap` or browser-specific caching tests behind *test-only* code, measuring real cold frames and GPU present separately. Do not switch production from 2D tiles to ImageBitmap or change `buildLimit` until source parity, no-pop-in acceptance, X230i and full integrated client p95 proof establish an improvement across browsers.

## Evidence and reproduction

- Final profiler: `tools/art/profile_p0_world521_3c_cold_tile_phases_browser.mjs`.
- Full instrumentation output: `assets/environment/greyhaven/3c-p40-paint-blit-review/world521_3b481_3c_cold_paint_phases.json`, plus genuine Chrome/Firefox four-panel source screenshots.
- Earlier stage-only exploratory output: `assets/environment/greyhaven/3c-p40-tile-phases-review/world521_3b481_3c_cold_paint_phases.json`. Its instrumented JS was an earlier in-memory-only version of the final source script.
- All JSON reports contain the original pinned World/3B/3C source SHA details, exact 3B asset hashes, per-trial real sample times, cache bounds, source pixel invariant, source profiler markers and limitations.

```bash
GRAPHICS_3C_EXPECTED_HEAD=<exact-original-3c-painter-SHA> \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
CHROME_EXECUTABLE=/path/to/chrome \
FIREFOX_EXECUTABLE=/path/to/firefox \
node tools/art/profile_p0_world521_3c_cold_tile_phases_browser.mjs \
  /pinned/world521/worktree /pinned/graphics3b481/worktree \
  assets/environment/greyhaven/3c-p40-paint-blit-review
```

**Constraints:** 640×480 Canvas, Zoom 0.84, DPR1. Profiling records only synchronous Canvas JS calls, NOT actual browser full-frame refresh, GPU presentation, network or player animation/input. No independent low-end X230i Chromium full-browser result is asserted; its original World/3B resource errors remain unresolved. No actual multi-user pickup/PvP, door authority, replica or death/rejoin tested.

## Main orchestrator handoff

- **Graphics 3C / World 9:** investigate actual Firefox `drawImage` tiling overhead versus safe alternatives with source byte parity and P39-equivalent cold-travel tests, including map edges, Red Lion, Blacksmith, warm/cold reuse and camera movement. Avoid reactive blind caching optimization.
- **Graphics 3B:** validate original facade/roof art and actual 3A Knight occlusion in the chosen integrated game branch; the P40 rendered screenshots are test-only.
- **Core / Combat / Main:** exact head P39 protected [#39621904430](https://github.com/tehki/myaso/actions/runs/39621904430) **FAILED mandatory M158 simultaneous FFA knockdown arbitration**, not traced to Graphics; do not bypass. Real owner-mandated four-human city → four canonical swords → fists/swords combat → death/rejoin with protected CI and rollback still BLOCKED.

**No merge, deploy, release GO or full-game FPS claim is authorized.**
