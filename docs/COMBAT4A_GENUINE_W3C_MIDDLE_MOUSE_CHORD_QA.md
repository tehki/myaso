# Combat 4A — genuine original Chrome/Firefox RMB+MMB guard, native QA

**Scope:** draft review-only native browser QA child of [fully protected-green #895](https://github.com/tehki/myaso/pull/895), exact `2e0b9113f3b9f3d918be82456c94f037dba7016b`, [full quality #39952270800](https://github.com/tehki/myaso/actions/runs/39952270800) SUCCESS. This child is **test/CI/documentation-only**, not runtime, 135/320ms Combat, Rust World/HP, network, packet or public gameplay change.

## Physical W3C test

Add an additive native original browser scenario `MYASO_PVP_SCENARIO=ui4amiddlemousechord` to existing real `scripts/pvp_browser_flight_runner.mjs` and run on original full protected CI. It uses the existing real ChromeDriver and geckodriver, the actual `web/online-game.mjs`, original spawned cert-pinned Rust WebTransport server, genuine player admission and acknowledged World actions. Two distinct Chrome and Firefox browser sessions each exercise the sequence independently:

1. Focus real `#arena`, attach **read-only** `isTrusted` listener for original DOM `pointerdown/up`, `mousedown/up` and `pointercancel`; never synthesize events, mutate game input or fake World.
2. Send physical W3C mouse `pointerDown(button=2)` RMB. Then, **without releasing RMB**, send real `pointerDown(button=1)` MMB. Original browser MUST receive `mousedown(button=1)` but *no* second W3C `pointerdown(button=1)`.
3. Poll replicated original World `acceptance.ownActionTransitions` for original **Block action 6** from the genuine middle mouse hold.
4. Send physical `pointerUp(button=1)` while RMB stays physically DOWN. Original browser MUST receive `mouseup(button=1)` but *no* intermediate W3C `pointerup(button=1)`. Verify original World transitions from Block6 back to Idle0, not stuck blocking.
5. In a `finally` block release any remaining real W3C mouse buttons; prove original actor/remote HP100 and guard100 are unchanged, with no phantom attack/parry. Log a labeled success only after **both** Chrome and Firefox satisfy the gate.

Only the two legitimate WebDriver W3C physical pointer actions drive gameplay; test-side JS is read-only event observation. The original pre-existing R2 genuine three-strike standalone middle block and all strict native M-series, M8, final whitespace remain mandatory. The new CI step is additive and **cannot substitute** original Full protected green.

## Limitations

A CI browser is an authentic native driver but not an independently operated human on a separate physical host. This proves neither source0 LMB/KeyE source1 `0x11/0x12` authenticated release-only integration nor combat Pre-Alpha release; final acceptance, merge/deploy and GO remain Main-only under #723. If new genuine native scenario fails, retain failed trace and diagnose, never relax test or silently mark green.
