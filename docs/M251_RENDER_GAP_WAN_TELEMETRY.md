# M251 — Measure extra render lag under real WAN jitter

## Why this is needed

The 18 October two-device **R1 predeployment immutable-artifact** trial connected actual Serj and X230i Chromium clients to the public WebTransport authority. Both observed one another and real input ACKs, but `Render catch-ups` grew by 899–1023 within ~15 seconds. That metric is a **cumulative count of frames where R1's original 1.45x catch-up rate limited a renderer advance**, not a latency distribution. It cannot independently tell us whether the presentation clock is milliseconds or seconds behind.

R1's `createSnapshotRenderClock().metrics().targetGapTicks` already represents the nonnegative difference between its **proposed presentation time** (which intentionally includes the unchanged 90ms remote interpolation delay) and its **actual bounded presentation time**. Conversion to milliseconds is `targetGapTicks / NETWORK.serverSimulationHz * 1000`. It is **EXTRA visual clock lag** beyond the existing interpolation target, not network RTT, one-way propagation or authoritative-server latency.

## Bounded opt-in local instrumentation

A new `createRenderGapTelemetry` samples at most every **100ms**, retaining only the **last 96** observed browser frames (about 9.6 seconds at sustained 10Hz) in memory. It returns upper nearest-rank **p50 and p95**, maximum, and the proportion above **33ms extra lag**, with explicit sample counts and `collecting…` until available. The `netstats=1` HUD exposes this beside unchanged input→ACK telemetry and cumulative catch-up count. No console/network reporting, IDs, endpoints, positions, input packets, persistent storage, server-side changes or global state.

The collector is created only when `netstats=1`; ordinary players do not run it. Invalid samples and parameters fail closed. Background/foreground visibility resets clear the sample history in sync with the existing render clock; backward browser time resets history as well. A bounded sample list prevents memory growth, and percentiles are computed only when the optional HUD refreshes twice per second.

No gameplay constants change: 60Hz authoritative server, 20Hz snapshots, 90ms remote interpolation, 100ms maximum remote extrapolation, 1.45x bounded catch-up rate, 50ms frame cap, movement, hitboxes, inputs, ACK, combat and server authority all remain unchanged.

## Acceptance

Focused regression tests verify percentile semantics, 96-entry bounded history, 100ms sampling, reset behavior, invalid data, opt-in guards, and unchanged strict input code. **Passing focused tests is insufficient**; require full exact-head Rust and genuine Chrome+Firefox CI, with existing M146/M147/M159/M194/M41 rules unchanged.

Then run the R1 client from a separate **local loopback preview** on two devices against the actual public QUIC server and collect extra-render-lag p50/p95/above-33% samples for both. For an eventual production R1 rollout, merge with the declared review and provider-side governance checks first, then require independently green main CI, verified package bytes, isolated production rollback, genuine cross-network combat and time-to-convergence measurements. No automatic VPS activation.

See [WAN responsiveness #293](https://github.com/tehki/myaso/issues/293) and [M249 green exact-head PR #305](https://github.com/tehki/myaso/pull/305).
