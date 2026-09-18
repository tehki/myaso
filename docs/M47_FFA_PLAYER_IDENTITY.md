# M47 - Spatial FFA Player Identity

## Objective

Give every remote fighter a persistent, readable identity in free-for-all combat so players can track the same opponent across movement, damage, death, respawn, and future scoring.

## Product behavior

- Every remote fighter renders a compact identity badge directly above the M46 HP/guard bars.
- The badge uses the fighter's authoritative network identity and displays it as `#<netId>`.
- Identity is resolved from the authoritative entity before interpolation; the identity-free interpolation scratch contract remains unchanged.
- The badge stays screen-horizontal while the fighter turns.
- The local fighter does not receive a spatial remote badge; its own authoritative id already appears in the connection/status presentation.
- The badge persists through defeat so the M44 death tell remains attributable to the same fighter.
- M47 adds no account/name system and no client combat authority. It establishes the stable in-arena identity primitive that later scoring and match rules can reference.

## Deterministic coverage

`fighterIdentityPresentation(netId)` accepts only positive integer authoritative network ids and formats them deterministically as `#<id>`. Invalid, zero, or fractional ids do not render.

## Real-browser acceptance

The dedicated `uiidentity` Chrome + Firefox production-page flight connects two real clients to one loopback authoritative server and waits until both authoritative player ids are known.

Each client then performs a one-time canvas sample for the unique M47 badge background color:

- one remote badge must produce at least 280 exact-color pixels;
- the count must remain at or below 650, which rejects rendering both a remote and local badge in the two-player flight;
- both clients must remain at 100 HP / 100 guard and observe the opponent at 100 HP / 100 guard;
- no fighter identity, position, HP, guard, or combat state is injected by the harness.

The text itself uses the deterministic presentation helper; the pixel gate verifies that exactly one remote identity badge is actually rendered in the production canvas on both browsers without depending on cross-platform font rasterization.

## Scope / risk

Base is frozen M46 exact head `51693f2ca8419ad16e9884adfd9b7097e2a16176`.

M47 changes browser presentation, deterministic readability coverage, the real-browser acceptance harness, CI, and this evidence note only. It does not change server simulation, fighter ids, combat timing, damage, guard, dodge/parry behavior, interpolation state shape, wire protocol, networking, persistence, public bind, deployment, or runtime activation.

Rollback is to close/discard M47; frozen M46 remains unchanged.
