# World P0 Alpha — Pinned Greyhaven Static Solids Artifact

**Department 9 World & Gameplay → Core 8C / Physics 6.** Draft dependency on [World #502](https://github.com/tehki/myaso/pull/502), deliberately outside the optional D1–D19 exploration stack. No live server functionality is activated.

## Purpose and source of truth

[World #502](https://github.com/tehki/myaso/pull/502) provides **23 deterministic World AABBs**, derived from immutable World #336 authored geometry (15 building footprints and eight city-wall spans with real gate openings). The new checked-in data file:

`assets/world/greyhaven-alpha-solids-v1.json`

is a **byte-exact, cross-language build input** for Core 8C to review and embed in a future authoritative Greyhaven-only server map. It uses simple JSON numerical `min_x,min_y,max_x,max_y` rectangles so a Rust Core/Physics consumer need not import any browser JavaScript. It does **not** create a second independent editable geometry source: `scripts/verify-world-alpha-solid-artifact.mjs` exports the canonical JSON only from the already reviewed `WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS` module, and required CI checks that the committed JSON still matches.

### Pinned invariant fields

```text
schema_version = 1
layout_id = moonvale-greyhaven-v10-solids-v1
map_id = moonvale-overworld
city_id = greyhaven
geometry_kind = fixed-buildings-and-city-walls
solids_count = 23
solids_sha256 = 9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43
requires_core_fence = true
includes_river_or_dynamic_solids = false
```

The hash is SHA-256 of the original compact `JSON.stringify(solids)` in reviewed ID order. This is an **authoring-content identifier**, not an authenticated server epoch, signed release, location witness or current map revision. The JSON intentionally has **no `complete:true`, `zone_id`, `worker_epoch`, `map_revision`, actor/item owner, sword ID or pickup authorization**.

The script rejects altered values, deleted or swapped solids, changed metadata, whitespace or new unreviewed fields. Since Windows Git may check out text as CRLF, the verifier allows only CRLF→LF normalization while requiring the canonical serialized bytes to match otherwise. No auto-overwrite occurs during CI. Explicit `--print` is a *developer output* for reviewed map changes, never live state.

## Usage

```sh
node scripts/verify-world-alpha-solid-artifact.mjs
node --test tests/world-alpha-pinned-solid-artifact.test.mjs
# For manually reviewing a new version ONLY:
node scripts/verify-world-alpha-solid-artifact.mjs --print
```

The new additive protected CI step performs syntax, actual checked-in artifact verification, and adversarial tests after the previous World P0 gate. All inherited Combat, Rust, multiplayer and browser CI gates remain unchanged.

## Core/Physics safe adoption contract

1. **Core 8C owns the trusted loader and independent parse/shape validation**. It must **pin the exact approved artifact in a server build**, verify expected `layout_id`, 23 shapes, coordinates and digest at build or trusted startup, and refuse unreviewed map drift. Rust `myaso-server` currently has no JSON parsing dependency; Core decides whether to add one or generate a build-time constant in a reviewed separate PR. This World PR adds **no Rust code, Cargo dependency or runtime loader**.
2. Only Core can bind the imported static rectangles to an **authenticated current zone, worker epoch and map revision**, with a trusted complete obstacle window. This file covers known Greyhaven fixed buildings/city walls, **not river, dynamic doors, other players or changing solids**. Do not mark a whole map `GeometryWindow.complete=true` solely because these 23 entries were parsed.
3. Physics [#494](https://github.com/tehki/myaso/pull/494) verifies pickup range and closed-segment LOS using the **complete current server-owned** geometry, not client-sent rectangles. Core must recheck current fencing at the atomic Items pickup boundary.
4. Items/Core 8B still own distinct canonical physical sword IDs and conservation, while Graphics/UI/Combat own real rendered sword hitmasks, precise click arbitration and armed/unarmed combat. No one may promote successful geometry unit tests into claims of four connected browser players or successful pickup.

The [mandatory armory issue #488](https://github.com/tehki/myaso/issues/488) and [First Playable gate #480](https://github.com/tehki/myaso/issues/480) remain authoritative for integrated acceptance. Source #502 has **complete green protected quality**, but the World foundation and other armory dependencies remain unmerged and require central rebase/merge/rollback management.

**Classification:** IMPLEMENTED and isolated TESTED; **not INTEGRATION-READY as a server world, not INTEGRATED, not PLAYABLE**. No production config, multiplayer process, network, inventory, Combat, Moon Coin or live pickup altered.
