# 🌕⚡️🚀 Graphics 3C P52 — Real Rust-emitted repeated/6-tick snapshots reproduced

**22 October 2026 · Moon Games myaso.io · QA-only, stacked on Graphics 3C P51 #821**

## Verified first: no source modification, no simulated loss

P50 [#813] once captured real player #4 with repeated accepted server ticks and **6-tick advances**, along with **35.12ms** original sampled presentation-clock debt; it lacked server transmission logs. P51 [#821] established a real test-only Rust stdout TX→browser accepted comparison, but in the two first four-client trials, both streams showed only regular 3-tick updates. P52 repeats the exact **unchanged** P51 harness and the same private, offline-compiled QA-only Rust executable (original source SHA256 `058c454f566c3db48c230d5b69f768050b6caaf45fc76fdc4469e465247c24a6`), **without adding synthetic tick loss, load injectors, network impairment, fake packet receipts, server/Combat edits, or source changes**.

Three separate **15-second** four-process live Chromium152 trials on the same authorized Linux Serj host. 12 genuine QUIC browser sessions, distinct server-owned IDs, live original Greyhaven Canvas/World, authenticated WebTransport snapshots/ACKs, four peers on each scoreboard, 0 HTTP/page errors. All Rust server + browser HTTP listeners bound ephemeral **127.0.0.1** and shut down at end. Original game/browser served using strictly test-only passive response observation statements (the tested wire JS is instrumented, but original repository source files stay byte-identical); Rust executable is a separate staging copy with **read-only stdout** `P51_SIM` / `P51_TX`, not byte-identical to production. It may perturb scheduling. **These are not four humans or independent devices**.

## New outcome: third run reproduces the actual repeated/6 pattern at server transmission

| 15-sec four-browser genuine Rust trial | Live server successful TX tick steps | Browser accepted tick steps | Largest sampled original clock debt | Largest browser receipt interval |
| --- | --- | --- | ---: | ---: |
| A | Mostly **3 ticks**; one player #2 repeated server send, not repeated in accepted stream | All 4 accepted streams: **3 ticks only** | **55.15ms** | **166.5ms** |
| B | All 4 streams: **3 ticks only** | All 4 streams: **3 ticks only** | **9.19ms** | **61.5ms** |
| C | Player #1/#2: 3 only; #3/#4: genuine repeated/6 changes | Player #1/#2: 3 only; #3/#4: corresponding genuine repeated/6 changes | **34.97ms** | **60.9ms** |

**Trial C, player #4:** within aligned 15s browser measurement, original successful Rust `P51_TX` logs show **13 separate 6-tick updates**, interleaved with repeated latest ticks (at least 13 repeats). The original client genuinely accepted **13 × 6-tick advances** and **13 × 0-tick repeats**. A representative same-player server/browser event:

- Original server succeeds in sending tick **342**, then successfully sends tick **342** again about 50ms later, then sends tick **348** about 50ms later. **No successful tick-345 server send occurred in that local event window**.
- Original browser accepts exactly the same real server ticks **342 → 342 → 348**, with approximately **49.2ms** and **50.7ms** between acceptances.
- Test-only original browser clock samples reached **27.55ms peak positive target presentation debt**. Original synchronous game-frame callback was **1.8ms p95**, **zero** browser callback gaps over 33ms and **zero** long tasks. Browser receipt intervals stayed at or below **51.4ms**.
- Client acceptance of every snapshot was matched by **player ID + server tick** to a successful actual `P51_TX` event. The original server provided the nonuniform tick sequence in this occurrence; **the 6-tick advance was not caused by the browser failing to receive a separately transmitted tick-345 packet**.

**Trial C, player #3:** another genuine successful Rust **756 → 762 → 762** TX sequence, matched to browser accepted snapshot ticks. One 6-tick advance and one repeated tick. The original clock reached **34.97ms peak debt** with fast normal RAF and no long tasks; browser receive intervals stayed below **60.9ms**.

This reproduces P50's important **0/6 accepted-tick phenomenon** and identifies its immediate source **in these P52 events**: the authoritative Rust server's latest replication-frame tick reported on successive successful QUIC sends. It is a **read-only timing/observation outcome**, not a new gameplay algorithm or merged fix.

## Why this can happen (source-level mechanism, not yet proven root cause)

Original `server/src/main.rs` runs *two independently scheduled Tokio timers*:

1. 60Hz authoritative simulation loop, `MissedTickBehavior::Skip`; refresh the cached `replication_frame` when `world.tick % 3 == 0`.
2. A separate `SNAPSHOT_INTERVAL=Duration::from_millis(50)` Tokio timer, also `MissedTickBehavior::Skip`, which reads `frame.server_tick()` of the latest cached frame and calls `connection.send_datagram(snapshot.bytes)` to each session.

These independent timer phases, scheduling jitter, and shared-state read order can permit one 50ms send to observe the same cached frame tick as the previous send, while the next observes a frame advanced by 6 ticks. **The natural source mechanism fits the verified TX pattern.** Exact cause and required fix still need Core 8A/8C review (e.g., timer phase, lock acquisition, snapshot sequence semantics, server fairness under load). P52 alone cannot isolate those sources or establish whether the observed clock debt is exclusively due to this pattern. Do not automatically force 3-tick transitions, alter authority, change interpolation catch-up rate, skip authentic snapshots or modify Combat behavior just to make HUD telemetry appear green.

A separate P52 trial A exhibited up to **166.5ms browser receipt interval** while original server successfully transmitted no more than **54.9ms apart** in the aligned window, with no 6-tick accepted advance. This confirms receipt/scheduling delay **can occur independently** of the repeated/6 server-send phenomenon, so not all delay has the same origin. The earlier P47 **223ms** HUD lag has **not** been reproduced here.

## Native data provenance and QA gates

- `tools/art/summarize_p52_real_tick_trace.mjs`: source-pinned read-only analysis of real P51 original server TX, original QUIC accepted timestamp/ticks and original visual-clock samples. Refuses runtime source drift. Classifies repeated tick and 6-tick changes only when matching successful server TX events exist. Records short surrounding TX event windows. No synthetic packet data or private credentials.
- `assets/environment/greyhaven/3c-p52-real-tick-jump-triage/p52-three-four-client-trials.json`: **compact sanitized analysis** of three real 15s sessions, 12 actual players-as-browser-processes. Full private raw traces remain in Serj's private cache; not shipped to GitHub.
- `tests/graphics3c-p52-real-server-tick-jump-triage.test.mjs`: provenance and genuine TX/acceptance step histogram constraints, 13+13 exact server/client event matches, four-player scope, no browser long-task/RAF stall, strict no production edit.
- Combined relevant native World/Graphics3C/P45–P52 test suite must pass. Exact-head protected full quality remains mandatory.
- **P51 protected [quality #39818053314](https://github.com/tehki/myaso/actions/runs/39818053314) FAILED** mandatory Combat M143 jump recovery FFA focus: the expected nearest #3 → punish #1 → nearest #3 handoff was incomplete. **No test threshold waiver, merge or deployment authorized**.

**Core 8A/8C next action:** examine dual timer phases and snapshot frame cache update/read ordering, confirm expected semantics of repeated/6-tick latest-server-tick sends, and propose a narrowly reviewed server-side remedy **only with authoritative simulation/Combat and client visual regression tests**. Graphics 3C does not own changes to the server clock or Combat authority.

This report does NOT certify multi-machine human play, Windows Firefox online, 3A Knight/3B named city integration, four literal rack swords/pickup, authoritative fist/sword fights, production render presentation/FPS, or First Playable Alpha GO.

**P52 state: genuine server-emitted 0/6 tick behavior VERIFIED, precise scheduling root cause not yet proven, narrow source-level mechanism identified, QA-only draft and NO-GO.**
