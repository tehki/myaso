# Core 8C P0 — pinned server-side Greyhaven static geometry input

**Status: DRAFT / inactive / not ready for live collision.** Child of World #509
(pinned solids), which is stacked on World #502 and World #336. Independent of
8C #486 opt-in spawn and dormant C4a–C4h SQL authority. Center #360 owns merge,
staging and production; first playable acceptance is #480 and armory #488.

## Exact contract
- `server/src/alpha_greyhaven_solids_generated.rs` contains the **23** reviewed
  fixed Greyhaven AABBs, generated from
  `assets/world/greyhaven-alpha-solids-v1.json`.
- `scripts/verify-core8c-greyhaven-geometry.mjs` checks exact World asset
  schema, IDs, geometry, immutable content SHA-256
  `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`,
  and **byte-for-byte parity** with the Rust-generated table. Altered authored
  source cannot silently change the embedded Rust data.
- `server/src/alpha_greyhaven_geometry.rs` provides a bounded **read-only**
  overlap query for these fixed AABBs and Rust regression fixtures for 4 Core
  #486 spawns, 4 #493 Blacksmith stands, solid smith footprint, and real west
  wall gate. This module has **no live /game integration** or new Cargo deps.
- A `false` overlap result means *no overlap with 23 reviewed static solids*,
  and **never** authorizes movement, a sword pickup, a world transfer or
  an equipment ACK on its own.

## Security and completeness boundary
World #509 explicitly omits the river, dynamic solids, other players and
revision/epoch authority. The layout ID / content digest is not a current
`GeometryFence`. Core 8C must bind a complete **current** relevant collision
window to a trusted server-owned zone, worker epoch and map revision. Physics
#494 must check current actor/item positions, range and LOS, and 8B/Items
must revalidate the same fence under the exclusive committed pickup operation.
Do not trust a user-provided window, positions, world authoring or revision.
No second character registry, item ledger or client-driven zone admission.

## Evidence and next integration step
Run `node scripts/verify-core8c-greyhaven-geometry.mjs`, then
`cargo fmt --manifest-path server/Cargo.toml -- --check`,
`cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`,
and `cargo test --locked --manifest-path server/Cargo.toml --lib alpha_greyhaven_geometry`.
Protected full quality, native Chrome/Firefox, real four-player movement,
collision/LOS, death/reconnect, and independent physical hosts are separate
unwaived release gates. A green static fixture does **not** prove playable city.

**Next:** reviewed World/Physics integration must supply a complete, revisioned,
same-tick collision kernel to `World` in the private Greyhaven staging mode,
then authoritative sword pickup and observer replication. Release remains HOLD.
