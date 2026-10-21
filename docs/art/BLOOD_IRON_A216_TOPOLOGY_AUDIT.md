# Blood & Iron A2.16 — Boot-region mesh topology connectivity audit

**Status: original-source topology evidence complete; sole identification remains UNVERIFIED.**

The approved **120%** opt-in knight presentation (96px standing, 134px A3 rolling), exact original 350ms A3 animation and all authoritative combat/network/physics are unchanged. This milestone intentionally does not change any art or runtime rendering.

## Method

Blender 4.5.14 LTS background script `tools/art/audit_knight_a216_topology.py` imports the original owner-local Silver Knight and T1 Sentinel A3 GLBs. It requires the authentic skinned character mesh, builds a union-find over **imported vertex indices and authored mesh edges**, and counts connected components. To relate those graph components to known rig groups, it collects vertices with at least 0.35 summed LeftFoot/LeftToeBase or RightFoot/RightToeBase skin weight (same selection rule as A2.13).

The report includes original GLB SHA-256, original polygon/edge/vertex counts, ten largest connected components, foot-bearing component summaries, foot-vertex concentration in the largest component and explicit safety boundaries. Analysis only writes standalone JSON files under `web/assets/knights/a216-review`.

## Verified results

| Original A3 GLB | Silver Knight | T1 Sentinel |
|---|---:|---:|
| Skinned vertices | 105,847 | 101,687 |
| Edges | 195,064 | 249,720 |
| Polygons | 98,787 | 149,880 |
| Connected components by imported vertex index | **9,658** | **2,057** |
| Components containing any foot-weighted vertices | **673** | **348** |
| Components containing left-foot weighted vertices | 343 | 174 |
| Components containing right-foot weighted vertices | 340 | 174 |
| Largest component in the entire mesh (vertices) | 550 | 921 |
| Largest single-component share of left-foot weighted vertices | **2.65%** | **4.20%** |
| Largest single-component share of right-foot weighted vertices | **2.74%** | **3.76%** |

**Decision: strict vertex-index-connected components cannot directly isolate a boot sole for either model.** The original source as imported in Blender is highly fragmented. The graph counts can be inflated by GLB indexing/duplicate vertices, shading seams, UV seams and unjoined authored surfaces. They are not evidence of hundreds of separate physical anatomical pieces. Connecting vertices that happen to occupy the same space is also not guaranteed to restore anatomical semantics; separate armor, cloth and skin may overlap. No topological component is automatically labeled as a sole.

A2.15 already verified that neither rig has a distinct boot-sole material or semantic group. A2.14 showed that the lowest weighted foot vertex switches repeatedly through the roll. These together make automatic permanent contact anchoring unjustified.

## Reproduction and acceptance

On the authorized Windows workstation with Blender 4.5.14 LTS and owner-local A3 source GLBs, from the knight PR #326 checkout:

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$root = "C:\Users\ilyav\Documents\myaso-blender45-work"

& $blender --background --factory-startup --python tools/art/audit_knight_a216_topology.py -- --source "$root\silver-knight-roll-A3.glb" --clip silver_roll --output web/assets/knights/a216-review/silver_roll_a216_topology.json
& $blender --background --factory-startup --python tools/art/audit_knight_a216_topology.py -- --source "$root\t1-sentinel-roll-A3.glb" --clip t1_roll --output web/assets/knights/a216-review/t1_roll_a216_topology.json

node --test tests/knight-foot-a216.test.mjs
```

The report JSONs preserve source hashes and the exact 0.35 skin-weight threshold for reproducibility. The source GLBs and editable Blender projects remain only on the authorized Windows workstation. No commercial third-party assets or new images have been introduced.

## Next safe steps, not yet performed

1. Inspect physical boot surfaces with an *explicitly reviewed* UV/texture/geometry seam map or artist-confirmed mesh face/vertex annotations. Spatial vertex welding may help diagnose GLB seam duplication, but cannot establish sole identity on its own.
2. Define reliable collision-space floor and foot/shoulder/hand contact references for each A3 phase. The frame-1 source-foot min-Z from A2.13 is **not** the server's floor.
3. Compare actual opt-in multiplayer knight feet and doors only after resolving draft graphics PR #350's cinematic 3/4 artwork vs flat server-XY projection. Measure real browser performance and visual depth sorting.

**Do not** use topology-island IDs, minimum vertex Z, bone tails or image alpha bounds as authoritative fighter pivots. Owner's 120% rendering remains opt-in; preserve `&knights=1&knightScale=100` rollback, original A3 170ms+180ms authoritative timing and all network/physics/gameplay. No PR merge or production deployment without current-base exact-head CI and separate authorization.
