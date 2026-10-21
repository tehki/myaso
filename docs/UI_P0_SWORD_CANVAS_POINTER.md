# UI P0 — screen-pointer to rendered sword canvas coordinates

First Playable: [#488](https://github.com/tehki/myaso/issues/488) ·
Integration parent [#489](https://github.com/tehki/myaso/pull/489).

This additive, side-effect-free UI primitive converts real PointerEvent
client coordinates to the same **canvas backing-pixel space** that Graphics
must supply for each **actually rendered individual rack sword**, including
canvas CSS scale, mobile viewport offsets, device-pixel-ratio and zoom already
resolved in the final sprites' screen rectangles.

Call `swordPointerCanvasPoint(event, canvas)` before `createSwordPointerGate`
for both `pointerdown` and `pointerup` on the real arena canvas.
If it returns null, there is no sword hit: preserve the regular Combat path
unless an earlier down already reserved the gesture. Never synthesize a
pickup or attack from a null coordinate or from stale game-state sprites.
The existing gate's down/up/cancel/reset lifecycle must always win over
Combat LMB charge/release **only when a visible sword was actually hit**.

This helper deliberately does not infer item identity, world location,
line of sight, authority, session admission, transfer or equipment.
Rendering geometry must be axis-aligned in final canvas coordinates;
alpha-mask/occlusion hit rules and scene freshness belong to Graphics.
Core/Items alone can commit pickup/equip. No claim of complete armory
interaction until real Chrome/Firefox click, four independent players,
simultaneous pickup, authoritative rejection and combat fallback pass.

Rollback: remove this module, its standalone tests and R0 test import.
No runtime, Combat, transport, protocol, persistence or production edits.
