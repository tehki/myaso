# Core 8A P0 — original native M144 input sender → ACK observations (review only)

Source base: [Combat4 strict M144 draft #814](https://github.com/tehki/myaso/pull/814) exact head `2884173aaa2f37daf18a2a73a255945ce87b94e9`. This is a **read-only diagnostic**, not a fix, a test waiver, or version-2 activation.

## The actual gap

The strict authentic W3C M144 simultaneous three-browser FFA test has observed genuine browser `Space` + LMB pointer events but occasionally the original Rust World entered `HeavyWindup9` instead of `JumpAttack16`. Without source-plane traces, the original evidence cannot distinguish:

1. a real DOM transition that happened entirely between existing 30 Hz input samples;
2. a sampled outgoing `attack + heavyAttack` before Space+jump override;
3. a correctly sampled `attack + jump` that was not delivered or acted upon;
4. a server-admitted input later denied by Combat action legality or timing;
5. a missing or stale ACK rather than missing physical input.

A genuine W3C event alone is not evidence that an input datagram was emitted, and an aggregate input ACK is not evidence of a Combat HIT.

## Precise source changes

In `web/online-game.mjs` the preexisting M145-only `uimultirecoveryspatial` original 30 Hz sender trace also runs for **M144** `uimultirecoveryffa`, before the unchanged `networkClient.sendInput({ tick: outgoingTick, ...currentInput })` call. The M144 case records up to **32 actual submitted samples** (action-bearing samples plus the two immediately preceding idle samples and first two following each real action; long unrelated idle streams are coalesced) with sequence tick, epoch time and attack/jump/heavy flags; this reveals whether a real native Space+LMB gesture crossed the send boundary. The existing M145 filter remains action-only and is not broadened.

For M144 only, the existing `onAck` callback separately logs up to 32 **authentic callback observations** (receipt epoch, latest processed client tick, latest server tick). Receipts may coalesce multiple input samples: they do **not** individually certify a PRESS, RELEASE, Combat acceptance, World action, HP or HIT. Existing World action transitions, server logs and W3C pointer/keyboard events remain the independent third layer.

`scripts/pvp_browser_flight_runner.mjs` includes these bounded `inputAckReceipts` alongside existing M144 `inputSubmissions`, W3C pointers/keys and authoritative focus/action states when reporting native results or strict failure. The original required M144 focus stages, exact W3C choreography, Combat windows and error assertions remain untouched.

## Qualification and trust boundaries

Source-policy `tests/core8a-m144-original-input-ack-trace.test.mjs` (4 checks) pins the scenario gates, sender call signature, both independent 32-record bounds, ACK observation and the original strict M144 test verdict. Authorized Windows Node run after source change: **4/4 PASS**, browser and native runner Node syntax PASS.

**NOT CLAIMED:** A real native Chrome/Firefox 3-peer M144 run at this exact child head, a true server World ingress action trace correlation to specific `clientTick`, a v2 negotiated transport, a corrected heavy/jump action, or a full-quality green run. These require exact-head protected GitHub CI and specific interpretation of W3C → sampled intent → ACK → original Rust World action ticks. An input ACK can coalesce processed samples; never identify a particular gesture based only on highwater-mark ACK.

Original v1 packet bytes, original 30 Hz sender scheduling, authoritative Combat, Physics, gameplay, World, UI controls, server main, CHAT C1 and production are unchanged. No `main` merge, deployment or release GO without Main [#360](https://github.com/tehki/myaso/issues/360) and Combat [#696](https://github.com/tehki/myaso/issues/696) review.


## Direct native qualification and loss-safe evidence retention

The browser's new pure observational `src/browser/m144-input-sample-observer.mjs` selectively retains the two most recent preceding idle samples before an action and the first two following a real action, rather than dropping the actual Space/LMB samples after a further 32 idle frames. It uses only the **unchanged** genuine 30 Hz `currentInput`, preserves input record order and never calls transport, Combat, World or HUD mutations. The 32-entry cap remains strict and older action samples may still age out only after more than 32 later action-bearing records. The prior M145 action-only collector is still identical.

New `tests/core8a-m144-input-sample-observer.test.mjs` demonstrates that 350+ later idle samples do not erase the diagnostic action, independent actor buffers never coalesce, and even 500 consecutive action submissions are bounded to 32. Four original source-policy tests remain. Dedicated `.github/workflows/core8a-m144-native-v1-input-provenance.yml` requires original real three-browser Chrome/Firefox/Chrome2 strict `uimultirecoveryffa` **without changing its assertion** plus Rust authoritative server and Node 8-case focused suite. A focused native pass/failure is separate from the full protected gameplay quality suite, which can independently fail an unrelated earlier M108.
