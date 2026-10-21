# Core 8C P0 — Server-owned Greyhaven Static Swept Collision (inactive)

**Status:** IMPLEMENTED as opt-in deterministic Rust simulation prototype,
**not activated** in the live /game process, not a complete authoritative
walkability oracle or playable Greyhaven. Integration and release controlled by
Moon Games [#360](https://github.com/tehki/myaso/issues/360) and
[#480](https://github.com/tehki/myaso/issues/480).

## Parent and authority boundary

Stacked on [Core #516](https://github.com/tehki/myaso/pull/516),
which is stacked on World #509 → #502 → #336. Reuses the exact
server-embedded 23 building/wall AABBs and pinned World source digest
`9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`.
No second item, character, combat or world-authoring registry.

- `World::enable_greyhaven_static_collisions()` is **OFF by default**, callable
  only from trusted Rust server code. It rejects non-8192² worlds and existing
  fighters/respawn anchors overlapping known solids. Add-player also rejects
  illegal spawn positions after activation. This is not itself a live admission
  authorization or worker/zone epoch capability.
- Every tick in this opt-in simulation validates **actual server-calculated**
  walking/running/dash/roll/attack lunge motion against swept fighter-radius
  18 circles. Post-hit knockback, roll collisions and player separation use
  the same kernel, preventing discrete transport across thin static walls.
  Conservative obstacle response returns to the preceding valid position or
  chooses one valid axis (not corner-cutting). Attack stamina/controls, timings,
  input packets and death/respawn internals are unchanged.
- Sweeps use **closed** segment/expanded-AABB intersection: touching a solid,
  fast crossing in <=100ms tick, or starting inside a solid fails closed.
  Inflated corners may reject otherwise valid motion. The algorithm is
  deliberately deterministic and allocates no per-tick heap objects.
- The player collision flag does **not** authorize a sword pickup, authenticate
  the actor, establish a current worker epoch/map revision, or settle item
  ownership. Combat **attack LOS through geometry remains a separate review**;
  this prototype does not intercept hit resolution or create new damage gates.

## Mandatory limits and unwaived blockers

World #509 covers exactly 23 reviewed **static** solids. It omits the river,
bridges, dynamic doors/obstacles, moving actors beyond current fighter-to-fighter
separation, and all future map changes. Therefore **even enabled static collision
is NOT complete city walkability/geometry authority**. Do not expose this flag
to clients or activate it on a public server. The safe private staging
activation must come in a separate, reviewed Core integration with
[#486](https://github.com/tehki/myaso/pull/486) (server-owned four-slot spawn),
[#494](https://github.com/tehki/myaso/pull/494) (same-tick Physics range/LOS),
and World/Physics validated complete relevant collision geometry. In particular,
never equate the static layout content SHA with a live zone/epoch/revision fence,
nor allow client-provided rectangles, positions, teleport destinations or
collision bypass flags. Core 8B owns actual item transaction/anti-duplication.

## Acceptance evidence

Run on exact head:
```sh
node scripts/verify-core8c-greyhaven-geometry.mjs
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/Cargo.toml
```

New deterministic Rust tests cover:
- opt-in rejection for invalid world/occupied present and respawn anchors;
- invalid spawn rejection and legacy default gameplay compatibility;
- real simulation movement into smith walls denied, ordinary original path unchanged;
- server dash > wall width prevented from tunneling; west gate remains open;
- forced Combat knockback fails to push target through smith;
- respawn uses preapproved immutable anchor;
- swept circle rejects tangent/endpoints/nonfinite inputs and retains real gate.

Full protected `quality` Chrome/Firefox, real 4-player QUIC, independently
operated browsers/hosts and complete city→sword→PvP acceptance are **separate**,
non-waivable release gates. No merge into `main`, no server deploy, no live DB.
