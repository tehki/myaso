# 🌕⚡️🚀 Graphics 3C P48 — Deterministic original render-clock tick-burst reproduction

**22 October 2026 · Moon Games myaso.io · QA-only draft**

Source base: Graphics 3C [P47 #681](https://github.com/tehki/myaso/pull/681), exact `46b63e172c24fd3be4333a4ac52a5ccac95059b6`.

## Question

Three P47 live trials used four separate real Chromium/WebTransport clients (12 total sessions) and showed **no named game-frame callback gap over 33ms or browser main-thread long task**, yet reported HUD **extra render lag p95 up to 223ms**. The HUD field is **presentation-clock debt**, not actual GPU-present latency. Can the *original* production clock produce a similar lag value under perfectly regular 60Hz frames and irregular server-tick arrivals?

## Pure, deterministic original-source experiment

`tools/art/probe_p48_renderclock_tick_burst_qa.mjs` directly imports the unchanged actual modules:

- `src/browser/smooth-motion.mjs` → `createSnapshotRenderClock`
- `src/browser/render-gap-telemetry.mjs` → `createRenderGapTelemetry`
- `src/network/constants.mjs` → `NETWORK`

The script hard-pins original source ancestry, refuses any change to these modules, online game, World painter, authored map or Rust server, and records original source SHA256 hashes. It runs **600 mathematically regular 60Hz frames** (10 seconds) with an initial authoritative tick 6000 and **20Hz (one packet every three frames)** synthetic server-tick reports. The controls preserve the same `serverSimulationHz=60`, `remoteInterpolationMs=90`, `maxRemoteExtrapolationMs=100`, and default catch-up budget **1.45x** with frame step clamp 50ms. All clock/presentation methods are actual original exports, not a reimplementation.

At frame 180, the input sequence can hold the latest synthetic authoritative tick for 0ms / 100ms / 400ms / 500ms, then jump to the correct current tick. The **60Hz caller never stalls or skips a frame**, no simulated browser work, no GPU/canvas and **no network packet capture**. Exact original 100ms-sampled `createRenderGapTelemetry.snapshot()` returns the final HUD p95.

| Synthetic ingress condition | Original-clock max debt (ms) | Final HUD extra-lag p95 (ms) | Frames with debt >200ms | Original bounded catch-up count |
| --- | ---: | ---: | ---: | ---: |
| Regular 20Hz tick arrival | 0 | 0 | 0 | 0 |
| Hold tick for 100ms | 25.833 | 0 | 0 | 4 |
| Hold tick for 400ms | 325.833 | **138.3** | 17 | 44 |
| Hold tick for 500ms | 425.833 | **238.3** | 31 | 57 |

The 500ms synthetic interruption generates a **238.3ms original HUD p95**, comparable to P47's **223ms real local client HUD p95**, without any browser frame scheduling delay. This **reproduces a capable software mechanism**, NOT the actual input conditions of P47. The real sessions did not capture corresponding 500ms snapshot outages, and the snapshot-gap p95 shown by live HUD may hide rare extremes. Neither the synthetic test nor P47 proves a specific server packet loss, clock bug, or GPU fault.

Why: after the synthetic batch catch-up, `proposed` jumps ahead based on latestServerTick. The visual `result` may advance by at most **1.45x** a regular frame's elapsed time, preserving remote sprite motion continuity. `targetGapTicks=max(0, proposed-result)` then stays positive until caught up. The sampled HUD extra lag is this difference divided by the original serverHz. **That is deliberate smoothing debt by construction, not inherently a broken rendering frame**.

## Decision for Core 8A / 8C

- Instrument **real** received authoritative tick changes and timestamps alongside `proposed` / `result` / `targetGapTicks` and browser RAF timing, with minimal opt-in telemetry and no secret/session logging. Correlate real tick bursts with the recorded HUD debt. This is the **next experiment**; P48 cannot claim it already happened.
- Validate packet delivery timing, first/nonzero server tick and late snapshots. Examine the metrics semantics and potential separation of interpolation debt from visual-frame performance.
- Do **not** increase catch-up rate just to lower the indicator. Faster clock catch-up could visually teleport remote fighters or worsen combat readability. Preserve all server-authoritative combat, parry, cooldown, hitbox, World/art parity and snapshot trust.

Raw source-pinned evidence: `assets/environment/greyhaven/3c-p48-renderclock-tickburst-qa/original-clock-synthetic-burst-linux.json`. New focused test: `tests/graphics3c-p48-clock-tickburst-qa.test.mjs`. No browser screenshot or runtime FPS claim for this synthetic study.

## Gates still closed

Parent P47 strict [quality #39658875898](https://github.com/tehki/myaso/actions/runs/39658875898) **FAILED mandatory Combat M175 kick/attack arbitration**: timed out waiting for running-attack confirmed stamina denial, exact head `46b63e172c24fd3be4333a4ac52a5ccac95059b6`. Earlier branches had M41/M33 and M145 native Combat failures. Their causes are not proven Graphics. P48 must pass its own exact-head protected quality, with no waiver, before orchestration considers anything for merge.

No production source code, asset, user identities, auth, wallets, server, browser networking, GPU renderer, gameplay, tests or threshold is altered by P48. Four independent human players/hosts, Windows Firefox full online, actual Knights and four physical swords, authoritative fist/sword combat and proper full-frame GPU present all remain unverified for Alpha.

**P48 result: deterministic original-clock demonstration delivered, root cause of live render lag still open, First Playable Alpha no GO.**
