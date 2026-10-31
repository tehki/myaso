# Graphics 3B — Red Lion Quaternius full visual replacement

**Status:** New original CC0 Blender architecture, source-ready. Runtime **not yet activated**. No merge, no production deployment.

## Why this replaces Red Lion A2.32

The owner explicitly rejected the previous Red Lion A2.32 visual model and requested a **complete change of asset library**. The old approved A2.32 roof and original art are now obsolete **for the future Red Lion art direction**, but source files in the historical stacked branches remain intact for rollback and evidence. This new Blender scene imports **none** of the old Red Lion A2.32 meshes, original painted/sprite facades or existing art authoring files.

Instead, this replacement is built directly from the **genuine Quaternius Medieval Village MegaKit Standard** CC0-1.0 original glTF models, mirror `J-Ponzo/gltf-medieval-village-megakit` pinned at commit `21104b4045261c28fc312360841ed1a7b0ac8782`. The source copy uses the existing exact-pinned Git submodule, not unverified downloads, image generation or a superficial retexture of the old building.

## Blender source architecture

- New tavern footprint modeled around original **6 × 8 m** modular CC0 wall bays, with authentic plaster/brick wall pieces.
- A genuine separate `Roof_RoundTiles_6x8` creator roof and two `Roof_Front_Brick6` authentic 3D gables. No re-use of rejected old A2.32 roof.
- Real original Quaternius front round door, frame and six glazed-window instances, with additional actual source open shutters on the visible facade and flank bays.
- Authored stone threshold, carved wooden **THE RED LION** plaque, and iron fasteners are original Blender geometry with proper editable materials, not flattened generated images.
- Real Quaternius chimney positioned against the source roof, source-only Cycles chimney smoke at dusk.
- Genuine source glass PBR materials are restored for daylight and use scene-local warm emissive clones at dusk. Room/interior/gameplay authority is never inferred from glass or doors.
- Original orthographic Blender review camera, **960×720** native RGBA day/dusk PNGs. The exact editable original source is generated as `red-lion-quaternius-original.blend` and attached to the exact-head GitHub CI artifact rather than storing 56MB directly in the source diff.
- Alpha-preserving WebP review files and original source SHA256 provenance under `assets/environment/greyhaven/red-lion-quaternius/review-only/`. Source Blender/Cycles authorship is reproducible using `tools/art/render_red_lion_quaternius_replacement.py`; no illustrative AI assets.

## Crucial World9 / Core8C / Physics6 ownership

The existing Red Lion world ID remains `red-lion` in `moonvale-overworld`. **No X/Y, portal, interior, door activation, actor identity, server collision, camera, combat, or gameplay state was changed** in this art-only branch. `oldRedLionArtSuperseded=true` means the new art candidate fully replaces the old *visual design*, **not that live runtime has already switched assets**. Historical World9 `worldBuildingPresentation` already permits only the `red-lion` ID; this draft does not change the allowlist or authority.

Before shipping as an interactive tavern, Graphics 3 / World9 / Core8C / Physics6 must approve:
- New sprite facade/roof/player-depth layer relationship and world-to-camera 960×540 anchor.
- Genuine Red Lion footprint/entry/portal continuity, no invented indoors.
- Pixel-accurate real Chrome and Firefox native 2/4-player scenes, fighter in front/behind roof and door, unchanged HUD/Combat and fallback when assets fail.
- Budgeted decoding, correct frame size and performance, full mandatory protected quality CI.

Until then, **P1 ART REPLACEMENT PROPOSED / GAME INTEGRATION HOLD / PRODUCTION HOLD**. Old runtime art is still active where the earlier Red Lion opt-in is used. No merge or deployment permission is assumed.

## Owner-requested Blender correction pass — 31 October 2026

The two latest owner-approved generated references are **visual direction only**. They are not game assets and are not represented as Blender renders. The corrected scene imports 33 genuine pinned Quaternius CC0 modules (15,148 original vertices), adds nine editable artist-authored ground-ivy leaves, and includes no A2.32 meshes. The following corrections are implemented in the real editable Quaternius source:

1. **Raised THE RED LION sign:** board center is now Z=3.55 m (bottom Z=3.29 m), with both forged supports, 3D text and rivets raised together. The Blender build measures the actual sign-board lower bound against both genuine front-window mesh upper bounds and requires at least 0.25 m clearance.
2. **Relocated crate:** moved to (5.35, -4.30, 0.00) m, fully outside the original roof's positive-X edge. Blender measures a minimum 0.40 m X clearance from the roof mesh; no crate/house AABB overlap is accepted.
3. **Grounded foliage:** the old upright CC0 `Prop_Vine2` wall-vine is removed from the visible scene and replaced with nine separate editable Blender ground-ivy leaf meshes with raised center veins, placed at (5.55, -5.85, 0.08) m. Blender measures its world-space bounds against both roof and crate and requires a ground-plane Z range of 0.00–0.20 m.
4. **Dusk chimney smoke:** six separate bubble meshes have been replaced with one continuous closed, irregular plume mesh (1.8 m rise) and a procedural Cycles volume material. Its origin is computed from the actual imported `Prop_Chimney` world-space bounds. The plume is hidden in daylight and enabled in dusk. The smoke is source-art only; no runtime VFX permission is implied.

The exact native Blender 4.5.14 Windows scene is rebuilt and saved as `red-lion-quaternius-original.blend`; genuine 960×720 day/dusk Cycles RGBA frames and hash provenance accompany it. The build fails closed if the sign/window, crate/roof, foliage/roof, foliage/crate or ground-plane clearances are not met. This remains a Draft/source-art change only; World9 placement, portal, collision and game runtime remain untouched.
