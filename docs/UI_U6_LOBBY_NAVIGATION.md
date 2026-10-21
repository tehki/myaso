# UI U6 — Exit / lobby navigation

Department 10 — UI & Player Experience. Stacked on UI U5 #378 at
`a150f8bce826956e2944fbf1090bc4bc479f4fd1`.

## User problem

The arena page has no always-visible path back to the multiplayer
lobby. A player must rely on the browser back button (or wait for
the network-failure recovery path). The practice page lacks an
obvious multiplayer entry point.

## Implementation

- Add a native anchor to the existing text strip BELOW the canvas.
- In online mode: "Leave arena · Multiplayer lobby".
- In local practice: "Multiplayer lobby".
- Fixed first-party href `/web/alpha.html`. No query forwarding,
  admission, wallet, authority, persistence, combat, or external link.
- The link is native mouse/keyboard accessible, has a visible focus
  ring, responsive placement, and uses system colors in high contrast.
- Preserve U3's focus/blur status span by appending a separate anchor.
  If online bootstrap fails, the existing error-recovery link replaces
  the hint children, so no duplicate or stale navigation survives.
- No interaction added to the combat canvas or simulation. No new
  keyboard/pointer handlers. Normal browser navigation allows existing
  unload/connection close flow.

## Validation

Five focused Node tests are registered under
`tests/browser-runtime.test.mjs`, including idempotence and
failure-replacement behavior. Test the native anchor keyboard
navigation from practice and malformed-online paths in Chromium;
verify 390px no-overflow and noninteractive canvas unaffected.

No edits to Sound/Graphics/NPC shared `web/index.html`,
`web/styles.css`, `web/game.mjs`, `web/online-game.mjs` or server.
U1 → U3 → U4 → U5 → U6 stack; U2 independent.

Do not merge, deploy or activate from Department 10; central
Development Center reviews exact-head CI and sequencing.
