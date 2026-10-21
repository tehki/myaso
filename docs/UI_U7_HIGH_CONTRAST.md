# UI U7 — System high-contrast combat readability

Department 10 — UI & Player Experience. Stacked on U6 (#382) at
`b6cfb8635f7e53d066ec70986839e6fc66eb90e8`.

## Problem

The combat HUD represents HP/guard/stamina primarily as colored
meter fills, and visual impact feedback is an animated box-shadow.
Windows forced-colors modes may suppress these backgrounds and
shadows, leaving little contrast and obscuring combat feedback.

## Implementation

- Opt in *only* under `@media (forced-colors: active)`.
- Use CSS system colors `Canvas`, `CanvasText`, `Highlight`
  for fighter panel edges, meter track/fill, visible keyboard focus.
- While the existing `data-combat-feedback` state is present,
  replace box-shadow animations with a static, high-contrast
  outline. Negative impacts use a dashed outline; positive
  confirmations use solid, a noncolor distinction.
- Keep game-controlled ~320–420ms impact state lifetime, values,
  event text, commands and input bindings unchanged.
- Preserve normal appearance outside forced-colors mode; layering
  after U5's reduced-motion CSS intentionally gives system
  high contrast priority when both preferences are enabled.

## Safety and integration

Pure CSS with one idempotent stylesheet installer in shared bootstrap.
Never touch `web/styles.css`, `web/index.html`, physics,
combat, authoritative/network, Sound, NPC, Graphics, or inventory.
No new render loop, input event, timer or gameplay state.

Four focused tests registered in existing browser-runtime quality
suite. Independent real-browser acceptance should emulate
forced-colors on and off, inspect computed meter and feedback
styles, navigate with keyboard and verify 390px layout.

Stack U1 → U3 → U4 → U5 → U6 → U7; U2 is independent.
Do not merge or deploy until exact-head protected quality and
central review; do not waive browser combat checks.
