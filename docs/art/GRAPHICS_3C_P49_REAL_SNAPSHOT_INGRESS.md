# Graphics 3C P49 — Real WebTransport snapshot ingress vs Greyhaven presentation debt

**22 October 2026 · myaso.io · Moon Games Graphics 3C · QA-only**

This branch is a draft child of [P48 PR #790](https://github.com/tehki/myaso/pull/790), exactly `893144ef56a64c2395038b4c7ebd3648cfb5f192`. **No production game client, World, renderer, network, Rust server, Combat logic, physics, tests or release check is modified.** It only adds an optional source-pinned local diagnostic harness and evidence/tests.

## Why this new experiment matters

- **P47 genuine four-client multiplayer** (actual Rust/WebTransport/Chromium) recorded **223ms extra render-clock debt p95** in one client while the original synchronous `frame()` p95 stayed **2.5ms**, with no main-thread long task or >33ms frame callback gap. It could not establish the triggering real snapshot arrival history.
- **P48 deterministic synthetic-only study** imported the untouched production clock. A simulated 500ms authoritative tick hold followed by a jump generated **238.3ms extra render-lag HUD p95**, with 60Hz caller frames. This proved the original clock *can* show this debt without a Canvas stall, but **did not demonstrate an actual packet outage or tick burst**.
- **P49** captures the original real QUIC **snapshot datagrams** at browser receive time, side-by-side with real gameplay frame timing and the original HUD. Its job is to test the live packet-arrival hypothesis rather than assume P48's invented interruption actually occurred.

## Instrumentation — original bytes delivered unchanged

`tools/art/probe_p49_real_webtransport_ingress_correlation_browser.mjs` starts the original exact-head locally compiled Rust `myaso-server` on **127.0.0.1 ephemeral WebTransport** and serves unchanged `web/index.html?server=...&cert=...&world=1&netstats=1` on another **127.0.0.1** listener. Up to four **separate Chromium processes**, each using a genuine WebTransport transport and server-owned ID, connect and send native automated WASD input.

At document start an opt-in test-only `Proxy` of the native `WebTransport` constructor wraps **only** its `datagrams.readable.getReader().read()` promise. It passively examines snapshot header fields and returns the **identical original `read()` result object and unchanged Uint8Array** to the real client:

- Protocol version at byte 0; snapshot packet type **2** at byte 1
- Real snapshot uint16LE sequence offset 4 and uint32LE authoritative server tick offset 8
- Browser monotonic `performance.now()` receive timestamp (relative timestamps only in event evidence)

The browser's genuine WebTransport, packet apply, ACK, prediction, original World painter, network clock and combat authority are not replaced. Existing P47 test-only timing measures the original named `frame(now)`, RAF callback intervals, actual cached tile blit self-time and native `PerformanceObserver(longtask)`. The harness explicitly refuses child changes to original network, clock, game, World, Combat or server modules and runs only on local loopback. **No packet or certificate bytes, identities beyond assigned player numbers, network endpoint, addresses or session IDs are written to the reports.** These capture only selected timing, count and numeric tick difference telemetry, not game-state transcripts.

## Native findings (authorized Linux Serj, Chromium 152)

All runs were real localhost Rust/WebTransport, not simulated network traffic. No browser JS/HTTP errors, all original opaque game canvases drew authentic 512px Greyhaven source tiles, and each live client received a distinct authoritative player ID and correct shared scoreboard.

| Trial | Real clients | Measurement window | Original snapshot datagrams/client | Largest real arrival gap | Largest tick jump | Original HUD extra render lag p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Solo | 1 | 5 s | 101 | 53.5ms | 3 ticks | 0ms |
| Four clients, A | 4 | 12 s | 240–241 | 125.1ms | 6 ticks | **0ms for all four** |
| Four clients, B | 4 | 12 s | 240 each | 58.2ms | 3 ticks | **0ms for all four** |

In trial A, each client recorded **one snapshot interval over 100ms**, with 104.2–125.1ms maximum. There were occasional long RAF scheduling gaps and main-thread long-task entries; this did not produce substantial *p95* presentation-clock debt at the end of the 12-second measurement. The low p95 might conceal very short-lived spikes: no claim of zero instantaneous debt at all times.

**Negative-result interpretation:** Across both sampled real 4-client sessions, we **did not observe** a 400–500ms real snapshot blackout or an associated 138–238ms HUD p95 debt. Thus the synthetic packet-stall hypothesis remains **plausible but unconfirmed** as a cause of P47's earlier 223ms HUD observation. P49 narrows the evidence; it cannot infer that the live P47 client suffered the P48 synthetic interruption. The capture also does not cover reliable-stream baseline snapshots: it targets genuine **realtime QUIC datagrams**, so interpretation of the actual client presentation tick source must account for possible reliable updates and snapshot apply/rejection behavior. This is a bounded localhost experiment, not WAN or mixed-host proof.

### Next Core 8A/8C action

Add **opt-in, read-only actual-client diagnostic markers** that correlate *accepted* authoritative snapshot tick (including reliable state transitions) with original `createSnapshotRenderClock` target vs rendered ticks, bounded catch-up count, and actual receive timestamps in a single test scene. Keep raw packets, credentials and player data private. Only then determine whether some real server tick discontinuity, lost/reordered datagram, interpolation-clock semantics or telemetry-sampling issue caused P47's observed debt. **Do not raise `maxCatchUpRate` to make the display look green**, as that might damage remote combat readability.

## QA and release gates

- Source-pinned original-node/local browser harness and unmodified original WebTransport payloads.
- Real native files: `assets/environment/greyhaven/3c-p49-real-ingress-qa/{one,four-a,four-b}-chromium-live-webtransport.json`.
- `tests/graphics3c-p49-real-ingress-evidence.test.mjs` checks source scope, true packet counts, independent IDs, genuine HUD data and absence of invented large outage, not an invented root-cause fix.

Parent P48 [protected quality #39797999312](https://github.com/tehki/myaso/actions/runs/39797999312) **COMPLETED FAILURE** at required Combat M194/M193 parry-vs-block exchange #2. P49 exact-head protected quality is independently required; no CI waiver, merge, production port, deploy, alpha release, or blanket Combat approval. Four independently operated human devices, real Windows+Firefox multiplayer, 3A Knight animation, physical Blacksmith four-sword pickup, authoritative fist/sword PvP and GPU-present acceptance are **still open**.

**Conclusion:** Real ingress capture succeeded; major live render-clock lag spike was not reproduced; origin remains unresolved, and Graphics runtime source was preserved.
