# Combat 4A — physical MMB guard during simultaneous mouse buttons

**Status:** isolated DRAFT; W3C real browser input-source correctness, not combat protocol or release approval.
**Parent:** [Combat4A draft #889](https://github.com/tehki/myaso/pull/889), full original protected [quality #39948140276](https://github.com/tehki/myaso/actions/runs/39948140276) SUCCESS, exact `51c6d9d2afcbff6df43359aba0b05f7bfc787ea8`. This child must earn its own new exact-head protection.

## Source-backed W3C transition boundary

Original clients correctly handled a lone native `pointerdown(button=1)` middle-button guard in the parent, and now cancel it on matching W3C `pointercancel(button=-1)`, `lostpointercapture` without physically held bit4, `pointerup(button=1)`, or blur. But **a mouse pointer emits `pointerdown` only at 0→nonzero pressed buttons, and `pointerup` only at nonzero→0**. With an LMB or RMB button already down, the intermediate MMB physical DOWN and UP arrive as ordinary `mousedown(button=1)` and `mouseup(button=1)` instead. Parent `#882` had no middle-button mouse event listeners and could fail to start guard, or keep guard latched after MMB release while another button stayed depressed. This is exactly the existing original reason why client LMB+RMB supports a `CHORDED_LEFT_POINTER_ID=-1` fallback.

## Additive owner-scoped transition fix

Both `web/online-game.mjs` and `web/game.mjs` gain a dedicated, strictly bounded middle mouse `CHORDED_MIDDLE_POINTER_ID=-2` fallback for native `mousedown(button=1, buttons&4)` **only when no middle pointer is already accepted**. Physical `mouseup(button=1, !(buttons&4))`, including when `buttons&1` or `buttons&2` remain held, always terminates the middle guard. The actual pointer-owned middle gesture is not overwritten by a duplicate native mousedown. Matching mouse `pointercancel(button=-1)` and lost capture after released bit4 also retire the fallback; an unrelated touch cancellation or mouse capture migration with bit4 held cannot. True blur continues to clear every middle state and pointer identity.

The old LMB pointer source, original RMB kick/run handler, Space jump/chord, wheel parry/roll, stamina, World authority, 135/320ms timing, authenticated source0/source1 `0x11`/`0x12` evolution and real server damage are unchanged. Existing exact 10+5+3 dedicated test suites remain intact. The new five focused Node tests execute **the real handler source** of both original browser clients under isolated Node VM, including mid-release while RMB/LMB remains physically held; they do not pretend to be native ChromeDriver events or prove combat World hit.

**Required:** new original full protected CI, independently reviewed Chrome/Firefox physical chord and input-block correctness, later P0 canonical authenticated release-only LMB+KeyE original-game integration and 2–4 human host QA before Main can approve any release. Do not merge main/deploy/public-enable/restart from this DRAFT.
