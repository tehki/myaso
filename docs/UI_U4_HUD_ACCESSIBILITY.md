# UI U4 — Scoped HUD announcements

Department 10 — UI & Player Experience

Stacked onto U3 (#373) head
`5ba8204d703be1e3792ab7d5a0f003c3055a7dae`.
This is an accessibility and UI-comprehension improvement, not an
authoritative game mechanic.

## Existing issue

`web/index.html` marks the entire `.hud` as `aria-live="polite"`.
That contains frequently changing player HP, stamina, guard, opponent
meters, and the combat event text. Assistive technology may encounter
noisy, irrelevant repeated updates as every value changes.

## Behavior

Install once in shared browser bootstrap before practice/online modules:

- Turn off inherited live announcements from `.hud` as a whole.
- Give `#event-text` an explicit `role=status`,
  `aria-live=polite` and `aria-atomic=true`, so discrete server/
  simulation combat messages can be heard instead of every meter tick.
- Preserve `#threat-cue` and `#combat-overlay` with their existing
  explicit `aria-live=assertive` urgency.
- Keep all visible pixels, controls and gameplay behavior identical.
- If JavaScript is unavailable, existing HTML still renders and
  retains its original semantics.

No changes to `web/index.html` (Sound), `web/styles.css` (AI),
`web/game.mjs`, `web/online-game.mjs`, combat/physics/AI,
server authority, economy, wallets, or network ingress.

## Acceptance

Unit checks exercise scoping, idempotency, missing elements, urgent
regions and wiring. Tests load under the protected
`tests/browser-runtime.test.mjs` lane.

Genuine browser smoke should validate DOM roles/attributes on practice
and online-error paths and verify that a running game preserves canvas,
meters and visible combat event copy. Does not claim a real screen
reader audit solely from DOM property checks.

**No merge/deploy before exact-head full quality and central review.
Merge after U3, which merges after U1.**
