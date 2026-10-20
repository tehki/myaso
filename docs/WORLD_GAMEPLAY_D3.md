# myaso.io World & Gameplay D3 — Authored Geometry Shadow Contract

**Status:** dormant cross-language contract; not a live multiplayer feature. Stacked on preview-only D2 PR #366 → D1 PR #359 → World & Buildings PR #336.

## What D3 adds

- `scripts/generate-world-geometry.mjs` builds a canonical Rust constant snapshot (`server/src/world_geometry_data.rs`) from the already-authored Moonvale / Red Lion map data. It fails when the renderer/preview's known Greyhaven gate and wall dimensions diverge, and `--check` fails for stale generated data.
- `server/src/world_geometry.rs` is a **read-only, stateless shadow query**, compiling into the Rust crate for tests only. It implements the same bounded exterior building, Greyhaven wall/gate, river/bridge and inn-furniture occupancy contract as D2. It is intentionally not connected to `simulation::World::step`, `server/src/main.rs`, packet handlers, authoritative movement, snapshots, hitboxes, combat, or zone teleportation.
- `tests/fixtures/world-geometry-parity-v1.csv` is a stable cross-language fixture set shared by Node and Rust. Both independently assert the same expected results, including clear routes, blocked structures, bridges, tavern furniture and invalid numeric input.
- `tests/world-geometry-parity.test.mjs` enforces the D2-side fixture, regenerability and absence of production wiring.
- GitHub `quality` now explicitly runs World & Gameplay Node checks (authored geometry, discovery, preview collision and parity); Rust unit parity checks are picked up by the existing `cargo test --locked` quality step.

## Scope of authority

`GeometryMap` is a Rust shadow identifier independent of the dormant B1 `ZoneId`. There is **no client-supplied map, geometry version, coordinate, or collision decision introduced into the network protocol**. This new module does not make a player location, combat or teleport more trustworthy in production. The preview's local collision remains purely cosmetic until Core & Multiplayer explicitly activates a shared server-authenticated world/movement implementation.

The Rust geometry constants are generated from map content; the gate/wall assumptions remain constrained by exact checked renderer and D2 marker strings to prevent silent drift. Moving these constants into a first-class shared manifest will require coordination with Graphics/World & Buildings. No runtime parsing or heap allocation is required for the Rust shadow query. Version `GEOMETRY_MANIFEST_VERSION = 1` is internal to D3 and must not be confused with the zone transfer protocol version.

## Acceptance gates

1. Generation on clean checkout: `node scripts/generate-world-geometry.mjs --check`.
2. Node parity, fixture coverage and dormant-only tests: `node --test tests/world-geometry-parity.test.mjs`.
3. Existing authored routes and safe bridge crossing: `node --test tests/world-preview-collision.test.mjs tests/authored-world.test.mjs`.
4. Rust shadow golden fixtures: `cargo test --locked --manifest-path server/Cargo.toml world_geometry`.
5. Strict `cargo fmt --manifest-path server/Cargo.toml -- --check`, `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`, and `cargo test --locked --manifest-path server/Cargo.toml`.
6. Exact-head GitHub required quality run, plus a documented real-browser preview and an isolated Rust occupancy microbenchmark. Production movement activation requires separate server-movement property tests, authority and zone scoping, rejected client-forged moves, two real clients, reconnect/rollback, and verified large-realm budgets.
7. Cross-language numerical boundary fuzzing must be completed before production activation. Golden fixtures are a first gate, not proof of IEEE float-perfect parity at every wall edge.

## Risks / non-goals

- Preview displacement is locally simulated and untrusted. The Rust shadow query is read-only and unused by the server gameplay loop; a genuinely shared authoritative world cannot be claimed.
- Authored geometry includes 15 exterior buildings, 8 inn solids, 8 wall spans, 9 river points and 2 bridge lanes. It contains no collision for trees, dynamic items, temporary buildings, NPCs or future player houses.
- The fixed linear checks are bounded but have not been capacity qualified under 512 real players. Scaling to many mutable structures requires a spatial index, revisioned maps and safe state migrations.
- Do not merge this D3 branch independently of its parents or deploy while CI/persistence/combat integration is unverified.

## Next step

After the central integration chain is green, negotiate the exact server movement/world authority API with Core & Multiplayer and the authored collision/portal manifest with Graphics, then implement authenticated server-side use under an explicit feature gate with repeatable multi-client acceptance.
