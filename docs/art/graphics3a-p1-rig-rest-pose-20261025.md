# Graphics 3A P1 — True Joint Rest-Pose Qualification (2026-10-25)

**Input:** the five verified original free Standard ZIPs kept privately on X230i; SHA-256 and CC0 provenance are recorded in [acquisition evidence](graphics3a-p1-acquisition-evidence-20261025.md). **No vendor asset bytes committed.** Source tool: `scripts/graphics3a_p1_rig_probe.py`, with nine passing synthetic tests in `tests/test_graphics3a_p1_rig_probe.py`.

The probe reads native glTF/GLB JSON from the original ZIP without extraction, checking joint names/order and local rest-pose **T/R/S**. It treats q and −q as equivalent rotations. This deliberately corrects an overly permissive assumption that matching joint *names* is enough for direct animation reuse.

| Reference: `Superhero_Male_FullBody.gltf` (65 joints) vs candidate | Same names/order | Different local rest T/R/S | Missing/extra names | Verdict |
|---|---|---:|---|---|
| `Outfits/Male_Ranger.gltf` | YES 65/65 | **48** | 0 / 0 | **Retarget review required** |
| `UAL1_Standard.glb` | YES 65/65 | **62** | 0 / 0 | **Retarget review required** |
| `UAL2_Standard.glb` | YES 65/65 | **62** | 0 / 0 | **Retarget review required** |
| KayKit `Rig_Medium_MovementBasic.glb` | NO | **1 comparable** | **64 missing / 22 extra** | **Explicit cross-rig bone map required** |

**Real conclusion:** Quaternius Base, Outfit, UAL1 and UAL2 share a **65-joint named skeleton**, but rest-pose local transforms are **NOT identical** in their actual released glTF/GLB exports. A simple `animation_data.action = other_armature.action` or raw track-node assignment is *not* qualified. Outfit blending without bind-pose-aware skinning may distort shoulders, fingers and seams. KayKit has a different 23-joint naming/topology scheme, so it needs independently authored correspondence plus both bind-pose and visual review.

Local evidence is saved outside git as `~/Downloads/myaso-graphics3a-p1-assets-20261025/{Ranger,UAL1,UAL2,KayKit}-rig-pose-audit.json`. All nine tests of the probe **passed locally on X230i**. CI on the actual PR exact HEAD still must pass independently; no old CI green is inherited.

## Mandatory next step

Import one actual free Complete Ranger + Base head into an **offline**, isolated Blender-compatible environment. Inspect bind pose and skin deformation, materials, feet contact and source-compliant variation. Before any true combat clip, build a retarget step respecting source and target rest orientation and root-motion offsets, then compare original clip phases. Produce eight-direction 160px review frames in the original 960×540 arena scale, stable lighting and no false Combat state.

**Limit:** this probe does not read inverse bind matrices, ancestor transforms or evaluate animations/skin deform; it is a conservative early warning, not a complete rig compatibility verdict. No Blender visual proof, FPS performance, actual world authority/human client or production release is claimed by this document.

**Release P1 HOLD; P0 Silver Knight/Combat untouched.**
