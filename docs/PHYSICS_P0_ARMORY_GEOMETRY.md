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

**New checked-operation prerequisite:** `verify_pickup_geometry_at_completed_tick(actor, sword, window, expected_current, reach, ticks)` additionally rejects `PickupTickFence` when `operation_tick=0` or the server's actual **actor**, **sword**, or **complete geometry window** did not come from exactly the same `u32` completed World tick as the committing operation. Its `StaleWorldTick` rejection must abort the Items transaction before publishing ownership, equipment or a receipt. This matches Items [#522](https://github.com/tehki/myaso/pull/522) `PickupWorldTick.completed_tick` and the checked [#505](https://github.com/tehki/myaso/pull/505) sword-equipment seam, but **does not** trust a previously returned sword preview or its `completed_tick`; any browser selection is revalidated using current server state and the exact physical item under the exclusive writer lock.

**Important trust limit:** `PickupTickFence` consists of ordinary caller-supplied primitive values, NOT a capability, lease, signature or independently verified clock. The integration must source all four ticks from Core's authenticated authoritative operation, not from the client, a cached preview or a separate unchecked thread. For static World #509 AABBs, Core must verify the currently pinned revision and **complete dynamic/river coverage** before stamping the window with the operation's completed tick. A matching tick does not establish present-time dynamic geometry completeness, trustworthy world state, authenticated item ownership or future transaction idempotency. The original `verify_pickup_geometry` remains a read-only lower-level LOS check for compatibility; production callers should enforce the same-tick prerequisite and the trusted lock/commit fence as well.

- Maximum 128 complete solid AABBs per query. Incomplete/oversized windows fail closed; **caller may not pass a truncated list claiming complete**.
- All geometry and positions must be finite and within ±1,000,000; valid rects have nonzero width/height. Endpoints must be inside window bounds.
- **Core 8C zone identity compatibility:** `GeometryFence.zone_id` and `WorldPoint.zone_id` use `u64`, not the ephemeral `u32` network player ID. This matches typed Core C4d `ZoneKey(NonZeroU64)` storage (positive signed 63-bit range in PostgreSQL). Values **above `i64::MAX` reject**, and zone keys above `u32::MAX` must round-trip without truncation or false equality. Two new Rust tests check this and the exact signed-highest-key boundary. A zero zone ID is still representable **only for the existing test/legacy arena**; verified distributed Core 8C zone leases must be nonzero. **No caller may substitute a `u32` fighter/session/net ID for a Core `ZoneKey`.**
- Positive worker epoch must fit Core signed 63-bit range; world revision zero is valid for an initial state record. Future live 8C zone IDs remain under Core authority.
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

Seventeen focused Rust unit tests check reach, wall block, open doorway, tangent occlusion, stale epoch/revision, cross-zone denial, invalid/incomplete/over-budget geometry, nonfinite/oversized input, read-only behavior, and legacy zero-zone/zero-revision compatibility.

**World #493 exact contract fixture (source-only):** A new Rust test uses the *proposed* single-zone open-front smith solid footprint (3710,3850)-(3892,4012), frozen sockets at x=3740/3780/3820/3860, y=4038, and walkable stands y=4088. All four proposed pickups at distance 50 must have clear LOS when the south front is open; an actor inside the solid shop footprint attempting a grab must be rejected as occluded. This duplicates World-authored **proposal coordinates in a test only**, it does not copy live collision geometry into production. World [#493](https://github.com/tehki/myaso/pull/493) remains stacked on unmerged World foundation #336. World 9 + Core 8C must approve the final complete authoritative geometry and revise the fixture together if sockets/solids change.

**World #502 authored-static parity (test-only):** The additional Rust fixtures review proposed [World #502](https://github.com/tehki/myaso/pull/502) 23-solid layout semantics: four parallel rack stands at x=3740/3780/3820/3860, y=4088 may each reach **only** their corresponding sword at y=4038 with a provisional server reach of **64** (50-unit vertical distance; adjacent diagonal distance √4100 ≈ 64.031 exceeds 64). This is why the kernel's generic maximum reach **96** must never be selected by default as the final `TryPickup` gameplay reach without additional sword-target legality checks. A second fixture uses the exact World #502 west wall AABBs (x3501.5–3538.5, north ending y4112 and south starting y4248) to prove an 80-unit horizontal ray passes the genuine gate at y4180 but cannot pass adjacent solid wall at y4000. The fixture deliberately contains only the relevant wall subset; it must never be represented as a complete live Greyhaven/world collision window. World #502 authoring digest `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43` is a drift tripwire, **not** Core 8C authority or an authentication token. World excludes dynamic solids and the river; Core must fail closed if it cannot guarantee full LOS coverage for the committed actor→sword segment.

**Core 8C #519 swept-collision compatibility verification (static fixture only):** Added a fifteenth Physics Rust regression for the *radius-18-inflated* World #502 smith `(3692,3832)..(3910,4030)`. The route `(3900,4038)` → `(3960,4000)` stays outside the inflated rectangle: the X slab ends at `t=1/6`, before the Y slab begins at `t=8/38`. A genuine corner-entry ray and closed tangential ray are still blocked. **Verified source:** Core [draft #519](https://github.com/tehki/myaso/pull/519) **already implements the correct** `if entry > exit { return false; }` check in `swept_circle_hits_known_static_solid`; the clear route is therefore handled correctly. A prior Physics review accidentally omitted that condition from its offline reproduction and incorrectly alleged a false-positive collision; that allegation was [explicitly retracted](https://github.com/tehki/myaso/pull/519#issuecomment-6314973248). The new Physics case remains useful **compatibility coverage**, not a Core bug fix or activation. Full Core-owned movement regression and live World authority still need independent acceptance.

**NOT TESTED here:** production `/game` wiring, actual Greyhaven collision manifest or doorway, cursor/sword pixel parity, transaction idempotency, real four-player race, verified WAN/independent-host gameplay. Those are hard integration gates, not simulated successes.

**Activation:** leave module unused by `server/src/main.rs` until World/Core/Combat contracts are approved and orchestrator accepts full exact-head CI; do not merge this as a substitute for the genuine First Playable scenario. No FX, Magic, wallet, economy, production ingress or migration changes.
