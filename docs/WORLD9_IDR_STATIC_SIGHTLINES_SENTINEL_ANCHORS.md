# World 9 / IDR #655 — original Greyhaven static sightlines & Sentinel anchor review

**Date:** 2026-10-21. **Scope:** optional, non-activating specialist handoff for
[IDR #655](https://github.com/tehki/myaso/issues/655),
[IDR master #636](https://github.com/tehki/myaso/issues/636).
Main Orchestrator controls integration/deployment. **FIRST PLAYABLE ALPHA #480
and four real sword #488 remain P0; this work is not an Alpha blocker.**

## Exact source / coordinates, not a new world

Reviewed original `moonvale-overworld` / `greyhaven` city
`x=3520,y=3460,w=1240,h=1290`, original **15 authored buildings and
8 city-wall solids**, fixed layout `moonvale-greyhaven-v10-solids-v1`,
SHA256 `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`.

Original Smith building is `[3710,3850]..[3892,4012]`. Original four
sword sockets remain `x=[3740,3780,3820,3860],y=4038`;
their four existing navigation stands remain at `y=4088` and the
independently reviewed **optional** closer candidate at `y=4068` remains
dormant in [World #639](https://github.com/tehki/myaso/pull/639).
Four true staging spawn positions
`(4110,4160),(4206,4160),(4110,4256),(4206,4256)` stay unchanged.

## Review-only Sentinel/observation points

| Purpose | Static coordinates | Honest interpretation |
| --- | --- | --- |
| Proposed east-of-Smith nearby Sentinel anchor | `(3908,4072)` | Radius18 collider is clear; 48.17 units from reviewed subject `(3860,4068)`; original west-first player approach/candidate lanes are more than 36 units from this *stationary* actor position |
| Proposed north-of-Smith hidden witness probe | `(3800,3810)` | Original building occludes ray to same subject; **no witness** from this static ray |
| Proposed distant uninformed city probe | `(4250,4260)` | Radius18 clear, not intersecting original four static cardinal paths |
| Common nominal appearance-change subject | `(3860,4068)` | One **hypothetical** subject for line-of-sight tests, not an actual disguised player or item event |
| Independent close, occluded pair | `(3911,3992)` ↔ `(3872,4031)` | Both radius18-clear and only 55.15 units apart (within reviewed 56 **prototype** range), yet the literal Smith SE corner obstructs a thin static ray; this is a **test probe**, not a guard placement |

All nominal positions are inside the original city and outside the
**known 23 static rectangles**. That does NOT mean the positions are free of
moving players, Sentinel actors, doors, river, occlusion in rendered
sprites, or a currently authoritative complete geometry revision.

## Executable source parity

- `tests/world-idr-sentinel-static-sightlines.test.mjs` imports the original
  authored World/23-solids and asserts exact source, reference
  coordinates, radius18 static endpoints, positive southern ray, negative
  through-Smith ray and near-range corner occlusion. It checks every
  **original west-first alpha spawn → own sword approach → optional closer
  target** corridor against the three hypothetical stationary Sentinel
  positions at 36-unit separation.
- `server/tests/world9_idr_static_sightlines.rs` calls **real compiled
  Core 8C** `overlaps_known_static_solid` and
  `swept_circle_hits_known_static_solid` against original embedded solids.
  A `0.25`-unit thick static probe is a conservative offline geometry
  *ray approximation*, **NOT approved Physics6 true line of sight**.
  The exact 23-solid hash is asserted. Positive ray means only
  **no hit against these fixed AABBs**.

## Integration boundary — Core 8C + Physics 6 and Core 8B

Before `Introduce`, `WitnessAppearanceChange`, `RevealEvidence`, or
`ApplyDisguise` may execute: Core 8C must derive current authenticated
observer/subject identities and actual same **completed simulation tick**
positions from server-owned actors; require alive/non-stunned policy,
zone/instance/epoch/revision, real reach and *all* static/dynamic blockers
inside one complete trusted Physics6 geometry window. Neither
`true` from this static World fixture nor a client-provided witness list
authorizes recognition, display names or canonical identity disclosure.

Physics 6 signs off the actual same-tick reach and LOS definition; Core
8B owns durable subject/observer identity, appearance epochs and
per-observer belief updates; Core 8A owns recipient-specific no-leak
transport. NPC1 chooses genuine Sentinel population/routes only after
**dynamic actor overlap** safety, and NPC routes must not obstruct the
four Blacksmith item-interaction lanes. Graphics3A owns real appearance
assets. UI10 cannot turn raw chat/name claims into verification. Original
unmodified PvP target IDs and Combat remain authoritative.

This World proposal changes **no NPC spawns or AI**, game client, map,
collider or P0 routes; no live identity events, mutations, DB, item
transactions, network packets, or production feature flags. **IDR OFF.**

## Requested acceptance from owners

Core8C/Physics6 should show (1) actual complete-tick LOS rejects both
original through-Smith and the near-corner case even if within reach;
(2) positive same-tick LOS plus policy-vetted proximity and actor liveness
accept the front-of-Smith visible pair; (3) no ghost/stale/current-zone
witness list is accepted from the client; and (4) actual Sentinel move/
appearance changes never block P0 sword routes. Core8B/Core8A must
independently prove observer-specific Unknown/Claimed/Verified, no
true-name or Human/Sentinel leak, and deterministic witnessed/unwitnessed
disguise races. These cases are **not demonstrated** by World static tests.

[World first playable #639](https://github.com/tehki/myaso/pull/639)
strict quality and Core acceptance were green as of this review; this
new optional specialist draft must earn its own CI, with no production
release or Main merge authorized by a passing static test.
