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

## Phase A follow-up: authoritative XY ground footprint and contact-safe corridors

The original World9 map has a single outdoor **2D ground plane**, with authored
roads/cobbles/soil/grass as rendering treatments, not server-signed per-vertex
terrain elevations. Physics 6 therefore enforces **server-authoritative XY
contact and containment** and makes no claim of vertical height/slope grounding.
The 8192×8192 original World footprint includes a radius-18 actor inset; with
Greyhaven opt-in, spawn positions outside that inset, nonfinite coordinates or
invalid facing are rejected **without silent clamping/teleporting**, before a
new actor incarnation is minted. The original arena's historical spawn policy
remains unchanged.

For an opted-in Greyhaven movement/roll/knockback/body-separation displacement,
the original Rust simulation performs a conservative swept static check. A
blocked displacement advances along its source-authoritative axis only to the
last safe contact point (16 bisection iterations); any subsequent axis slide
is separately swept from the actual resolved position. This avoids both
full-tick rollback/sticking and a forged diagonal corner-cut. No client
presentation or physics packet gains authority and no Combat timing changes.

The strict new Rust cases use **the exact authored World9 Alpha outdoor route**:
Staging (4110,4160) → Blacksmith (3820,4088) → Red Lion legal exterior
(4365,4080) → Market west (4230,4380) → Chapel south (4590,3850), using only
actual input-driven `World::step_by` ticks, movement-speed bounds, world-radius
bounds and 23-solid clearance. The decorative Red Lion door at (4365,4060)
remains non-walkable for radius18 and never authorizes a portal.

**Unresolved authority:** The map authoring has no authoritative heightfield,
river-bank collision, bridges-as-terrain support, trees/grass obstacles,
dynamic doors, authenticated zone revision or actor grounding Z coordinate.
These cannot be inferred from a flat renderer or from a clear static query.
World9 must approve their eventual authored surfaces and Graphics must verify
visual foot placement. Core8C must connect this into its controlled Greyhaven
loopback admission and real Chrome/Firefox WebTransport flight before end-to-end
PASS; this source-only PR remains DRAFT/HOLD.
