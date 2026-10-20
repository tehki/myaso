# Blood & Iron A2.5 — camera-matched overhead building slices

**Status:** offline graphics acceptance study. Do NOT directly activate in the live game.

## Why

A2.4 measured up to 80.907 pixels of mismatch between the **three-quarter isometric Blender render** and the actual flat-XY multiplayer renderer. The existing browser uses projectArenaPoint from src/browser/arena-viewport.mjs and a render-only ARENA_VIEW_ZOOM of 0.84. Our A1 art convention remains 40 game-world units per authored meter. Thus a compatible static world XY texture needs **33.6 displayed pixels per authored meter in both game axes**, with positive Y down.

A2.5 introduces an independent, reversible Blender 4.5 LTS CPU camera that looks straight down -Z, has no 3/4 rotation, and uses an orthographic scale equal to the canvas size divided by 33.6. Raw Blender PNGs have +Y up; a **vertical pixel flip** (no X flip) changes the rendered image to the browser's positive-Y-down convention. Blender's own world_to_camera_view checks the X and Y basis against the browser's measured per-meter scale with <0.01 pixel-per-meter tolerance.

This top-down art sacrifices the dramatic visible building facades seen in the A2/A2.2 isometric reviews. It is a *technical calibration candidate*, **not** a replacement for approved Blood & Iron art direction. Future depth-sorted per-building sprites may use different visual camera compositions provided their ground anchors are calibrated independently.

## Rebuild from source

With Blender 4.5 LTS:

    blender --background --factory-startup --python tools/art/render_greyhaven_a25_xy_slices.py -- --scene /path/blood_iron_greyhaven_a22.blend --manifest assets/environment/greyhaven/art-manifest.v1.json --viewport-source src/browser/arena-viewport.mjs --out-dir /local/a25-review --samples 4

On the workstation (Python 3.14 and Pillow/WebP):

    python tools/art/encode_greyhaven_a25_xy_webp.py --in-dir /local/a25-review

Blender exports four 640x640 RGBA PNGs:
- Red Lion building base and its roof, separately.
- Gable Merchant building base and its roof, separately.

The Pillow script flips image Y, crops alpha to a 2-pixel padded rectangle and losslessly encodes independent WebPs with per-crop draw offsets and visual door-anchor pixels. It checks that the decoded and reassembled full-canvas image is pixel-identical in visible RGBA. It provides two checkerboard-backed composite PNGs for review.

Reports: greyhaven_a25_camera_report.json and greyhaven_a25_webp_report.json. Both original A2.2 .blend source and current game code remain unchanged.

## Important boundaries

- The Red Lion's game door (4365,4075) comes from **A1 proposed manifest coordinates**. This is not evidence of server-authoritative portal or active world placement; the merchant has no claimed world XY placement. These are visual review anchors only.
- Roof images contain the building's roof surfaces; wall/base images exclude other scene elements. There is **no runtime occlusion fade, shadow/depth compositing guarantee or global world atlas**.
- Image draw-offset is relative to the *visual door ground anchor* in the derived preview image. It is NOT an authoritative collider, spawn, foot pivot or backend map portal.
- For the actual playable client, verify optical continuity of original 3/4 artwork, true knight foot/sprite pivot, authored-world placements and correct server zone transitions before selecting any building render/occlusion strategy.
- Browser decode, VRAM, desktop/mobile FPS and multiplayer responsiveness remain unmeasured.
- Keep the draft PR unmerged until exact-head required CI passes and art owner separately approves. Never deploy without explicit authorization.
