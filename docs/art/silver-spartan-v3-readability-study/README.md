# Graphics 3A — original Silver Knight Spartan V3 lighting comparison (SOURCE ONLY)

**Classification:** source-tested candidate; VISUAL REVIEW HOLD; NOT merged, integrated, deployed, Pre-Alpha, real-server or owner-approved.

The same original Silver Knight 22-bone GLB (`d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f`) and the **same V3 10-key original skeletal action** produce two sets of authentic Cycles source frames. No movement, rig, animation timing, support-toe source anchor, camera, scale, actor root, Physics, Combat or game-renderer code is changed. Only Blender source-render area-light power and background fill are increased, under optional `--spartan-v3-readable-light` (requires existing `--spartan-contact-recoil-v3`).

- [Original V3 vs original lit study — all eight directions, 380ms](silver_spartan_v3_normal_vs_light_study_8way_380ms.gif)
- [New full 1280×1280 8×8 lossless 160px source atlas](silver_spartan_v3_readable_light_study_8x8.webp)
- [Editable original 22-bone action-only Blender source](Graphics3A_Silver_Spartan_V3_ReadableLight_Study_source.blend)
- [Pixel, SHA and brightness audit for all 64 cells](spartan_v3_readability_study_manifest.json)
- [Original V3 versus lit-study Blender rig pose comparison](original_v3_vs_lighting_study_rig_audit.json)

The original V3 `silver_spartan_contact_recoil_v3_p0.webp`, original authoring script default, approved V2 victim, production source `web/assets/knights` and Pre-Alpha Silver 5 atlases remain untouched. This study should **not** replace the original V3 game atlas unless owner/Art Director explicitly approves native gameplay visuals. Quantitative source illumination alone does **not** prove readability in the actual arena. No damage, physical boot contact, hit VFX/SFX, Greyhaven terrain or real 2–4 player action is inferred.

## Reproduce
```powershell
blender -b -t 2 --python tools/art/author_silver_kick_dash_p0.py -- --source C:/authorized/silver-knight.glb --output .v3-light-full --plant-kick --spartan-kick --spartan-high-forward --spartan-contact-recoil-v3 --spartan-v3-readable-light --kick-only --samples 1 --engine CYCLES
python tools/art/pack_silver_spartan_v3_readability_study.py --input .v3-light-full --baseline docs/art/silver-spartan-contact-recoil-v3/silver_spartan_contact_recoil_v3_p0.webp --output docs/art/silver-spartan-v3-readability-study
node --test tests/graphics3a-v3-readability-study.test.mjs
```

Next: separate opt-in actual authoritative Chrome/Firefox/Chrome2 original WebP replacement test with unchanged M153 game receipt, full protected exact-head CI and human art approval before **any** integration. Preserve narrow Pre-Alpha exclusions.
