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
