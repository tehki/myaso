# World & Gameplay D4 — Dormant walking-resolution parity

**Status: Review-only, NOT live multiplayer movement.** D4 stacks onto D3 #371 → D2 #366 → D1 #359 → authored Moonvale #336. No server movement, combat, packet handlers, zone membership, or production flags were changed.

## Why this exists

D3 proved 37 static point-occupancy golden cases in Rust and JavaScript. A player moves between positions, however; checking only the destination can cause clipping through solid world entities or disagreements between Rust and browser movement. D4 adds a **dormant server-owned walking step** and a reproducible test corpus. The server component is not integrated with the real game simulation, and input coordinates remain test-only values.

## Delivered

- `server/src/world_movement.rs`: pure `shadow_resolve_walk(map, origin, displacement, radius)` operating on the D3 Rust `is_walkable` query. The function rejects invalid/blocked starting positions and invalid, nonfinite or over-budget displacement requests. Valid input is resolved using at most 4-unit substeps and axis sliding. It never writes to the actual `World` or player snapshots.
- `scripts/generate-world-movement-fixtures.mjs`: seeded, reproducible **867-case** corpus from D2's existing authored browser collision logic. The committed fixture includes named landmarks, Greyhaven gates/walls, bridge decks, river, Red Lion Inn furniture, map bounds, valid/invalid moves and many near-boundary starts. Generator `--check` rejects stale fixture data without rewriting it.
- `tests/fixtures/world-movement-parity-v1.csv`: shared cross-language expected origin, delta, radius, resolved point or explicit rejection outcome. This is local regression/test evidence, **not a client-trusted movement protocol**.
- `tests/world-movement-parity.test.mjs`: asserts browser inputs and outputs, rejection behavior, generator freshness and disconnected authority status; Rust tests parse the exact same corpus and assert an absolute drift bound **≤0.006 world units**, accepting expected differences between IEEE JS f64 and Rust f32.
- `.github/workflows/ci.yml`: explicitly checks regenerated fixtures, runs the D4 Node tests and Rust world_movement tests alongside all existing Rust and browser/combat gates.

## Safety boundaries

1. D4 is **walking only**. Combat rolls, knockback, jumping, stamina, attack reach, flight, NPC steering, water physics and dynamic objects are **not** authorized by this resolver; they need distinct geometry/collision/risk contracts.
2. The 16-unit maximum displacement and 4-unit step subdivisions mirror the **preview's per-frame delta**, but are not yet authenticated per server tick or tied to movement speed, conditions, prediction, player ID, combat cooldown or anti-cheat checks. An attacker must never be allowed to call this API with a client-provided origin/zone or arbitrary frequency.
3. The geometry is static and has no trees, resource nodes, fallen items, houses, gathering interaction or dynamically opened/closed doors. It is not a spatial index and must not be used for property placement.
4. Invalid positions **fail closed** with `InvalidStart`, invalid deltas with `InvalidDelta`, rather than accepting or teleporting. A blocked valid movement resolves to the closest stepped valid location. It cannot independently prove no tunneling for obstacles thinner than 4 units.
5. The fixture is generated from the **existing preview**. Matching generated examples is a consistency gate, not formal proof of server authority. Before any live usage, Core & Multiplayer must design server-position/zone sourcing, fixed-tick input budgeting and rollback, and add independent randomized/differential boundary testing and real two-client session tests.

## Acceptance

- `node scripts/generate-world-movement-fixtures.mjs --check`
- `node --test tests/world-movement-parity.test.mjs tests/world-preview-collision.test.mjs`
- `cargo test --locked --manifest-path server/Cargo.toml world_movement`
- `cargo fmt --manifest-path server/Cargo.toml -- --check`
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`
- `cargo test --locked --manifest-path server/Cargo.toml`
- Full project Node suite and exact-head GitHub quality run.
- Existing M151/strict PvP evidence must stay unchanged. Do not bypass a red parent branch or merge this PR independently.

## Next

Only after the parent authored-world and D1-D4 stacks are integrated: Core & Multiplayer can propose a separately feature-gated, authoritative walking integration with server-owned zone/position/velocity, per-tick speed budgets, server-side portal bounds, consistent replication, reconnect/replay and two real clients. World & Gameplay retains ownership of authored routes, discoverability and independently reproducible collision fixtures.
