# World 9 P0 — Blacksmith reach-safe staging candidate (static / non-authoritative)

**Review-only child of World [#618](https://github.com/tehki/myaso/pull/618).**
No new live weapon, item authority, pickup ACK, animation, map, building,
collider, network packet, combat profile, or spawn rule. This is not a
server-configured movement destination and is OFF in gameplay.

## Observed gap in four authentic-browser Greyhaven

Original Blacksmith rack World sockets:
`(3740,4038)`, `(3780,4038)`, `(3820,4038)`, `(3860,4038)`.

Original four World **navigation** approaches are `(x,4088)`.
At zero approach error they are 50 World units from their named swords,
but genuine Core 8A [native run #39639520191](https://github.com/tehki/myaso/actions/runs/39639520191)
accepts players **within 18** of each approach. The Items 2B reviewed
**offline prototype** reach is 56 (NOT a committed live rule).

A genuine Firefox player arrived at server-owned `(3780,4100)`: 62 from
its named sword. The navigation test correctly passed, but this actor
would not be inside the prototype range if there were a live sword.

A separate genuine Graphics 3B [4-browser run #39645019984](https://github.com/tehki/myaso/actions/runs/39645019984)
proved the original **empty** rack visible to all four browsers. Two
of the four authentic reported final positions were likewise beyond
prototype reach56. Neither run asserts live sword ownership/pickup.

## Non-activating closer staging candidate

For the four **same original swords**, try `(x,4068)` as a **candidate**
for a future Core-owned W3C walking acceptance. Its nominal geometric
distance to each socket is `4068 - 4038 = 30`. If a genuine server-owned
fighter completes real movement within Euclidean 18 units of that target,
its distance to the *nominal static sword socket* is at most 48 by the
triangle inequality, leaving 8 units against the historical reach56.

Distinct candidate X coordinates retain 40-unit spacing, greater than
the reviewed radius-18 fighter diameter 36. This is not proof of
live dynamic occupancy or right-to-stand. A candidate can be within reach
of more than one sword; item selection must **never** infer nearest
item from spatial eligibility. The future pointer must select exact
visible sword pixels and pass one server-issued current
`GroundEntityId + ItemId + mutation revision` to an authenticated
transaction.

The added `tests/world-alpha-cardinal-rack-walk.test.mjs` exercises
the static math and authored 23 AABBs, original corridor, no-overlap,
and adjacent-sword ambiguity. The **actual compiled** Core 8C
`server/tests/world9_courtyard_static.rs` sweeper verifies the
original stand → candidate and the southern West-first corner →
candidate routes, both directions, at fighter radius18. These are
static authoring/regression tests; **not** real navigation, live
collision approval, signed item authorization, or a change to the
original `WORLD_ALPHA_SWORD_RACK_SOCKETS` module.

## Required follow-up before any First Playable status change

Core 8A needs four real Chrome/Firefox W3C actors arriving at a
jointly approved destination, backed by independently read current
Rust-owned positions and true ticks; Core 8C/Physics must check
complete same-tick World geometry (including river, dynamic actors and
doors), current zone/epoch, own collision/LOS and the actual selected
item pose; Items/Core 8B must supply an exclusive durable canonical
u128 item custody transfer, idempotent request receipt and replay-safe
observer replication; UI/Graphics must draw **four real signed swords**
and target their actual nontransparent rendered hit shapes without
striking; Combat must verify armed/unarmed outcomes. These remain
outstanding. No merge to `main`, no deployment or default-on preview;
Main Orchestrator [#360](https://github.com/tehki/myaso/issues/360)
controls integration and release.
