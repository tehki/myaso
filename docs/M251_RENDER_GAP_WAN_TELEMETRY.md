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

## Critical defect discovered by this instrument (18 Oct real WAN)

The M251 real-client preview reproduced **~63,580,000 milliseconds** of `targetGapTicks` on BOTH Serj (#36) and X230i (#37), despite true WebTransport ACKs, remote rival replication and genuine W3C keyboard input. Before correction, all 96 gap samples per device were above 33ms and p50 lag was approximately **17.66 hours**. This is NOT real Internet RTT; it is an artificial renderer timebase gap. Both clients connected to the 3.8-million-tick public Rust world, while `connectAuthoritativeClient` initializes `latestServerTick = 0`. The first visual frame can sample that initial zero and then spend hours advancing from tick zero at 1.45×.

Corrective visual-only guard in `createSnapshotRenderClock.sample`: while the renderer has **not yet anchored** to a real server tick, ignore the special initial `serverTick === 0` placeholder and return a stable 0; anchor on the **first nonzero** authoritative tick. No fake packets or output state, no altered authoritative tick, and no relaxation of catch-up limits for subsequent actual WAN bursts. This also tolerates a new server starting legitimately at tick zero: it displays a stable first frame and initializes at the first later nonzero tick.

The new regression checks simulate a 3,815,000-tick server bootstrap and assert that its first real frame has **zero artificial gap**, while its NEXT burst remains bounded by unchanged 1.45×. Any unexpected failure must stay red, and the correction must be verified on two independent live-network preview clients **before** claiming an improvement. No public VPS deployment in this experiment.
