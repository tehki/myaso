# World & Gameplay P0 — Rack Pickup Range and Exact-Sword Selection Proof

**Scope:** test-only authoring compatibility; child draft of [fully CI-green World P0 #521](https://github.com/tehki/myaso/pull/521). No authored coordinates, renderer, geometry, Combat, online client, server or items state changed. The existing strict four-sword World CI gate runs the new test as an additional check, while all four named P0 gates remain.

## Reviewed independent constraints

- World #521 / original #493 immutable four-sword rack: four sword points `(3740/3780/3820/3860,4038)`; four corresponding nominal player stands at `y=4088`. Avatar authoring collision radius **18** units; each stand spaced **40** units from its neighbor.
- Items 2B isolated [#530](https://github.com/tehki/myaso/pull/530), head `6cbad2f7361755d878b3c405b832815ee384467d`, `server/src/loot.rs` defines `PICKUP_REACH = 56.0` and validates inclusive **squared point distance** from actual server Fighter to actual `GroundDrop`. This is an **isolated prototype value, not an orchestrator-approved unified live protocol**.
- Physics 6 [#494](https://github.com/tehki/myaso/pull/494) currently defines `MAX_PICKUP_REACH = 96.0` as an **upper validation bound**, not proof that a real pickup is allowed at 96. Core/Items/Physics must agree one effective range before any live `TryPickup`.

## What the World geometry proves

| Case | Center-to-center distance | Within Items prototype 56? |
| --- | ---: | --- |
| Nominal player stand → matching sword | 50 units | Yes |
| Nominal stand → adjacent sword | `sqrt(40²+50²) ≈ 64.03` | No |
| Nominal stand → sword after moving 6 units south | 56 units | Yes, at boundary |
| Nominal stand → sword after moving 7 units south | 57 units | No |
| Midpoint between two neighboring stands → **either** neighboring sword | `sqrt(20²+50²) ≈ 53.85` | **Both** eligible by distance |

Thus the current four stands each unambiguously reach their own sword *only at the nominal standing coordinates*. There is **only 6 units of outward margin** from the nominated stand. A real player may stand between sockets, within reach of **two** swords. There must be **no automatic nearest-sword ID inference, index-based sword grants or client-selected coordinates**.

A real click on one of Graphics 3B's four independently rendered sword sprites, including Chrome/Firefox high-DPI, should reserve one intended exact candidate; Core/Items must resolve its authenticated server-issued ground entity and canonical item ID, recheck current player/item zone, worker fence, completed tick, genuine LOS, effective reach and exclusive receipt. A preview world socket ID is not that server item ID. A successful *distance* test is not a real pickup, an item-authority proof, or the M1–M5 multiplayer acceptance.

## Acceptance / ownership

The `tests/world-alpha-rack-selection-range.test.mjs` suite checks the exact four original sockets/stands, four-player 18-radius spacing, own vs neighboring Items prototype reach, the **two-eligible-sword midpoint**, six-unit outward boundary and absence of runtime activation. It imports only existing World static data. A future World layout change must requalify this against the owning Items reach setting and Physics/Core actual complete same-tick geometry.

The existing protected `Validate P0 Greyhaven Blacksmith four-sword armory sockets` step now includes this test. **No inherited CI gate has been removed, skipped, relaxed or made optional.**

**Readiness: static conformance IMPLEMENTED/TESTED only.** Live pickup/equip, authoritative range agreement, one canonical item writer, same-tick server LOS, real four independent browser clients and overall rollout remain BLOCKED and centrally governed.
