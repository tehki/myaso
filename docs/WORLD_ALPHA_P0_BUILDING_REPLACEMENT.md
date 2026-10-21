# World & Gameplay P0 — Named Building Replacement / Depth Contract for First Playable Alpha

**Department 9 — World & Gameplay.** Branch `feat/world-alpha-p0-building-replacement` forked directly from the original authored World [#336](https://github.com/tehki/myaso/pull/336), not the 19-PR optional exploration stack. This is a **small integration interface** responding to [Alpha gate #480](https://github.com/tehki/myaso/issues/480) and Graphics 3B's genuine-source finding in [#479](https://github.com/tehki/myaso/pull/479). No production activation, merge or deployment.

## Contract supplied to Graphics 3B/3C

`createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]})` suppresses **the single original Red Lion placeholder** while compiling World #336's 512-unit terrain tiles. Background, roads, wall, portal indicator and the other 14 named buildings keep their exact original painting. An unmodified call `createAuthoredWorldRenderer()` draws the original placeholder exactly as before. Replacements are **opt-in on construction**, validated by stable authored building ID, unique, and immutable over each renderer's cache lifetime. Invalid, unknown or duplicate replacement IDs fail closed. This avoids both duplicate facade painting and expensive opaque-rectangle erasure of terrain.

`worldBuildingPresentation(MAP_IDS.overworld,"red-lion",actors)` returns an immutable **presentation-only** plan:

| Field | Fixed authored source or rule |
| --- | --- |
| `mapId` / `buildingId` | `moonvale-overworld` / `red-lion` |
| `footprint` | (4240,3880), 250×170; unchanged from `AUTHORED_MAPS` |
| `gameplayEntrance` | (4365,4060), unchanged |
| `interactionPortal` | `red-lion-enter`, (4365,4075), radius 52; unchanged |
| `visualDepthY` | 4075, the previously reviewed Graphics 3B visual threshold, **not a collision rule** |
| `actorsBehind` | Existing actors with y strictly less than 4075 |
| `actorsInFront` | Existing actors at y ≥4075 (ties in front) |

Graphics owns the actual facade/roof/light/actor image assets, proper compositing and performance; World deliberately supplies no mesh, image, roof-fade system or alpha blending. The plan **does not paint actors itself** or assert an authoritative front/back order. Coordinate order is in world units before existing camera projection. `actors` is a caller-owned array; it is not mutated or stored. Data geometry remains from the existing single authored source.

## Integration protocol

1. **World #336 integration review:** confirm current-main compatibility; preserve `WORLD_TILE_SIZE=512`, `WORLD_CACHE_CAP=24`, `buildLimit=3`. The replacement affects only tile-build painting and requires a **new renderer instance** to switch options; do not toggle it on a warmed cache.
2. **Graphics 3B + 3C:** render the approved facade and fixtures using the named plan; supply genuine two-browser screenshots with actor north/south of (4365,4075), compare to #479, and assert the original Red Lion placeholder is no longer present. Retain artist-door (4365,4075) and 3C fixture coordinates independently of the World `gameplayEntrance` (4365,4060).
3. **Core 8C / Core orchestrator:** **do not** infer player zone, collision, enter/exit permission, hitbox or spawn from `visualDepthY`. An authenticated zone/collision protocol is a *separate P0 dependency*, not implemented here. A client's `?world=1` is only opt-in background painting.
4. **Center:** review this narrow PR relative to World foundation #336 and existing Graphics PR #479; only include in First Playable candidate after current-main rebase, full protected green CI, real Chrome/Firefox composite and an approved serial merge. Preserve production rollback.

## Tests and limits

`tests/world-building-presentation.test.mjs` checks original default placeholder remains, opt-in placeholder disappears from cached tiles without hiding the Blacksmith or portal indicator, cache bounds/immutable options, accurate map/building/portal footprint, deterministic front/back actor split, invalid/duplicate input rejection and no multiplayer/server alteration. `.github/workflows/ci.yml` adds a **strict additive** Alpha World gate while preserving all inherited Combat, Rust, networking and browser tests.

```sh
node --check src/world/building-presentation.mjs
node --check src/browser/authored-world-renderer.mjs
node --test tests/world-building-presentation.test.mjs tests/authored-world.test.mjs
```

**Readiness:** interface IMPLEMENTED + focused TESTED. **Not yet INTEGRATION-READY:** full CI and real Graphics composite/Firefox budget plus authoritative online World/Core zone/collision agreement are outstanding. **Not INTEGRATED / not PLAYABLE**. An unmerged World preview with painter replacement is not a shared 2+ player multiplayer game.

**Safety:** no route/portal state, movement, server protocol, auth, physics, combat, coins, Moon Coin, inventory or persistence changes. The World renderer is visual-only; no live world authority is activated.
