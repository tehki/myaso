# Graphics 3B — Owner-approved glowing windows and chimney smoke in authentic Blender

**2026-10-26 visual approval:** owner approved the Blood & Iron cottage as a style match, then requested (a) warm light inside the main arched window at dusk, (b) warm light inside the glass panes of the corrected front door, and (c) chimney smoke. The generated illustrative image is a **visual target only**, not the production asset. Implement all three with original imported Quaternius CC0 Standard geometry inside Blender.

**Source:** [draft PR #1047](https://github.com/tehki/myaso/pull/1047) with accepted real door/frame geometric alignment, raised orthographic camera, and non-destructive roof shader. Genuine source CC0 meshes, image textures and byte-level creator archive verification remain unchanged. No new paid assets.

## Real Blender implementation
- Identify the **actual material-tagged glass polygon vertices** in the original `Window_Wide_Round1` and `Door_1_Round` imported glTF meshes; fail closed if absent. The source glass model `MI_WindowGlass` is genuinely present in both assets.
- Inside the new editable .blend only, clone the original source glass PBR materials to named dusk-only variants, set warm amber Principled emission and full alpha to make the otherwise faint transparent glass visibly illuminated; restore the unchanged source glass material **at daylight**. Use two low-energy amber point lights placed from the glass's true world-space bounds for modest nearby plaster and timber light spill.
- Anchor six translucent, volume-shaded procedural Blender smoke puffs to the **real imported source chimney world-space top**, not a guessed rooftop pixel. They are visible for dusk preview and invisible during daylight review. Smoke is Blender-authored geometry/shader in the editable scene, **not a working game particle emitter or animation**.
- Preserve the existing roof, original door transform, source PBR maps, World9 camera, source Greyhaven Red Lion and actor/collision/portal authority. These additions are restricted to original headless Blender author-time day/dusk art samples.

## Native evidence gates
- Actual blender scene report includes source `MI_WindowGlass` material slot matches for **both** window and door, their true world bounding positions, source chimney world height, six procedural volumes and honest `animatedInGame=false`. Original day glass stays unmodified.
- Existing Blender-to-2.5D sprite baker refuses the dusk image if those source-derived checks fail. Localhost Chrome+Firefox source World9 preview refuses sprite reports missing these checks. Real day/dusk PNGs, original editable .blend, source bake WebPs, and native browser screenshots remain CI artifacts.
- Human visual review must confirm both window *and door* emit light and that chimney smoke is visible, subtle and correctly originates from its masonry top. Any failures keep P1 art HOLD.
- Any future animated-smoke implementation requires a separate sprite atlas or graphics-runtime approval, with performance/ownership checks; do not silently claim the static Blender smoke is in-game animated.
- Full protected `quality` and canonical PR #1036 Main0 integration are separate. Previous draft art branch quality had sporadic Combat M158/M33 failures; Graphics 3B should not modify Combat to mask those. **No merge, deploy, server changes or World9 building placement**.
