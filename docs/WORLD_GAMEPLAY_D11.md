# World & Gameplay D11 — Sampled-Clear Trail Rejoin Hint (Offline Preview)

**Status:** separate draft milestone stacked on D10 #410 (and D9 → D1 → World Foundation #336). All existing gameplay, live movement, combat, identity, inventory, economy, server, and networking authority remain unchanged.

## Purpose and player experience

D10 measured how far a preview player stood from a D9 certified expedition corridor, but offered no direct route back. D11 allows a modest improvement when the player has left the corridor: if a *short straight approach* to a sampled point on that corridor passes local authored collision checks, the preview shows a compass direction and estimated approach distance. Otherwise it explicitly says **no sampled-clear direct rejoin nearby; follow walkable roads**.

The hint appears only when the current local player position is more than **96 world units** from the active certified corridor, but still within **256 units** of it. It does not grant movement, advance the expedition or promise that unseen server-controlled obstacles are absent. A compass bearing, trail position and actual rejoin suggestion are separate things.

## Algorithm (not live routing)

`src/world/local-rejoin.mjs` adds two pure helpers:
- `isSampledPreviewSegmentClear(mapId, ax, ay, bx, by)`: fails closed for unknown/cross-zone or nonfinite inputs, overlong segments, blocked start/end, or any occupancy sample along the line. Checks use D2's **18-unit-radius** preview avatar against buildings, city walls, rivers and bridges every **4 world units or less**.
- `localSampledTrailRejoin(state,mapId,x,y)`: takes the currently selected D9 pre-certified *milestone-to-milestone* corridor. It creates at most three local points per segment (projection, 32 units earlier, 32 units later), sorts them stably by proximity, and independently sweeps at most **12** candidate approaches. It returns one immutable descriptive record only when an approach is sampled clear. Bounded D9 corridor corpus means at most 4 segments / 12 candidates. It never performs A*, heap traversal, world/grid scan, interest replication, dynamic entity query or network I/O.
- `web/world-preview.html`: uses the existing D8/D10 **250-ms** refresh gate and displays a read-only `trail-rejoin` status below the native progress bar. There is no extra canvas, new animation loop or background task.
- `tests/world-safe-rejoin.test.mjs`: gate / city-wall contrast, deterministic cleared approaches, no advice for distant/near/invalid/blocked players or wrong map, zero stage/inventory mutations, source isolation, HTML syntax and throttle coverage.
- `.github/workflows/ci.yml`: additive D11 regression step; no Combat, networking or Core checks are removed or bypassed.

## Examples

At The Fallen Watch expedition's Red Lion initial milestone, the player may walk south toward Greyhaven, leaving the certified northern path. From the checked location **(4365,4319)** the static preview can validate an approximately 240-unit direct northward approach to the corridor. By contrast, a line across the **Greyhaven west wall** at y=4000 is rejected, while the authored **west gate** at y=4180 allows a line through.

The system deliberately does **not** suggest a direct path for an actor beyond the 256-unit envelope, inside blocked geometry, inside the Red Lion interior, with an inactive/completed route, or already close enough to the certified trail.

## Known security and precision limits

A sequence of ≤4-unit occupancy samples is **not** a mathematical proof of continuous swept-disc collision, and cannot account for dynamic obstacles, players, doors, structures, server-only collisions, knockback or variable avatar radii. Its result is explicitly labeled **sampled-clear in static preview geometry only**, never "guaranteed safe," "server-approved," "fastest route" or a persistent completion claim.

This module must not be wired to online transport, authoritative movement, quest/loot grants, items, property, payments or Moon Coin without an independently reviewed Core/Physics/Economics contract. Server identity, current zone, tick provenance and full collision remain the responsibility of Core & Multiplayer.

## Review and merge gates

Run `node --test tests/world-safe-rejoin.test.mjs tests/world-trail-progress.test.mjs`, `node --check src/world/local-rejoin.mjs`, full Node tests and the unchanged GitHub `quality` workflow. For browser smoke review, serve the repository at its root, select Fallen Watch from Greyhaven's Red Lion, walk south until >96 units off the certified corridor, observe a sampled-clear northward rejoin where static geometry permits; pressing M still shows only the milestone corridor (not a dynamic escape route). Switch and reload; no client state persists.

The upstream chain remains unmerged. Inherited strict Combat browser CI failures have included M151 (#336), M144 (#380), M171 (#394), and M194 (#389/#398/#400). Do not bypass these checks. D10 exact-head CI must also be verified before integration; only central Development Center may merge and deploy.
