# 🌕⚡️🚀 Graphics 3C P46 — actual online-game frame callback vs scheduling lag

**21 October 2026 · myaso.io / Moon Games · First Playable Alpha P0**

**QA-only child** of [Graphics 3C P45 #665](https://github.com/tehki/myaso/pull/665), head `0a1e622a356007c70030bff190dd7abf44df4501`; no shipping game, renderer, World, server, items, network, Combat, or graphics asset changes.

## Question

P45 proved four **real authoritative WebTransport** Chromium browser processes in Greyhaven but reported **174 ms extra render lag p95** on client #4 while each browser's `requestAnimationFrame` scheduling gap p95 was ~16.8 ms. The callback-spacing metric measures **when** the browser invokes a callback, not **how long the original game frame function runs**. Do not conflate the two.

P46 instruments the **exact actual `web/online-game.mjs` `function frame(now)`** by wrapping only named `frame` callbacks passed to native `requestAnimationFrame` at document load. `performance.now()` bounds the synchronous original game callback, including prediction, client visual World rendering and HUD. Other `requestAnimationFrame` callbacks remain on the original function; independent `collect` callback measures scheduling gaps. Separately record wall-clock self-time for native 512×512 Canvas tile `drawImage` calls into the actual opaque `#arena` Canvas. Instrumentation is **test-only browser monkeypatching**, not a shipped runtime source change. It has some observer overhead.

The real compiled P44 Rust server and exact original P45 game source run only at `127.0.0.1` ephemeral WebTransport/HTTP endpoints. Real Chrome/Chromium 152 processes connect and receive distinct server-owned player IDs and ACKs; each sends authentic native automated keyboard input. No mocks, public server exposure, test bypass, human control, or artificial bot.

## Native Linux Serj real browser measurements

Source is `0a1e622a356007c70030bff190dd7abf44df4501`, run environment the same single authorized Linux host. One **6-second single-client** baseline and **two independent 6-second four-browser runs**. All nine browser process sessions completed with **zero connection, HTTP or page errors**, nonzero original authored World tile blits, original `{alpha:false}` game Canvas, separate authoritative player IDs and correct shared 4-player scoreboards in the two 4-client runs.

| Client count / independent trial | Actual original JS `frame()` p95 across clients | Original scheduling gap p95 | Worst per-client input→ACK p95 | Worst per-client extra render lag p95 |
| --- | --- | --- | --- | --- |
| One process | 0.8 ms | 16.7 ms | 24 ms | 0 ms |
| Four processes, trial 1 | 1.8–2.5 ms | 16.7–16.8 ms | 58 ms | 9 ms |
| Four processes, trial 2 | 2.9–3.1 ms | 16.8 ms | 122 ms | **75 ms** |

Native `frame()` callback samples by client: **single 360**; four-first **360, 361, 361, 361**; four-repeat **332, 345, 334, 325**. In the repeat the **maximum** original RAF callback *spacing* was **133.3, 83.3, 83.4, 150 ms**, despite scheduling-gap **p95 ~16.8 ms**. This confirms p95 can hide rarer actual stutters. Worst original synchronous `frame()` callback **maximum** in that same repeat was **20.6 ms**, while most frames stayed below 3.1 ms at p95. Thus the wider request/render delays cannot automatically be attributed to slow synchronous Graphics 3C painting.

Original cached tile blit self-time summed across the six-second window was **40.4 ms** for single process; four-first **29.9 / 21.5 / 20.4 / 19.3 ms**, four-repeat **41.1 / 26.3 / 38.6 / 21.0 ms**. These sums are only the wrapped `drawImage` operation durations and **exclude** GPU presentation; do not mistake them for a client FPS baseline. World scene/camera position may vary among clients and between independent trials.

P45 earlier reported **174 ms extra render lag p95** for player #4. In these repeated P46 runs the corresponding maximum across clients was **75 ms**; the exact historical 174 ms spike was **not reproduced**, but unpredictable browser scheduling and ACK spikes persisted. **Do not mark the source issue solved.**

## Raw reports and acceptance

- `tools/art/probe_p46_real_online_render_duration_browser.mjs`: reproducible localhost-only real Rust/WebTransport/browser harness, source pinned, refuses runtime gameplay changes in child, no test-server certificate or port committed, subprocesses closed.
- `assets/environment/greyhaven/3c-p46-real-frame-qa/solo-local-chromium.json`
- `assets/environment/greyhaven/3c-p46-real-frame-qa/four-first-local-chromium.json`
- `assets/environment/greyhaven/3c-p46-real-frame-qa/four-repeat-local-chromium.json`
- `tests/graphics3c-p46-real-online-frame-evidence.test.mjs`: exact scope, sample, online client and honest metrics/limitations.

**Interpretation:** actual original synchronous game-frame callback p95 was below 3.1ms in the tested four-client trials, but the entire system is **NOT proved to sustain 60 FPS**. Browser GPU queue/presentation, display compositor, GC/process scheduling, network simulation and server timing are not isolated; this test cannot identify the root cause of sporadic stall gaps. Longer real human interaction, multiple devices, Windows+Firefox, GPU-present frame timeline and varied hardware are still needed.

**Mandatory protected release gate still RED:** Parent P45 [quality #39653870912](https://github.com/tehki/myaso/actions/runs/39653870912) failed required Combat **M145 spatial recovery handoff**; native browser recovered target #3 then returned to normal focus without complete expected handoff. Earlier P44 failed M41. No Combat gate, CI threshold or production source was changed; neither the P46 frame measurements nor P45 four-browser smoke overrides them.

**State: P46 diagnostic improvement; no new production optimization and no First Playable GO.** Main Orchestrator #360 owns sequence, independent network acceptance and deployment. Maintain draft status until reviewed.
