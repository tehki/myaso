# Core 8B C3s — Greyhaven physical sword socket ↔ item identity / ground preflight

**First Playable P0: OFFLINE, NOT LIVE.** This source is stacked on Core 8B read-only MainHand [#526](https://github.com/tehki/myaso/pull/526). It does **not** decide item authority, activate a sword, authorize a player, infer line of sight, or select a world-coordinate conversion. Integration decisions remain with [canonical contract #432](https://github.com/tehki/myaso/issues/432), [First Playable #480](https://github.com/tehki/myaso/issues/480), and Main Orchestrator [#360](https://github.com/tehki/myaso/issues/360).

## Exact source of cross-department mismatch

World [#493](https://github.com/tehki/myaso/pull/493), authored `WORLD_ALPHA_ARMORY_VERSION=1`, defines one Blacksmith exterior rack with four immutable **visual socket names** and world-unit locations. These sockets are *not* item IDs or authoritative pickup rights:

| Authored socket | World x | World y | Walkable approach y |
| --- | ---: | ---: | ---: |
| `greyhaven-rack-1` | 3740 | 4038 | 4088 |
| `greyhaven-rack-2` | 3780 | 4038 | 4088 |
| `greyhaven-rack-3` | 3820 | 4038 | 4088 |
| `greyhaven-rack-4` | 3860 | 4038 | 4088 |

Items 2B [#522](https://github.com/tehki/myaso/pull/522) uses the *same world units* for `GroundDrop.at: Point {x:f32,y:f32}`, and distinct `u64` ground entity and item IDs in its illustrative tests. The visual radius is not the physical pickup radius: Items [#530](https://github.com/tehki/myaso/pull/530) subsequently restricts actionable targets to server-verified **56 world units**. Core 8C [#532](https://github.com/tehki/myaso/pull/532) has separately tested four real QUIC connections walking to the four approaches. Neither makes a live item writer or browser pickup available.

Core 8B earlier fixture [#492](https://github.com/tehki/myaso/pull/492) invented **`Ground { zone_id:1, x_cm:371000+35*i, y_cm:385000 }`**—not the same physical rack. Its sample item IDs `201..204` overlap the numerical examples that Items uses for **ground entities**, but they are not the same objects. An unchecked copy would let the server target the wrong location or incorrectly identify a ground entity as an item.

## New dormant typed preflight

`server/src/alpha_armory_mapping_preflight.rs` exports a validation-only `preflight_greyhaven_rack_v1` taking exactly four `ProposedRackSource` records, a collision-checked existing `LegacyImportPreflight`, and an explicit `ProposedWorldToCentimeter` configuration:

- Requires the exact four names, order and world coordinates from World V1. Changing World coordinates without re-reviewing Core must fail the contract test, rather than silently accepting the older fake rack.
- Demands **four nonzero, separately registered source `u64` ground entity IDs** and **four distinct source `u64` item IDs**, validating their independent source domains against the earlier C3p `u64→u128` collision-screened import. A source ID 201 that represents a ground entity cannot be implicitly treated as a Core item ID 201.
- Returns separately typed **`canonical_ground_entity: u128`** and **`canonical_item: ItemId(u128)`** plus a proposed `ItemLocation::Ground` in Core's centimeter-labeled coordinates. No ledger record, new item ID, public packet or mutable world state is created.
- Requires the reviewer to supply a real nonzero typed `ZoneId`, a **positive rational centimeter/world-unit ratio** (numerator and denominator), and signed x/y centimeter origins. Uses checked `i64` multiplication/addition, requires exact integer centimeters with **no rounding**, and checks destination `i32` range. Rejects zero/negative scales, fractional results and overflow.
- Does **not** approve any numerical conversion. Both `100 cm/world unit` and `1 cm/world unit` appear only as distinct **test-only examples** illustrating that arithmetic validity does not equal correct game geometry. A live transform may require a different origin, unit convention, dynamic-zone binding or higher precision, and must be approved explicitly.
- Does **not** prove the source rows were obtained from a signed checkpoint or trusted death/loot event, authorize the actor or worker, resolve same-tick Physics LOS, carry item `ItemKind`, prevent two independent writers, or publish a world/item outbox/observer ACK. A runtime call using browser-supplied coordinates would be unsafe. Treat this as an offline acceptance worksheet.

## Acceptance

At exact implementation SHA `279e1fdf3953842ad1917cc352d3d47e2fe83f74`, Serj Linux Rust 1.89:

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib alpha_armory_mapping_preflight
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

**5/5 focused C3s preflight tests PASS; 120/120 full library tests PASS; 3 intentionally ignored subprocess helper entries; rustfmt PASS; strict Clippy PASS.** They cover correct version-1 physical sockets, no numeric ID alias, rejection of the old placeholder, swapped/fake sockets, duplicates/missing/zero IDs, invalid scales, nonintegral units, i64/i32 overflow, and an explicitly different valid arithmetic transform.

The tests do not import the World JavaScript source at runtime (the P0 World branch is still unmerged); they pin its reviewed V1 coordinates for approval. Before activating any transform, a central integration suite must compare these coordinates **directly** against the selected, immutable World source and test actual signed same-tick distance/LOS and pickup from independently controlled clients.

**Protected full `quality` on this exact PR head is required.** The parent [#526](https://github.com/tehki/myaso/pull/526) currently has protected [quality #39597163525](https://github.com/tehki/myaso/actions/runs/39597163525) **FAILED legitimate M145 browser spatial recovery handoff**. Do not waive that red browser gate.

## Required sign-off and rollback

**8C + World + Physics** must decide actual 8192-world geometry to authoritative Core zone location representation, zone identity/epoch, LOS and pickup reach semantics; **Items 2B** must nominate four unique source ground entity/item IDs and the ONE approved live sword transaction writer; **8B** must verify the complete active+retired canonical ID inventory, collision-safe deterministic mapping, and receipt durability; **8A** must provide authenticated player/session to item intent and the authoritative ACK/outbox. **Graphics/UI** must hit-test the physical sword image and reject old visual frames under a verified monotone epoch/revision.

Only the Main Orchestrator may integrate and stage once protected CI and 4 independent-browser M1–M5 acceptance passes. Leave MYTX and MYWLD003 prototypes isolated: never dual-write the same sword, downcast `u128→u64`, or guess centimeter scale. No production migration, gameplay switch, wallet or MOCMP activation.
