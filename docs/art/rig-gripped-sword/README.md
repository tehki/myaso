# Graphics 3A — original Silver Knight × Graphics 3B Blender sword: actual bone-gripped roll preview

**P0 First Playable / 2026-10-21. ART CANDIDATE — HUMAN VISUAL FAIL/HOLD. NOT live gameplay, not integrated and not production approved.** Source parent: [Graphics 3A last-accepted MainHand #528](https://github.com/tehki/myaso/pull/528). Original Silver role renderer [#497](https://github.com/tehki/myaso/pull/497) and original 3B sword asset [#500](https://github.com/tehki/myaso/pull/500) remain untouched.

## What has genuinely changed

The earlier experimental screen-space sword attachment floated beneath the Knight during roll; its `silver_roll` overlay was disabled. This new review uses **the owner's original Silver Knight A3 roll GLB action** plus **all six actual source meshes** from Graphics 3B's `blacksmith_armory_p0_source.blend`. In Blender the six sword parts are transformed every frame with the original 22-bone rig's `mixamorig:RightHand` 3D pose, so apparent depth/occlusion follows actual source geometry instead of a flat rotated WebP at an approximated 2D wrist coordinate. No original source Knight GLB or 3B `.blend` is modified or bundled in this child.

### Critical bug found and fixed during artwork reproduction

A first smoke preview showed a huge gray sphere obscuring the tumbling body. This was **NOT an existing Knight atlas defect**: Blender's `bpy.data.libraries.load` restored the faceted pommel object's **mesh** but omitted its original object scale/translation. The true original 3B pommel scale is `(0.105, 0.100, 0.105)`, while the appended preview mistakenly used identity `(1,1,1)`. Re-rendering after restoring all six source object matrices from an SHA-pinned Blender source manifest eliminated the oversized sphere. The original source [Silver roll WebP](../../../web/assets/knights/silver_roll.webp) has no such sphere.

**Provenance/reproduction:** `tools/art/extract_original_3b_sword_transform.py` reads original 3B `.blend` and creates [original transform manifest](original_3b_sword_transforms.json) pinned to source SHA-256 `db5f256c7d0e6e3f9e026966cdbe475bc16b532f77a8858e15345870e7b68dd6`. `tools/art/render_rig_gripped_silver_roll_review.py` explicitly verifies that hash and all six mesh vertex counts before restoring matrices. Original hand animation, geometry and all production WebPs remain byte-identical.

## Required inspectable art — all eight directions and 350 ms

The package contains:

- [**350 ms eight-direction animated before/after GIF**](silver_8direction_bone_grip_350ms.gif): unarmed original Silver source top, bone-gripped Blender sword bottom, eight frames (40/40/50/40/40/50/40/50 ms).
- [**Original owner Silver WebP padded to equal review framing**](silver_roll_unarmed_original_reference.webp).
- [**New 8×8 bone-gripped 1792px WebP review atlas**](silver_roll_original_bone_gripped_sword_review.webp).
- [Manifest with source-art and generated-art SHA-256 hashes](review_manifest.json).
- [64 actual Blender bake-frame measurements](rig_grip_bake_report.json).
- [Eight-pose 3D sword/character geometry envelope](source_sword_clearance_proxy.json).
- [Browser review page](../../../web/silver-rig-grip-a3-review.html), offering loop, pause, previous/next, exact scrub and highlight-facing. Host the repo root using a local HTTP server and open `/web/silver-rig-grip-a3-review.html`.

**Native browser evidence** is genuine headless browser screenshot output, not a proposed future capture:

| Phase | Chrome 154 | Firefox 153.4 |
| --- | --- | --- |
| Start (frame 1/8) | [Screenshot](silver_rig_grip_chrome_frame0.png) | [Screenshot](silver_rig_grip_firefox_frame0.png) |
| Inversion (frame 4/8) | [Screenshot](silver_rig_grip_chrome_frame3.png) | [Screenshot](silver_rig_grip_firefox_frame3.png) |
| Recovery/tuck (frame 6/8) | [Screenshot](silver_rig_grip_chrome_frame5.png) | [Screenshot](silver_rig_grip_firefox_frame5.png) |
| End (frame 8/8) | [Screenshot](silver_rig_grip_chrome_frame7.png) | [Screenshot](silver_rig_grip_firefox_frame7.png) |

[Chrome JSON](silver_rig_grip_chrome.json) · [Firefox JSON](silver_rig_grip_firefox.json). Both engines decoded two **1792×1792 genuine original/derivative WebP atlases**, then executed **64/64 frame-and-facing checks** with **zero JS or HTTP errors**; four screenshot captures per browser. This proves the source preview loads/plays, **not** that the animation is correct in actual multiplayer.

## Actual visual assessment and blocking defect

This is **better than the original 2D floating attachment**, since the sword maintains a transform relative to the original animated wrist bone in each source pose. **But it is still visually incorrect for a grounded medieval combat roll**. In inverted phases the sword extends sideways and near/through the body/putative ground, with questionable human wrist grip. It does not read as a naturally protected blade while executing a safe shoulder roll.

Measured in actual Blender source-space: the lowest transformed 3B sword mesh vertex sits below the lowest skinned Knight-geometry vertex in **6 of 8 sampled phases**, with relative differences approximately **−0.249, −0.416, −0.141, +0.304, +0.153, −0.076, −0.309, −0.249 source units**. The imported GLB's source `z=0` is **not** a verified World/Greyhaven ground plane (even the hand source Z is negative), so the separate Z=0 measurements **MUST NOT** be interpreted as actual collision/ground penetration; they are a risk proxy only. There is no measured real floor, swept collision, opponent overlap, two-client observer, or source-to-server clock agreement. The original Silver roll animation was not changed or reapproved.

**Next 3A art correction:** author a physically defensible blade-tuck/sword-protection secondary animation (hand grip, shoulder clearance and guard orientation) for all eight facing directions, then render a true in-world actor at Greyhaven gameplay scale with ground and building reference and 350 ms Combat timing. Recheck whether separate held-sword sprites are viable through inverted frames; do not simply rotate a sword around the pelvis again. Keep unapproved sword overlays **disabled for jump and roll in live gameplay**; the actual Items server-owned sword, if equipped, must remain owned even when hidden visually.

## Source reproduction

On an authorized computer holding the original owner Silver source and original 3B Blender source, use Blender 4.5.14 and Python Pillow:

```sh
blender -b blacksmith_armory_p0_source.blend --python tools/art/extract_original_3b_sword_transform.py -- --output docs/art/rig-gripped-sword/original_3b_sword_transforms.json
blender -b --python tools/art/render_rig_gripped_silver_roll_review.py -- --knight silver-knight-roll-A3.glb --sword-blend blacksmith_armory_p0_source.blend --sword-manifest docs/art/rig-gripped-sword/original_3b_sword_transforms.json --output .grip-full --samples 1 --engine CYCLES
python tools/art/pack_rig_gripped_silver_roll_review.py --source-frames .grip-full --original-atlas web/assets/knights/silver_roll.webp --out docs/art/rig-gripped-sword
node --test tests/silver-rig-grip-source-review.test.mjs
```

The exact original owner GLB and original Graphics 3B .blend source are **inputs**, not redistributed binaries in this child. Raw 64 temporary 224px PNG frames are reproducible by Blender and are intentionally **not committed**; the reviewed WebP 8×8 atlas, GIF, SHA manifests, screenshot evidence and authoring scripts are committed. This is a source-art build, **not** an editable equipped-sword production animation pipeline.

## P0 acceptance and shared ownership

- **3A owns** realistic silhouette, hand grip, 8-way pose frames, camera/scale/roll effects and human visual approval.
- **Combat / Core owns** 170 ms dodge active +180 ms recovery, hitboxes, movement, server tick and server-authenticated facing. Graphics sprites never apply root motion or grant dodge i-frames.
- **Core 8A/8B / Items 2B owns** one canonical sword ID, fenced writer, real MainHand current-state receipt, reconnect epoch and replicated observer inventory. Every synthetic `MainHand` payload used in other 3A previews is forgeable; no trusted production adapter is enabled here.
- **World 9 / Graphics 3B / UI** owns the genuine four Blacksmith rack swords, world physical pickup, alpha hit tests and one nonoptimistic UI/Combat pointer arbitration gate. No parallel independent pickup handler is added here.
- **Orchestrator** [#360](https://github.com/tehki/myaso/issues/360) and [#480](https://github.com/tehki/myaso/issues/480) controls merge/deployment, exact-head protected CI, rollback and actual four independent Chrome/Firefox players testing City→Armory→sword pickup→fist-v-sword PvP.

**Readiness: IMPLEMENTED original-mesh SOURCE PREVIEW and native-browser TESTED. VISUAL FAIL/HOLD; NOT INTEGRATION-READY, NOT INTEGRATED, NOT PLAYABLE. No default renderer activation, no main merge and no deploy.**
