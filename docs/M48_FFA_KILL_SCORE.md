# M48 - Authoritative FFA Kill Score

## Objective

Turn the readable FFA combat loop into the first persistent match-state loop by giving every fighter an authoritative kill score and rendering a shared scoreboard.

## Product behavior

- The server owns kill attribution. A fighter receives one kill only when its committed attack drives another fighter to authoritative death.
- Kill score persists through the victim's respawn; respawn restores combat state, not match score.
- Every browser renders a compact FFA scoreboard keyed by the stable M47 `#<netId>` identity.
- Rows sort by kills descending, then network id ascending for deterministic ties.
- The local fighter is highlighted without changing score authority.
- No client action can directly write a score.

## Replication

M48 reuses the existing replicated action-metadata byte (`flags` in the current wire structs) as a bounded kill-score byte. That slot was already carried by full snapshots and action deltas but had no gameplay meaning before M48.

The authoritative simulation keeps `kills` as `u16`; replication saturates at `255`. This adds zero bytes to snapshot records and requires no encoding-version migration.

## Deterministic coverage

- Server combat coverage proves lethal attacks increment only the killer and that the score survives respawn.
- Server snapshot coverage proves that authoritative kills enter the replicated metadata byte.
- Browser presentation coverage proves deterministic FFA ordering, local identity marking, and the 255 wire bound.

## Real-browser acceptance

The dedicated `uiscore` Chrome + Firefox production-page flight reuses the real M31 death/respawn path. The lower authoritative network id attacks through genuine WebDriver pointer input until the opponent dies and respawns.

After respawn, both browsers must independently render exactly two scoreboard rows:

1. the authoritative attacker at `1` kill;
2. the authoritative defender at `0` kills.

Each browser must also mark exactly its own `#<netId>` row as local. No score, identity, HP, guard, death, or respawn state is injected by the harness.

## Scope / risk

Base is M47 exact head `eea6029a478c302cf8990ac54fa1d8e97e6ae2b8`.

M48 changes authoritative fighter score state, maps that score into an already-existing replicated byte, adds deterministic scoreboard presentation, adds one real-browser acceptance scenario, and documents the contract. It does not change combat damage, timing, movement, hit authority, packet length, protocol version, public bind, persistence, deployment, or runtime activation.

Rollback is to close/discard M48; M47 remains the product base.
