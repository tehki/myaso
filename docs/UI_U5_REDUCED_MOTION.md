# UI U5 — Reduced-motion arena impact feedback

Department 10 — UI & Player Experience

Stacked on U4 #376 at `72fdaaec5091bd9dc67fcc15343ae75f08f79daa`.
Merge order: U1 #361 → U3 #373 → U4 #376 → U5.

## Problem

The shared arena uses expanding, fading full-canvas edge flashes for
combat confirmation. It also animates meter changes. These are not ideal
for players requesting reduced motion through OS/browser preferences.

## Approach

- Load a very small optional stylesheet in shared bootstrap.
- Apply overrides only inside `@media (prefers-reduced-motion: reduce)`.
- Replace impact animations with a thin, *static* colored arena edge.
  Reuse the game's existing, self-expiring `data-combat-feedback` state.
- Keep semantic color distinction between favorable confirmations and
  damage/denial states. The authoritative text and audio feedback remain.
- Disable purely decorative meter transform transitions. Changes still
  update to the correct numerical HP, guard and stamina without delay.
- Do not listen to gameplay inputs, mutate the simulation, set timers,
  alter event windows, or disable the canvas/render loop.
- With system motion preference unchanged, original animations remain.

Source files untouched: `web/index.html`, `web/styles.css`,
`web/game.mjs`, `web/online-game.mjs`, server/network/combat,
and Sound/Graphics/NPC files. No background work.

## Verification

Four Node tests: idempotence, headless no-op, CSS semantics and early
bootstrap ordering; registered through the protected browser runtime
test suite. Also verify with real browser media emulation both reduce
and no-preference paths, static impact and empty-state behavior, as
well as no horizontal overflow on small screens.

**Draft until exact-head protected quality and central review.**
