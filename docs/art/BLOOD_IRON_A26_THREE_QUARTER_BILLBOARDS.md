# Blood & Iron A2.6 — per-building 3/4 billboard review

**Draft art only. No playable building sprites have been activated.**

## Intent

A2.4 mathematically proved that the full, skewed 3/4 Blender scene does not register against the flat game-XY canvas, with errors up to 80.9 pixels across the sample. A2.5 produced correct flat-XY camera exports, but their overhead view loses the medieval architecture and facades. A2.6 preserves the original Blood & Iron **3/4 visual camera angle** and exports separate wall/base and roof layers from **each individual building**. These 3/4 sprites can be explored as future *anchored visual billboards*, independently of authoritative map/portal logic.

**This is a representation study, not a resolved projection mismatch**: a billboard may be placed at one agreed ground pivot, but moving by another game-world meter still does not follow the Blender camera's tilted 2D basis. The script reports this mismatch explicitly and fails if it unexpectedly claims to be matched. Door anchors are visual XY only, not authoritative player collision positions.

## Reproducible source and output

Blender 4.5.14 LTS, CPU Cycles, no third-party textures:

    blender --background --factory-startup --python tools/art/render_greyhaven_a26_billboards.py -- --scene /path/blood_iron_greyhaven_a22.blend --out-dir /local/a26-review --samples 4

Then Pillow with WebP:

    python tools/art/encode_greyhaven_a26_webp.py --in-dir /local/a26-review

The first slice contains Red Lion, Gable Merchant and Blacksmith. Since the Blacksmith model is physically turned 180 degrees toward its street, the script also turns **its isolated art review camera** by 180 degrees to show the entrance rather than the empty rear facade. This camera change does not rotate or move the building in the world; each reviewed sprite is independently anchored and **not a common screen-aligned world atlas**. Each has three 640x640 original RGBA PNG masters (base, roof, whole), two original-pixel-lossless cropped RGBA WebPs, a checkerboard review composite, and reports:

- greyhaven_a26_render_report.json: Blender camera settings, measured ground-basis X/Y and their uncorrected game-XY disagreement, actual rendered layer/object counts, visual door anchor.
- greyhaven_a26_webp_report.json: per-layer crop rectangles, visual-door-relative draw offsets, RGBA reconstruction fidelity, WebP SHA256 / byte counts, and mean RGB difference between the separate-layer composite and independently rendered full object.

All source objects and the seven barrel placements remain unchanged. No character models, network/zone authority, A3 roll clips, player physics, collisions, portals or game renderer are affected.

## Art acceptance and blockers

The review stills should show full facades and distinctive roof materials. The roof pass must be independently removable without deleting foundation/wall geometry. The exact visual door anchor remains centered in each full-canvas master, with crop offsets recorded separately. An *offline* base-over-roof comparison can reveal shadow discrepancies caused by separate Cycles passes. Do not claim exact full-scene reconstruction when the measured difference is nonzero.

Future integration requires a separate opt-in client change reviewed with the *actual* browser camera: per-building screen-space placement, the existing opt-in knight pivots, roof occlusion/fade depth ordering, real map/portal authority and measured Chrome/Firefox/mobile FPS and decoded texture usage.

Do not merge while required exact-head quality is red or CI is pending. Never deploy without separate owner authorization.
