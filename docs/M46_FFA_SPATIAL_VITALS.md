# M46 - Spatial FFA Fighter Vitals

## Objective

Make health and guard readable per fighter in free-for-all combat instead of relying on the legacy single-opponent HUD.

## Product behavior

- Every living remote fighter renders a compact horizontal HP bar and guard bar directly above the fighter.
- HP and guard are derived only from replicated authoritative fighter state.
- The bars remain screen-horizontal even while the fighter turns.
- HP and guard values are clamped to the normal 0-100 presentation range.
- Dead fighters do not render spatial vitals because M44 owns defeat presentation.
- The local player keeps the existing personal HUD; M46 adds no client-side combat authority.

## Real-browser acceptance

The dedicated `uivitals` Chrome + Firefox production-page flight reuses the proven authoritative M32 hit exchange.

After a real 34 HP hit:
- the attacking browser must render the damaged remote fighter at 66 HP and 100 guard;
- the damaged browser must render the undamaged remote fighter at 100 HP and 100 guard;
- exact-color canvas evidence must match the expected filled bar lengths within a small pixel tolerance;
- the existing authoritative `hit-confirm` / `damage-taken` evidence remains mandatory.

The acceptance harness reads rendered pixels only. It does not inject HP, guard, identity, position, or combat state.

## Scope / risk

Base is frozen M45 exact head `8ea50b206a42df54466a544541d1a0436f0e07e7`.

M46 changes browser presentation, deterministic readability coverage, the real-browser acceptance harness, CI, and this evidence note only. It does not change server simulation, damage, guard, combat timing, geometry, interpolation, wire protocol, networking, persistence, public bind, deployment, or runtime activation.

Rollback is to close/discard M46; frozen M45 remains unchanged.
