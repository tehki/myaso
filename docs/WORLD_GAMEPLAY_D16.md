# World & Gameplay D16 — Authored World Integrity Gate

**Status:** draft-only, stacked on D15 #442 and earlier World & Gameplay previews; no production runtime movement, combat, items, wallet, persistence or deployment.

## Purpose

World development now spans authored geography, landmarks, natural resources, readable lore, ordered expeditions, collision-sampled expedition corridors and linked stories. A small local change to one manifest can silently invalidate another: a resource becomes buried inside a building, a site is unreachable due to F-action overlap, an expedition references an obsolete ID, a trail endpoint moves independently of its destination, or a historical story drops a clue.

D16 introduces a **deterministic, read-only build-time consistency audit** to catch those changes in CI before they can regress the offline preview.

## Current accepted snapshot

| Source | Audited records |
| --- | ---: |
| Landmark discovery (D1) | 4 |
| Natural field sites (D6) | 8 |
| Roadside lore sites (D13) | 6 |
| Ordered expedition routes (D7) | 3 |
| Pre-certified route legs (D9) | 7 |
| Connected story threads (D14) | 2 |

All 18 authored interaction points currently pass the established D2 preview collision checks at a world radius of 18 units. Every existing F-action target remains independently reachable. At Fallen Watch, the plaque at (3210,2070) is closer than Watchpost Ore (3220,2110), and the ore is closer at its own anchor; neither is shadowed under D13's exact **strictly-closer lore / tied-field wins** interaction arbitration. Every D7 step uses an existing landmark or field object with its correct action and reference, and D9's trail leg endpoints match each route transition. Each fixed corridor is sampled every **≤4 world units** against authored preview collision, including all fixed waypoints. D14 story threads each reference three unique lore sites; all six authored lore records are covered.

## New CI tool

`scripts/audit-world-authoring.mjs` provides `auditMoonvaleAuthoring(overrides?)` with deterministic, immutable report of named invariants. It checks:
- Canonical stable site IDs, no cross-manifest duplicates, overworld map IDs, finite/bounded/walkable site anchors and frozen authored data;
- D1 discovery radii, D6/D13 clues, and 18-character preview actor collision at all site anchors;
- Nearest selectable **F** target at every lore and field site anchor, including D13's tie behavior;
- D7 exact step reference identity, expected `visit`/ `inspect` role, ordered edges and unique route IDs;
- D9 unique, complete and non-orphaned certified corridors, exact authored endpoints, valid immutable waypoints and segment occupancy samples no more than 4 world units apart;
- D14 thread IDs, triplets, no duplicate or unknown lore references and no missing lore accounts;
- A reviewed baseline **minimum content count** for each manifest, allowing deliberate additions but requiring a conscious audit-floor revision for deletions.

The CLI prints one deterministic `PASS` summary or a sorted list of error codes and exits with **1** if an invariant fails. It does **not** write to the repository, alter game content, touch network/multiplayer code, or perform runtime pathfinding.

Run from repository root:

```sh
node scripts/audit-world-authoring.mjs
node --test tests/world-authoring-audit.test.mjs
```

`tests/world-authoring-audit.test.mjs` adds eight adversarial regression tests. Each intentionally corrupts isolated data (without modifying the authored source) and confirms that the auditor catches it: blocked/off-map and duplicate sites, shared field/lore collision shadowing, invalid expedition actions/foreign keys, blocked trail samples/endpoints or missing route leg, missing/duplicated story references, deleted manifest records and invalid CLI execution. Canonical data and repeatable audit results must remain green. `.github/workflows/ci.yml` adds this as a **new strict D16 quality gate**, preserving all inherited Combat, networking, Rust, Core, browser and earlier World steps.

## Important limits

This is an **offline static authoring linter**, not a continuous mathematical proof of swept collisions, playtest of every travel permutation or proof of future dynamic world state. It does not validate walls and obstructions added at runtime, physics dynamics, other players, equipped avatar sizes, NPC AI, inventory, real-world settlement or cryptocurrency. The 4-unit sampled corridor checks use D2's established preview geometry. Any authoritative multiplayer movement/rejoin, resource harvesting, quest storage or map transition requires separate Core & Multiplayer, Physics and Economics coordination.

Existing map content and UI behavior are unmodified. This milestone is deliberately infrastructure for reliable content authoring rather than another layer of runtime features.

## Release discipline

Parent D15 #442 and all preceding World departments' stacked PRs remain open/unmerged and diverged from updated `main`. D13 #431's exact-head [quality #39515475207](https://github.com/tehki/myaso/actions/runs/39515475207) **passed**. D14 #438 and D15 #442 quality runs were still in progress at D16 development start. D12 #425 exact-head quality failed inherited strict Combat M205 repeated M201 server-tick FFA punish proof; older strict M151/M144/M171/M194 histories require central requalification. Do not bypass, weaken or skip any strict acceptance to integrate D16. The Development Center owns stack rebasing, full CI, merged releases and live deployment.
