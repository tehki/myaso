# Blood & Iron A2.21 — First source-authentic game-XY 2.5D Red Lion prototype

**Status:** offline graphics prototype, Chrome-verifiable; **not a finished art direction, server portal or deployable runtime building**.

## Why we stopped investigating boots

The owner chose to end the lengthy anatomical foot/sole work and redirect attention to playable medieval graphics. A2.20 confirmed that the exact game's `projectArenaPoint` projection agrees with calibrated overhead ground, but a visually rich 3/4-view Red Lion does not: at (+120,−80) game-world units, the cinematic ground projects about 270.766px away from actual game XY. Simply attaching those oblique sprites to a door location would misrepresent the movement geometry.

A2.21 investigates an art-only alternative: **retain original Red Lion timber, limestone, doors, windows and clay roof source geometry, preserve exact ground XY, and visually lift only elevated geometry into a vertically illustrated 2.5D image**.

## Source and transparent art layers

Original Blender 4.5.14 LTS owner-authored `blood_iron_greyhaven_a22.blend` is loaded but never saved. Reproducible `tools/art/render_greyhaven_a221_xy_elevation.py` reads the original game camera zoom **0.84** from `src/browser/arena-viewport.mjs`, along with the existing art-manifest conversion **0.025 authored meters per game unit**. A fixed vertical orthographic camera uses **33.6 px per authored meter**. For original Red Lion mesh points `(x,y,z)`, preview-only in-memory elevation uses:

`x' = x; y' = y − 0.85 × max(z,0); z' = 0.05 × z`.

This is a **visual distortion by design**, not a new game 3D projection. At original ground height `z=0`, X/Y remain strictly unchanged. The decorative rise for one source unit of height is −28.56 screen pixels. The geometry is reprojected inside Blender **only for this offline render**; original .blend/GLB, 120% knight sprites, world data and runtime sources are untouched.

**Measured from the actual bake:** 17 original Red Lion mesh objects, 4,318 source vertices processed, **12 ground-level vertices with zero XY drift**, exact XY basis about +33.600006 px per source meter in both axes; separate **13 base** and **3 roof** visible source-mesh rendering groups. The selected art-only door is visually centered on (320,320) in the 640×640 source image. The proposed game door `(4365,4075)` remains *non-authoritative* and is **not enabled as a server portal**.

`tools/art/encode_greyhaven_a221_xy_elevation.py` flips the PNG vertically to match game +Y-down, crops the base/roof independently and emits **lossless alpha WebPs**, with exact 640×640 RGBA roundtrip restoration. The base is 45,846 bytes and roof 41,788 bytes in this initial prototype; both can be drawn at documented offsets relative to the **visual-only** door center.

## Actual browser review

`web/greyhaven-a221-2p5d.html` is an isolated two-panel visual review comparing original source Red Lion in the new XY-grounded 2.5D bake vs original A2.6 cinematic 3/4 bake. `web/greyhaven-a221-2p5d.mjs` draws the same real approved 120% Silver Knight/ Sentinel frames sourced from **independent** unmerged knight PR #326 (exact companion head `c74fcf90e227f3bc4788728f000cfe6aa083c7ef`), and uses exactly the same `projectArenaPoint` for both panels. It supports coordinate offsets, visual roof opacity and diagnostic XY divergence.

The Chrome 154 acceptance harness `tools/art/verify_greyhaven_a221_browser.mjs` serves only allowlisted companion knight WebPs over localhost, without copying binaries into graphics PR #350. Three original-browser screenshots and a JSON report are committed in `assets/environment/greyhaven/a221-review`, including standing 96px, A3 134px roll and a large XY walk offset.

| Relative offset from proposed visual door | New A2.21 2.5D ground mismatch | Old A2.6 oblique mismatch |
| --- | ---: | ---: |
| (0,0) game units | 0 px | 0 px (single shared door pivot) |
| (+120, −80) game units | **0.000022 px** | **270.766 px** |

**Three Chrome screenshots, zero page/network errors.** These demonstrate coordinate-basis compatibility of the artistic image, **not** that the client or authoritative server has an active entrance, collision, depth ordering or actual multiplayer acceptance.

## Art direction assessment

The prototype has a recognizable timber-framed facade and visually separate clay roof, but **the roof and elevation are still too tall/flat compared with the stronger original cinematic A2.6 composition**. Do not mark this as visually approved for production. It is a useful test proving XY-correct visual elevation is possible without returning to the bare overhead-only building.

The follow-on graphic task is to refine roof proportions, visible gables, wall shadows, layered foreground occlusion and doorway relief **while preserving a fixed game-XY ground basis and author-verified door/step anchors**. Avoid treating the entire visual raster as a walkable/collidable floor. The server/world departments remain responsible for actual portals, zoning, building footprints, collisions and ownership.

## Reproduction

On the authorized connected Windows machine with Blender 4.5.14 LTS, original A2.2 Blender scene and the graphics PR #350 checkout:

1. `blender --background --factory-startup --python tools/art/render_greyhaven_a221_xy_elevation.py -- --scene <original A2.2 .blend> --manifest assets/environment/greyhaven/art-manifest.v1.json --viewport-source src/browser/arena-viewport.mjs --outdir <review directory> --pixels 640 --samples 4 --height-lift 0.85`
2. `python tools/art/encode_greyhaven_a221_xy_elevation.py --in-dir <review directory>`
3. With a separate PR #326 checkout pinned to the exact source head, use `node tools/art/verify_greyhaven_a221_browser.mjs <knight checkout> <browser evidence directory>`.
4. Verify evidence with `node --test tests/art-direction-a221-elevated-world-xy.test.mjs` and the preceding A2 graphic regressions.

No server, core, physics, combat, input, hitbox, A3 animation, original GLB, original Blender scene or knight WebP was changed. The 120% knight (96px standing, 134px A3 roll) remains opt-in and reversible. **No merge or production deployment**; A2.21 stays in draft graphics PR #350 until the art and runtime acceptance gates are passed with required exact-head CI against current main.
