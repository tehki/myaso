# Moon Games Graphics 3C P0 — Blacksmith art-review first-frame / X230i resource diagnosis

**Date:** 2026-10-21 | **Scope:** First Playable Alpha P0 Graphics 3C diagnostic only | **Status:** independent X230i browser visual acceptance BLOCKED; no production changes

## Source and exact ownership

This reproducer is an optional *read-only original-source* instrumentation harness, `tools/art/diagnose_armory_world_first_frame_p0.mjs`. It imports the **exact original World #493** head `07060f981b8a1dac89184b621b6893dd970a08ae` plus **original Graphics 3B #508** head `2a11b923591a682bbae3cffe6d9f70b0d2036de8` from separately checked-out pinned Git worktrees. It serves original HTML, world renderer, map, rack/sword original first-party lossless WebPs and source modules over a **localhost-only explicit allowlist**. The only instrumentation modifies the *served QA review JavaScript in memory*, to log `Image.decode()` and per-world-draw timings. Original 3B/World files, live `web/online-game.mjs`, shared network, game client/renderer, Rust server, Combat, item/zone authority and protected tests are **never modified**.

The 3B review page synchronously draws its World Canvas six times. The test explicitly permits `P0_DIAG_WARMUPS=1` only to isolate first-stage faults. That is **NOT** a normal six-draw art acceptance and cannot be called PLAYABLE or INTEGRATION-READY. Neither setting performs image screenshots or Canvas pixel readback; it instruments original art loading and world chunk builds only.

## Measured outcomes

| Test | Pinned original World/3B art source | Image load/decode | World Canvas draws | Result |
| --- | --- | --- | --- | --- |
| Windows Machine, Chrome 154, 6 draws | all fetched | `Image.decode()` completed (~26.4 ms between trace markers) | 1st 121.2ms (3 new tiles); 2nd 11.4ms (6 cached); remaining 4 draws ~0.7–1.0ms | Instrumented diagnostic READY |
| X230i Linux, Chromium 152.0.7977.82, **1** draw budget | all 10 listed source routes requested | `image:begin` logged; **`image:decoded` never logged**, browser reports original `armory_sword.webp` fetch `net::ERR_INSUFFICIENT_RESOURCES` | **No `draw:begin` marker observed** | Instrumented diagnostic TIMEOUT |

Complete original trace JSON: `assets/environment/greyhaven/3c-p34-review/windows_world493_six_draws.json` and `assets/environment/greyhaven/3c-p34-review/x230i_world493_one_draw_original_webp_failure.json`. On X230i the script recorded a `Waiting failed: 20000ms exceeded` plus an unrelated secondary **`Runtime.callFunctionOn timed out` while requesting status**. Earlier attempts had timed out on screenshot capture and the 2D RGBA readback. These failures have never qualified as independent Linux browser visual passes.

The **specific primary browser resource error** occurred on the original **2,682-byte first-party sword WebP** over localhost, before any tile painter call. It is not proof that the WebP itself is corrupt, nor proof of RAM, file descriptor or GPU exhaustion as a root cause. After the run, X230i had 7.6 GiB RAM total with ~2.25 GiB available, `ulimit -n=524288`, `ulimit -u=30377`, zero leftover Chromium processes at measurement. Those limits do not, on their own, explain `ERR_INSUFFICIENT_RESOURCES`. Source file exists and decodes separately via ImageMagick; original art SHA-256 was verified previously on both hosts.

**Interpretation:** the failed Linux first-frame acceptance is at least partly **pre-render original image loading/Chromium resource transport**. Since no `draw:begin` happened, this test cannot assign the timeout to Graphics 3C grass, stones, gradients, tile culling or world cache. The test even uses **original World painter**, not Graphics 3C. Do not increase production cache budgets, disable GPU features globally or weaken mandatory CI as an inference from this result.

## Reproduction

```bash
P0_DIAG_VARIANT=world493 P0_DIAG_WARMUPS=6 \
CHROME_EXECUTABLE=/path/to/chrome PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/diagnose_armory_world_first_frame_p0.mjs \
  /exact/world-493/worktree /exact/graphics3b-508/worktree output.json

# X230i bounded one-draw diagnostic (deliberately does NOT grant normal preview approval)
P0_DIAG_VARIANT=world493 P0_DIAG_WARMUPS=1 P0_DIAG_TIMEOUT_MS=20000 \
CHROME_EXECUTABLE=/usr/bin/chromium PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/diagnose_armory_world_first_frame_p0.mjs \
  /exact/world-493/worktree /exact/graphics3b-508/worktree output.json
```

Every report carries the pinned exact source heads, source routes, browser, per-stage trace, failure events and `productionEdited:false`. The script does not run as mandatory browser CI on GitHub; protected quality only syntax-checks it. No new Chrome, Puppeteer, Python or operating-system dependency is installed.

## Handoff and next P0 gate

1. **Graphics 3B owns the first-party WebP decode/review path** and should reproduce/check the original 3B rack WebP `Image.decode()` on the low-end X230i environment in a **minimal stand-alone two-image page**, separate from the World painter. Check browser resource/network error and image-by-image decode completion, then restore six original draws. This is not a 3C asset bug until evidence shows otherwise.
2. **World 9 / Core / Graphics 3B**: draft World consolidated [#521](https://github.com/tehki/myaso/pull/521) establishes the art-only midpoint rack origin **(3800,4038)**; [3B completed frame #529](https://github.com/tehki/myaso/pull/529) paints real 3B rack/sword art with external committed-item plan. Those remain separately staged, not live authoritative pickups.
3. **Graphics 3C** will repeat true combined scene/visual performance acceptance after low-end decode is usable and the orchestrator selects a precise verified integrated World/Core/Items/UI/Combat candidate. Existing Windows Chrome+Firefox source-art acceptance remains valid but **does not substitute for live four-human M1–M5**.
4. **Protected CI blocker:** latest parent QA head `714c5861843e57de51cf212f0907c82ac8920ce2`, run [#39597208172](https://github.com/tehki/myaso/actions/runs/39597208172), **FAILED** mandatory M142 jump-attack FFA threat ordering. The trace showed transient Firefox `2 THREATS` / `NEXT #3` but the expected full multi-browser threat-ordering acceptance was not satisfied. Combat/Core owns root-cause triage. No Combat/test/input code is touched by this script.

**Readiness: IMPLEMENTED diagnostic, TESTED on Windows and measured Linux failure. NOT INTEGRATION-READY, NOT INTEGRATED, NOT PLAYABLE.** [Graphics 3C draft #419](https://github.com/tehki/myaso/pull/419) stays unmerged and undeployed; central Main Orchestrator has exclusive GO/rollback authority.
