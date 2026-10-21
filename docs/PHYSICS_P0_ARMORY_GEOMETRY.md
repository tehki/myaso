# Physics P0 — armory pickup range and line-of-sight gate

**Status: IMPLEMENTED INACTIVE / not integrated / not multiplayer-playable.** Department 6 Physics; P0 owner scenario [#488](https://github.com/tehki/myaso/issues/488), central [#480](https://github.com/tehki/myaso/issues/480), coordination [#360](https://github.com/tehki/myaso/issues/360). Created directly from current integration `main`, independently of dormant P1–P18 FX [#357](https://github.com/tehki/myaso/pull/357).

## Purpose

The required Alpha interaction is four players walking to the Greyhaven armory and clicking **individual rendered sword pixels**. Rendering hit testing is a UI/Graphics concern; authorizing the physical interaction requires a *separate* trusted server geometry check:

- Actor and sword are in the **same authenticated current zone**.
- Sword is within a **server-configured, positive reach no greater than 96 world units** from the player's authoritative center (provisional alpha envelope; owners may lower it).
- The **closed segment** actor center → committed sword position does **not** intersect or merely touch any **solid** World-authored AABB. An open doorway is a literal gap in the solid manifest, not a client flag.
- The complete bounded geometry window is from the **trusted World / Core provider**, not a rendered facade, browser, portal preview, or an item request.
- The window's fence equals the **current** Core 8C zone, authority epoch, and map revision; the server must recheck these under the correct operation/transaction boundary.

This is a **read-only prerequisite**. It does not mint a sword, decide ownership, approve a Combat action, deduct stamina, equip, publish a snapshot, authenticate WebTransport, or send an ACK.

## Code and bounds

Module: `server/src/alpha_armory_physics.rs`.

`verify_pickup_geometry(actor, sword, window, expected_current, reach) -> Result<(), PickupGeometryReject>`

- Maximum 128 complete solid AABBs per query. Incomplete/oversized windows fail closed; **caller may not pass a truncated list claiming complete**.
- All geometry and positions must be finite and within ±1,000,000; valid rects have nonzero width/height. Endpoints must be inside window bounds.
- Positive worker epoch must fit Core signed 63-bit range; world revision zero is valid for an initial state record. Legacy single-arena zone ID zero remains representable; future live 8C zone IDs remain under Core authority.
- Rectangles are **closed** for conservative LOS: wall grazing, sword on barrier boundary and actor inside a wall are occluded. An approved door must be represented by two physically separated solids.
- This is 2D LOS at server-resolved world positions, not camera-ray, zoom, pixel alpha, counter surface height, cover, body-radius movement collision, or full 3D clearance.
- The API `expected_current` is a *comparison witness*, not a security capability. Supplying it from the same untrusted request is insecure. The caller must read current Core 8C epoch/revision, verify session/actor/item, and enforce fencing at the **same commit boundary**. An isolated successful geometry result must not outlive the tick/ownership check.
- The test coordinates near `(3700,3940)` are **illustrative** and NOT accepted Blacksmith rack coordinates, blockers or a published Moonvale revision.

## Owners and release dependencies

| Owner | Needed for genuine integration |
| --- | --- |
| **World 9** | Final accessible open-front smith / doorway and four canonical rack sockets; complete revisioned solid manifest plus decorative exclusion, actual route from Core spawn |
| **Core 8C** | Same-tick zone/worker/map revision validation, authoritative actor/sword positions and mutation fence |
| **Core 8A/8B + Items 2B** | Authenticated TryPickup, exact u128 sword ID, atomic single-winner receipt and same-ID drop/repickup |
| **Combat 4 / UI 10** | Server action/death validity and client gesture arbitration (sword click produces zero light attacks) |
| **Graphics 3A/3B/3C** | Rendered-pixel sword hitboxes and replica equipment visuals; no browser-derived collision authority |
| **Orchestrator** | Real multi-host Chrome/Firefox acceptance, full CI and controlled sequential merge, staging + rollback |

## Test contract

Ten focused Rust unit tests check reach, wall block, open doorway, tangent occlusion, stale epoch/revision, cross-zone denial, invalid/incomplete/over-budget geometry, nonfinite/oversized input, read-only behavior, and legacy zero-zone/zero-revision compatibility.

**World #493 exact contract fixture (source-only):** A new Rust test uses the *proposed* single-zone open-front smith solid footprint (3710,3850)-(3892,4012), frozen sockets at x=3740/3780/3820/3860, y=4038, and walkable stands y=4088. All four proposed pickups at distance 50 must have clear LOS when the south front is open; an actor inside the solid shop footprint attempting a grab must be rejected as occluded. This duplicates World-authored **proposal coordinates in a test only**, it does not copy live collision geometry into production. World [#493](https://github.com/tehki/myaso/pull/493) remains stacked on unmerged World foundation #336. World 9 + Core 8C must approve the final complete authoritative geometry and revise the fixture together if sockets/solids change.

**NOT TESTED here:** production `/game` wiring, actual Greyhaven collision manifest or doorway, cursor/sword pixel parity, transaction idempotency, real four-player race, verified WAN/independent-host gameplay. Those are hard integration gates, not simulated successes.

**Activation:** leave module unused by `server/src/main.rs` until World/Core/Combat contracts are approved and orchestrator accepts full exact-head CI; do not merge this as a substitute for the genuine First Playable scenario. No FX, Magic, wallet, economy, production ingress or migration changes.
