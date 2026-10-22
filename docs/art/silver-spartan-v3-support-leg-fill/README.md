# Graphics 3A — Original Silver Knight Spartan V3: support-leg lighting correction

**True Blender/Cycles source adjustment. No image generation, screenshot retouching, synthetic pixels, material replacement or mesh repaint.**

The owner's feedback is that the **left support leg appears nearly invisible**, making the right-leg Spartan front kick look one-legged in the real game. In the original 22-bone Silver Knight source action, the kicking leg is `RightUpLeg/RightLeg` and the planted leg is `LeftUpLeg/LeftLeg`.

This separate draft branch introduces `--spartan-v3-support-leg-fill`, a targeted camera-facing soft **Blender AREA light** positioned using the **evaluated original left support thigh, knee, shin and ankle** on every 8-way Cycles frame. The shadow-side illumination stays visually attached to the real articulated leg through the full 380ms motion; it does **not** alter body proportions, angles, any joint, UV maps or original texture. The light is a smaller, cooler 4.8W local bounce, not a blanket world exposure boost.

Original global Key 295W, Fill 280W, ambient strength 0.88 are **unchanged** from the separate unapproved source study [#801](https://github.com/tehki/myaso/pull/801). Default Blender source without new flag is unchanged. Exact original owner Silver 22-bone GLB stays private and untouched; the repository only receives editable armature/animation/lights `.blend`, rendered genuine Cycles atlas, before/after GIF and SHA/source audit.

- [**Real Blender/Cycles 380ms eight-facing original vs support-leg-fill animation**](silver_spartan_v3_support_leg_before_after_380ms.gif)
- [**Real Blender/Cycles complete 8×8 source atlas**](silver_spartan_v3_support_leg_fill_8way.webp)
- [**Editable actual Blender original 22-bone armature, V3 kick action and light**](Graphics3A_Silver_Spartan_V3_SupportLegFill_source.blend)
- [**Every 64 frame genuine RGBA-alpha SHA and illumination measurements**](support_leg_fill_manifest.json)
- [**Independent original rig support-toe pose comparison**](original_vs_support_leg_pose_audit.json)

**Design constraints:** The original right-leg kicking motion, planted toe source stabilizer, original static sprite camera scale (1.66 ortho), eight direction samples, all ten authored action keys, 90ms windup + 70ms active + 220ms recovery (380ms total), skinned source mesh, original world root and multiplayer authority are unchanged. All 64 source alpha masks MUST exactly match the prior Cycles source atlas; source luminance difference comes only from the new real Blender leg light. Actual 960×540 game readability, world-ground contact and owner art approval are separate acceptance gates.

## Reproduce using locally authorized original Silver GLB

```powershell
blender -b -t 2 --python tools/art/author_silver_kick_dash_p0.py -- --source C:/authorized/silver-knight.glb --output .support-leg-full --plant-kick --spartan-kick --spartan-high-forward --spartan-contact-recoil-v3 --spartan-v3-readable-light --spartan-v3-support-leg-fill --kick-only --engine CYCLES --samples 1
python tools/art/pack_silver_spartan_v3_support_leg_fill.py --input .support-leg-full --baseline docs/art/silver-spartan-v3-readability-study/silver_spartan_v3_readable_light_study_8x8.webp --output docs/art/silver-spartan-v3-support-leg-fill
node --test tests/graphics3a-v3-support-leg-source.test.mjs
```

**Classification:** TRUE BLENDER SOURCE CORRECTION / SOURCE TESTED / OWNER GAME-SCALE VISUAL APPROVAL PENDING. This branch does not overwrite original V3, accepted original Silver victim V2, default renderer, Pre-Alpha assets, Physics, Combat or any source in a production build. Dedicated real three-browser/gameworld screenshot proof and protected CI must precede any integration; no independently authorized merge/deploy.

**Saved-source Blender verification:** [Actual editable moving area-light audit](actual_blender_support_leg_light_audit.json) confirms Blender reopens the source with the 4.8W AREA lamp and a real keyed animation spanning Blender frames 1–23.8, matching the authentic 380ms source clip. The original rig, support-toe animation and kick remain unchanged. The light is attached to the eight sample positions for the editable stored facing; the full atlas was independently Cycles-rendered for each of the eight facings.
