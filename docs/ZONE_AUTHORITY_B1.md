# World & Buildings — Phase B1: server-owned zone authority

This PR introduces a **dormant Rust server zone module**, not an active
interior transfer. The existing WebTransport loop, v1 protocol, snapshot
replication, combat engine, FFA ranking, player movement and production
deployment remain unchanged until the complete multi-zone contract is safe.

## What the server will own

- Canonical stable map IDs `moonvale-overworld`, `red-lion-inn`.
- Canonical portal IDs `red-lion-enter` and `red-lion-exit`.
- Exact designer-authored coordinates from World & Buildings Phase A PR #336:
  exterior portal (4365, 4075), indoor portal (390, 550), interior
  spawn (390, 480), outdoor return (4365, 4143).
- Explicit bounds: overworld 8192 × 8192; tavern 780 × 620.
- Same shared public tavern zone for every authorized player, not private
  client-owned copies.
- A registry keyed by a server-authenticated fighter identity. The
  client cannot choose destination map, arrival coordinates or source zone.
- Door proximity and safe spawn validation, action-state restriction,
  120-tick cooldown, monotonically increasing wrapping nonce and 512-occupant
  zone cap. A failed request must leave membership unchanged.
- Zone-aware pair eligibility and peer enumeration for later replication
  and combat isolation; unknown members always fail closed.

## Unimplemented release blockers — Phase B2 and B3

- **Atomic migration** of fighter state between two actual World simulations,
  including cooldown, cross-zone collision rejection, death/respawn and
  match scoreboard ownership. Registry authorization alone must *never*
  trigger a real transition.
- Versioned, reliable door-request wire and server-ack format with unforgeable
  authenticated connection binding, exact map manifest hash and transfer epoch.
- Transition isolation: changes to snapshot interest, reliable deltas, kill
  feed, attack candidates, damage, knockback, AI, input-history and offscreen
  markers. Two players inside share one entity set; third outside sees none.
- Camera/prediction/interpolation reset only after authentic ACK. Client
  map loading is visual; browser-side `previewPortalDestination` remains
  restricted to the offline preview.
- Real building/room collision geometry and safe spawn occupancy, including
  door threshold interactions and transport packet loss.
- End-to-end two-browser entry, exit, simultaneous attacks, reconnect,
  repeated door spam and M194 regression checks.
- Controlled release with server protocol gating, rollback and full load tests.

## Merge guidance

Phase A PR #336 is the authoritative map authoring proposal; its geography
must be synchronized before activation. This B1 module is intentionally
independent of the Phase A branch and adds no behavior to live server.

Future implementation **must not** call `ZoneAuthority::authorize` without
coordinating an atomic server simulation transfer. The current method
immediately changes in-memory registry membership; only use after atomic
migration has been designed and tested, or refactor to prepare+commit.

Run module tests via `cargo test --manifest-path server/Cargo.toml zone::`.
Required GitHub quality must pass on exact head before merge. Merge does
not authorize production deployment.
