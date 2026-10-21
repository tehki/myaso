# Blood & Iron A2.13 — evaluated skinned foot-region geometry

**Status: measured art QA, not collision, floor-contact or production approval.**

## Scope and method

After A2.12 showed that bone endpoints do not reliably correspond to the visible boot, A2.13 measures original owner-local Silver and T1 A3 source GLBs in Blender 4.5.14 LTS. The new script tools/art/measure_knight_a213_skinned_foot_geometry.py sets 60fps before glTF import, verifies the 22-bone Mixamo rig and original roll action, and selects original mesh vertices with at least 0.35 accumulated skinning weight on LeftFoot/LeftToeBase or RightFoot/RightToeBase. These are **weighted foot regions**, potentially including armor or cloth, not independently isolated shoe-sole geometry.

The armature-deformed vertices are evaluated at source frames 1,3,5,7,9,11,15,22. For each foot the script reports minimum and 10th-percentile region Z, identity of the lowest original vertex, and its world position. The lowest foot-region vertex in source frame 1 defines an *artificial within-model reference plane only*. A trustworthy environmental game-floor Z is not known from the GLB.

Original 160×160, scale-1.66 orthographic A3 sprite cameras (T1 vertical offset 0.67 model units) project each lowest deformed vertex for all eight directions into original atlas pixels and approved 120% 134×134 roll draw coordinates (-67,-78). Thus there are 64 direction/frame observations per model, without re-evaluating the geometry when only the camera changes.

The companion tools/art/review_knight_a213_mesh_contacts.py annotates two review-only atlas sheets, one per model, for south/east original frames. Green circles indicate the lowest evaluated foot-weighted mesh vertex, yellow the earlier A2.12 skeletal foot tail, and pink the unchanged fighter origin. Original production WebP sprites are not modified.

## Measurements

| Model | Source skinned mesh vertices | Left/right foot-weighted vertices | Source frame-1 foot minimum reference | Source frame-7 lowest foot vertices L/R |
| --- | ---: | ---: | ---: | ---: |
| Silver Knight | 105,847 | 3,318 / 3,390 | -0.51224 | +0.00584 / +0.01237 |
| T1 Sentinel | 101,687 | 8,508 / 8,245 | -0.03150 | +0.28457 / +0.37522 |

Near the middle of the roll, Silver feet rise about 0.518 / 0.525 source-model units above the frame-1 minimum reference; T1 rises about 0.316 / 0.407. These are **relative model-unit distances, not game-floor height**, and cannot authorize gravity, collisions or roll recovery changes.

On the south/east annotated source frames, all 32/32 lowest deformed foot-weighted mesh markers for each model lie within three pixels of an alpha>=32 sprite pixel. That is an image-location QA heuristic, **not a ground-contact accuracy score**. Earlier T1 skeletal tails achieved 26/32 near-opaque results, indicating why mesh and bone positions should not be conflated.

## Reproduction

Run original A3 local GLBs through Blender 4.5.14 background Python, using tools/art/measure_knight_a213_skinned_foot_geometry.py with --source, --clip and --output options. Use clips silver_roll and t1_roll. The generated original-source reports contain SHA-256 checksums. For actual atlas marker sheets, run tools/art/review_knight_a213_mesh_contacts.py using --atlas, --mesh-report, --joint-report, --output and --qa. Raw reports and overlays are in web/assets/knights/a213-review/; original GLBs and editable Blender files stay on the authorized workstation.

Run tests with:

    node --test tests/knight-sprites.test.mjs tests/knight-scale-a211.test.mjs tests/knight-foot-a212.test.mjs tests/knight-foot-a213.test.mjs

## Outstanding blockers

- Weighted foot vertices are not formally segmented boot-sole materials or toe/heel collision points. Contact from the hands, shoulder, armor or other body during forward roll remains unmeasured.
- The frame-1 foot-region minimum is not an authoritative ground-plane calibration. Model unit scales differ, and neither map floor collision nor portal authority is established.
- The cinematic Greyhaven Red Lion 3/4 camera in separate graphics PR #350 does not match the game's flat world-XY projection. Automatic roof occlusion and player alignment require additional proof.
- No real-network multiplayer, Chrome/Firefox/mobile FPS or decoded GPU memory measurements are supplied by this art study.
- Preserve selected 120% presentation (96px idle / 134px roll), 350ms A3 roll cycle, original GLBs, movement, hitboxes, network, server authority and all game physics. Do not adjust visual origins or physics based only on these metrics.
- Keep PR #326 unmerged until current-base exact-head quality is fully green and owner integration governance permits it; no production deploy without separate explicit authorization.
