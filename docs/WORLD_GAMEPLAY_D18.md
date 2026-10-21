# World & Gameplay D18 — Reciprocal Portal & Interior Reachability Audit

**Status:** isolated draft World & Gameplay authoring gate, stacked on D17 #456 and earlier unmerged authored-world work. **Build-time only**; no live map transfer, movement authorization or deployment.

## Why

D17 checks that the player can reach all **18 overworld** interactable points from Greyhaven. D16 validates each static authored site, and D2 independently checks furniture collision inside the Red Lion. However, a future edit could break the **overworld-to-tavern doorway**, leave a valid return portal with a **blocked landing**, or isolate the tavern's exit behind furniture. Those failures can strand a player despite otherwise green overworld and single-site checks.

D18 adds a targeted **two-zone door transition integrity gate**. It checks that each authored portal has a reciprocal counterpart in the other zone, that both portal centers and the preview's exact transfer landing points are walkable, and that those centers and landings are reachable from the actual offline-preview spawn inside each zone using D17's sampled-collision graph.

## Current world contract

| Property | Actual authored behavior |
| --- | --- |
| Overworld | Moonvale, 8192×8192 |
| Red Lion interior | 780×620; furniture is collidable except decorative rug |
| Outside player preview spawn | (4365,4150) |
| Tavern player preview spawn | (390,480) |
| Entry trigger | `red-lion-enter`, (4365,4075), 52-unit radius |
| Exit trigger | `red-lion-exit`, (390,550), 42-unit radius |
| Enter landing | Inside at (390,480), i.e. exit trigger y − 70 |
| Return landing | Outside at (4365,4143), i.e. entry trigger y + 68 |
| Connection | Entry targets exit; exit targets entry |

The canonical check accepts **2 reciprocal zones and 4 spawn-reachable trigger/landing points**.

## New code and gates

`scripts/audit-world-portals.mjs` implements `auditPreviewPortals` with a deterministic, read-only report and sorted errors. It checks stable unique IDs, finite in-bounds portal coordinates, nonzero bounded radius, actual D2 collision for triggers, valid destinations, exactly reciprocal links, D2 walkability of transfer landings, and preview helper parity with `previewPortalDestination`. It uses **one conservative D17 grid flood per zone**, with the same **≤4-unit swept sampling** of accepted edges. The overworld uses a **32-unit graph**, the tavern a **20-unit graph** suitable for its actual authored dimensions. Both are **CI-time checks**, never runtime player path searches. The CLI exits nonzero on any invalid or isolated portal point.

`tests/world-portal-reachability.test.mjs` adds **8 focused tests**: actual reciprocal authored Red Lion and exact transfer positions; synthetic working two-zone portal pair; missing/wrong backlink and duplicate IDs; malformed and blocked portals; independently blocked landing; a portal behind a simulated closed wall; invalid zone dimensions and origins; and cross-platform deterministic read-only CLI plus production code isolation.

`.github/workflows/ci.yml` adds a strict D18 gate after D17, preserving all Combat, Core, Rust, multiplayer, browser, world and earlier CI steps. No production files are changed.

## Test and acceptance

Run from repository root:

```sh
node scripts/audit-world-portals.mjs
node --test tests/world-portal-reachability.test.mjs
```

Expected canonical output:

```text
World portal audit PASS: 2 reciprocal zones; 4 spawn-reachable trigger/landing points.
```

Reviewers should also run D16 + D17 audits and the full Node quality suite. The editor's design can still be visually accepted in the existing isolated preview with **E** for enter/exit; D18 does not change rendering or portal input.

## Limitations and integration

This is a conservative **static authored-map** connectivity approximation, using the existing D2 default 18-unit preview fighter radius and samples at ≤4 units. It does not mathematically prove continuous swept-disc physics, dynamic door states, furniture movement, server tick movement validation, zone identity, network transfer handshakes, actual multiplayer inventory persistence or NPC navigation. A narrow but valid opening can fail the grid audit; a sampled-clear static route is not live authority. D18 does not grant XP, loot, coins, tokens, Moon Coin, real wallet access or achievement credit.

The central Development Center owns stack rebasing, exact-head CI, approval, merges and deployment. D16 #450 [CI #39518375524](https://github.com/tehki/myaso/actions/runs/39518375524) **passed**. D17 #456 [CI #39519447278](https://github.com/tehki/myaso/actions/runs/39519447278) **failed inherited strict Combat M41 spatial FFA parry tell**, not a D17 world gate failure. D12's inherited M205 and D15's inherited M158 also remain; older M151/M144/M171/M194 histories require requalification. **No bypass, CI weakening or unauthorized release.**
