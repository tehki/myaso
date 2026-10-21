# Blood & Iron — A2.4 registered camera and cropped roof trial

**Status: REVIEW-ONLY. Direct integration into the current multiplayer Canvas renderer is explicitly blocked.**

## Critical finding

The game does **not** project Greyhaven as an isometric world. The existing browser implementation, src/browser/arena-viewport.mjs, projects game-space positions in flat XY:

    screenX = width/2 + (gameWorldX-cameraX)*0.84
    screenY = height/2 + (gameWorldY-cameraY)*0.84

The fixed authoring convention from assets/environment/greyhaven/art-manifest.v1.json is 1 Blender meter = **40 game units**, hence 33.6 screen px per modeled meter. The A1 manifest proposes Red Lion's door at game XY (4365,4075). This does **not** mean the door/portal has been activated on the authoritative server; world/server implementation is independent and currently not inferred from this document.

The A2.2 Blender camera is *tilted*, 3/4 orthographic. Blender 4.5.14 reports that moving one authored meter along +X shifts the rendered ground point by (-20.588,+8.898) px; +Y shifts it by (+15.955,+11.481) px. The ground axes meet at **120.888 degrees**, instead of the two perpendicular, independent axes required by the existing browser's flat XY formula. Offsets alone cannot register the two coordinate systems.

The offline A2.4 comparison aligns the *visual door ground point* at the same center pixel, then measures seven ground sample points. Up to **80.907 screen pixels** of disagreement remain at +/-2-meter samples; 1-meter X disagreement is 54.913px and 1-meter Y disagreement is 27.273px. Therefore the existing A2.3 composite must **not** be dropped into the game as a single scene sprite with arbitrary offset/scale.

A2.4 diagram: assets/environment/greyhaven/a24-review/greyhaven_a24_projection_mismatch.png. Yellow dots are actual Blender-projected ground positions, magenta rings are expected flat-XY world positions with the door anchors aligned. This is diagnostic artwork, not a combat/UI preview.

## Roof alpha cropping

Given the 1120x720 A2.3 roof alpha, the original nontransparent bbox is [108,39,1061,567]. A reproducible Pillow 2px padding crop yields a 957x532 lossless RGBA WebP positioned in the **original Blender review pixel frame** at (+106,+37).

- Original 1120x720 lossless roof WebP: **145,224 bytes**
- Cropped 957x532 lossless WebP: **122,468 bytes**
- Saved: **22,756 bytes, 15.67%**.
- Exact alpha and visible composite pixels roundtrip when the crop is composited onto the original 1120x720 frame at the recorded draw offset.
- The draw offset is **NOT** a world pivot, roof/door collider or browser camera offset.

## Reproduce

    blender --background --factory-startup --python tools/art/measure_greyhaven_a24_projection.py -- --scene /path/blood_iron_greyhaven_a22.blend --manifest assets/environment/greyhaven/art-manifest.v1.json --viewport-source src/browser/arena-viewport.mjs --out-dir /local/a24

    python tools/art/crop_greyhaven_a24_roof.py --in-dir /local/a23 --out-dir /local/a24

    python tools/art/diagram_greyhaven_a24_projection.py --report /local/a24/greyhaven_a24_projection_report.json --street-render /local/a22/blood_iron_greyhaven_street_a22.png --out-dir /local/a24

The A2.4 crop's alpha fidelity is tested independently of the camera mismatch. All scripts are offline, deterministic, do not modify Blender inputs or network/browser code, and use original first-party asset provenance.

## Unblocked next engineering step (separate future graphics integration)

Either produce *per-building* wall and roof layers using a camera with an explicitly measured **game-compatible ground-plane projection**, or revise renderer/world projection in a separately approved architecture PR after verifying collision/door/knight semantics. The latter would be a major gameplay/UI change, **not** part of this art-only PR. Then calibrate actual player feet and door screen positions with the opt-in browser world PR, test roof fade/occlusion and WebP decoded texture memory in Chrome/Firefox/mobile, and preserve rendering and authoritative physics separation.

**No merge or production deploy without required exact-head CI green and owner visual approval.**
