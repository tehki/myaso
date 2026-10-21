# Graphics 3 — P0 real four-browser frame-cadence acceptance

**Status:** QA-only, opt-in, DRAFT / not a frame-rate or game release claim. **No production module, network server, Combat rule, World geometry, 3A/3B/3C art, or default visual rendering change.**

## Verified source basis

The branch starts from actual all-green [Core/UI real rendered Greyhaven #589](https://github.com/tehki/myaso/pull/589), exact original source `30921852fbd4d24bef615249e6dda227a6e56040`. That parent's genuine four native Chrome/Firefox Rust-WebTransport rendered-Greyhaven checks passed:
- [four real W3C browser native #39628283313](https://github.com/tehki/myaso/actions/runs/39628283313)
- [Core combined #39628283232](https://github.com/tehki/myaso/actions/runs/39628283232)
- [full strict quality #39628283446](https://github.com/tehki/myaso/actions/runs/39628283446)

This review adds **no Graphics 3C #419 P40 authored texture renderer**, no new real rack swords, no multiplayer skin replacement and no requirement to enable adult avatars. It is an uncontaminated first **real-browser baseline** before the Art Director evaluates World #521 + Graphics 3C #419/P43 + Graphics 3B original Red Lion source compositions in a centrally reviewed candidate. Base all-green CI does NOT transfer to this new exact head.

## Instrument and strict boundary

`MYASO_P0_GRAPHICS_RAF_QA=1` is read only by the existing **test-runner process**, never as a public game option. When absent, the original native four-player acceptance runs unchanged.

In this optional mode `scripts/alpha_p0_four_native_rendered_greyhaven.mjs` executes a small **read-only RAF subscription** through genuine WebDriver `execute/sync` inside each of the existing four browser sessions. Sampling starts immediately before the runner's real W3C keyboard/movement input and stops only after all four connected clients independently prove:
- Exact authoritative four-person roster and own-player identity,
- Source-authentic `world=1` visual Canvas green sample, no scenario,
- Real input ACK and server snapshot reception increase, separately,
- Genuine refreshed on-screen HUD tick.

The sample is bounded to 240 browser callback intervals per page and creates no additional game frame loop or Canvas drawing. It observes `requestAnimationFrame` callback scheduling; it does **not** instrument `worldRenderer.draw` or change movement, actors, network, HUD, collision or source-tile painting. Browser W3C screenshots and original liveness report remain mandatory.

New report `graphicsBrowserFrameCadence` in the original `report.json` stores per-browser:
- Sample count; callback count; wall duration; document visibility; native Canvas width/height.
- Nearest-rank **p50/p95/p99** of observed RAF callback *intervals*.
- Counts of intervals >16.7ms and >33.3ms.
- Maximum interval. A browser with fewer than three genuine intervals fails this **QA-only** workflow, rather than silently claiming smooth visual progress.

**Interpretation limits:** RAF cadence is not actual painted frame completion, GPU presentation, 3C tile copy timing, compositor latency or gameplay FPS. As four browsers run on the **same hosted runner**, competing browser load and headless scheduling influence samples. Do not infer multi-host/low-end X230i performance, individual user hardware, or a shipping 60FPS guarantee.

## Next review gate

1. Compare the same browser releases/hardware/viewport, same real W3C movement, original #589 RAF distribution and authentic liveness against a **centrally selected** 3C+World+3B integration candidate, NOT 3C old-base PR #419 blindly merged.
2. Only then profile `stats.created/cached/visible` and ground/lamp/facade paint self-time under the same actual page. Keep original 512 world-unit tile, 24 cache cap, 3 cold tile build limit; report missing tiles and original WebP decode failures.
3. Treat source P40/P43 data as isolated Canvas evidence, explicitly separate from observed in-game RAF callback timing. Firefox translucent QA contexts do not establish parity for the game's original `{alpha:false}` Canvas.
4. On X230i, reproduce full World+3B original source module graph independently. Existing P41 minimal source run did not reproduce the historical larger-graph failure; no false claim of resolution.
5. Never accept an 'optimization' that changes unexpected game pixels, drops players, stops real ACK or snapshot progress, or bypasses mandatory Rust/JS/Combat/Chrome+Firefox CI. Full exact-head quality, native screenshots, and a central integration decision remain required.

**Ownership:** Graphics 3 owns this browser diagnostics augmentation. Graphics 3C owns environmental painter/cache improvements; World owns authored entities, 3B source facades, Core owns true packet/session state, Combat owns timings, UI owns HUD semantics, Main Development [#360](https://github.com/tehki/myaso/issues/360) owns merge and release. Report at [3C #415](https://github.com/tehki/myaso/issues/415) and [First Playable #480](https://github.com/tehki/myaso/issues/480).

**Not integrated, not deployed, not a replacement for four-player armed PvP / physical sword pickup / independent-host acceptance.**
