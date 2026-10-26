# Graphics 3B — Owner-selected plain plaster gable wall

**Owner feedback, 26 October 2026:** after viewing the genuine source Blender day/dusk render of [draft PR #1050](https://github.com/tehki/myaso/pull/1050), the user observed the triangular plaster texture was misaligned and offered two corrections: center the texture, or make the triangle a plain wall. The assistant selected **plain wall**, and the owner's next "🌕⚡️🚀" authorizes the actual Blender source fix.

## Actual source geometry correction

The new triangular 3D prism in the review assembly was assigned Quaternius's original UV-textured `MI_Plaster` atlas, but the author-created prism lacks the original wall mesh UV atlas. That leads to odd placement/sampling within the gable. We do **not** need to touch the source Quaternius images or the roof geometry to fix this.

- Retain the existing double-sided true 3D gable prism, original geometry/roof collision constraints and genuine imported source walls.
- Make a scene-local duplicate of the original `MI_Plaster` shader called `BloodIron_Greyhaven_PlainGablePlaster_ReviewOnly`, disconnect only the clone's Base Color, Normal and Roughness texture links, set its uniform matte warm beige base color `[0.55,0.45,0.34,1.0]` and roughness `0.90`. The original `MI_Plaster` PBR atlas and the plaster on existing wall meshes are unchanged.
- Remove the gable **center post** to avoid an off-center visual line; retain the edge rafters and sill in genuine imported `MI_WoodTrim` for consistency with Blood & Iron.
- The real Blender source-check report must show the clone shader is unlinked from UV texture inputs, exactly three remaining timber braces, unchanged source plaster, original roof, original door, lit glass and procedural chimney smoke. Sprite baking/native browser art review refuse the result if any requirement is unmet.

## Acceptance

CI must generate two genuine 640×640 day/dusk RGBA Blender PNGs and a new editable .blend, compress day/dusk real WebP review sprites, and pass native Chrome+Firefox screenshots showing source World9 + original immutable Red Lion unchanged outside the independent review inset. Compare current day/dusk images to prior #1050; verify the triangle is plain, no visible UV distortion, and stylistic coherence.

This is a **review-only** source art correction, not a game world asset placement, authoritative collision/door interaction, Combat fix, native FPS guarantee or production deployment. The original 176-model free CC0 provenance remains unchanged, and Main0 retains release authority. No merge or deploy.
