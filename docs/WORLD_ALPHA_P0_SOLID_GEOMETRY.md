# Moon Games — World & Gameplay P0: Greyhaven Static Solid Geometry Contract

**First Playable Alpha / Department 9.** Draft review branch `feat/world-alpha-p0-solid-geometry-contract`, based directly on World foundation #336. This is a **third independent, tightly scoped P0 handoff** alongside the Red Lion facade #484 and Blacksmith rack sockets #493. No optional D1–D19 exploration stack, production server change, UI integration, activation or deployment.

## Problem and ownership

Mandatory [four-player physical armory #488](https://github.com/tehki/myaso/issues/488) needs server-authoritative **pickup range and line-of-sight** with authentic world solids. Physics 6 [draft #494](https://github.com/tehki/myaso/pull/494) provides `verify_pickup_geometry`, which intentionally rejects incomplete geometry windows, stale Core-authenticated zone/epoch/revision or occluded paths. World Department 9 must supply the fixed authored building/wall shapes, while **Core 8C** owns the current map revision/epoch, complete same-tick obstacle window and dynamic geometry; **Physics 6** owns the authoritative LOS kernel; **Items 2B + Core 8B** owns sword identity and atomic receipt.

The World client renderer alone is **not** a trusted collision provider. This module produces immutable *authoring fixtures only* and explicitly does **not** emit `complete:true`, `map_revision`, `worker_epoch` or player authority.

## World-owned geometry payload

`src/world/alpha-solid-geometry.mjs` exports:
- `WORLD_ALPHA_SOLIDS_SCHEMA_VERSION = 1`;
- `WORLD_ALPHA_SOLIDS_LAYOUT_ID = "moonvale-greyhaven-v10-solids-v1"`;
- `WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE` requiring Core's fence and explicitly **excluding river and dynamic solids**;
- immutable `WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS` with **23 AABBs**, keyed by canonical `building:<id>` or `wall:<segment>`. Every rectangle has `min_x,min_y,max_x,max_y` directly matching Physics [#494](https://github.com/tehki/myaso/pull/494)'s `SolidRect` coordinate shape, plus an authored stable ID and kind;
- `deriveAlphaGreyhavenStaticSolids(map)` to reconstruct from **World #336's single authored building/city map** and fail closed on invalid/incomplete building IDs or geometry;
- `worldAlphaGreyhavenSolidById(id)` for exact immutable fixture lookup.

**15/15 existing building solids** use exact authored obstacle footprints. **Eight city-wall spans** use the D2 preview's actual 37-unit stroke width (half-width 18.5) and two honest gate gaps, centered at x=4130 (half-width 73) and y=4180 (half-height 68). There is **no fake opaque city-wall rectangle** over the real gates and no invented Blacksmith interior doorway: `smith` has one fully collidable footprint. The required alpha sword rack [#493](https://github.com/tehki/myaso/pull/493) is therefore **open-front on the south side** of the building, in the same world zone.

### Concrete armory handshake

The Blacksmith building's solid AABB is `(3710,3850)..(3892,4012)`. Four independently clickable sword socket anchors are **(3740,4038), (3780,4038), (3820,4038), (3860,4038)**; actor approach positions use the same X and y=4088. Each player-to-corresponding-sword segment is 50 units long, entirely outside building/walls and clear under a closed-segment LOS test. The Physics #494 maximum reach is 96; **Core/Physics must select and enforce an actual server configured reach**, not assume this static check alone authorizes pickup. A hypothetical pick through Blacksmith's interior is blocked. All four proposed Core 8C #486 Greyhaven staging spawns are unblocked under this static geometry.

### CI / parity tests

`tests/world-alpha-solid-geometry.test.mjs` (7 focused tests) verifies all building/world footprints, exact city wall endpoints/gaps, canonical immutable 23-solid roster and complete geometry content digest:

```text
SHA256(JSON.stringify(solids)):
9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43
```

The digest is an **authoring change-detection guard**, not a trusted signature, chain state or Core-authenticated current `map_revision`. Any authored change must deliberately update the contract, digest, Core server geometry, Physics coverage and reviewed version together. Tests exercise four clear sword LOS paths, through-Blacksmith rejection, city gates open, straight 4-unit swept-sampled four-spawn approaches, malformed input fail-closed, and zero online/server activation. CI adds a **strict additive P0 World gate** after existing World checks and leaves all inherited Combat/Rust/Core/browser gates untouched.

Independent manual cross-branch parity acceptance on the authorized Windows machine compared the **real D2 `isAuthoredPreviewWalkable(mapId,x,y,18)` implementation** from D17 #456 source against the new 23-solid AABB+circle predicate at **36,660 deterministic sample points** across Greyhaven, 7-unit spacing. **36,660/36,660 agree, 0 mismatches.** This is D2 **static preview parity**, not a dynamic, server-authoritative physics or movement proof.

Run from repo root:

```sh
node --check src/world/alpha-solid-geometry.mjs
node --test tests/world-alpha-solid-geometry.test.mjs tests/authored-world.test.mjs
```

## Central integration gate (DO NOT SHORT-CIRCUIT)

1. **Core 8C** explicitly adopt/translate the reviewed static manifest into an independently trusted server geometry source and assign authenticated zone/epoch/`map_revision`; recheck that geometry inside every authoritative pickup. The manifest's own revision string cannot itself prove current server state.
2. **Physics 6** supply LOS/range on that Core-owned complete same-tick window. This 23-solid roster does **not** include the river, moving doors, other player bodies, dynamic building construction or server-map transition; Core must either constrain P0 pickup strictly to the reviewed Greyhaven city or provide all extra current obstacles. Never label an incomplete window `complete=true`.
3. **Graphics/UI/Combat** must render four distinct swords and prove true final-frame pixel click → one pending pickup and zero attacks, including Chrome/Firefox camera zoom and cancel/chord.
4. **Items 2B + Core 8B** own single-winner sword ID/receipt/reconnect conservation; the World module does not issue an ID, ownership or equip status.
5. **Central Main Orchestrator** owns parent foundation #336 current-`main` rebase, full protected CI, real independent four-client same-city pickup+fists/sword PvP and staging release/rollback. No merge/deploy until qualified.

**Readiness: IMPLEMENTED and locally TESTED. Not INTEGRATION-READY, INTEGRATED or PLAYABLE.** Preserve strict CI, including the inherited non-World failures (armory #493 quality M194; Red Lion #484 M41).
