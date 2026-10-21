# 🌕🌲🎨 Graphics 3C P43 — shipping Canvas context versus prior art profiling context

21 October 2026 · myaso.io P0 First Playable · **read-only offline QA**, stacked on P42 draft #626 exact `b52a787ecb1958b885c4c96fbef737a8e45d7599`, original World #521 exact `3178b9aad8757ceb3594ff04b9e3099dced6b729`.

## Why this control matters

Actual `web/online-game.mjs` creates its primary Canvas 2D context with `{ alpha: false }`. The earlier P40/P42 optional art profilers used `{ willReadFrequently: true }` for pixel capture. This differs in BOTH alpha compositing and possible Canvas backing-store/performance behavior. P42's 768 zero-RGBA-diff comparisons proved source format parity **inside that earlier transparent QA surface**, not equivalence to the genuine game's opaque target.

The new P43 test imports the unchanged original Graphics 3C and World source over localhost and tests:
- **shipping-opaque**: `{alpha:false}` (matches main game 2D context);
- **opaque-readfrequent**: `{alpha:false,willReadFrequently:true}`;
- **prior-qa-transparent-readfrequent**: `{willReadFrequently:true}` (matches P40/P42 capture);
- **default-transparent**: `{}`.

For pixel parity, the three alternatives are each compared against a fresh opaque control for **16 source-rendered moving-camera frames at zoom 0.84 and 1.0**. For performance, separate **fresh canvases with NO `getImageData`** time the original renderer for **48 frames per case**, 2 trials with reversed order per zoom. No code or runtime change to `web/online-game.mjs`, renderer, map assets or physics. Limits remain max three new 512px tiles per draw, cache cap 24.

## Actual native browser findings: two complete independent Windows runs

Hardware: authorized Windows Machine, Chrome 154.0.8037.99 and Firefox 153.4.0. **Zero HTTP/browser script errors** for both repeated source-pinned experiment runs.

The transparent capture variants visibly **do NOT have strict whole-canvas RGBA parity** with the production opaque target at zoom 0.84. At zoom 1.0 they matched in the bounded test. `opaque-readfrequent` is much closer: on first run Firefox zoom 0.84 exact across 16 frames, Chrome 6 changed RGBA bytes in 1 frame; parity to the shipping target is not universal or assumed. These differences must NOT be hand-waved away as irrelevant pixels without a documented exact viewport/crop analysis.

Firefox **shipping-opaque**, zoom 0.84, cumulative original-renderer synchronous time across warm frames (those with zero new tile creation) in each pass:

| Trial | First run | Independent repeat |
|---|---:|---:|
| 0 | 145 ms | 119 ms |
| 1 | 138 ms | 119 ms |

Firefox warm p95 per-draw self-time was roughly **4–6 ms** in these samples. The prior transparent profiler cases were not consistently faster/slower, but they are **not a faithful proxy** for shipping alpha behavior. P43 purposely separates pixel readback from timed canvases to avoid one easy profiling confound.

**These figures are not full-game frame times, GPU present, FPS or 4-player browser load**. The frame includes the original authored visual tile renderer only, on two synthetic moving-camera routes. Neither the old P42 tile-format alternatives nor this P43 diagnostic fixes Firefox Canvas cost.

## Evidence and decision

- `assets/environment/greyhaven/3c-p43-canvas-context-qa/first-run-windows.json`
- `assets/environment/greyhaven/3c-p43-canvas-context-qa/repeat-run-windows.json`
- `tools/art/probe_p43_shipping_canvas_context_browser.mjs`
- `tests/graphics3c-p43-shipping-context-qa.test.mjs`

**Decision:** From now on, performance and pixel acceptance for Graphics 3C should benchmark the **original `{alpha:false}` shipping surface**, with per-frame comparison taken from an independent copy when readback is required. Treat the old P40/P42 timings as offline experiment diagnostics and do not use them to claim a deployed 60 FPS game. No source performance optimization has yet been approved.

CI still requires exact-head protected quality (including inherited mandatory Combat): Graphics 3C P42 [#39643648585](https://github.com/tehki/myaso/actions/runs/39643648585) failed M145 light-before-jump 151ms vs permitted 70–150ms; not a Graphics root cause proven. No unauthorized merge/deploy.
