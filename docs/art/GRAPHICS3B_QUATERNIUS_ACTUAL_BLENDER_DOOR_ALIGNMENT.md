# Graphics 3B — Quaternius real Blender door/arch alignment

**Owner visual acceptance, 2026-10-25:** "the house's door is misaligned"; following a corrected visual reference: "That's correct now, is this the fix you need to do in Blender?" — YES. This isolated Graphics3B follow-up fixes actual original imported free CC0 Standard glTF transforms, NOT generated illustrative pixels.

## Identified source geometry root cause

The original free Quaternius Standard `Door_1_Round.gltf` is hinge-origin: its actual POSITION attribute bounds in original right-handed glTF local X are `[-0.0462631062, +1.0737497807]`, **center +0.5137433372 m** relative to its object origin. Original `DoorFrame_Round_WoodDark.gltf` local X source mesh bounds are `[-0.7034929395, +0.7034913898]`, center **~0 m**. Former manifest placed door and frame at the SAME world x=1, yielding **~0.514 m rightward door displacement** from arch. This isn't a texture/edit-only issue.

Correct **only the imported Blender assembly pose** in `assets/environment/greyhaven/quaternius-standard-preview/manifest.json`:
- Preserve arched frame x=1.000, depth y=-2.020, floor z=0, yaw 0.
- Move the ORIGINAL imported `Door_1_Round` mesh pivot to x=`0.486255`, depth y=-2.050, floor z=0, yaw 0.
- Original wall `Wall_Plaster_Door_Round`, window/roof/chimney, materials, other instances and original source glTF bytes remain completely unchanged.

A precise scene-space acceptance contract checks the **actual Blender imported mesh world-space bounds**, including parenting and glTF axis conversion: door center within **0.015 meters** of frame center; door bottom **0.000–0.090 m** above frame low point; and door/frame center depth plane separation under **0.100 m**, with door top under frame top. Real Blender sources are NOT substituted by invented proxy meshes or AI-edited image pixels.

Independent exact free-source glTF `POSITION` bounds test proves the old centered-pivot manifest had ~0.514-m visual error and new X offset passes; the 2.5D source sprite baker refuses any renderer output that lacks valid actual Blender geometry proof; opt-in native Chrome/Firefox source World9 review refuses missing or unverified door geometry evidence.

## Strict scope

This is **artist-only original Quaternius cottage**. No Door portal or openable door behavior, physics collision, World9 placement, Core8C authority, Real Red Lion original art, alpha gameplay, network snapshot, Combat or public release changes. The user-approved generated image is a *visual reference*, not actual game/source proof. Genuine source Blender day/dusk PNG/WebP and native Chrome/Firefox original World9 comparison must pass on the exact same commit before saying real door corrected. Source license remains CC0 Standard verified against the original creator OpenGameArt archive in predecessor draft #1045. Full protected quality is independent and must not be mislabeled green if Combat fails.

**HOLD:** no merge, production deployment or building placement pending Main0/Graphics3/World9 approvals.
