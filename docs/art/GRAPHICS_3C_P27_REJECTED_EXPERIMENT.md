# Graphics 3C P2.7 — Rejected wall-culling experiment

2026-10-21 · Draft-only regression investigation for myaso.io, not an approval for integration.

**Outcome:** Reverted. The P2.7 experiment [commit 8d748190acd8cbcbcf528ea488a75d45e3b4df27](https://github.com/tehki/myaso/commit/8d748190acd8cbcbcf528ea488a75d45e3b4df27) conservatively culled off-tile Greyhaven wall spans and corner towers. It preserved original wall coordinates, gates, Canvas stroke state and all other authored geometry. It was compared to the pinned P2.6 revision `cf648a39aaa6309735233c791c273d4ee091215d` using separate localhost checkouts. **Do not reinstate this code without stronger performance evidence.**

## Visual and correctness

Windows Chrome 154 and Linux X230i Chromium 152, software Canvas, 960×600, 16 views per host, including Red Lion, Greyhaven city walls, both gates, northern corner, bridge/river, other settlements, groves and wilderness: **16/16 RGBA pixel hashes identical** on each host. The original P2.7 Windows screenshots and raw Chrome test report remain recoverable at its exact rejected commit under `assets/environment/greyhaven/3c-p27-review/`. Linux screenshots and the raw benchmark file remain in the isolated X230i working checkout, not deployed.

P2.7 local focused World/Graphics tests **18/18 passed** on Windows and X230i. The restored P2.6 renderer is expected to return the original 17 tests (the P2.7-specific test was removed by the revert).

## Real browser performance: no reproducible acceptance

Four offline world.draw camera routes, including a deliberately synthetic rapid tile-hop stress case. Three alternating A/B trials per version, **1,728 Canvas draw calls per version per host**. A draw over 16.7 ms is treated as over budget; this is not full game FPS.

| Hardware / browser | P2.6 over-budget calls | P2.7 over-budget calls |
| --- | ---: | ---: |
| Windows i7-2700K, Chrome 154 GPU disabled | 9 | 9 |
| Linux X230i i3-2370M, Chromium 152 GPU disabled | 18 | 34 |

The X230i experiment also showed unrelated grove samples slower on the candidate run, so machine load likely contributed to noisy timings. **No causation is established**, but there is no demonstrated cross-machine speed benefit. The experimental code is therefore not accepted, even though its screenshot parity passed.

The rejected experiment's raw Windows JSON is available from the pinned 8d74819 commit as `assets/environment/greyhaven/3c-p27-review/p25_moving_camera_benchmark.json`. The X230i JSON was generated locally in `assets/environment/greyhaven/3c-p27-x230i-review/p25_moving_camera_benchmark.json` on the authorized X230i; it was not represented as a published GitHub artifact.

## Protected CI and disposition

Exact P2.6 quality [run #39524848104](https://github.com/tehki/myaso/actions/runs/39524848104) **passed**. Exact P2.7 [run #39527730523](https://github.com/tehki/myaso/actions/runs/39527730523) **failed** the protected M194 guard-break browser acceptance at the nested M34 staging assertion (unblocked 34 HP). This is not proof that visual-only culling caused the Combat failure. No Combat test, assertion, physics, server-authoritative state or player input was edited.

Revert commit restores exact P2.6 source while retaining Git audit history; new protected CI is required at the new branch head. PR #419 remains draft, stacked on unmerged World #336. Integration remains **HOLD** pending current exact-head CI, whole-game frame/GPU budget, and Graphics 3A characters + 3B Red Lion composite. No merge or deployment.
