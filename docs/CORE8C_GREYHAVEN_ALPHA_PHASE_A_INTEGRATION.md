# Core 8C — Greyhaven Alpha Phase A authoritative integration

**Review-only source candidate.** This document describes the combined World 9, Physics 6 and Core 8C source donor. It does not authorize merge, deployment, production restart, public access or a network-policy change.

## Source provenance

- Canonical Pre-Alpha P0: `88c4733c90199ab3cabf7bc85ebb58d2f8760c58`.
- World 9 Alpha source: `0843946d308bc3f88bb147d910deff450393c475`, reviewed in Draft #1148.
- Physics 6 static collision donor: `54de74246b18de2f81d1602e51054c145a8bf845`, Draft #1147.
- Core 8C spawn-authority correction: `07268ceaa5d55d75b6c721bead08fbd29ce4f668`, Draft #1149.
- Combined candidate is source-only and must be qualified at its own exact SHA after publication.

## One operator gate, one original World

`MYASO_WORLD9_GREYHAVEN_ALPHA=1` is the only server-side selection for this isolated Greyhaven Phase A profile. It is fail-closed unless the server binds to loopback, synthetic flight actors are absent, and `MYASO_MAX_PLAYERS` is within the original four-seat limit. The flag is absent/off by default. Browser URL state is not server authority.

Before accepting any connection, Core 8C applies the same flag to the already-created original Rust `GameState.world` and calls `World::enable_greyhaven_static_collisions()`. Failure to validate the 8192² World or pre-existing actor positions aborts startup. The same flag selects World9's server-owned `free_spawn` path. No second simulation, new transport, client coordinate, client map selector, portal or world transfer is introduced.

The arena path remains unchanged when the flag is absent/off. Existing original actor identity, lease/incarnation fencing, WebTransport, Combat, Chat C1, movement tick, HP/stamina, death and respawn code remain authoritative.

## Spawn and static geometry

World9 owns the four authored spawn anchors:
`(4110,4160)`, `(4206,4160)`, `(4110,4256)`, `(4206,4256)`.

Core 8C's spawn correction preserves each living actor's immutable respawn reservation, rejects a slot occupied by any actor's current server-owned position (Physics6 body diameter 36 units), rejects match-over and incompatible 8192² World dimensions, and leaves actual actor creation to original `World::add_player_at`.

Physics6 supplies the 23 version-pinned static building/wall AABBs:
- layout: `moonvale-greyhaven-v10-solids-v1`;
- SHA-256: `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`;
- manifest parity command: `node scripts/verify-core8c-greyhaven-geometry.mjs`.

The geometry is explicitly a *partial known-static set*, not the entire world obstacle authority. It excludes the river, moving actors and dynamic doors; a negative static-solid query is not proof that an arbitrary coordinate or path is walkable. World9 must approve current rebuilt Red Lion/Blacksmith visual alignment, entrances and map revision before release. No interior or portal is implied.

## Evidence and acceptance boundary

The individual Core8C spawn-fence SHA `07268ce` has genuine GitHub-hosted Chrome + Firefox original-Rust/WebTransport two-seat acceptance (run #41231002675). Both clients observed the same server-issued actors and positions; the exact run uploaded original screenshots and JSON evidence.

The combined candidate also requires its own exact-head CI/native run with Physics6 collision activation enabled. Local isolated integration checks must include:
- `cargo fmt --manifest-path server/Cargo.toml -- --check`;
- locked Rust `cargo test --all-targets`;
- strict all-target Clippy with the experimental HIT delivery feature and `-D warnings`;
- full Node regression suite;
- exact 23-solid manifest/generated-Rust digest parity;
- the explicit-gate movement test proving that an unflagged World remains unguarded while an opted-in Greyhaven World cannot move through the known Blacksmith solid.

Still mandatory before Main0 release: independent two-physical-host original WebTransport qualification (current test server is loopback-only), current-map/Red Lion/Blacksmith owner signoff, three same-session deaths/respawns, fresh Light34 and Heavy46 genuine server HIT/HP, Chat C1 continuity, reconnect/lease fencing, and default Pre-Alpha arena regression.

**Verdict: combined source integration only; overall Greyhaven Alpha Phase A remains HOLD.** No gate waiver or production action.
