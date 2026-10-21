# 🌕⚡️🚀 Graphics 3C P47 — real four-client RAF / long-task correlation

**21 October 2026 · myaso.io First Playable Alpha P0 · diagnostic only**

Parent: Graphics 3C [P46 #671](https://github.com/tehki/myaso/pull/671), exact original client + server head `f08b627318f0e5998b827779a1ac24cb49c45bc8`. Source test refuses any child changes to original `web/online-game.mjs`, server, authenticated World map or renderer. No production code or deploy changes.

## Why

P45 previously measured client #4 extra render lag p95 **174ms**, and P46 later measured up to **150ms between original game frame callbacks**, despite low p95 synchronous `frame(now)` execution. Those are separate phenomena. P47 tests **whether positive extra render lag can occur in genuine multiplayer without any missed `requestAnimationFrame` intervals or browser `longtask` events**.

It uses the exact original Rust game executable (built from P44/P45 source), four actual authoritative Chromium 152 browser processes on one authorized Linux Serj machine, original `web/online-game.mjs?world=1&netstats=1`, four distinct server-owned player IDs and real snapshots/input ACKs via ephemeral **127.0.0.1-only** WebTransport/HTTP listeners. The game client is not replaced or mocked.

Test-only document-start instrumentation wraps only the original named RAF `frame` callback to record each invocation's start, the gap from the previous invocation, synchronous `frame` duration, and actual `#arena` cached tile draw self-time. Native `PerformanceObserver` additionally watches supported browser `longtask` entries. Test does not override clock policy, snapshot packets, canvas pixels or gameplay. No root-level network exposure, no unrelated process termination.

## Three separate native 9-second runs

Three successful **four-process concurrent** trials A/B/C. **12 real authoritative browser sessions**, zero request/page errors, original opaque `#arena` Canvas, scoreboard with four live players, no fallback to mocked multiplayer.

| Metrics across each four-client trial | Trial A | Trial B | Trial C |
| --- | ---: | ---: | ---: |
| Largest original synchronous `frame()` callback p95 | 2.4ms | 2.5ms | 2.5ms |
| Original `frame()` gaps over 33ms, all four clients | 0 | 0 | 0 |
| Browser `longtask` events reported, all four clients | 0 | 0 | 0 |
| Worst game HUD extra render lag **p95** | 49ms | 75ms | **223ms** |
| Worst input→ACK p95 in trial | 60ms | 48ms | 62ms |

All three trials reported `longTaskObserverStatus:"observing"`. Thus zero entries is a genuine observer reading, not simply an unsupported API, **but only for the observed browser main threads and these time windows**. Each client collected approximately 540 named game-frame callback samples; test used 9 seconds of live play per run.

**Most significant trial C mismatch:** player #3 reported **extra render lag p95 = 223ms**, while its actual synchronous game `frame()` p95 was **2.5ms**, maximum **4.6ms**, with **zero** callback gaps above 33ms, zero long tasks, and its actual `Input→ACK` p95 was **45ms**. This **disproves the narrow hypothesis** that every elevated extra-render-lag sample must coincide with expensive Graphics 3C drawing, an extended browser animation callback gap or a visible main-thread long task. It does **not** establish the precise root cause.

## Technical meaning of the HUD indicator: render-clock debt

This is the key source-grounded observation for Core & Multiplayer to investigate:

- `web/online-game.mjs` calls `snapshotRenderClock.sample(networkClient.latestServerTick, nowMs)`, then passes `snapshotRenderClock.metrics().targetGapTicks` into `renderGapTelemetry.noteFrame(...)`.
- `src/browser/smooth-motion.mjs` caps the renderer's visual clock catch-up to **1.45×** elapsed frame time, at most **50ms** per frame, and defines `targetGapTicks = max(0, proposed - result)`, where `proposed` is based on latest authoritative server tick, packet arrival time and interpolation delay. This is a **render-only** clock; it does not change real server tick or authority.
- `src/browser/render-gap-telemetry.mjs` samples `targetGapTicks / serverHz * 1000` at roughly 100ms intervals and reports the p95 as **extra render lag beyond the intended interpolation target**. This metric is **not** a direct measurement of GPU-present frames, RAF gap, input RTT or server clock skew.

Consequently, a 223ms HUD value can coexist with smooth RAF pacing and short frame callback execution: it means the client presentation clock is **behind its own target**. A server tick discontinuity/jitter pattern, snapshot presentation clock catch-up, sampled timing or a metrics issue might contribute. **No root cause or fix is confirmed**. Core 8A/8C should investigate authoritative tick arrival, monotonic sample inputs, `boundedCatchups`, target vs rendered tick and reconciliation under bursty packet ingress. Do **not** simply raise `maxCatchUpRate` or loosen test thresholds without gameplay/visual evidence and central approval.

## Reproduction and strict evidence

- `tools/art/probe_p47_raf_longtask_correlation_browser.mjs`: original-server, real-game, four-client source-pinned localhost browser trace.
- `assets/environment/greyhaven/3c-p47-raf-longtask-qa/four-trial-a-local-chromium.json`
- `assets/environment/greyhaven/3c-p47-raf-longtask-qa/four-trial-b-local-chromium.json`
- `assets/environment/greyhaven/3c-p47-raf-longtask-qa/four-trial-c-local-chromium.json`
- `tests/graphics3c-p47-render-clock-correlation-evidence.test.mjs`: exact report provenance, four-player realism, positive lag alongside zero measured stalls, and static meaning of original render-clock telemetry.

Same environment variables and original local binary as P46, with `P47_CLIENTS=4 P47_MEASURE_MS=9000`. All test servers/browsers terminate at end. Reports intentionally exclude ephemeral certs/session tokens/port numbers.

**Governance:** P46 [quality #39656972310](https://github.com/tehki/myaso/actions/runs/39656972310) is **FAILED** in protected Combat M41/M33; prior P45 failed M145. New P47 strict exact-head quality remains mandatory. These diagnostic QA successes do **not** validate cross-machine human clients, Windows Firefox, finished 3A Knights/3B named architecture, physical sword pickups, Combat input resolution, GPU-present 60fps or the First Playable Alpha. No CI bypass, merge, deployment, or change to gameplay authority.

**Decision:** Graphics tile draw is *not proven* the source of the extra HUD render lag. Escalate presentation-clock/backlog sampling to Core while preserving P0 visual output and failing Combat gates.
