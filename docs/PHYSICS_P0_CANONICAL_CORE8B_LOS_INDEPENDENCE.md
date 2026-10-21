# Physics 6 × Core 8B — canonical Ground identity cannot authorize LOS

**Moon Games / myaso.io First Playable P0. DRAFT, test-only. No live pickup, main merge, writer activation or deployment.**

## Original source ownership

- Physics + real Items source [PR #663](https://github.com/tehki/myaso/pull/663), original exact parent `4217ee546b7a6839b089aa5295219416e335ce4f`. Includes original Core 8A/8C/World geometry and read-only Physics/Items reach/physical IDs/corpse safety.
- Core 8B canonical offline item identity [PR #659](https://github.com/tehki/myaso/pull/659), original exact parent `9287712708054e6af583adc8aebcaf9423261610`. Includes the exclusive local MYTX V2 journal and read-only unique canonical Ground membership; **not** a selected, globally fenced production item writer.
- This integration is one true two-parent Git source merge. The only textual conflict was additive `server/src/lib.rs` registration; retain all Core+Physics+Items modules exactly once, without replacing owner implementation.

## New deterministic cross-owner regression

One new Rust `alpha_quiescent_rack_handoff::tests::canonical_unique_core_ground_and_physics_los_are_independent_prerequisites` is test-only and uses **actual existing Items/Core review fixtures**, not invented physical item IDs:

1. Build the four original physical sword GroundDrop records via the real Items grant/drop allocator and save one legal quiescent MYASOL03 checkpoint; reopen its real sword projection and compare each distinct `ground_entity_id:u64`/`item_id:u64` with the fully collision-checked imported canonical `GroundEntityId:u128`/`ItemId:u128` for all four authored Greyhaven sockets.
2. Create exactly the four canonical items in the sole *local, offline* `DurableItemJournal` using true MYTX journal operations, and verify `review_offline_rack_against_existing_core` accepts all four uniquely present Ground swords with pinned local journal head/mutation revisions. This is deliberately **not** a signed source of current World actor/item/zone/tick authority.
3. The first original sword at `(3740,4038)` is within Items' exact `PICKUP_REACH=56` from proposed `(3740,4068)`. A **test-only synthetic** complete static 23-solid Physics window returns `Ok`, but the same current Core canonical journal remains perfectly valid when a synthetic closed dynamic door is inserted across that ray and the Physics verifier returns `Occluded`. Declaring geometry incomplete denies with `IncompleteGeometry`. Thus even a unique canonical sword is not an authorized pickup.
4. Remove the synthetic door. Geometry still returns `Ok`, but a fifth distinct canonical item committed into the exact same `Ground{zone,x_cm,y_cm}` by the journal makes Core `review_offline_rack_against_existing_core` fail closed on `ambiguous physical rack ground occupancy` with no change to actor/item line of sight. Thus LOS can never certify a unique clicked physical sword.

Both negative checks are independently necessary; **there is no live transaction combining them**. The test intentionally uses fabricated `GeometryFence{zone=7, epoch=11, revision=23}`, equal tick900 and artificial `GeometryWindow.complete=true` to compare static predicate logic. The 23-shape source omits river, actors and current doors. Core's `ZoneId(1)`, x100 cm mapping and the old Items checkpoint are test-only/offline, unsigned and rollbackable. Both MYTX and MYASOL03 can still independently write without a global epoch fence, as the Core+Items #629 negative test proved.

## Release contract

Core 8C owns a *trusted, complete, same completed tick* World actor/current item/static+river+dynamic geometry witness tied to one zone/worker epoch/map revision. Core 8B + Items must select exactly one canonical globally epoch-fenced durable `ItemId:u128` writer with replay-safe current ground mutation rev and receipt/outbox. Core 8A must authenticate the real session, selected original pixel/ground entity/item target and deliver ACK. UI/Graphics and Combat then establish four genuine browser sword and fist actions, knockdown, drop/loot/death/reconnect and independent two-host acceptance. Main Orchestrator alone controls merge and deployment.

Require exact-head full protected GitHub CI on this true merged source; independent ancestors' passing checks are **not** combined approval. Keep parent #663 native M143 failure visible; never waive browser Combat tests.
