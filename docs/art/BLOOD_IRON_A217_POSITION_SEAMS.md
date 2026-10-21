# Blood & Iron A2.17 — Original A3 mesh seam-equivalence diagnostic

**Status: source-mesh evidence complete; boot-sole selection and ground-contact validation remain blocked.**

## Scope and exact method

Continuing the owner-approved 120% knight sprite program from A2.16, this stage inspects the **original Silver Knight and T1 Sentinel A3 GLBs** using Blender 4.5.14 LTS in background, read-only mode. No original GLB/.blend, atlas WebP, texture, actor sprite pivot or game/runtime files are modified.

The reproducible script `tools/art/audit_knight_a217_position_seams.py` rebuilds the original **vertex-index/edge** connected-component union from A2.16, then creates two different **hypothetical, in-memory** union-find groupings without altering vertex positions:

1. **Exact imported rest-position equivalence:** indexes at numerically identical local-space (x,y,z) are treated as coincident even if their authored vertex IDs differ.
2. **Rounded five-decimal rest-position equivalence:** vertices with the same rounded-to-5-decimals local XYZ are grouped. This is deliberately *not* a true Euclidean distance/epsilon-neighborhood test; rounding boundaries can separate close vertices or group diagonally different vertices.

The audit also repeats A2.13's source foot-region criterion (sum of Mixamo Foot/ToeBase skinning weights at least 0.35), and measures whether hypothetical components contain left/right foot-weighted mesh vertices. Source GLB SHA-256 and source-mesh sizes are preserved in machine-readable reports.

## Verified results

| Source-mesh statistic | Silver Knight A3 | T1 Sentinel A3 |
| --- | ---: | ---: |
| Original vertex-index/edge components | 9,658 | 2,057 |
| Exact-coordinate union components (hypothetical) | **23** | **1** |
| Rounded-5-decimal union components (hypothetical) | **23** | **1** |
| Groups with duplicated position indices | 35,963 | 22,879 |
| Duplicated indices beyond first per position | **57,834** | **26,827** |
| Duplicate-position groups spanning distinct original index-components | **35,945** | **22,879** |
| Components containing both left and right foot-weighted vertices after union | **1** | **1** |
| Left/right foot-weighted vertices in shared component | 3,318 / 3,390 | 8,508 / 8,245 |

The dramatic component-count drop establishes that duplicated **imported vertex positions** account for much of the earlier A2.16 component fragmentation. The exact and rounded methods coincide on both source assets; no additional near-coordinate grouping was observed under the chosen rounded-5-decimal bins.

**Crucial limitation:** this does *not* identify separate shoes or soles. For Silver, all 3,318 left-foot and 3,390 right-foot weighted vertices join the same connected component after the hypothetical grouping. For T1, the entire source skinned mesh becomes a single component. A connected body mesh often spans both feet naturally; the shared component does not itself prove an erroneous cross-foot weld. The result is simply unusable for identifying anatomical boot soles. Spatially coincident armor, fabric, and skin can also be unrelated surfaces—automated welding may inadvertently merge them.

The previous A2.15 provenance audit found neither model carries an explicit sole material or semantic outsole group. A2.14 demonstrated shifting lowest weighted-foot vertex IDs as the A3 roll progresses. All three studies point to the need for **reviewed geometric sole segmentation or manually authored boot-sole landmarks**, not automatic pivot selection from mesh component IDs.

## Reproduce safely

From a checkout of knight PR #326 on the authorized Windows machine:

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$assets = "C:\Users\ilyav\Documents\myaso-blender45-work"

& $blender --background --factory-startup --python tools/art/audit_knight_a217_position_seams.py -- --source "$assets\silver-knight-roll-A3.glb" --clip silver_roll --output web/assets/knights/a217-review/silver_roll_a217_seams.json

& $blender --background --factory-startup --python tools/art/audit_knight_a217_position_seams.py -- --source "$assets\t1-sentinel-roll-A3.glb" --clip t1_roll --output web/assets/knights/a217-review/t1_roll_a217_seams.json

node --test tests/knight-foot-a217-seams.test.mjs
```

A full focused acceptance set also includes `tests/knight-sprites.test.mjs`, `tests/knight-scale-a211.test.mjs`, and `tests/knight-foot-a212` through `a216` tests. Results are pure JSON and do not create a replacement Blender file, geometry edit or atlas.

## Safe next milestone

Investigate **artist-reviewable local boot face boundaries** in Blender without welding the source, or add non-destructive named anatomical landmarks to *copies* of original rigs only after human visual review. Require a genuinely verified world floor plane and coherent shoulder/hand/sole contacts through the roll before approving sprite-foot/world pivots. An independently validated ground/door and 3/4-to-world XY strategy remains needed for Greyhaven/Red Lion in graphics PR #350.

Do **not** use hypothetical coordinate unions or global connected components as exact boot soles. Preserve owner-approved 120% knight presentation (**96px idle / 134px roll**), 100% rollback, authentic A3 **350ms** animation, authoritative 170ms roll plus 180ms recovery, combat hitboxes, server/network authority and original materials. Maintain separate knight PR #326 and graphics PR #350, no merge without current-base exact-head green required CI; no production deployment without separate explicit approval.
