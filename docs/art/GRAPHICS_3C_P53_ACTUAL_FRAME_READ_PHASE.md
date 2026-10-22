# 🌕⚡️🚀 Graphics 3C P53 — original Rust replication-frame read phase identified

**22 October 2026 · myaso.io Moon Games · QA-only diagnostic child of P52 #829**

Base exact `e8cb752ee31407534b4c2a0a32305b020a98c70d`. No committed change to production Rust source, game client, Graphics 3C, World, Combat, snapshot protocol, render-only clock or CI gate. This report uses real loopback Rust/WebTransport and actual original game running in four separate automated Chromium browser processes on one Linux Serj computer. No GPU-present, multiple human/host or Internet/WAN claims.

## Why P53 adds information beyond P52

P52 observed genuine successful Rust **repeated same-tick snapshots and six-tick jumps** which the original browser accepted identically (e.g. `342 → 342 → 348`). This excluded a missing intermediate client packet as the proximate cause of *those* 0/6 sequences but did not prove exactly **when** the Rust server selected its cached replication frame relative to its separate 60Hz simulation refresh.

P53 adds one narrowly placed, stdout-only observer on a **private out-of-repository copy** of original `server/src/main.rs`, immediately after the actual `let server_tick = frame.server_tick();` in the original 50ms sender branch, following the original `Arc::clone(&state.replication_frame)`. It logs `P53_READ player tick epoch_us`, in addition to P51's genuine `P51_SIM` refresh and `P51_TX` successful QUIC send. Server compiled offline using pinned Rust toolchain and existing private Cargo target. Browser uses original logic with passive test-server response-time observation statements (not byte-identical original browser-served file, but code/packet timing logic unchanged). **The extra stdout itself can perturb scheduling**; all conclusions below apply to the observed instrumented QA runs.

The original `server/src/main.rs` SHA256 is **`058c454f566c3db48c230d5b69f768050b6caaf45fc76fdc4469e465247c24a6`**. P53 staging script refuses drift in server/client/World/clock source, stages code strictly under `/home/serj/.cache`, preserves the original server authority, and logs only numeric player ID/tick/time (no payload or credentials).

## Real native results — two separate four-player 15-second trials

Two independent real loopback Rust servers; eight distinct authenticated Chromium152 browser sessions, original Greyhaven opaque Canvas and online game, native input and ACK, four-player HUD, no page/HTTP errors; all original source-preserving tests pass.

| Actual 15s four-client live run | Genuine accepted unusual transitions | Peak original sampled clock debt | Main-thread game callback p95 |
| --- | --- | ---: | ---: |
| A | Player #2: **5 repeated 0-tick + 5 six-tick** steps | **42.53ms** (#2) | 2.6ms or below |
| B | Player #1: 1 repeated + 1 six-tick; player #3: **75 repeated + 74 six-tick** steps | **42.53ms** (#4), **35.12ms** (#3) | 2.4ms or below |

For **all** 149 trial-B player #3 unusual steps, genuine accepted snapshots matched successful actual Rust TX **and** logged actual frame selections with the same server tick. Its 75 repeated-tick sender reads occurred a median **1.628ms before** the next `P51_SIM` refresh, 74/75 within 5ms; the corresponding 74 six-tick reads occurred a median **0.439ms after** the current `P51_SIM` refresh, **74/74 within 5ms**. All 149 selected exactly the latest cached `P51_SIM` tick as of the server's `P53_READ` timestamp. Thus the observed sender sampled opposite sides of the actual refresh boundary.

Concrete original server sequence in trial A player #2:
- `P53_READ tick=423` then around 54.445ms later `P53_READ tick=429`, **0.621ms after** the original `P51_SIM tick=429` refresh; 6-tick step.
- The next `P53_READ tick=429` occurs 47.534ms later, **0.813ms before** the original `P51_SIM tick=432` refresh; 0-tick repeat.
- Both exact server sends and both browser-accepted ticks match their respective frame reads.

In trial B player #3 a typical sequence shows `P53_READ tick=336` **0.687ms before** the refresh to tick339 (repeat), then `P53_READ tick=345` **0.584ms after** that refreshed tick (6-step). The server frame reader was returning the latest cached replication state; it was not demonstrably stale relative to the completed refreshes at the moment of read.

## Interpretation and Core 8A/8C decision

The original `server/src/main.rs` has a Tokio **60Hz authoritative simulation** interval, replication refresh at `tick % 3 == 0`, and separate **50ms per-connection snapshot send** interval, both configured `MissedTickBehavior::Skip`. Near-50ms updates can straddle the replication refresh because separate timer phases and scheduler wakeups are not coupled to that specific frame boundary. The real P53 **frame-selection timestamp** provides direct, source-grounded evidence of this mechanism in instrumented live runs. Not a missing client datagram for these exact repeated/6 events; not a graphics Canvas stall.

This explains **how those emitted 0/6 sequences can happen**. P53 does **not** prove which scheduling changes, if any, should be made or that such phases are the sole cause of the historical P47 HUD **223ms** p95 outlier. Careless sender synchronization or forcing monotonically increasing ticks could alter input ACK, replication fairness, reliable checkpoints, motion continuity or authoritative Combat semantics. Graphics 3C should **not** change Core's simulation loop or raise the client visual-clock 1.45x catch-up budget.

**Request to Core 8A/8C:** choose documented desired transmission freshness/sequence semantics, then implement and test any narrow change behind the canonical source/QA gates; replay actual 0/6 trace and ensure server authority, client interpolation/spectator focus, RTT/ACK and Combat test outcomes remain correct. Distinguish harmless repeated samples from visually material clock backlog. No waiver for unrelated native Combat acceptance failures.

## Evidence and gates

- `tools/art/stage_p53_server_read_phase_trace.mjs` — copies and instruments Rust source only outside git worktree, immutable original SHA.
- `tools/art/probe_p53_snapshot_read_phase_browser.mjs` — authentic localhost WebTransport/server, four actual browser processes and passive original game timing.
- `tools/art/summarize_p53_snapshot_read_phase.mjs` — correlates original Rust SIM/READ/TX and browser accepted tick, captures both repeated and six-tick transition timing.
- `assets/environment/greyhaven/3c-p53-frame-selection-phase/p53-actual-read-vs-simulation-refresh.json` — sanitized deterministic **analysis of actual live packet/timer records**, raw traces retained only in private Serj QA cache.
- `tests/graphics3c-p53-read-phase-evidence.test.mjs` — evidence/source drift gating.

P52 protected [quality #39827323245](https://github.com/tehki/myaso/actions/runs/39827323245) **COMPLETED FAILURE**, mandatory Combat **M143 jump recovery FFA focus**. P53 own full protected exact-head CI is still required. No merge/deploy, no Alpha approval or 60fps/GPU-present claim. Four independently operated humans/hosts, real Windows Firefox online experience, 3A Silver Knight/3B facades and physically equipped four Blacksmith swords/fists-vs-sword authoritative combat remain open.
