# Graphics 3A P1 — Original-Source Complementary Head/Torso Neck Geometry

**Date:** 2026-10-26
**Scope:** strictly private Quaternius original-source art/engineering; no runtime or Combat changes
**Owner criteria:** independent head, interchangeable armor, complete unequipped body
**Status:** **BOTH REST-GEOMETRY CAPS MATCH / FUNCTIONAL ART & RELEASE HOLD**

## Actual original-source result on X230i

The previous documented head underside prototype closed two cut boundaries per original Base Character (one major collar ring plus a tiny anterior ring). This continuation independently clipped the **lower original base humanoid mesh** at the same collar plane, preserving its original skinned mesh and using a mirrored, winding-corrected version of the qualified upper plane clipper. The real lower shell also has exactly the same two planar boundaries, with **no other open edges** at this cut.

`scripts/graphics3a_p1_lower_body_neck_cap.py` now produces an **independent lower-body neck cap** from the original rest geometry, with **opposite/upwards-facing normals** and original source skinned boundary weights. It restores original handedness and source coordinates after clipping; the original ZIP/glTF is not edited or exported.

| Real original source | Male | Female |
|---|---:|---:|
| Shared original collar cut y | 1.578655 m | 1.538433 m |
| Matching cut loops | 84 + 4 vertices | 80 + 4 vertices |
| Upper head underside cap triangles | 84 | 80 |
| Lower torso-side cap triangles | 84 | 80 |
| Lower original base-shell vertices | 5,791 | 5,815 |
| Lower original base-shell faces | 9,988 | 10,092 |
| **Head/torso coincident boundary vertices** | **88/88** | **84/84** |
| **Maximum corresponding boundary XYZ mismatch** | **0.0 m** | **0.0 m** |
| **Maximum matching bone-weight delta** | **1.11×10^-16** | **1.11×10^-16** |
| Opposing cap normals (-Y head / +Y torso) | **PASS** | **PASS** |

All measurements came from the owner-approved **original free Standard Quaternius Base Character**, actual Peasant collar plane and real glTF POSITION/NORMAL/TEXCOORD/JOINTS/WEIGHTS. The lower result is neither a placeholder character nor a fabricated rig.

The fail-closed pure function `verify_matching_head_torso_caps` checks every boundary position, original bone index/weight influence and opposite cut-facing normal; refuses noncoincident positions, mismatched skin weights, incorrect normals, incomplete data or unclear joint mapping. **Actual X230i Male and Female original-source comparisons both passed.**

## Safeguards and CI

- The earlier pure head-cap module and its **12** synthetic tests were already committed and executed successfully against real sources, with an opt-in private eight-facing Walk renderer for the head cap.
- New `scripts/graphics3a_p1_lower_body_neck_cap.py` and `tests/test_graphics3a_p1_lower_body_neck_cap.py` provide **12 additional synthetic tests**, all **12/12 passed on Serj**, Python compilation passed.
- Total Graphics 3A P1 source-only synthetic tests: **194** (earlier 170 + 12 head cap + 12 complementary torso/interface); the separate **70 genuine UAL1 hood motion poses** remain rig-only evidence.
- Existing protected quality CI adds the 12 new tests without changing or relaxing any Combat, Core, World, player/browser or main-release checks.
- No source third-party archives, images or Blender assets were committed. No runtime/gameplay files modified.

## Strict interpretation and remaining owner conditions

**This passes matched REST-POSE geometry only.** It does **not** establish a finished playable head, a seamless animated seam at all poses, correct detachable state presentation, proper neck materials/UVs, actual gameplay or network-authoritative severing, collision, blood, nor any release acceptance. Existing Peasant clothing and Ranger hood/collar appearance still need Blender-level artistic work.

A genuine visually complete and unequipped base body has **not** been verified, nor have alternate armor sets been equipped and removed in the game. Their separate owner criteria remain open. The lower Base Character mesh is a source geometry segment, not proof that it satisfies unequipped appearance requirements.

**Combat 4 is busy with Combat Pre-Alpha** and receives no work, issues, hooks or QA demands as part of this graphics experiment. Main Orchestrator 0 owns later integration scheduling.

**Draft PR #1041: ART/RELEASE HARD HOLD. No merge, deployment, P0 Silver Knight replacement, original asset uploads, purchases or CI bypass.**
