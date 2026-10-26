# Graphics 3B — Gable plaster weathering and roof-ridge seam correction

**Owner feedback (2026-10-26):** the formerly plain triangular gable is too clean compared with the lower plaster facade, and the dark/dirty spot at the top beneath the roof ridge must be removed. This change is made in the **actual editable Quaternius Blender assembly** on the branch stacked above plain-gable review [draft PR #1051](https://github.com/tehki/myaso/pull/1051). It does not replace an artifact with an AI-edited picture.

## Original pixel comparison and identified causes

I inspected the original genuine native Blender day frame from #1051. Its central gable RGB sample is approximately `179,165,149`, whereas the lower facade between arched window and door is around `151,133,107` with natural small mottling. The previous scene-local gable clone had constant `[0.55,0.45,0.34,1]` color and a smooth flat normal; the difference is visible. At the top apex is a narrow **dark unfilled seam** beneath original roof timber, not a deliberate stain in the existing source material.

## Genuine Blender art-only remedy

1. Original imported source `MI_Plaster` remains untouched on the actual lower facade. On the authored gable scene-local material duplicate only, remove the original atlas image nodes because the custom triangle has no matching original UV coordinates.
2. Use a low-amplitude `ShaderNodeTexNoise` in `ShaderNodeNewGeometry.Position` world space. Scale `9.5`, detail `3`, no distortion. Constrain output with a warm source-facade color ramp, from `[0.342,0.252,0.163,1]` to `[0.420,0.327,0.225,1]`; give subtle height grain through a weak bump node (strength `0.045`, distance `0.008`). Avoid over-staining, UV skew, hand-painted masks and obvious repeating polygons. Keep original source plaster PBR atlas untouched.
3. The source-authored triangular front face extends its hidden apex from z `5.10` to `5.26` and advances the front face by `0.015 m` to cover the narrow dark seam at the roof peak. The original roof mesh and timber trim still have their exact original geometry. This is **not** a change to the roofline silhouette or to live World9 game coordinates.
4. Retain the three original authentic timber edge/sill braces (no center post), corrected original door position, genuine window and door glass emission at dusk, all original roof/stone/timber material maps and six source-chimney smoke volumes. No new first-party/game asset registrations.

## Acceptance

The original Blender audit must prove world-space/no-UV source material clone, original atlas disconnected, restricted fine noise parameters, small bounded apex seam extension, unchanged source roof and wall and original window/door glass + chimney smoke. Real day/dusk PNG and editable .blend, genuine 2.5D alpha-preserving WebP, and native Chrome+Firefox image review must pass at exact head. **Human review** must compare both new true Blender day/dusk images with the lower-wall plaster and inspect the roof apex for visual black marks; a source-code gate alone cannot prove aesthetic similarity.

P1 review HOLD, no merge/deploy/World9 placement or physics/portal/Combat changes. Independent protected quality must be reported separately; graphics green does not waive Combat failure.
