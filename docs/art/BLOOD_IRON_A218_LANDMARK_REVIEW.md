# Blood & Iron A2.18 — Persistent foot-region landmarks for visual review

**Status:** repeatable artist-review candidate landmarks on the original A3 rigged meshes, **NOT** certified outsole, contact, collision or gameplay pivot. No original model or sprite changes.

## Why this milestone

A2.14 showed that the currently lowest skin-weighted foot vertex is not a stable vertex ID through the shoulder roll. A2.15 found no dedicated boot-sole material or group. A2.16/A2.17 showed that mesh-index connectivity fragments the imported GLB, while grouping identical rest-position coordinates reunites both feet inside shared connected components. None of these methods can safely identify independent soles.

A2.18 takes a **non-destructive, fixed-ID review approach**: choose one *heel-side* and one *toe-side* candidate from the foot-weighted mesh **once at source A3 frame 1** for each foot, then follow exactly those original vertex indices through all eight original A3 frames and all eight sprite-camera directions.

These are stable **vertex identities**, not necessarily stable *physical contacts*, and they are not verified anatomical heel or sole surfaces.

## Reproducible geometric selection

The read-only Blender 4.5.14 LTS source script is `tools/art/measure_knight_a218_landmarks.py`:

1. Import the original owner-local Silver Knight or T1 Sentinel A3 GLB with 60 FPS configured before import, verify the 22-bone rig and unaltered `roll` action, and isolate its one armature-skinned mesh.
2. For each foot, collect original mesh vertices with at least **0.35 combined Mixamo Foot/ToeBase skinning weight**, matching the earlier A2.13 study. The selection may include boot, armor or other foot-influenced geometry.
3. At **frame 1**, form a longitudinal **XY-only** candidate axis from that foot's `Foot.head` toward `ToeBase.head` in the original evaluated Blender scene. Calculate each selected vertex's projection along that axis. This is a **heuristic**, not a verified boot-longitudinal anatomical measurement.
4. Select the **lowest Z** vertex from the bottom 25% of axis projections as a *heel-side* review candidate, and independently from the top 25% as a *toe-side* candidate. Never weld, reorder, recolor or re-save the source mesh.
5. Track those four fixed original vertex IDs through eight original source roll frames **(1,3,5,7,9,11,15,22)**. Project their deformed positions through the exact original 160×160 / 1.66 ortho A3 sprite cameras for eight directions (T1 original camera height +0.67), and map to approved 120% `134×134` destination offset `(-67,-78)` relative to the unchanged game fighter center.

## Actual A3 source measurements

| Original GLB | Left heel-side | Left toe-side | Right heel-side | Right toe-side |
|---|---:|---:|---:|---:|
| Silver Knight | 71894 | 71908 | 22498 | 22501 |
| T1 Sentinel | 6073 | 192 | 21619 | 14705 |

These numbers are reproducible **source mesh vertex indices at frame 1**, maintained across all 8 roll phases. They **are not physical contact point IDs**. Camera projections contain 64 frame/direction records per model, each with four candidate pixels.

The read-only `tools/art/review_knight_a218_landmarks.py` copies original genuine A3 WebP atlas frames into separately annotated two-row PNGs for SOUTH and EAST. Circle legend: turquoise = left heel-side, green = left toe-side, gold = right heel-side, rose = right toe-side; pink cross = existing fighter visual center.

For the reviewed 2×8 source atlas frames **64/64 projected markers per knight lie within three pixels of an alpha≥32 source pixel** (and all 64 are inside the atlas frame). This is only a rough check that candidate geometry projects near a visible rendered surface. It does not identify a sole, prove ground support, rule out armor or guarantee reliable camera anchoring when inserted into a real world.

## Inspect and reproduce

On the authorized Windows workstation, using owner-local source GLBs (never copy them to the public repo):

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$root = "C:\Users\ilyav\Documents\myaso-blender45-work"

& $blender --background --factory-startup --python tools/art/measure_knight_a218_landmarks.py -- --source "$root\silver-knight-roll-A3.glb" --clip silver_roll --output web/assets/knights/a218-review/silver_roll_a218_landmarks.json

& $blender --background --factory-startup --python tools/art/measure_knight_a218_landmarks.py -- --source "$root\t1-sentinel-roll-A3.glb" --clip t1_roll --output web/assets/knights/a218-review/t1_roll_a218_landmarks.json
```

Then render **separate review overlays only**, never overwrite the original WebPs:

```powershell
python tools/art/review_knight_a218_landmarks.py --atlas web/assets/knights/silver_roll.webp --report web/assets/knights/a218-review/silver_roll_a218_landmarks.json --output web/assets/knights/a218-review/silver_roll_a218_overlay.png --qa web/assets/knights/a218-review/silver_roll_a218_overlay_report.json
```

Repeat for T1. Regression test: `node --test tests/knight-foot-a218.test.mjs`. Original GLB SHA-256 and all source landmarks, world coordinates and camera projections are documented in the JSONs and checked against prior A2.17 provenance.

## Review acceptance gate (not yet met)

- An artist must inspect both source rigs and the annotated candidate markers in multiple views and frames, specifically checking whether each point is on **the boot outsole rather than metal armor, fabric, unshod ankle, or a decorative object**. The current algorithm cannot answer that.
- Mark independently validated anatomical sole/heel/toe surfaces (or named reviewed vertex IDs) in *copies* of editable Blender source if the owner approves an art edit. No conversion to physics offsets from this report.
- Establish an actual authoritative world-floor transform and cross-check the original A3 hand/shoulder/foot contact phases. The frame-1 lowest foot-region mesh plane used in A2.13 remains a non-authoritative model-relative proxy.
- Verify real multiplayer display in the opt-in knight renderer and alignment to the flat XY game projection. Red Lion's cinematic 3/4 view in separate draft graphics PR #350 is not yet game-world registered; dynamic roof occlusion and browser FPS/VRAM remain unverified.

Keep **120% owner-approved visual scale** (96px standing/134px roll), the `&knights=1&knightScale=100` rollback, full 350ms A3 visual animation, authoritative 170ms active + 180ms recovery, network, collision, hitboxes and original art unaffected. Leave PR #326 open and do not merge or deploy without required current-base exact-head CI and separate production authorization.
