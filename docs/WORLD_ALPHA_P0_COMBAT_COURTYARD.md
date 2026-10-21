# World 9 — P0 shared Blacksmith south courtyard (authored-only)

**Status:** Unmerged World-only child of central integration [#571](https://github.com/tehki/myaso/pull/571); static World geometry source and focused regression only.
This is part of the same `moonvale-overworld` map as the Greyhaven Blacksmith:
**not** another instance, portal, server combat authority, or a staged arena switch.
Central integration approval belongs to [#360](https://github.com/tehki/myaso/issues/360).

## Gameplay purpose

Owner-required [First Playable #480](https://github.com/tehki/myaso/issues/480)
needs physical unarmed/sword PvP immediately after leaving the
[four-sword Blacksmith #488](https://github.com/tehki/myaso/issues/488).
Current central [#571](https://github.com/tehki/myaso/pull/571) already includes the
consolidated World [#521](https://github.com/tehki/myaso/pull/521): four
individual rack sockets, 18-radius approach stands and static wall geometry.
This child imports the previously protected [#537](https://github.com/tehki/myaso/pull/537)
56-unit prototype reach/midpoint ambiguity regression alongside the new courtyard. This change adds **one authored open courtyard**
and a deterministic regression to prevent decoration/building changes from
silently making the first sword fights spatially impossible.

Source: `src/world/alpha-combat-space.mjs`, ID
`greyhaven-smith-south-courtyard`. Its bounds are
`[3700,4120]..[3940,4360]`, with four separated static test stations
`(3740,4200)`, `(3860,4200)`, `(3740,4290)`,
`(3860,4290)`. A central `(3820,4240)` reference samples
64 World units in eight headings (a **geometry envelope only**, not an
actual Combat movement distance).

The source does **not** change player spawns, Blacksmith/rack coordinates,
23 pinned solid AABBs or their hash, Core 8C zone/state, Items identities,
Physics authority, UI pointer selection, animation or Combat timings.

## Strict static regression

`node --test tests/world-alpha-combat-space.test.mjs` checks the courtyard, while
`node --test tests/world-alpha-rack-selection-range.test.mjs` guards the
reviewed Items 56-unit prototype source geometry (four unique approaches and
three ambiguous neighboring midpoints). These are authoring constraints, not a
live Items or Physics reach setting. Courtyard checks:

- Same map, no zone transfer and explicitly no combat authority.
- The complete authored clearing rectangle is disjoint from every known fixed
  Greyhaven AABB even after 18-unit fighter-radius inflation.
- Four nonoverlapping human-scale station placements.
- All **16** nominal socket-approach-to-courtyard-station routes avoid the 23
  pinned fixed solids under exact continuous segment-vs-radius-18-inflated-AABB checks (closed tangencies blocked).
- **Another 16** direct, reversible server-designated spawn-to-courtyard-station
  static paths let all four players reach the fist-fighting space without first
  visiting the rack; every one stays inside the authored Greyhaven city and is
  conservative radius-18 collision-clear in both directions.
- Eight 64-unit directional segments plus fighter radius stay unobstructed. A separate thin-obstacle/tangency negative regression proves the sweep does not miss hazards between sampled points.

These are two additional **courtyard traversal matrices**, not a replacement for
Core [#527](https://github.com/tehki/myaso/pull/527)'s separate
**16 spawn-to-rack** routes, or [#532](https://github.com/tehki/myaso/pull/532)'s
actual four-session loopback transport test.

## Remaining acceptance boundaries

Only authored, *known static* 23-rectangle geometry is covered.
Full-authority Physics must check dynamic blockers, all relevant sightlines,
complete geometry window, current Core epoch and true server movement.
Combat must approve actual knockback/roll/dash travel and ensure four humans
can fight, die, respawn and rejoin. Graphics must keep swords visible.
Items/Core must commit pickup/drop/equipment; a static clearing proves none
of those outcomes. Chrome/Firefox + multi-host M1–M5 acceptance remains
unverified; do not merge/deploy this isolated World draft independently.
