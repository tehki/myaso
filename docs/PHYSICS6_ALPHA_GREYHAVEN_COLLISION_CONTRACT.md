# Moon Games — Physics 6 / Greyhaven Alpha Phase A collision contract

**Status:** DRAFT / default-off / review only. Parent is canonical live Pre-Alpha P0 SHA `88c4733c90199ab3cabf7bc85ebb58d2f8760c58`; owner Main0 [#1141](https://github.com/tehki/myaso/issues/1141). No merge, deployment, live enablement or existing arena changes.

## Source geometry provenance and scope

This branch reuses World 9 [#509](https://github.com/tehki/myaso/pull/509) and Core 8C [#516](https://github.com/tehki/myaso/pull/516)/[#519](https://github.com/tehki/myaso/pull/519)'s historical 23 static reviewed AABBs, layout `moonvale-greyhaven-v10-solids-v1`, original SHA-256 `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`. Strict parity: `node scripts/verify-core8c-greyhaven-geometry.mjs` verifies the JSON content against embedded Rust constants.

The 8192×8192 map includes 15 building footprints and eight wall spans. Red Lion footprint: x4240..4490, y3880..4050. Blacksmith: x3710..3892, y3850..4012. Radius-18 server fighters may approach Red Lion's south frontage but may not walk through its solid footprint. The authored west/east city-wall gates are y4112..4248; north/south gaps x4057..4203. These are outdoor clearances, **not** activated portals, doors, interiors or items.

**Approval required:** World 9 must confirm the current revised Red Lion/Blacksmith rendered footprints, world-projection alignment and legal entrance frontage. Core 8C must approve current map/worker epoch and trusted server opt-in. Old static geometry is not automatically the current authoritative revision.

## Authoritative physics boundary

Original Rust `World::enable_greyhaven_static_collisions()` is server-callable and defaults OFF; refused for the original 800×600 arena or occupants whose current or immutable respawn positions overlap a known static solid. Spawns are also checked before minting a new actor incarnation. Client packets and input semantics remain unchanged. Only when enabled, server-computed walking/running, dash/roll, heavy motion, fighter-to-fighter separation and attack knockback are tested against conservative swept circle-vs-expanded AABB, with safe axis or previous position fallback. The existing 36-unit fighter diameter, Combat hit/damage/stamina/cooldowns/recovery, QUIC/Chat and original arena path are untouched.

This is **incomplete static geometry**, not a universal walkability oracle: river, bridge colliders, trees/vegetation, dynamic obstacles and door state are absent; “no overlap” does not confer movement, Combat LOS, item pickup, admission or teleport permission. High-speed wall crossings are rejected rather than teleported across walls; inflated-AABB corner checks are deliberately conservative.

**Grounding limitation:** canonical Rust is top-down x/y without an authoritative z-heightfield or terrain slope. This work does not prove character feet, actor visual occlusion, 3D terrain grounding or animation appearance. World 9/Graphics 3 must validate actual 960×540 Chrome/Firefox screenshots and art anchors separately; do not invent elevation.

## Verification and release gates

- `node scripts/verify-core8c-greyhaven-geometry.mjs`
- `cargo fmt --manifest-path server/Cargo.toml -- --check`
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`
- `cargo test --locked --manifest-path server/Cargo.toml --test alpha_p6_greyhaven_static_collision`
- Full exact-head protected CI plus two genuine independent-actor Chrome/Firefox original Rust WebTransport navigation through approved wall gates and near solid buildings, no trapping/rubber-band, authentic fight movements and original default legacy unchanged.

**Not yet proven by a source-only Rust PR:** genuine two-player browser acceptance, network jitter/recovery, terrain/foot grounding and current revised building footprint approval. These remain HOLD until Main0 and Core 8C/World9 signoffs.
