# Combat 4A — v1 LMB input/provenance boundary (P0 evidence, not a fix)

**Repository:** `tehki/myaso` · **Base:** `main` at `6fa59b649112c272bcbc018b4a32bf963f9a5bba`  
**Coordination:** [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695), [Combat #696](https://github.com/tehki/myaso/issues/696), [wire #723](https://github.com/tehki/myaso/issues/723), [M156 #531](https://github.com/tehki/myaso/issues/531), [M144 #392](https://github.com/tehki/myaso/issues/392).

## Verified source-level defect

1. `src/browser/left-button-charge.mjs` defers the normal `onLight()` callback to `release()`. `press()` calls `onLight()` only for `immediate` (Space/jump) chords. Hence ordinary pointerDOWN does **not** submit the required immediate light intent.
2. `web/online-game.mjs` keeps `currentInput.attack = attackRequested || leftChargeHeld` and `currentInput.heavyAttack = heavyAttackRequested || leftChargeHeld`. A normal held LMB therefore enters the **simultaneous attack+heavy** v1 state, before any light callback.
3. `src/network/input-codec.mjs` represents the eight action bits in the same byte but has no typed KeyE/LMB source, gesture ID, PRESS/UPGRADE/RELEASE/CANCEL, or ack per gesture edge. Both standalone KeyE and a hypothetical lost-predecessor LMB heavy-only observation encode identically. This is a codec information deficit, not proof that any particular QUIC packet was lost.
4. Live `src/network/constants.mjs` currently says `inputSendHz: 60` and `inputRedundancy: 3`. A genuine 12ms click can fit wholly between 60Hz send instants (16.67ms). The directive's 30Hz characterization should be checked against its historical revision; this branch does **not** change it. A queued onLight on release **can** still be delivered later, so the witness is **not** a claim that every short click disappears.
5. Native [#531](https://github.com/tehki/myaso/issues/531) records a genuine ~12ms Chrome2 press entering World action9, not the required light action1. The **specific** input ingress/tick transition causing that occurrence remains unproven until physical event, selected client sample, accepted QUIC packet, and original World step are correlated.

## Acceptance interface owned by Combat 4A

An approved canonical v2 implementation, in coordination with 4C/8A/8C/UI10, must preserve one source-typed, lease-fenced event stream:

- **LMB PRESS:** send once on genuine pointerDOWN; original World admits one eligible server-owned light windup (135ms), not instant damage.
- **UPGRADE:** only a valid, still-uncommitted held gesture may upgrade; do not use client time to authorize 320ms READY; late upgrades may not rewind a committed light.
- **LMB RELEASE:** terminal edge for the same gesture; a server-verified READY heavy may commit once, never on mere timeout. Below READY release must not create an undeserved heavy. Clarify behavior of already-upgraded undercharged releases in the chosen server reducer before enabling runtime integration.
- **CANCEL:** focus loss, capture loss, pointer cancellation, hidden tab, death/rejoin, closed lease; never mint phantom RELEASE/HP.
- **KeyE:** independent explicit source; never infer from an orphaned LMB release.
- **Ordering:** protect DOWN+UP within one send interval, duplicates, lost/reordered edges, stale ACK, session/boot/actor incarnation changes, and one-hit-per-gesture.
- **Chords:** preserve Space+LMB, RMB+LMB, roll/parry+LMB, sprint+attack and existing bindings without adding concurrent v1 and v2 listeners.

## Scope and safeguards

This draft adds deterministic tests of **existing legacy behavior** plus a narrowly scoped W3C pointer-cancellation fix in `web/online-game.mjs` and `web/game.mjs`. Previously both handlers gated left cancellation on `event.button === 0`; PointerEvent cancellation can report `button === -1`, leaving a still-pressed gesture active. Both handlers now call `leftButtonCharge.cancel(event.pointerId)` without guessing button state; the existing controller refuses to cancel an unrelated pointer. Online only resets left-button movement state after the matching cancellation. The separate two new tests confirm canceled charges cannot later strike and reject the old button-gated live handlers.

No gameplay bindings, normal click/light/heavy algorithm, sampled input bits, network protocol, server World or damage values change. The original v1 observations are **diagnostic witnesses**, NOT passing Pre-Alpha requirements or a reclassification of known native CI failures.

Do **not** merge this proof as a substitute for fix or unlock Pre-Alpha based on it. Build the actual fix on a single selected #723 protocol lineage, not by changing v1 flags to guess KeyE vs LMB. Existing Core/Combat/UI experimental proposals and their ancestry need Main/4C coordination before incorporation. Server-owned 34HP/46HP and 135ms/320ms rules remain unchanged.

## Additional independent pointer identity regressions

The live online `onLeftPointerUp` previously cleared `leftButtonDown` and the captured strafe movement **before** checking whether a release actually belonged to the active LMB; a foreign pointer's pointerUP could therefore destroy an unrelated valid chord reservation. The controller now exposes a read-only `isActivePointer(pointerId)` predicate that prevents entering the handler's existing real release/movement-clear sequence for a foreign pointer, preserving the pre-existing exact-order `r1-directional-release-capture.test.mjs` contract. This check never commits a hit or changes charge timings.

The online `lostpointercapture` previously cleared captured left movement **even for a nonmatching pointer** and failed to clear `leftButtonDown` after a matching loss. It now checks the active pointerId first and preserves the original sequential `leftButtonPressMovement = null; leftButtonCharge.cancel(pointerId)` on genuine cancellation; lost-capture checks successful matching cancellation before clearing state, and only when the native pointer no longer holds the left button. Practice lost-capture previously called `cancel(undefined)`, which cancels any active gesture in the underlying controller; it now requires an actual integer pointerId.

Three further deterministic tests execute the **real live handler source** in an isolated Node VM (not hand-copied fake handlers): foreign pointerUP, foreign vs matching lost capture, and missing pointer identity in practice. They are regression coverage for state integrity, not W3C/QUIC multiplayer acceptance. No protocol format, LMB hit semantics, input timing or authoritative combat damage changes.

## Required next verifications

- Add strict actual browser-to-World assertion: pointerDOWN starts authoritative LightWindup without requiring pointerUP; preserve legitimate sub-sample quick taps.
- Confirm source-typed KeyE release-only behavior and LMB upgraded READY held indefinitely, zero pre-release heavy damage, no light/heavy double damage.
- Correlate M156 #531 and jumping attack #392 with native event clocks, actual sampled v1/v2 edges and *server* tick/admission; do not subtract unrelated browser-relative clocks.
- Run fail-first authoritative Rust tests, native real Chrome/Firefox (2–4 humans), unchanged M-series and exact-head protected CI. Combat4D independent acceptance and Combat4/Main sign-off required.

**Current verdict: HOLD — no safe live fix in this evidence-only branch.**

**Protected CI learning:** exact prior head `b69f60238038b1bc97232283c3893fea98428065` passed all nine dedicated focused tests but [full quality #39930488204](https://github.com/tehki/myaso/actions/runs/39930488204) **FAILED** in `Validate R1 zoom, offscreen targets and bounded WAN render catch-up`: original protected `r1-directional-release-capture.test.mjs` checks `leftButtonCharge.release(event.pointerId);` immediately followed by `leftButtonPressMovement = null;`. The first patch had inserted a conditional between these two statements. The current narrowly revised handler restores that original sequencing with a **pre-release active-pointer guard**, without modifying or weakening original tests. The new head must qualify independently.

**Second protected ordering check:** the unchanged original R1 test also asserts `leftButtonPressMovement = null;` immediately before `leftButtonCharge.cancel(event.pointerId);`. The live pointercancel handler now uses `isActivePointer` to guard that original ordering, while lostpointercapture retains its result-checked reset path. Both regex contracts are also required by the new dedicated 4A tests; all physical input timing/World rules remain untouched.
