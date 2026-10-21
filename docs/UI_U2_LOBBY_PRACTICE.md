# UI U2 — Always-available local practice from the multiplayer lobby

Department 10 — UI & Player Experience. Base `main` at
`7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`.

## Problem

The existing alpha lobby puts `LOCAL PRACTICE` in a long, low-page
footer. `JOIN MULTIPLAYER` stays disabled when the browser lacks
WebTransport, HTTPS is absent, or the server configuration cannot be
loaded. New players see a disabled primary button rather than an
obvious alternative to learn the current combat rules.

## Implementation

- A visible native same-origin `TRY LOCAL PRACTICE` link appears
  immediately alongside the Join and Copy Invite controls.
- The link is inserted synchronously before the network capability
  check and remote config fetch. It stays available if either fails.
- Progressive fallback: if JavaScript fails, the original footer
  `LOCAL PRACTICE` link still exists in the static HTML.
- No new request, session admission, permission, input handler,
  combat action or server-side state is introduced.
- Does not modify `web/alpha.html` (SEO #327),
  `web/index.html` (Sound #355), shared arena styles or
  `web/online-game.mjs` (Physics/Graphics/NPCs).

## Acceptance

Unit tests: same-origin destination, correct action order, duplicate
installation protection, missing elements, initialization order and
visible keyboard focus. Registered under the existing R0 validation
lane via `tests/r0-alpha-config.test.mjs`.

Native browser acceptance should test the real static alpha page
without a trusted multiplayer server, verifying disabled Join,
visible/focusable practice link and navigation to `/web/`.
Full protected quality on exact PR head is mandatory before merge.

No merge or deployment by this department. Revert U2 utility/CSS
import to restore original landing navigation.
