# World 9 / P0 — four-player rack arrival must be collision-qualified

**World source parent:** [P0 geometry candidate #639](https://github.com/tehki/myaso/pull/639), protected 172/172 green on immutable `129a5f0c0dc8399b5acf192be9d6fd60b38af751`. **Non-activating test-only child.** World authored geometry, all four swords, rack art and original 23 static solids remain unchanged. Does not change any client/player/runtime movement or collision rules.

## Exact regression discovered in cross-owner source review

The four proposed closer World staging destinations are `(3740,4068)`,
`(3780,4068)`, `(3820,4068)`, `(3860,4068)`. Actual reviewed
fighter radius is 18, so the nominal radius-18 fighters are 40 apart
and have just **4 units** of gap beyond their 36-unit combined diameter.

Core8A [#646](https://github.com/tehki/myaso/pull/646) authentic native
W3C test and [#668](https://github.com/tehki/myaso/pull/668) genuine
Firefox SIGKILL/rejoin test reach each proposed target with **18-unit
per-player arrival tolerance**. These are real Rust snapshot positions,
but standalone per-player distance-to-target checks **cannot establish
pairwise non-overlap**. This is a *logical proof limitation*, not evidence
that the real Rust server actually overlaps its actors.

Counterexample against the exact original intended positions:
player1 ends at `(3758,4068)`, player2 at `(3762,4068)`, players3
and4 at exact targets `(3820,4068),(3860,4068)`. Players1/2
are both **18** from their independently assigned target, yet only
**4** apart, rather than at least **36** needed for two radius18
fighters. Both are comfortably within reviewed offline 56 sword
reach (Euclidean `sqrt(18²+30²)=34.986`). Thus even four passing
individual **position and provisional reach** assertions cannot
certify four characters have physically usable room to interact.

The additive mandatory `tests/world-alpha-cardinal-rack-walk.test.mjs`
asserts nominal valid and negative counterexample using exact sourced
world fixture and no runtime alteration. **We do not add an arbitrary
spread or teleport**, widen/shorten standing tolerances, resize actor
radius, edit sword racks or force player movement. This is an
acceptance-contract gap handed to the authoritative runtime owners.

## Required qualified multiplayer acceptance before P0 pickup

Core8A should require the **actual authenticated same-tick Rust
server-owned roster positions**, not separate stale sampled views,
for all four living current actors after the real native walk and
after any crash/rejoin. Core8C + Physics6 own dynamic actor
overlap/occupancy policy and must demonstrate actual server-approved
per-actor radius 18 collision and physical room near the original
Blacksmith facade. For every two distinct actors require distance
at least their combined applicable real radii (36 if both 18) in the
**same authoritative world/zone/tick**, or explicitly document/accept
any game-design exceptional overlap (e.g. server spawn transition)
without calling it a simultaneous sword-interaction pass.

Actors may have different current zone/epoch, death/transitional
poses, or temporary collision invulnerability; fail closed or exclude
them with a vetted authoritative rule, never a client claim. Source
23-solids do NOT include dynamic actors, and World #639's additive
Core static solver does NOT prove dynamic occupancy.

Items2B/Physics6 [#663](https://github.com/tehki/myaso/pull/663)
proved **more than one original selected sword may lie within range**.
Retain explicit user-clicked current
`GroundEntityId + ItemId + revision`, never infer identity from
the actor's rack index, nearest blade, nominal point or range mask.
The canonical Core8B/Items single-writer and signed complete
current same-tick LOS/reach remain release blockers.

**No production activation or independent merge**. Main Orchestrator
[#360](https://github.com/tehki/myaso/issues/360) owns cross-department
integration. Four-sword First Playable [#480](https://github.com/tehki/myaso/issues/480) / [#488](https://github.com/tehki/myaso/issues/488)
is higher priority than IDR, magic and cosmetic expansions.
