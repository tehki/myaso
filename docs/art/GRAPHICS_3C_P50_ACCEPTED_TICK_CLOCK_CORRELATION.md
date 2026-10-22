# 🌕⚡️🚀 Graphics 3C P50 — accepted server ticks and original presentation clock in real Greyhaven

**22 October 2026 | Moon Games First Playable Alpha | QA-only draft child of P49 #804**

Original exact source parent: `e7fd51e3e423a9f04a62c187482820b14796a894`. No source modifications committed to production `web/online-game.mjs`, `web/authoritative-client.mjs`, `web/network-transport.mjs`, `src/browser/smooth-motion.mjs`, `src/browser/render-gap-telemetry.mjs`, `src/network`, Graphics 3C painter, World, server or Combat.

## Motivation

P47 measured real same-host four-client Greyhaven HUD **extra render lag p95 223ms** without a corresponding expensive `frame()` callback or browser long task. P48's deterministic study demonstrated an original-source render-clock mechanism after a **synthetic** 500ms tick pause, generating 238.3ms HUD lag p95 despite mathematically regular 60Hz caller frames. P49 passively captured real realtime QUIC snapshot datagrams, but neither 12-second four-client run showed a 400–500ms blackout or the historical large HUD lag. P49 did not inspect whether tick updates were *accepted* by the actual client or what the render-clock backlog was at the same time.

**P50's narrow advance:** correlate *real client-accepted* authoritative tick updates (realtime and reliable handlers) with *original render-only clock* output and its own `targetGapTicks` at the same browser timestamps as the actual WebTransport datagrams and `requestAnimationFrame` execution.

## Strictly test-only browser instrumentation

The localhost static test HTTP server reads the **unchanged exact original repository file bytes**, checks exact original source markers, and inserts minimal passive observation statements into the **responses served to the test browser only**. Thus the browser runs an **instrumented copy** of the original two modules: **NOT a byte-identical production client**, although original statements, control flow, packet data, server, authority and clock algorithm are left intact. No file on disk is patched. The test refuses any child branch changes to original server, client, transport, snapshot codec, clock or World/Graphics source.

- The original `web/authoritative-client.mjs` is sampled **after** `latestServerTick = snapshotResult.serverTick` (accepted realtime snapshot) and **after** `latestServerTick = reliableSnapshotResult.serverTick` (accepted reliable-stream latest-tick advance). Both original assignments execute without change.
- In original `web/online-game.mjs`, **after** `snapshotRenderClock.sample(networkClient.latestServerTick,nowMs)`, the test records the same input tick, returned rendered tick, actual `targetGapTicks`, `boundedCatchups`, and monotonic browser timestamp. Sampling ~100ms bounds report size. The original production clock has not been replaced, patched or adjusted.
- P49's passive native `WebTransport.datagrams.readable.getReader().read()` observer continues to pass identical original `read()` results and bytes to the actual client, while recording realtime snapshot header sequence/tick/receipt time. P47's native actual game `frame()` p95 and RAF gaps remain measured.
- The live compiled original Rust `myaso-server` remains bound to ephemeral **127.0.0.1**, as does the source-only HTTP listener. **Four separate** native Chromium152 processes connect via genuine WebTransport; distinct server-assigned player IDs, original Greyhaven opaque Canvas and four-player scoreboards are required. No fake player authority or simulated packets.

No credential, certificate, session secret, player coordinates or raw snapshot data is saved. Evidence contains only relative browser timings, server ticks, packet sequence integers, rendering clock values and numeric local player IDs.

## Three native original-server runs (authorized Linux Serj)

| Run | Live Chromium processes | Real measuring interval | Accepted realtime snapshots/client | Accepted reliable tick **advances** | Largest accepted tick step | Max sampled clock debt | HUD extra lag p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Solo baseline | 1 | 4.5s | 90 | 0 | 3 | 0ms | 0ms |
| Four-client A | 4 | 12s | 240–241 | 0 | **6** | **35.12ms** (client #4) | **28ms** (client #4) |
| Four-client B | 4 | 12s | 240–241 | 0 | 3 | 0ms | 0ms |

In live run A, **client #4** accepted several successive realtime updates with tick step **6**, some with the same server tick as the immediately preceding accepted snapshot, during ordinary ~50ms snapshot receive cadence (max accepted interarrival **61.1ms**). An original 100ms-sampled frame-clock observation at client time **11,659.5ms** reads accepted latest tick **900**, rendered tick **893.4951**, `targetGapTicks` corresponding to **35.115ms** additional interpolation debt, and accumulated **206 bounded catch-ups**. Another sample at 3,559.8ms shows accepted tick **414**, render tick **407.5011**, **35.015ms** debt and 72 bounded catch-ups. Browser game-frame callback p95 was **2.5ms**; **0 frame-to-frame gaps over 33ms** and **0 native browser long tasks** during that run. This is **real temporal co-observation**, not a synthetic approximation or proof of which component caused the tick pattern.

Important qualification: The `acceptedReliableCount=0` here means **no reliable-stream authoritative latest-server-tick assignment advanced** during these measured windows. The test has an exact source hook for this path, but **no live positive evidence that the reliable path triggered**. P50 cannot certify reliable stream behavior under recovery.

Client #4's HUD extra-lag p95 was **28ms** while the independently 100ms-sampled clock debt p95 was **34.92ms**, reflecting different observation windows, sampling/reset boundaries and HUD update timing. Do **not** report these as identical metrics or exact clock self-time/GPU-present latency.

Both 4-client trials succeeded against genuine Rust without browser/HTTP errors. All eight browser processes had normal source tile drawing, distinct authority-assigned IDs and full peer scoreboard. Run B captured a regular 3-tick update pattern with zero sampled clock debt in all four; **the earlier P47 223ms outlier remains unreproduced**.

## Source-grounded explanation and next Core action

Original `createSnapshotRenderClock` limits **render-only** visual clock advance to **1.45x** elapsed frame time; the HUD's “extra render lag” is `targetGapTicks/serverSimulationHz`, not time spent painting, a GPU-present frame gap or RTT. Real P50 client #4 has direct co-timed accepted tick steps and nonzero presentation-clock debt. This makes **accepted tick cadence/tick-step interaction a viable line of investigation**. It does **not establish** whether the 6-tick advances originated at the server, were caused by datagram loss/reordering/coalescing, or followed other legitimate snapshot delivery. Do not change catch-up limits or server authority merely to hide the indicator.

**Next Core 8A/8C:** reproduce this state with exact server tick-send telemetry and separate accepted realtime/reliable source markers, correlate the same original render target/result/delivered-state transitions, and test actual cross-host conditions. Preserve remote sprite readability, accepted tests and server-authoritative Combat physics.

## Evidence, provenance and release gates

- `tools/art/probe_p50_accepted_tick_clock_correlation_browser.mjs` source-pinned loopback real-client harness
- `assets/environment/greyhaven/3c-p50-accepted-clock-qa/{solo,four-a,four-b}-original-clock-live-chromium.json` — native session JSON, no raw packets or session tokens
- `tests/graphics3c-p50-accepted-clock-evidence.test.mjs` verifies genuine accepted packet count, exact source markers, real debt sample and strict no-production-edit scope
- P49 parent full protected [quality #39808639437](https://github.com/tehki/myaso/actions/runs/39808639437) **FAILED mandatory Combat M121 native left-sweep directional light readability**; no waiver or graphics blame. P50's own protected exact-head full quality still mandatory.
- This does **not** certify real 4 independently operated humans or two hosts, Windows Firefox online gameplay, original 3A Knight animation, physical Blacksmith four-sword pickups, authoritative fists+sword PvP, GPU-present FPS, full Alpha readiness, a solved Clock bug, or an accepted Combat CI run.

**Result: original runtime left untouched on disk, test-instrumented authentic accepted realtime snapshots and render-clock debt co-measured; cause of historical 223ms lag remains unresolved; PR must stay draft.**
