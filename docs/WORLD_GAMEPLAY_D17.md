# World & Gameplay D17 — Static Full-World Connectivity Audit

**Status:** isolated draft World & Gameplay authoring milestone, stacked on D16 #450 and the earlier unmerged Moonvale world-preview work. Does **not** implement live navigation, NPC planning, portal authority, combat, physics, persistent quests, items or currency.

## Why this gate exists

D16 validates that each authored site is walkable at its own coordinate, and D9 validates only the seven already certified **expedition-to-expedition** corridors. Neither property, alone, proves that a player starting in Greyhaven can actually *reach every other authored site*. A designer might unknowingly block a bridge, remove a road gap, enclose a stone or lore inscription behind a wall, or strand a resource in a separately walkable but disconnected region.

D17 makes that additional guarantee a strict **offline build-time test** against the current authored static preview collision geometry.

## Scope of the audited world

- **Origin:** the actual existing offline preview player start (4365,4150), just south of the Red Lion.
- **Targets:** all **18 immutable existing authored interactable points**, across D1's 4 landmarks, D6's 8 natural field sites and D13's 6 roadside lore inscriptions.
- **Geography:** one fixed Moonvale overworld, 8192×8192 world units. No tavern interior, zone transfer or dynamic/player-built structures.
- **Collision:** D2's `isAuthoredPreviewWalkable` for the default **18-unit avatar radius**, checking Greyhaven city walls and gates, authored buildings, the river and bridge lanes. Trees and crop decorations remain non-colliding in that preview.
- **Connectivity model:** an orthogonal graph on a **32-world-unit grid** (257×257 possible vertices, excluding unwalkable/out-of-bounds vertices), with each accepted edge sampled at **≤4 world units** along the segment. The origin and each target are connected to one or more nearby grid vertices **only via their own collision-sampled straight segment** (bounded 5×5 nearest-grid candidate window). A deterministic queue flood-fills exactly once from the valid origin candidates. Repeated runs produce stable sorted results.

The grid and 4-unit samples are a **conservative reachability approximation**: a narrow but technically traversable path can be missed by the 32-unit grid; a 4-unit sampled edge is not a mathematical continuous-collision proof. The test establishes *a particular sampled-clear path exists* for each site under fixed authored preview obstacles, not safety under other avatars, dynamic physics, combat knockback, doors, players, future structures or authoritative multiplayer ticks. It does not give players a path to follow.

## Files and validation

- `scripts/audit-world-connectivity.mjs` exports `auditAuthoredConnectivity(options?)` and runs as a strict command-line audit. The immutable result includes the expected target count, sorted connected/unreachable IDs, occupied graph size, grid resolution and number of flood-visited cells. Invalid map sizes/steps, blocked origins and unbounded target lists reject. The canonical command prints a one-line PASS or sorted `UNREACHABLE_SITE` failures and exits nonzero.
- `tests/world-connectivity-audit.test.mjs` includes **7** adversarial tests: canonical 18-site reachability, open-vs-closed simulated bridge/gate connection, a thin blocked line *between* walkable grid vertices, individually walkable but isolated target rejection, invalid/overlarge model guards, deterministic sorted IDs/input ordering, and cross-platform read-only CLI plus no server/online-preview wiring.
- `.github/workflows/ci.yml` gains an **additive strict D17 quality step**, running source syntax, the executable checker and its tests. D16's site integrity gate and *all* inherited Combat, Core & Multiplayer, Rust and browser acceptance are preserved.

From the repository root:

```sh
node scripts/audit-world-connectivity.mjs
node --test tests/world-connectivity-audit.test.mjs
```

Canonical observed output on the authorized Windows test machine:

```text
World connectivity audit PASS: 18 authored sites connected to Greyhaven, 62648/66049 swept-sampled cells.
```

## Ownership, security and integration

This is **authoring and acceptance tooling only**; no loaded game runtime, navigation UI or network request uses the flood fill. Every edge is checked *during CI or a manual audit*, never on a game frame. It does not create or modify destination inventories, trading property, NPC behavior, map authority, cryptographic settlement, tokens, Moon Coin, quests or player progression. Runtime world and physics authority must be implemented and verified independently by Core & Multiplayer/Physics.

The parent chain remains a collection of separate open World PRs, starting at authored foundation #336. Strict upstream Combat CI histories include M151, M144, M171, M194, M205 and M158. Parent D16 #450 exact-head quality was still running when D17 development began. **Do not merge/deploy any of these PRs independently or bypass strict gates.** The central Development Center owns rebase, conflict resolution, ordered exact-head requalification and production rollout.
