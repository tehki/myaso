# UI U3 — Contextual combat focus guidance

Department 10 — UI & Player Experience
Stacked on U1 PR #361 at `758fa48d43d80ebfd530cb693d771329ca90af1e`.
Merging U1 first makes the U3 diff small; this PR does not merge U1 itself.

## Issue

The practice/online arena carries one static bottom message:
"Click the arena once, then fight. Add ?server=https://host:port/game..."
This leaks developer connection setup into the main player experience and
provides no indication whether the focusable combat canvas owns focus.
A player pressing WASD or clicking a sound control may not know why
combat input is inactive.

## U3 behavior

- On practice/online load, display a simple Click-or-Tab-to-focus prompt.
- On native canvas focus/blur, update to a short, relevant focus state,
  with subtle passive styling below the arena.
- Preserve original text if JavaScript fails; no overlay or interruption.
- If multiplayer initialization fails, `web/bootstrap.mjs` replaces the
  message with the "Return to multiplayer lobby" recovery link. Later
  focus/blur events MUST NOT overwrite that link.
- Only 2 listeners on the canvas (focus/blur); no keyboard, pointer, wheel,
  action, movement, network, wallet or gameplay listeners.
- Keep `web/index.html`, `web/styles.css`, `web/game.mjs`
  and `web/online-game.mjs` untouched to avoid Sound, AI, Physics, Graphics,
  Combat, Magic, Core, and World branch collisions.

## Verification

Four isolated Node tests cover practice, online mode, idempotency,
failure-link preservation, missing elements, and passive CSS. A
single import in protected `tests/browser-runtime.test.mjs` makes
the tests part of existing GitHub quality CI.

Check real Chromium/Firefox: focus by click/Tab, blur by Tab, visible
state copy, same existing combat bindings and failure recovery link.
Do not merge or deploy until exact-head CI and central integration review.
