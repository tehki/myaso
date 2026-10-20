# Blood & Iron — Greyhaven A2 procedural material study

**Status:** original, editable Blender source and CPU review renders; **not approved as finished realistic environment**, not used by the live multiplayer game.

This follows [A1 direction](BLOOD_AND_IRON_ART_DIRECTION_RU.md) and [roadmap #344](https://github.com/tehki/myaso/issues/344). The Red Lion OBJ is reimported **without changing its 6.25 × 4.25 m authored building footprint**; A2 layers procedural PBR-style surface variation and composes surrounding architecture and props.

## What's included

- Red Lion A1 blockout with procedural limestone, lime plaster, weathered timber, clay and iron materials.
- Four additional facade modules: slate-roof merchant house, thatched cottage, stone weaver's cottage, blacksmith workshop with anvil and glowing forge. These are **look-dev prototypes, not final hero meshes**.
- One authored fixed street composition, 1,032 cobbles consolidated into **one Blender mesh**; handcart, 6 oaks, fences, grass and barrels.
- Original shader-node noise, color ramp and bump materials. **No external textures, paid libraries, reference downloads or generative assets**. Geometry is original project-authored Python.
- Orthographic street and Red Lion review cameras, roof-occlusion candidate mesh tags, Cycles CPU lighting. The camera pitch is a **composition study**, not a locked game export angle.

## Rebuild from Blender 4.5 LTS

From repository root (substitute your Blender executable and output directory):

    blender --background --factory-startup --python tools/art/build_blood_iron_a2.py -- --a1-obj assets/environment/greyhaven/red_lion_blockout.obj --out-dir /tmp/myaso-a2 --render --samples 8

The script writes blood_iron_greyhaven_a2.blend, blood_iron_a2_report.json and, when --render is passed, blood_iron_street_a2.png and blood_iron_red_lion_a2.png. The Blender file is editable. CPU Cycles rendering is intentionally selected for the NVIDIA GT 630 workstation.

The checked-in blood-iron-a2.art.json describes the source/provenance and deliberately flags the composition as **not authoritative world coordinates**.

## Acceptance gates still open

1. Review the rendered images for architectural plausibility and depth. This is a material/scale study, not a claim of photorealism.
2. Overlay the **actual** Silver Knight and T1 Sentinel models at verified in-game unit/pivot ratio; review camera/export angle before baking.
3. Build separate wall and roof-alpha WebP exports with measured dimensions, byte sizes and pivots. bake_layer is metadata only, **not implemented gameplay roof occlusion**.
4. Compare render-to-game with world=1 (PR #336) and knights=1 (PR #326) only after those independent tracks have passed required gates.
5. Check real Chrome, Firefox and mobile frame times/VRAM. The 60 FPS target is unmeasured; this PR contains no browser performance claim.

No source gameplay or authoritative server files are changed. Do not merge while exact-head checks are red, and never deploy without separate owner authorization.
