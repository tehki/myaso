# Graphics 3B — Red Lion A2.32: physically attached door hinges

**22 October 2026 — original editable Blender source correction; no live game changes.**

## Owner-reported defect and source root cause

The two hinge straps of the Red Lion door look detached. Inspection of the original Blender 5.2.2 editable building scene found that the real wooden door object, Red Lion / door_front, has a front face at **world Y = −2.030 m**. The forged-iron straps instead occupy Y = −1.4245 to −1.3695 m: a **0.6055 m gap** between the nearest strap surface and the wooden door front.

## Corrected Blender scene — actual 3D meshes

- Both **original hinge straps** now have Y = −2.045 m, embedding 12.5 mm into the door face.
- Both **original iron hinge barrels** now have Y = −2.050 m, intersecting the physical wood and corresponding hinge straps.
- All six original **peen/rivet heads** now have Y = −2.075 m, intersecting their straps.
- **Follow-up lower-hinge support correction:** move ONLY the lower hinge's strap, barrel and all three rivets **24 cm upward**, from **Z=0.72 m to Z=0.96 m** in the actual saved editable Blender scene. The complete upper assembly remains at **Z=1.88 m**. This spaces the hinges more naturally above the threshold while preserving original X, hinge Y contact depths, iron materials, 20 separate meshes, door, upper hinge, windows, shutters, roof and portal.

The rebuilt **red_lion_a232_wrought_ironwork.blend** is the actual editable artifact, not a Photoshop/image-generation retouch. Actual Blender 5.2.2 readback verified all ten hinge metal meshes contact the original wood/iron and emitted red_lion_a232_hinge_attachment_blender_report.json with world-space bounds, contacts and source hash.

## 2.5D Cycles game-art projection

The original sprite export deliberately flattens world geometry. Moving real Blender hinge meshes to the physical door correctly introduced a visual height shift in this custom projection. The deterministic **build_red_lion_a232_ironwork.py** now corrects only the hinge parts in the export-only deformation AFTER the editable .blend has been saved, preserving the source physical placements. It also projects the hinges **8 cm inboard** on the rendered game door. No source world/roof/collision changes are involved.

The original Cycles PNGs, lossless day/dusk game WebPs, manifest hashes and proof render were regenerated from genuine Blender. Verified latest follow-up **6,792 RGB changed pixels, zero alpha changes**, original 228×297 sprite crop and exact roof byte identity. The lower hinge assembly is 24 cm higher, while the upper hinge remains fixed.

**Inspect:**
- Editable 3D scene: assets/environment/greyhaven/a232-review/red_lion_a232_wrought_ironwork.blend
- **Actual Blender before vs 24cm-raised lower hinge**: assets/environment/greyhaven/a232-review/red_lion_a232_lower_hinge_raised_blender_comparison.png
- Original A2.32 old detached ironwork vs correctly mounted hinge visual: assets/environment/greyhaven/a232-review/red_lion_a232_original_vs_attached_projection.png
- Actual Blender contact report: assets/environment/greyhaven/a232-review/red_lion_a232_hinge_attachment_blender_report.json
- Deterministic generator: tools/art/build_red_lion_a232_ironwork.py
- Geometry validator: tools/art/verify_red_lion_a232_door_hinge_attachment.py
- Node regression: tests/art-direction-a232-hinge-attachment.test.mjs

**Follow-up local acceptance:** reopen the revised editable Blender 5.2 scene; assert the actual lower strap, barrel and rivets now all center at Z=0.96 m, upper ones remain at Z=1.88 m; independently assert hardware-to-door / rivet-to-strap overlaps. Rebuild original Cycles renders and lossless day/dusk source WebPs, then rerun all art and geometry regression tests. No automated release or merge.

**Limits:** DRAFT art only, not yet approved by owner as final gameplay scale; live online-game.mjs is unchanged; no server/Combat/Physics/Items or Red Lion World integration; no main merge or release. Strict protected CI and Art Director visual signoff remain required. Pre-Alpha 0.1 remains the minimal Combat arena.
