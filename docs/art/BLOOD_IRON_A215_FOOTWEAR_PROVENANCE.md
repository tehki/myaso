# Blood & Iron A2.15 — Original A3 footwear semantic-provenance gate

**Status: source audit complete; anatomical boot-sole/ground-contact validation BLOCKED.**

## Why A2.15 stops short of a physical contact claim

A2.12 verified Mixamo Foot/ToeBase joint trajectories. A2.13 sampled the deformed *foot-weighted region* of the original meshes, and A2.14 showed that the identity of their lowest vertex changes several times through the approved shoulder roll. Those facts do not establish a fixed anatomical shoe sole or ground-contact plane.

The owner-local A3 GLB files were re-imported with Blender **4.5.14 LTS**. New read-only source audit `tools/art/audit_knight_a215_footwear_provenance.py` enumerates actual mesh objects, polygon material assignments and rig vertex-group names, recording original GLB SHA-256 values.

| Authored GLB | Skinned character mesh | Skinned vertices | Polygons | Skinned materials | Named outsole/boot-sole group or material |
| --- | --- | ---: | ---: | --- | --- |
| Silver Knight A3 | `geometry_0` | 105,847 | 98,787 | `Material_0` (all polygons) | **No** |
| T1 Sentinel A3 | `material` | 101,687 | 149,880 | `Material.001` (all polygons) | **No** |

Both source rigs *do* provide `mixamorig:LeftFoot`, `mixamorig:RightFoot` and ToeBase skinning groups. Those contain general foot-influenced surfaces, not an explicitly isolated boot outsole. The non-skinned Cube and Icosphere objects do not provide a footwear distinction.

**Engineering decision:** do not split the sole by the single material (that material covers the whole skinned mesh). Do not infer heel/toe sole contacts from lowest weighted-vertex Z or alpha silhouettes. Neither the boot sole nor the arena collision floor has been established. A future mesh-topology/UV/semantic segmentation study *could* identify a genuine outsole, but it requires explicit geometric validation.

## Reproduce and test

Run from a checkout of PR #326 on the authorized Windows Blender workstation:

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$source = "C:\Users\ilyav\Documents\myaso-blender45-work\silver-knight-roll-A3.glb"
& $blender --background --factory-startup --python tools/art/audit_knight_a215_footwear_provenance.py -- --source $source --output web/assets/knights/a215-review/silver-knight-a215-provenance.json
```

Repeat with T1 source and corresponding output path. Re-running overwrites *only the generated report*, not the source model. Then:

```powershell
node --test tests/knight-sprites.test.mjs tests/knight-scale-a211.test.mjs tests/knight-foot-a212.test.mjs tests/knight-foot-a213.test.mjs tests/knight-foot-a214-scoping.test.mjs tests/knight-foot-a215.test.mjs
```

Reports are kept under `web/assets/knights/a215-review/` with original source SHA-256. No source GLB, Blender project, WebP, gameplay asset or animation was changed.

## Next safe acceptance criteria

An artist or a reproducible validated geometry-processing tool must first **identify the underside boot vertices/faces by actual 3D topology and footwear boundaries**. Assign explicit, reviewable boot-sole attributes or surface provenance, with comparable evidence for both models. Independently establish the world floor/contact transform and verify foot/shoulder/hand contacts during rolling phases; then test opt-in sprites in the real multiplayer browser, across door/roof projections.

Do **not** alter authoritative fighter center, hitboxes, collision, roll timing (170ms + 180ms), A3 visual 350ms duration, networking or production deployment from these material findings. Preserve the owner's chosen **120%** sprite presentation (96px standing / 134px roll), 100% rollback and default-disabled `knights=1` opt-in. PR #326 is unmerged and based on an older `main`; exact-head CI, current base and separate release authorization remain mandatory.
