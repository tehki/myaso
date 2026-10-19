# World & Buildings B2 — isolated atomic two-world prototype

B1 (#338) passed its full required GitHub quality gate and was merged into
`main` at `c398047fdcddff33de3323fc4eba2dd09ac419d3`. This B2 branch is
rebased directly onto that commit. B2 introduces **a dormant Rust multi-world
simulation container**; the live WebTransport connection handler, production
server, WebSocket fallback, browser client, packet version and all existing
combat timings remain unchanged.

## Current contract

- Two independent `simulation::World` instances: 8192 x 8192 Moonvale and
  780 x 620 shared Red Lion tavern.
- One common authoritative identity registry from B1. Unknown fighter IDs,
  wrong door, wrong source, stale nonce, cooldown, attack/death state and
  out-of-range coordinates fail without moving any state.
- `ZoneWorlds::enter_portal` stages copies of both worlds and the zone
  registry, validates against the existing server-side Fighter, then
  commits all three **at one synchronous boundary**. No client destination
  coordinates are accepted.
- Players in the tavern share one `World`; players outdoors are in a
  different `World`, so combat candidates, roll collisions and local
  snapshots cannot accidentally include entities in another zone.
- Zone-specific `visible_fighters(viewer)` exposes the active world's
  candidates only. This is NOT an interest/bandwidth replacement for the
  current optimized live replication pipeline.
- Transferring fighter spawns with authoritative map coordinates, retains HP,
  guard, stamina and remaining regen/dash cooldowns, but resets
  pending attacks/buffers and zone-local FFA kills. Door entry must not heal
  resources or let the client replay an earlier action.
- Tests cover two players entering the same tavern, third outside invisible,
  impossible/stale requests, cooldown and exit, cross-zone hit exclusion,
  vitals preservation, and duplicate/disconnect rejection.

## Why this is not yet live

1. The **existing** server connection handler still owns one global
   `simulation::World`. This container is unused there by design.
2. There is no reliable versioned door request, server-authenticated
   zone ACK, zone identity in replica snapshots, zone-scoped kill events,
   client-side map loading ACK, or reset of prediction history.
3. Authored collision walls, interior furniture, and safe occupied arrival
   points are not yet enforced by the simulation.
4. Because B2 stages cloned zone worlds on each transfer, measured capacity
   and memory behavior under 512 occupants still need benchmarking. Before
   production it can be optimized to an indexed two-phase transfer.
5. A client currently cannot enter the tavern in multiplayer; only the
   earlier offline visual preview supports local demonstrations.

## Next acceptance: B3

Implement a versioned request/ack channel and 2-user browser flow while
preserving strict M194 checks; reject transferred input until ACK, reset
remote snapshots on zone change, and prove a third client outside receives
no tavern entities or attack effects. Benchmark, add collision maps,
rollback, and only then consider release enablement.

Governance: B1 has passed CI and merged. B2 requires its **own new**
exact-head quality check on the rebased `main` base. The previous B2 CI failed
M194 due to genuine late cross-browser input timing unrelated to this dormant
module; that failure cannot be waived. Merge does not deploy production.
