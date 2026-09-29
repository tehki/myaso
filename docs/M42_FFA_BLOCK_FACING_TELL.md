# M42 — Spatial FFA Directional Block Facing

## Objective

Make a remote fighter's authoritative block direction unmistakably readable in the normal online arena without exposing hidden timing or adding client combat authority.

## Product presentation

- Replicated `Block + facing` is the only source of the M42 tell.
- A remote blocking fighter keeps the existing gold block arc and gains a green dashed outer protection arc.
- The outer arc uses the same authoritative `COMBAT.block.halfAngleRadians` as the existing presentation.
- The local fighter never paints the remote-only green arc around itself.
- Releasing block removes the outer arc when replicated state leaves `Block`.

M42 does **not** expose the 115 ms parry window. Action elapsed time is not part of the replicated snapshot, so inventing a client timer would violate the authority boundary.

## Real-browser acceptance

The dedicated `uiblockfacingtell` flight launches real Chrome + Firefox against one authoritative loopback server.

- Firefox aims toward the other live fighter with a real W3C pointer move.
- Firefox holds a genuine right-click block.
- Chrome must render the unique remote green protection arc.
- Firefox must render zero pixels of the remote-only green tell around its local fighter.
- The flight verifies the right-click pointer-down/up coordinates are aimed toward the observer.
- After block release, Chrome must observe the green tell clear.

No combat state is injected by the acceptance harness.