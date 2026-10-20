# BLOOD & IRON — Greyhaven A2.2 neighboring houses and roofs

**Status:** reproducible, project-authored Blender **look development** only. This does not change or activate browser-rendered assets.

A2.2 builds on the already reviewed A2.1 derived Red Lion scene and keeps the historic Red Lion, barrels, street layout and previous knight review assets intact. Input is the blood_iron_red_lion_a21.blend produced with tools/art/polish_red_lion_a21.py. Workstations with Blender 4.5.14 LTS / NVIDIA GT 630 should use **Cycles CPU**.

## Rebuild

    blender --background --factory-startup --python tools/art/polish_greyhaven_a22.py -- --base /path/blood_iron_red_lion_a21.blend --out-dir /local/a22-review --render --samples 4

Produces a separate editable blood_iron_greyhaven_a22.blend, two 1120×720 PNG reviews from the SAME A2 review cameras, and a machine-readable JSON report.

## Geometry and material provenance

All geometry and 16 procedural shader materials are original Python/Blender authoring. No external textures or third-party libraries.

| Building | Roof character | Patches (single batched mesh) |
| --- | --- | ---: |
| Gable Merchant | cool, weathered blue slate | 468 |
| Tanner's Cottage | aged golden and damp reed thatch | 1,242 |
| Stone Weaver | earthy ceramic clay | 494 |
| Blacksmith | charcoal/smoke-darkened slate | 532 |

Each roof uses the **actual four-vertex slopes from the existing roof mesh**; no approximated gable pitch, orientation or placement. All former course-marker objects (14 per building, 56 total) are **preserved but render-hidden in the derived scene only** to avoid protruding fragments through the tiles. Roofs retain roof-occlusion-candidate metadata; this has **no automatic runtime roof occlusion**.

An additional *single combined facade mesh* across the four buildings contains 92 dressed front foundation blocks, 28 oak door planks and 8 forged iron hinge details. These are render-only, not colliders or enterable door configuration.

Blender source generation validated preservation of **292 original A2.1 meshes** and **all seven original barrel positions**. Five new meshes total (4 roof + 1 facade). No source knight GLBs, roll clips, map gameplay data, server or network changes.

## Quality gates still outstanding

The two real rendered reviews must be inspected for recognizably distinct roofs and correct A1/A2 camera continuity. Scene output is **not yet committed as a playable game atlas**. Later separate work must:

1. Align camera projection and knight pivots to actual browser sprite rendering.
2. Bake stable roof/base occlusion textures to lossless master + optimized WebP for in-game use, measure pixels/bytes.
3. Benchmark texture and frame budget in real Chrome/Firefox/mobile gameplay before any activation.
4. Approve visual style and verify exact-head required CI before merge; separately authorize any production deployment.

**No production deployment or CI bypass in A2.2.**
