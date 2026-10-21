# Moon Games — World Department 9 / P0 First Playable Source Consolidation

**Status: isolated DRAFT review candidate, not merged, deployed, authoritative, or multiplayer-playable.** Central Main Development & Deployment Orchestrator alone controls acceptance sequencing and release. Mandatory acceptance: [First Playable #480](https://github.com/tehki/myaso/issues/480), [four-sword armory #488](https://github.com/tehki/myaso/issues/488), [integration #360](https://github.com/tehki/myaso/issues/360).

## Exact dependency and ownership

This branch is a **direct child of [World pinned JSON #509](https://github.com/tehki/myaso/pull/509)** at `2c92191198db9b0e682ad8e682a23fa1b1af3e0c`, which depends on [World 23 solids #502](https://github.com/tehki/myaso/pull/502) and foundation [#336](https://github.com/tehki/myaso/pull/336). It imports precisely the World-owned file changes from these two separate **P0** drafts, without importing optional D1–D19 exploration:
- [Armory sockets #493](https://github.com/tehki/myaso/pull/493), head `07060f981b8a1dac89184b621b6893dd970a08ae`, original immutable `src/world/alpha-armory.mjs` and `tests/world-alpha-armory.test.mjs`.
- [Red Lion presentation #484](https://github.com/tehki/myaso/pull/484), head `17d600d2798afcdebfae26d01229f8444e5c9530`, original `src/world/building-presentation.mjs`, `src/browser/authored-world-renderer.mjs`, `tests/world-building-presentation.test.mjs`.
- The two **original** additive CI steps from #484/#493 are integrated into `.github/workflows/ci.yml` **without changing** any mandatory inherited Combat, Rust, Core, networking, browser, World #502 or #509 checks. Four World P0 gates now run in strict CI.

Each imported source and test is intentionally unchanged relative to its pinned source; no new gameplay coordinate authority or Combat compatibility workaround is introduced.

## Four World integration surfaces

**1 — Greyhaven collision:** Existing World #502 gives 15 buildings and eight genuine gate-open wall segments with 23 stable `min_x/min_y/max_x/max_y` rectangles. #509 exports byte-canonical, hash-pinned `assets/world/greyhaven-alpha-solids-v1.json` with digest `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`. Core 8C [#516](https://github.com/tehki/myaso/pull/516) / [#519](https://github.com/tehki/myaso/pull/519) own trusted Rust ingestion and server authority separately; this branch does not alter their heads.

**2 — Physical rack:** `greyhaven-smith-open-front`, same map `moonvale-overworld`, four distinct sword sockets `greyhaven-rack-1`..4 at x 3740/3780/3820/3860 and y4038; simultaneous 18-radius approaches at matching x,y4088; no indoor zone change. Source-only display **origin (3800,4038)** is the exact arithmetic mean of original four positions. Graphics [#508](https://github.com/tehki/myaso/pull/508), [#512](https://github.com/tehki/myaso/pull/512) already derive it. This origin is not a server-authoritative pickup target. The default authored map does **not** create four server sword IDs, grant inventory, register clicks or display fake swords without trusted on-rack item state.

**3 — Red Lion compositing:** `createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]})` excludes exactly the original placeholder at **tile-build time**; default renderer unchanged. The `worldBuildingPresentation` contract preserves original footprint, entrance/portal and opt-in artist depth Y4075. The World presentation helper is not collision, teleport or spawn authority. Real Graphics 3B/3C meshes/roof and browser FPS remain separate cross-owner checks.

**4 — Protection:** all four named strict gates remain together: Alpha World Red Lion facade replacement; P0 Greyhaven four-sword sockets; P0 Greyhaven 23-solid LOS; P0 pinned Greyhaven static JSON. Do not remove/skip/relax the inherited mandatory M41/M145/M194/M205 Combat or Core/Physics/security checks just to make this stack green.

## Integration / genuine alpha acceptance is still pending

Even if this combined source, JS regression and exact-head protected CI pass, it is **not** a current-`main` integrated server arena. This branch intentionally does not add authenticated map revision, Core `GeometryWindow.complete`, snapshot/worker fencing, replicated live sword items, LMB arbitration, animation, authoritative pickup or live four-player PvP. Those belong to Core 8A/8B/8C, Physics, Items 2B, Graphics, Combat and UI owners.

Central must select sequencing with Core #516/#519 (both descend from #509), reconcile any source/CI overlap, rebase against current `main`, verify Core's four real Chrome/Firefox browser player movement separately from authored-city pickup, and run actual **M1–M5 four-player city→Blacksmith→four distinct server-issued swords→fists/sword PvP→reconnect** with post-merge protected CI and rollback. There is no permission to merge/deploy this branch independently.

**Readiness classification:** IMPLEMENTED source / subject to exact-head TESTED qualification; **NOT INTEGRATION-READY, NOT INTEGRATED, NOT PLAYABLE**.
