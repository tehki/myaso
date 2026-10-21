# Physics 6 × Core 8C/World 9 × Items 2B — physical sword identity parity

**First Playable P0, test-only DRAFT. NO live pickup activation, merge, or deployment.**

## Exact immutable dependencies

- Main Orchestrator Core/World [#571](https://github.com/tehki/myaso/pull/571): \`9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59\`.
- Physics [#601](https://github.com/tehki/myaso/pull/601) (also includes parent [#544](https://github.com/tehki/myaso/pull/544) and original [#494](https://github.com/tehki/myaso/pull/494)): \`48dcb23015485282b855d19b73605ea27798ac56\`.
- Items actual read-only current ground projection [#595](https://github.com/tehki/myaso/pull/595): \`505350c9653a5ffd247f25b937fbefbd666fcaa1\`.
- This draft branch is an actual source merge of #601 + #595. The single conflicting server/src/lib.rs additive module registration retains **all** Core, Physics, Items and Magic modules, preserving the original input/protocol/simulation. It targets #601 for review, not \`main\`.

## Exactly what the new tests do

Two new TEST-ONLY integration tests in \`server/tests/alpha_physics_items595_current_sword_parity.rs\` use the **real public server-owned LootAuthority domain APIs**, without fabricating internal LootStateSnapshot fields:

1. A disposable Rust World creates 4 sword-bearing players at authored rack anchors \`(3740,3780,3820,3860; y=4038)\` and four receiver players at the matching 50-unit-south stands \`y=4088\`. Every supplier receives a **fresh item ID** via real \`LootAuthority::grant\` and creates a **separate physical ground-entity ID** via real \`LootAuthority::drop_backpack\`. The Items-owned \`proposed_current_rack_swords\` reads the CURRENT ground to return **4 distinct exact** \`(groundEntityId,itemId)\` bindings, not generated test placeholder IDs or a nearest-distance guess.
2. The source import of Items' **actual** \`PICKUP_REACH\` constant is supplied to the unchanged Physics read-only \`verify_pickup_geometry_at_completed_tick\`, using source Core \`STATIC_SOLIDS\` 23 authored AABBs. For four receiver actors, their own **current ground entity's stored actual position** passes, all 12 other current swords reject \`OutOfRange\`. \`complete=false\` fails even with real current ground IDs; stale sword tick fails. The geometry operation leaves the Loot state unchanged.
3. A physically central point can reach two separate exact real current item IDs. The test explicitly selects the **second** item's \`groundEntityId\` through the existing **offline domain-only** \`take_ground\`, checks same original \`item_id\`, verifies other three swords remain, Items' current rack projection clears only selected rack, and retry of physically missing ground entity rejects \`NotFound\`.

This test does **not** assert the 4 supplier players or receiver players represent four real sessions, independently connected browsers, player input commands or a production World tick. Their IDs are **local Rust-only fixture actors**.

## Critical authority and completeness restrictions

The static Core AABB source omits rivers, moving actors and dynamic doors. The fixture \`GeometryWindow.complete=true\` is **deliberately SYNTHETIC**, used only for static LOS/range comparison. The fixture \`zone_id=7, worker_epoch=11, map_revision=23, tick=900\` is intentionally arbitrary test data, **not an authenticated Core signed lease**. Read-only Items projection returns legacy \`u64\` item IDs, **not the canonical Core8B signed \`u128\` transaction authority**, mutation sequence or outbox receipt. Items' public \`take_ground\` remains an offline domain mutation, **NOT** the approved single-writer checked atomic pickup and NOT a \`/game\` handler. There is no production item/geometry authority in this PR.

A live physical-sword click requires current World actor, exact CURRENT ground entity, current canonical item and mutation sequence, complete trusted static+dynamic+river blockers, typed zone/lease+epoch+map revision, all four completed source ticks, and one globally fenced item ownership writer bound to the authenticated session and durable receipt/outbox under a single atomic mutation boundary. The owner disciplines are Core 8C, Core 8B, Items 2B, 8A, Graphics/UI and Combat. No such authorization is granted by a green test in this draft.

## Review and release gate

- Protect the **original** native Combat acceptance (M172/M173, M151/M193, etc.), do not bypass or relax.
- Require exact-head protected quality and CI on the combined tree. Green ancestor PRs do not establish combined qualification.
- No main merge or production action without the Main Development & Deployment Orchestrator.
- M1–M5 four **real** independently connected browser gameplay + physical sword ownership + combat/reconnect remains **NOT PLAYABLE** until proved.

Run \`cargo test --locked --manifest-path server/Cargo.toml --test alpha_physics_items595_current_sword_parity\`, then full server Cargo tests, \`cargo fmt --check\`, strict \`cargo clippy --all-targets -- -D warnings\`, and \`git diff --check\`.

## Additional fail-closed current-source counterexamples

The integration suite now has **four** test cases, including two new explicit negative proofs that a Physics LOS success does NOT grant ownership:

- **Dynamic blocker:** the current Items ground sword has a clear 50-unit ray through the original 23 Core static AABBs when a test incorrectly claims static-only geometry is complete. Adding a synthetic closed dynamic door to the test window yields `Occluded`, and a non-complete window yields `IncompleteGeometry`. This is a regression of the Physics predicate; production Core 8C does NOT yet supply authenticated dynamic coverage.
- **Taken/expired ground item:** after offline Items `take_ground` removes the exact selected entity, current Items rack projection is empty for that socket, duplicate pickup is `NotFound`, yet the geometry-only predicate still returns `Ok(())` for remembered coordinates and fabricated equal ticks. After item expiry, the time-filtered source is empty even if a stale geometric ray remains clear. Production must re-read exact canonical item/current physical source and expiry inside the single signed epoch/tick mutation lock.

These source tests deliberately demonstrate what geometry **cannot** authorize. No dynamic-door runtime, secure source lease, canonical Core u128 writer, network TryPickup, observer outbox, live player interaction or complete current map has been implemented.

## Dense actual Items-versus-Physics reach equivalence

A fifth Rust integration case performs 6,667 deterministic southern Blacksmith approach samples (`dx=-56..56`, `dy=0..58`) plus 81 f32 ULP-adjacent original sword boundary samples. For every sample, it restores a fresh Items `LootAuthority` state containing four real generated sword ground/item identities, invokes actual `LootAuthority::take_ground` on exact item ID with a local World fighter position, and compares success/denial with the existing Physics `verify_pickup_geometry_at_completed_tick` using the real imported `PICKUP_REACH=56` and generated Core static source.

The source fixture is artificially marked static-complete ONLY because it samples the open southern approach, where all 23 static solids are known. This is numerical reach parity, not runtime geometry completeness, session authentication, canonical u128 item writer approval or a four-browser acceptance. Any future fused multiplication, altered f32 operation order or inclusive threshold drift must cause this test to fail.

## Items #637 corporeal rack overlap cross-owner negative

A sixth integration test now merges actual Items #637 source without editing the Items owner's production code. It creates a **real** gold-bearing corpse via `LootAuthority::death` at an exact authored sword rack socket while preserving the live original physical sword. Existing Physics reach/LOS against static World AABBs returns `Ok(())` before and after the corpse appears. The CURRENT Items-domain `proposed_current_rack_swords` instead returns `LootError::InvalidState` for the whole rack, and remains read-only. Marking the World window incomplete returns `IncompleteGeometry`.

This is intentional: a geometrically visible position is not proof of unique item identity, and a corpse/ground item overlap is not an obstacle map revision. Production must validate both the current Items source and COMPLETE World geometry at the same exclusive canonical commit. This test adds no runtime request handler, live item feed, authored dynamic corpse collider, writer, or authentication.

## World 9 #639 / Core 8A #646 review waypoint: exact selection is mandatory

Source proposal only: four Blacksmith interaction approach waypoints are `(3740|3780|3820|3860,4068)` and the authored sword points remain `(3740|3780|3820|3860,4038)`. The original navigation y4088 waypoint was NOT changed or approved as a production waypoint. Core 8A #646 separately exercised native Chrome/Firefox and proposed radius-18 W3C arrival; neither the browser test nor these Physics tests authorize item ownership.

Two additional source-real Rust regression cases create the four DISTINCT physical sword IDs and corresponding ground-entity IDs using genuine Items `LootAuthority::grant`, `drop_backpack` and `proposed_current_rack_swords`; they import actual `loot::PICKUP_REACH` and use original Core 23 static AABBs and the existing Physics verifier without editing production code:

- At exactly the four proposed y4068 waypoints, the 4x4 Items/Physics selection matrix is **4 own + 6 directed adjacent reachable (10 total)** and **6 farther out of 56-unit reach**. A player standing nearest sword 0 may intentionally select adjacent sword 1: exact ground entity ID selects exact item, leaves sword 0 untouched, and duplicate retrieval rejects `NotFound`. Do NOT use auto-select nearest sword or treat waypoint owner index as an item ID.
- A separate exhaustive integer-coordinate tolerance sweep samples **4 × 1,009 = 4,036** distinct test-only player positions inside each radius-18 arrival circle. The original four nominal own swords remain eligible in every sampled position; second-neighbor swords always remain outside reach; adjacent eligibility varies with precise x/y. Every geometry result is compared against an independent fresh Items source `take_ground` result, preserving exact f32 reach semantics. This is a **synthetic positional tolerance sweep**, not recorded actual W3C fighter positions or an authentic signed Core8C World tick.

IMPORTANT: `GeometryWindow.complete=true` is test fiction for the fixed static LOS table; actual World river/actors/doors and signed zone/epoch/map revision/same completed tick still need one current complete source. No `TryPickup` transport handler, canonical `ItemId(u128)` single-writer commit, authoritative sprite/pixel exact selection, browser sword rendering, ACK or playable alpha exists in this test. This new case extends rather than revises Core 8A's own native approach evidence and World 9's authored candidate. Main Orchestrator alone determines whether a new approved physical approach route and item transaction can ship.

## Authority transition: real World body separation invalidates previously reachable adjacent sword

**Test-only new authoritative simulation counterexample**, using the original `simulation::World::step` server fighter-body separation (not post hoc test-coordinate rewriting). Core8A #646 accepts a reviewed 18-unit arrival tolerance around candidate y4068, and World #639 candidate nominal x positions differ by40 while an original fighter has **radius18**.

Two LOCAL Rust fighters at `(3753,4080)` for slot0 and `(3767,4080)` for slot1 are each within radius18 of their own nominated approach waypoints `(3740,4068)` and `(3780,4068)`, but are only **14 units apart** (diameter36). The first actor's `LootAuthority` genuine adjacent sword1 at `(3780,4038)` is initially in exact `PICKUP_REACH=56` and passes unchanged Physics static-only 23-AABB LOS.

One actual `simulation::World::step()` advances the authoritative tick and resolves the fighter collision to `(3742,4080)` and `(3778,4080)`, **36 apart**. The originally selected adjacent sword1 is now **beyond 56** for the first fighter. Both unchanged Physics `verify_pickup_geometry_at_completed_tick` and actual Items-domain `take_ground` independently reject the selected adjacent item from the current World fighter. A separately supplied stale actor tick is explicitly denied. Source-owned ground entity and item IDs do not change, and both own swords remain reachable.

This proves a four-browser *arrival* inside reach is not a committed current-tick pickup and even collision correction changes exact cross-sword eligibility. Core 8C must supply post-collision current actor state, completed tick, trusted full obstacle coverage and zone/epoch/map revision under the **same actual item-writer commit**. Core 8A must bind an exact pixel-selected canonical ground entity+item ID rather than route slot or nearest sword. The test contains NO authenticated W3C session, genuine current signed World geometry, live action, canonical u128 writer, receipt/ACK, or public deployment. Synthetic GeometryWindow.complete=true remains strictly test-only.
