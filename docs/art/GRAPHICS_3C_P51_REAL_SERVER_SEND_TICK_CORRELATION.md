# Graphics 3C P51 — Actual Rust server transmission ↔ Chromium accepted-tick correlation

**Moon Games / myaso.io · 22 October 2026 · QA-only draft child of P50 PR #813**

Original exact parent: `05f577b7fb8d97ef33c6ddcf9699a3d6432db909`. **No committed changes to production Rust server, browser client, World renderer, authored assets, Combat, network protocol, game clock, constraints, or release checks.**

## What was missing after P50

P50's real local four-client Greyhaven session co-observed player #4's accepted **6-tick** latest-server-tick jumps and approximately **35.12 ms** extra presentation-clock debt with regular browser frames. However, client snapshots alone cannot say whether the **server sent a 6-tick update** or whether an ordinary 3-tick server snapshot was dropped/queued/coalesced before browser acceptance.

P51 adds a tightly scoped, optional **QA server-output trace** at two exact original Rust source points:

1. On each original authoritative simulation loop iteration satisfying `tick % SNAPSHOT_EVERY_SERVER_TICKS == 0`, immediately after the unchanged replication-frame refresh, output `P51_SIM tick=… epoch_us=…`.
2. Immediately **after** a successful unchanged `connection.send_datagram(snapshot.bytes)`, output `P51_TX player=… tick=… epoch_us=…`, using the actual replication frame server tick and actual assigned player ID.

The source is copied from the **pinned exact repository** into a separate, private `/home/serj/.cache/myaso-graphics3c-p51-traced-source-20261022` directory. The original `server/src/main.rs` is read and its SHA256 verified unchanged (`058c454f566c3db48c230d5b69f768050b6caaf45fc76fdc4469e465247c24a6`). Test-only instrumentation adds **stdout observations only** and is compiled offline with Rust 1.89 into an isolated **separate** Cargo target. The resulting server executable is **not byte-identical to production**, and printing introduces some processing overhead, but **authority/simulation/packet bytes/timers/Combat branches are unchanged**.

The P51 browser harness inherits P50's test-only HTTP response instrumentation, which captures actual `web/authoritative-client.mjs` accepted realtime/reliable server tick and original `snapshotRenderClock.sample` debt, P49's original WebTransport datagram receive headers, and P47's real `frame()`/RAF timing. It adds `performance.timeOrigin+performance.now()` to accepted-tick timestamps, allowing same-host correlation with the Rust server's `SystemTime::now()` output in epoch milliseconds. This assumes a shared host wall clock; small logging/event loop queueing differences are possible, so precise network latency claims are **not** justified. The original browser source is **instrumented in HTTP test responses only, never modified on disk**.

All QUIC and static listeners bind only to ephemeral **127.0.0.1**. Four separate native Chromium 152 browser processes are **automated on one machine**, not four human participants or independent network hosts. Test client sends genuine inputs to genuine compiled Rust game authority. All processes/servers were shut down and no public port was opened.

## Native tests and measurable findings

Three successful, distinct sessions: one 4.5-second solo baseline, two consecutive 12-second concurrent **four real Chromium processes** trials. Nine browser sessions total; all real server-assigned IDs and world Canvas original Greyhaven tiles confirmed. No HTTP/browser errors, no fabricated snapshots.

| Session | Realtime accepted packets/client during window | Server transmitted tick interval | Accepted tick interval | Max server TX spacing during measured window | Max observed browser receive spacing | Max presentation debt |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| Solo | 90 | 3 ticks | 3 ticks | approx. 51 ms | 55 ms | 0 ms |
| Four A | 240–241 | **3 ticks for every observed TX step** | **3 ticks for every observed accepted step** | **54.9 ms** | **69.6 ms** | **9.19 ms** |
| Four B | 240–241 | **3 ticks for every observed TX step** | **3 ticks for every observed accepted step** | **69.8 ms** | **104.2 ms** | **18.42 ms** |

The server simulation's **replication refresh** tick trace advanced by exactly **3 ticks for every observed refresh**. It does **not** imply every server send in the *entire* session must step by 3: before/after the bounded browser measurement window, player admission and related server state refreshes can yield different steps. The table applies only to the aligned native browser measurement intervals, excluding startup and teardown.

**Every actual accepted realtime tick** in the aligned two four-client trials was matched to the original successful server `P51_TX` log for that **player ID + tick**. Same-host TX-to-accepted reported timestamp differences in trial A: median **0.46 / 0.57 / 5.64 / 4.13 ms** across players, p95 **0.54 / 7.48 / 7.93 / 6.52 ms**; trial B medians **0.82 / 6.20 / 9.25 / 2.62 ms**, p95 **18.31 / 16.77 / 22.52 / 20.55 ms**. These are **observed logging/receipt timestamp differences**, not certified transport latency or production RTT: the server logs *after* calling `send_datagram`, browsers run on the same machine, and instrumented logging can shift timing. No unmatched received snapshot occurred in these windows.

In trial B, the actual browser received gaps reached **100.9ms** for client #1 and **104.2ms** for client #2, despite server TX gaps of at most **64.2ms** and **69.8ms** respectively, with **no 6-tick transmitted or accepted step**. The relative evidence supports transport/event-loop/receiver scheduling as a candidate for *those particular* delayed receipts. It is **not proof of physical packet loss or a server-side simulation skip**. HUD extra render-debt p95 in this B run was **2 / 9 / 2 / 0ms**; max sampled debt up to **18.42ms**, not P47's historic 223ms and not P50's 35ms scenario.

## Source facts and limits

Production source `server/src/main.rs` has **60Hz Tokio simulation timer**, `MissedTickBehavior::Skip`, replication-frame refresh on tick divisible by **3**, a separately scheduled **50ms Tokio snapshot timer** also skipping missed timer ticks, and `connection.send_datagram(snapshot.bytes)` from the latest snapshot cache. Simulation and sends have separate clocks, and player admission can force additional frame refreshes. This explains why a consumer's 6-tick advance alone is ambiguous. During P51's bounded normal runs the server refreshed and sent the expected 3-step sequence; **P50's 6-step event was not reproduced**, so it remains unresolved.

**Next actionable Core 8A/8C step:** run the exact passively instrumented server+client pair while reproducing a **6-tick accepted client event**, then inspect exact TX logs and real snapshot sequence transitions for that same session. Distinguish (a) server skipped 3-tick emission, (b) QUIC delivery/receive coalescing, (c) client accepted-sequence filter, (d) valid extra frame refresh due to join or other state updates. Do not change authority, packet ordering, visual catch-up rates or mandatory Combat expectations without evidence.

## Evidence and gates

- `tools/art/stage_p51_server_tick_trace.mjs`: explicit *external cache-only* source staging and original hash provenance, refuses source drift
- `tools/art/probe_p51_server_transmit_vs_accepted_ticks.mjs`: localhost-only authentic Rust/WebTransport/Chromium harness and same-host TX/accepted event timeline, no secrets/raw packets
- `assets/environment/greyhaven/3c-p51-server-tick-trace/{solo,four-a,four-b}-real-server-tx-vs-browser-accepted-chromium.json`: three exact native evidence sets
- `tests/graphics3c-p51-server-tx-vs-accepted.test.mjs`: real evidence assertions on send/received ticks, same-host timestamps, source SHA, and exact observer scope

P50 [protected quality #39815028930](https://github.com/tehki/myaso/actions/runs/39815028930) had already recorded a mandatory Combat **M194 guard-break/parry** failure at step 30 (unrelated cause unproven). Parent PR #813 and this P51 child remain blocked until their exact-head protected quality gates pass and orchestration authorizes it. No test waiver, production merge, public deployment, 4-human/two-machine Alpha, real Firefox online, finished Silver Knights/physical sword rack, authoritative fists/sword PvP or GPU-present FPS acceptance claimed.

**Verdict: P51 actual server TX/real client accepted clocks correlated. Two normal trials do not reproduce the 6-tick event; no root-cause fix or Alpha GO.**
