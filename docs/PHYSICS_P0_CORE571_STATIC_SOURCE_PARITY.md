# Physics 6 × Core/World — exact-source Greyhaven P0 static ray audit

**Status:** test-only DRAFT; **not production pickup authorization**. No independent release, merge, runtime /game wiring, client flag, second item ledger or new world geometry authority.

## Exact source ancestry

- Main Orchestrator Core8A/8C plus consolidated World: [#571](https://github.com/tehki/myaso/pull/571), 9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59.
- Physics read-only same-tick LOS / Items-equivalent f32 reach: [#544](https://github.com/tehki/myaso/pull/544), 05af9d6a56163300e2e31fd0756a9cad772c5dc6, containing parent #494.
- An actual **two-parent source merge** joins these histories; the only conflict in server/src/lib.rs was resolved preserving both distinct public module declarations and the original simulation/protocol body.
- Review this child relative to **Main Orchestrator #571 branch**, not direct main. Only Main Orchestrator merges or releases.

## New actual cross-source regression

server/tests/alpha_physics_world571_static_parity.rs reads Core's **actual generated STATIC_SOLIDS** from alpha_greyhaven_geometry and creates *test-memory-only* Physics SolidRect entries passed to the existing verify_pickup_geometry_at_completed_tick kernel. It does not define a second production solids table, authorize a real TryPickup, or use rendered geometry.

- Pins STATIC_LAYOUT_ID moonvale-greyhaven-v10-solids-v1, the authored 23 solids and exact SHA-256 9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43, and exact Blacksmith building rectangle.
- At a test-only mirror of Items' current PICKUP_REACH=56, all four stand-to-own-sword 50-unit rays pass, all 12 cross-rack choices reject OutOfRange, and all four radius18 stands clear the genuine embedded Core source. At x3760,y4088, two distinct clicked sword anchors are simultaneously eligible, so geometry is **not** item selection.
- A source point *inside* the smith solid at (3740,4005) cannot reach the sword at (3740,4038): Occluded, even at distance33.
- A standalone **84-unit NON-PICKUP** LOS probe across west-wall endpoints (3478,y) to (3562,y) passes the open west gate y4180 and rejects the solid wall y4000. The Physics generic ceiling96 is used for this geometry-only test, **not** a proposal to widen Items reach56.
- With complete=false the nominal own-sword ray rejects IncompleteGeometry. Sword tick899 against actor/geometry/operation tick900 rejects StaleWorldTick.

## Critical safety boundary

Core's STATIC_SOLIDS source explicitly omits **river, moving actors and dynamic doors**. The test-only complete=true geometry fixture is synthetic, solely to examine the static-source ray result. It is NOT a Core lease or proof of complete, current World blockers; pinned static SHA merely detects source drift, never genuine authority.

Production must obtain complete static+dynamic+river collision data, authenticated selected item, actor position, zone and worker epoch, map revision and all four identical source ticks **inside the single authoritative Core/Items mutation boundary**. Items controls the effective reach56 and exclusive canonical u128 physical item writer, Core 8A real TryPickup ingress/ACK, UI Graphics actual click, Combat loadout, and Main Orchestrator release.

## Local reproducibility

Run cargo fmt --manifest-path server/Cargo.toml --check; cargo test --locked --manifest-path server/Cargo.toml --test alpha_physics_world571_static_parity; cargo test --locked --manifest-path server/Cargo.toml; cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings; git diff --check.

This adds **2 cross-source integration test cases** alongside the existing **19 Physics unit tests**. It does not demonstrate real rack pickup on four independent browser clients or two hosts. M1–M5 First Playable remains BLOCKED until the true authority/write/replication/real-player gates pass.
