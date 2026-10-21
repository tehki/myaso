# Moon Games — Graphics 3C First Playable Alpha alignment

**Priority:** P0 | **Department:** Graphics → 3C Environment & Atmosphere | **Classification:** BLOCKED  
**Coordination:** [Moon Games Development Center #360](https://github.com/tehki/myaso/issues/360#issuecomment-6306632832)  
**Integration authority:** Moon Games Main Development & Deployment Orchestrator  
**Repository:** [tehki/myaso](https://github.com/tehki/myaso) | **main** integration target

## Truthful status, 2026-10-21

| Classification | Graphics 3C outcome |
| --- | --- |
| IMPLEMENTED | Deterministic Greyhaven ground details/cobblestones; bounded static lamps and warm pools; offscreen river geometry culling; existing World painter reused |
| TESTED | Original 17/17 focused tests, live interactive **offline** World preview on Windows Chrome 154 and X230i Linux Chromium 152; movement/zoom/E door and graphical evidence |
| INTEGRATION-READY | **NO** — missing exact-head mandatory CI, World #336 integration, 3A/3B compositor acceptance and true online multiplayer/GPU budget |
| INTEGRATED | **NO** — [draft Graphics 3C PR #419](https://github.com/tehki/myaso/pull/419) stacked on unmerged [World #336](https://github.com/tehki/myaso/pull/336) |
| PLAYABLE | **NOT PROVEN** — isolated World design preview is not a real shared multiplayer world |

The preserved implementation begins at commit `bf9d347fea0ba9cf9506d2abda8f0c3d9785b6be` and stays on `art/3c-greyhaven-ground-p2`. The earlier new-head protected CI [#39530782086](https://github.com/tehki/myaso/actions/runs/39530782086) **FAILED** the Combat/Core-owned M129 buffered-roll bound: observed 143 ms recovery-to-dodge delivery delay. Source contracts and strict Combat acceptance remain unchanged; the earlier 3C P2.6 quality [#39524848104](https://github.com/tehki/myaso/actions/runs/39524848104) had succeeded but does not certify a newer head.

## P0 contribution — protect existing multiplayer rendering contract

Before any alpha cosmetics or additional world expansion, **do not break the existing real online arena**. This PR adds `tests/graphics3c-first-playable-alpha-contract.test.mjs` to the existing mandatory Graphics quality step, with four non-invasive checks:

1. Extract and evaluate the **actual** `web/online-game.mjs` world flag Boolean under ten combinations. Require **off by default**, enabled only for `world=1` without a `scenario`, and off for any scenario including empty or known Combat scenarios.
2. Verify rendering order **exterior world → remote fighters → own fighter → HUD** and original World camera transform; no gameplay snapshot, action or hitbox modifications.
3. Require online mode to **not import or use local-preview portal navigation**. The Red Lion E transition remains a *local design preview*, not an authorized server zone transfer.
4. Exercise the true authored renderer's Canvas allocation under camera travel; at most **three new 512-unit tiles per draw**, at most **24 cached tiles**, and no independent timer/RAF loop.

These are **source-contract/unit tests, not a new online two-browser end-to-end test**. They catch accidental integration contract drift and support rollback via omitted flag/`world=0`; they do not prove collision, actor/roof occlusion, network stability, whole-game performance, or real 50–200 player capacity.

## Direct ownership and dependencies

**Graphics 3C owns:** cosmetic ground and street materials, light fixtures and shadows within existing deterministic World Canvas tiles; visual safety, stable scenery layout, culling, realistic performance disclosure; cross-browser evidence. For First Playable do **not** add dynamic weather, additional settlements, new caches, live interiors or client-side teleport.

**World / Core own:** stable fixed map, tile and camera contracts; actual shared player movement and replication; server-authoritative collision, combat, doors/zones and synchronized interiors (if included in alpha). World #336 is unmerged. Its current `&world=1` optional **exterior-only** renderer is the agreed seam until the Main Orchestrator replaces it.

**Graphics 3A owns:** player silhouettes, supported combat animation states, actual forward roll and animation atlas/memory budget. Draft [#472](https://github.com/tehki/myaso/pull/472) is an animation preview, not actual live-game appearance acceptance.

**Graphics 3B owns:** built Greyhaven/Red Lion facades, roofs, threshold overlays and authoritative actor/building visual-plane compositing. Draft [#479](https://github.com/tehki/myaso/pull/479) reports **Firefox source-only composite p95 37 ms**; this is not a 60 FPS acceptance.

**Combat/Core CI:** investigate protected M129 and provide **green shared exact-head CI**, without weakening thresholds. Main Orchestrator chooses integration order, shared candidate, staging and rollback.

## Next measurable P0 gate

Run the endorsed World+Core+Combat+Graphics A/B staging candidate in **two independent browsers** (Chrome and Firefox; ideally separate Windows/Linux machines), with at least two real networked players and identical scenarios, comparing `world=0` rollback to `world=1` authored exterior on the same locked build. Preserve authenticated server traces and actual browser screenshots/frame-time samples. Demonstrate player movement, combat visibility, roll/death/respawn, clear silhouette/terrain separation, world cache stability, actor occlusion and readable combat HUD. Reject any missing authoritative behavior or frame-time regression.

The Main Orchestrator must provide the exact shared candidate and coordinated merge/rollout decision; Graphics 3C will produce the visual/performance acceptance evidence, not deploy or bypass server ownership.

**Hold:** Draft [#419](https://github.com/tehki/myaso/pull/419) remains unmerged and undeployed. Advanced atmosphere is P2 until the First Playable P0 gates pass.
