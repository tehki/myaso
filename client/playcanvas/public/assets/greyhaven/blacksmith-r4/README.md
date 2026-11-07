# Blacksmith R4 — genuine approved Blender art (PlayCanvas source-only)

This is a **visual-only** conversion of the existing MYASO.IO Greyhaven Blacksmith R4 source asset, not a new building design or a change in game authority.

- **Original artist source:** `Downloads/BlacksmithBlenderR4/review-final-v2/greyhaven-blacksmith-original-source.blend` on the owner-authorized Windows Machine. Not copied into Git; the editable source remains there.
- **Original source SHA-256:** `26ef652f2493a66a01e174a1865f8beac787adcf953db0b0d69162747f1d7f3d`
- **Artwork provenance:** original MYASO Blender work using Quaternius Medieval Village MegaKit CC0 source modules, plus native original forge, anvil, bench, tools, closed gables and original dusk lighting/smoke designs. Quaternius's model library is CC0 1.0 Universal; see repository Graphics3B PR #1110 and `docs/art/GRAPHICS3B_P1_ORIGINAL_BLACKSMITH_BLENDER.md`.
- **Original review/approval:** R4 day/dusk Blender images were visually approved October 27, 2026, for art direction; that did not authorize live placement, interactivity, collision, portals or a production cutover.
- **Export source:** genuine Blender 5.2.2 LTS headless glTF 2.0 export of the original `.blend`, selecting real visible mesh objects and excluding eight Blender Cycles-only volumetric smoke meshes (which do not faithfully translate to glTF). Blender 3D model geometry, door glass, forge, anvil, chimney and light material components are retained. Some Cycles node graphs cannot be faithfully exported and Blender emitted texture sampler warnings; visual validation remains necessary.
- **Export original:** GLB 51,150,148 bytes.
- **Browser processing:** only the 18 embedded PNG textures were downsampled from 2048×2048 to 1024×1024 using Pillow LANCZOS and losslessly PNG-compressed thereafter. All non-image glTF buffer views, geometry, layout, materials and source vertex data were retained and re-packed unchanged.
- **Web GLB file:** `blacksmith-r4-original-blender-web1024.glb`
- **Web GLB SHA-256:** `84cf7901e7ec851f24055766d47240726bf12e908ed494f4e33881faac382640`
- **Web GLB bytes:** 13,425,740.
- **Blender source-space whole model bounds:** X -4.4636..5.3, Y -5.88..2.7399, Z -0.19..7.2279 (Blender Z up). Core building bounds X -2.7565..2.7565, Y -2.8216..2.7399, Z -0.0085..6.7337.
- **World9 smith reference:** authored building `smith` x=3710 y=3850 w=182 h=162 in map; visual center world (3801,3931), mapped to PlayCanvas scene (-8.475,0,-4.35) with presentational scale 0.025 relative to map origin (4140,4105). Suggested initial render scale 0.72 is a **visual trial**, not verified authoritative geometry; original outdoor forge apron extends beyond the building footprint.

Do **not** merge, deploy, publish, overwrite original Blender source, grant World9 `smith` replacement, or infer server collision/portal/item authority from this standalone visual file. Keep the existing live Pre-Alpha unchanged. The Glb is a visual *candidate* for an isolated PlayCanvas Alpha Editor scene.
