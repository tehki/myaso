# Blood & Iron A2.12 — original A3 foot-joint projection

**Status: measured Blender/atlas study only. No game foot-pivot correction.**

## Method

We inspected the exact owner-authored A3 Silver Knight and T1 Sentinel GLB rigs from the authorized Windows workstation. The Blender 4.5.14 LTS script **tools/art/measure_knight_a212_foot_bones.py** sets 60 FPS *before* glTF import, checks the 22-bone Mixamo skeleton, evaluates its "roll" action at original frames 1, 3, 5, 7, 9, 11, 15 and 22, and recreates the original **160×160, scale-1.66 orthographic camera**, for all eight directions. T1 uses the original bake camera's +0.67m vertical offset.

The left and right real foot-bone head/tail endpoints are projected into source-atlas pixels and the owner-approved **134×134 A3 roll sprite draw rectangle positioned at (−67,−78)** relative to the unchanged fighter world origin. Each report contains **64 poses and 128 foot-tail positions** and the source GLB's SHA-256.

The second script **tools/art/review_knight_a212_foot_bones.py** adds markers to separately generated 2-row art-review PNGs (south and east directions). Cyan marks foot-bone *heads*, yellow marks *tails*, pink is the unchanged fighter origin. The original atlas pixels and original owner-supplied GLB/Blender projects are not modified or re-committed. This is an annotated copy, never an exported replacement game sprite.

## Results

| Measurement | Silver Knight A3 | T1 Sentinel A3 |
| --- | ---: | ---: |
| Blender pose projections | 64 | 64 |
| Tail Y offsets from unchanged fighter center, all 64 poses | −44.8 to +43.7px | −18.6 to +46.3px |
| Tail landmarks within 3px of visible (alpha≥32) atlas pixels, south/east | 32 / 32 | 26 / 32 |
| Approved visual roll | 134×134 at (−67,−78) | same |

**Important:** 26/32 is not a ground contact score, and the 32/32 Silver metric does not prove proper feet. These results only check whether one projected rig point falls near a visible pixel. The T1 disparity may reflect boot/mesh shape, viewing angle or rig/bake conventions and needs diagnosis. The 3D foot bone head/tail is **not the boot sole or ankle/heel ground contact position**. Rolling characters can contact ground by shoulder/hand rather than feet; a single flat "foot Y" cannot correctly define every roll phase.

## Reproduction

Run on the authorized Blender workstation with owner-local source assets, not from downloads or external commercial libraries:

    blender --background --factory-startup --python tools/art/measure_knight_a212_foot_bones.py -- --source /local/silver-knight-roll-A3.glb --clip silver_roll --output /tmp/silver_roll_a212_foot_report.json

    blender --background --factory-startup --python tools/art/measure_knight_a212_foot_bones.py -- --source /local/t1-sentinel-roll-A3.glb --clip t1_roll --output /tmp/t1_roll_a212_foot_report.json

Then use Pillow for the read-only atlas annotation (repeat per clip):

    python tools/art/review_knight_a212_foot_bones.py --atlas web/assets/knights/silver_roll.webp --report /tmp/silver_roll_a212_foot_report.json --output /tmp/silver_roll_a212_foot_joint_overlay.png --qa /tmp/silver_roll_a212_overlay_report.json

Reports and original-asset-derived *review-only overlays* are committed under **web/assets/knights/a212-review**. The original owner GLBs and .blend sources stay on the connected Windows workstation. The visual A3 source WebP textures are unchanged, and no other commercial asset has been introduced.

## Unresolved acceptance gates

1. Measure skinned boot **mesh sole vertices** and contact with a reliable floor under each roll pose, not only foot bones. The world-center origin may differ from foot or ground.
2. Check source camera optical projection against the current browser flat game XY and real door/portal anchors; Red Lion 3/4 art in graphics PR #350 still cannot be activated as an aligned multiplayer object.
3. Test actual opt-in knight renderer in a real networked multiplayer scene with authoritative actors and dynamic roof occlusion; evaluate Chrome/Firefox/mobile FPS and decoded texture memory.
4. Do not change the owner's approved 120% sprite scale, 350ms A3 visual roll, combat i-frames/collision, world coordinates, server authority or original textures based solely on this study.
5. Leave PR #326 unmerged until required exact-head quality green against an up-to-date base and project governance. No production deploy without separate authorization.
