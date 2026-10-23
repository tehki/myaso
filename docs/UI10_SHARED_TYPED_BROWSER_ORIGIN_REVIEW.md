# UI10 P0 shared typed LMB + KeyE source-origin integration review

Status: **DRAFT / dormant**. Owner-selected release-only protocol [Main #723](https://github.com/tehki/myaso/issues/723#issuecomment-6363299673), on experimental Core8A [#887](https://github.com/tehki/myaso/pull/887) → Combat4C [#862](https://github.com/tehki/myaso/pull/862) → Core8 [#855](https://github.com/tehki/myaso/pull/855). Main controls all central merges, staging, live protocol activation and release.

## Intent and source boundaries

The UI10 [#844](https://github.com/tehki/myaso/pull/844) keyboard origin is ported **without altering its physical KeyE semantics**. The existing UI10 #720 mouse-edge gate accepts the already-authored Core8A `ProposedSharedTypedGestureOutbox` as an additional opt-in **source0** owner. New `createDormantSharedUi10Sources()` joins both physical-event origins behind exactly **one** Core8A lease-scoped typed outbox: source0 LMB and source1 KeyE share a monotonically ordered 32-bit EVENT sequence and a single global gesture ID allocator. They maintain different active source and matching-terminal ownership.

No new v2 packet format, alternative `0x52`, session authority or second KeyE outbox is introduced. The Core8A typed codec already owns canonical 16-byte `02 11` and `02 12`; the client diagnostic tick is never attack authority. KeyE PRESS may request the server-owned heavy; KeyE RELEASE cannot submit LMB RELEASE or strike locally. Actual Combat4/World remains the only HP/damage/READY decision owner. KeyE PRESS starts server heavy windup, reaches 320ms READY with **no hit while held**, then matching KeyE RELEASE commits at most one true World heavy. Never substitute auto-KeyE #858/#868.

The bridge is **not imported by** `web/online-game.mjs` or original `server/src/main.rs`. The generated browser test uses a temporary loopback HTML fixture with genuine WebDriver `isTrusted` inputs. It does **not** negotiate real QUIC, send source events to the Rust server, activate v2 gameplay, confirm a hit, or prove multi-host acceptance. Original v1 UI10 runtime, Silver, Chat C1, physics, sound and HUD remain untouched.

## Tests

- 10 additional source-behavior assertions: same-lease source0/1 monotonic sequence and distinct gesture IDs; KeyE during held LMB and matching UPGRADE; chat/jump/focus; two-source CANCEL on blur/hidden/chat; ACK correlation remains transport-only; first-send fairness; invalid diagnostic tick fail-close; lease retirement; DOM listener teardown; absent live imports.
- Original UI10 LMB tests preserved.
- New real Chromium/Firefox browser QA runs the original WebDriver mouse and physical KeyE acceptance against the **single** shared outbox. Native edge labels and IDs come from actual W3C events, with no synthetic game input or forged Combat evidence.
- Initial isolated Serj Linux source: **20/20 Node tests PASS**, exact compiler/syntax checks PASS; genuine local Chromium source QA PASS. Exact-head GitHub browser and full protected CI must independently complete before source-qualified promotion.

## Unresolved inherited source-policy conflict

The existing original policy tests `tests/prealpha-lmb-gesture-proposal.test.mjs` and `tests/core8a-p723-shared-typed-edge-outbox-review.test.mjs` require the server to have **no** runtime reference to experimental v2 code. Core8 #841→#855 deliberately introduces a **loopback-only, default-OFF** Rust ingress reference, so these legacy tests reject that parent. This branch does **not** modify, remove, bypass or reinterpret those checks. Core8A, Combat4 and Main must explicitly reconcile the historical blanket ban with the new feature-gated experimental contract, preserving the default-OFF and public deployment gates. Do not claim full protected green while any original guard is red.

## Release-blocking follow-up

- Real original browser `online-game.mjs` must atomically hand off the old 30Hz LMB and KeyE paths into the negotiated session-owned Core8A typed outbox **after** authentication and v2 grant; do not install both on the same gameplay actor.
- Core8A must determine whether legitimate second-source `REJECTED` due to an already-busy Combat actor should retire an entire shared outbox. Current review behavior retires on any REJECTED ACK, and one source's terminal must not strand another source's gesture. This requires a source-owned server ACK policy, not a client-side fabricated action.
- Core8B + Core8C must revalidate current boot/lease/generation/actor/World ownership under the same original World mutex. Ephemeral game-seat authorization is not a registered human account identity.
- Original strict M107/M108/M121/M143/M144/M156/M193/M194/M205, real Rust HP and stamina, independent 2–4 browser hosts, exact SHA protected/postmerge CI, immutable package/rollback and Main+owner GO remain mandatory.

No production deployment, `main` merge, service restart, public network toggle, or browser game input remap is authorized by this source-only draft.


## Additional native original Rust server bridge qualification — UI10 source-specific

On this separate release-only child, `scripts/ui10-native-real-world-shared-gesture-review.mjs` uses the **actual UI10 dormant physical DOM event handlers** from this review (no test-only replacement listeners), the exact existing Core8A per-connection `ProposedSharedTypedGestureOutbox`, and real original Rust WebTransport with pinned certificate. It invokes a bounded QA transport pump after native events are queued; this **is not** the original game's negotiated production sender nor proof of automatic resend scheduling. Core8A owns send/ACK; original Rust 60Hz World owns LightWindup/HeavyWindup/Active.

Four strict review modes using the unchanged original Rust server:
- Physical LMB0 DOWN, KeyE1 DOWN+UP while LMB is active, LMB0 UP: source tags/order 0→1→1→0; exactly one original LightActive; no Phantom HeavyActive.
- Deliberately discard original source0 PRESS on the QA transport, let later typed physical edges arrive first; no premature ACCEPTED; resend actual queue packets in order, confirm only one original LightActive.
- Discard original **server** ACCEPTED ACK from the QA receiver; retry byte-identical pending original PRESS; get actual original server DUPLICATE ACK, no duplicate LightActive.
- Physical standalone KeyE DOWN: actual original HeavyWindup then hold beyond 320ms server time, **no HeavyActive while still held**; only physical trusted KeyE UP commits exactly one HeavyActive. This is the Main-selected release-only contract; sibling auto-KeyE experimental branches are incompatible.

The test asserts `M201_FLIGHT_ACTOR_BASELINE` from the actual Rust World before native input, not a fabricated actor state; native `isTrusted` pointer/key edges, actual World-tick ACKs and World action transitions. The in-test WebTransport pump is intentionally explicit, not integrated into `web/online-game.mjs`: original page's atomic v1→v2 authenticated transition, live end-to-end transport scheduling, four independently operated physical human hosts, HP-on-real-remote-victim, respawn/grant fencing, full protected CI and Main GO are not claimed.
