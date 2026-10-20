# Blood & Iron A2.19 — Original-GLB 3D boot-region landmark inspection

**Result: improved original-source 3D inspection evidence; no anatomical outsole approval or player-ground correction.**

This milestone uses the owner's original Silver Knight and T1 Sentinel A3 GLBs, not generic illustrations or generated replacement sprite art. The prior A2.18 four fixed vertex IDs per model are now evaluated on the actual deforming skinned source mesh and inspected at three distinct poses from three camera angles. The original GLBs, Blender sources, WebP atlases, game code, server, physics, network and A3 animation timing remain unchanged.

## Actual methods

Using Blender **4.5.14 LTS** in background mode, new read-only script `tools/art/inspect_knight_a219_source_landmarks.py`:

1. Verifies **SHA-256** against the A2.18 original-GLB source report. Imports the 22-bone original GLB after setting **60 FPS**, assigns the original `roll` action, mutes NLA tracks and uses the single armature-skinned mesh.
2. Samples original action source frames **1, 7 and 22** with all four unchanged source vertex IDs (heel-side and toe-side candidates, left and right).
3. Measures the actual **evaluated mesh vertex normal** in Blender world coordinates using the inverse-transpose of the original mesh object's matrix, and each evaluated source vertex's world XYZ. The world Z axis is the **source-model coordinate axis**, *not independently calibrated authoritative game floor*.
4. Produces **nine** real Blender Workbench studio renders for each original GLB: three frames × front, side and low-angle camera views, with four temporary colored marker spheres at the actual evaluated vertex positions. It does not save the temporary Blender scene or a modified model.
5. `tools/art/assemble_knight_a219_review.py` assembles the nine source render images into a separate annotated **2032×1687 PNG review sheet**, one per model. All nine individual renders can be regenerated, and are kept as local raw evidence rather than adding 18 intermediate PNG files to the GitHub PR.

## Measurements

| Original source model | Frame 1 vertex normal dot(source Z), four candidates | Mid-roll frame 7 dot(source Z) | Frame 22 |
|---|---|---|---|
| Silver Knight | −0.671, −0.938, −0.865, −0.734 | +0.459, +0.613, +0.738, +0.433 | Same as frame 1 |
| T1 Sentinel | −0.997, −0.996, −0.997, −1.000 | +0.936, +0.922, +0.970, +0.937 | Same as frame 1 |

All four selected surface normals on each model point generally *downward in source-model Z* at initial standing pose, rotate upward at mid-roll, and recover their initial orientation by frame 22. This confirms the selected mesh surfaces rotate with the A3 character, and offers **stronger visually reviewable underside orientation evidence** than alpha proximity alone.

**This is NOT anatomical outsole identification or floor-contact validation.** A downward normal can belong to undersides of leg armor, clothing or other geometry. Vertex normals can be smoothed/shading-dependent, and Workbench mesh colors do not distinguish materials. The source floor transform, actual shoe sole faces, game collision floor, rolling shoulder/hand contacts and server-side ground height were not measured. Marker spheres are visible overlays, not part of original assets.

## Output and acceptance

- `web/assets/knights/a219-review/silver_roll_a219_review_sheet.png`: nine real source-model closeups, 3 frames × 3 views, annotated with the four candidate positions.
- `web/assets/knights/a219-review/t1_roll_a219_review_sheet.png`: same for original T1 Sentinel source.
- `web/assets/knights/a219-review/*_a219_normals.json`: original-source SHA-256, evaluated normal/position data, flags explicitly disallowing outsole/gameplay contact claims.
- `web/assets/knights/a219-review/*_a219_sheet_report.json`: the full list and byte sizes of nine raw render inputs, output dimensions, and explicit review-only safeguards.
- `tests/knight-foot-a219-review.test.mjs`: exact original-source provenance, 3-frame sign changes, unchanged source IDs and sprites, saved PNG dimensions and non-production flags.

## Reproduce on the authorized Windows workstation

Use an unmodified PR #326 worktree (or detached checkout of the PR head) plus the original locally held GLBs. From repo root:

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$assets = "C:\Users\ilyav\Documents\myaso-blender45-work"

& $blender --background --factory-startup --python tools/art/inspect_knight_a219_source_landmarks.py -- --source "$assets\silver-knight-roll-A3.glb" --clip silver_roll --a218 web/assets/knights/a218-review/silver_roll_a218_landmarks.json --outdir web/assets/knights/a219-review

python tools/art/assemble_knight_a219_review.py --clip silver_roll --source-dir web/assets/knights/a219-review --output web/assets/knights/a219-review/silver_roll_a219_review_sheet.png --qa web/assets/knights/a219-review/silver_roll_a219_sheet_report.json
```

Repeat with `t1-sentinel-roll-A3.glb` and `--clip t1_roll`. No original rig or scene is overwritten. Run the focused tests:

```powershell
node --test tests/knight-sprites.test.mjs tests/knight-scale-a211.test.mjs tests/knight-foot-a212.test.mjs tests/knight-foot-a213.test.mjs tests/knight-foot-a214-scoping.test.mjs tests/knight-foot-a215.test.mjs tests/knight-foot-a216.test.mjs tests/knight-foot-a217-seams.test.mjs tests/knight-foot-a218.test.mjs tests/knight-foot-a219-review.test.mjs
```

## Next decision: still a manual art approval gate

An artist/owner must verify exact boot outsole face association and judge candidate placement across front/side/low views; **A2.19 does not claim this approval has happened**. After genuine outsole review, establish independently trustworthy game-floor and body-contact references at each roll phase. The game remains a flat-world XY authoritative simulation; the cinematic Red Lion 3/4 building art in separate draft graphics PR #350 does not yet align with those world coordinates.

Keep the owner-selected **120% opt-in draw scale** (96px standing, 134px A3 roll), its `&knightScale=100` rollback, 350ms animation, 170ms active/180ms recovery, original GLBs, source WebPs, combat, collider and multiplayer server unchanged. Both PRs remain unmerged. Required exact-head CI must pass against a current base, and production needs separate explicit authorization.
