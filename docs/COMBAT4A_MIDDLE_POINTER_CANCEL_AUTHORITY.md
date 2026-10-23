# Combat 4A — Middle-button pointer ownership under W3C cancellation

**Status:** P0 input-state correctness review only, DRAFT; not an authenticated gesture protocol implementation.
**Parent:** protected-green [Combat4A #861](https://github.com/tehki/myaso/pull/861) exact `757b7cc407957bd4e32b66c5ebd4fcaf7ac938f7`.
**Owners:** Combat 4A browser controls; Combat 4/Main review and release; Core8A/8C/UI10 own the canonical source0/source1 `0x11`/`0x12` integration separately.

## Observed source-level bug

Both original browser clients (`web/online-game.mjs` and `web/game.mjs`) set `middleBlockHeld = true` on `pointerdown(button=1)`, but previously released that state on `pointercancel` or `lostpointercapture` only if `event.button === 1`. W3C cancellation is not an ordinary button release and may report `button=-1`. Consequently an interrupted middle-button guard can remain stuck true after cancellation, continuing to submit block even when no middle button is physically held. The original `pointerup(button=1)` also cleared that hold without checking that the released pointer was its owner.

## Narrow corrective behavior

- Remember the accepted integer middle-button `pointerId` when starting a held block. Reject duplicate/unidentified middle-button downs instead of replacing its owner.
- For `pointerup(button=1)`, release middle hold only on the same `pointerId`.
- For `pointercancel`, release the matching held middle pointer even with `button=-1`; unrelated pointer cancellations do not change block.
- For `lostpointercapture`, release the matching held middle pointer only when `event.buttons & 4` shows middle no longer physically depressed; changing capture while held must not cancel its input.
- On blur or visibility lifecycle `releaseInputs()`, clear both middle-block boolean and owner ID.
- All original LMB gesture pointer identity, RMB running, wheel parry/roll, Space chord, v1 input packets, server authority, damage, timing, protected combat acceptance and the exact parent green #861 source remain unchanged.

## Evidence and release limitations

The additive test `tests/combat4a-middle-pointer-cancel-owner.test.mjs` invokes **the actual registered input handler source** from both browser game clients through a restricted Node VM. It checks missing, different and matching pointer IDs, native `button=-1`, both capture states, independent LMB cancellation and blur cleanup source contract. This is not a native Firefox/Chrome event-driver proof, original server admission, or World damage claim. An additive protected CI step runs the focused tests and leaves all original acceptance gates intact.

**Pre-Alpha GO remains prohibited** until the original authenticated release-only source0 LMB/source1 KeyE World integration, exact-head CI, and 2–4 independently hosted Chrome/Firefox physical gameplay tests pass under Main #723.
