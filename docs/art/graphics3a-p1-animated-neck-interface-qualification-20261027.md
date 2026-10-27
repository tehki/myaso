# Graphics 3A P1 — Animated Head/Torso Seam Qualification Gate

**Status:** Numeric checker plus synthetic regression tests; **original-source pose acceptance NOT COMPLETE; ART/NATIVE/RELEASE HOLD**.

**Parent:** Draft PR #1041, following the real Male/Female rest-pose cap matching report dated 2026-10-26.

## Source-only changes

- New Python function **verify_animated_head_torso_seam** requires both head and torso to pass the existing exact rest-pose cap validation first.
- Each independently named sampled pose supplies separate **head** and **torso** palettes mapping original skin-joint indices to 3x4 affine skinning matrices. Matrices must include correct inverse-bind and mesh-space handling; raw joint world transforms are not interchangeable with skinning matrices.
- The function linearly skins the boundary independently on both sides, measures maximum vertex separation in meters per pose and fails closed on bad transforms, missing joints, duplicate/missing pose labels or any gap beyond tolerance.
- Current default numeric limit is **0.0001 meter**. This is a diagnostic drift threshold, *not a visually approved collar or skin seam tolerance*.
- Eight new synthetic regression tests are added to the protected quality workflow, with zero gameplay or asset-binary changes.

## Synthetic tests and limitations

New module: scripts/graphics3a_p1_animated_neck_interface.py

New tests: tests/test_graphics3a_p1_animated_neck_interface.py

The labels Idle, Walk, Sprint, Jump and Roll are **synthetic test data**. They must **never** be represented as genuinely sampled publisher animations or art-approved clips. A passing numerical boundary check says nothing about clipping through clothing, face/neck materials, normals under motion, actual timing, game-scale lighting or eight-direction beauty.

## Real-source next milestone

1. On the approved private original-source workstation, regenerate the Male and Female capped head/torso pairs at their exact documented collar planes.
2. Sample actual original UAL1 Idle/Walk/Sprint/Jump/Roll motions at multiple meaningful phases, retarget them onto the original approved bodies, produce both cap skin palettes in a common source-local mesh space, and use the new checker.
3. Capture SHA256 source provenance, animation identifiers/timestamps, source geometry hashes, numeric per-pose seam data and authentic 8-direction Blender review renders. Keep publisher assets and original PNGs private.
4. Independently inspect true anatomical geometry, collar/hood/hands intersection, skin/material transitions, grounding and movement at actual game scale. The checker is **not** a replacement for these art reviews.
5. Submit original-source evidence to Graphics Orchestrator 3. Native Chrome/Firefox 2/4-player validation requires later Main0 authorization after actual game integration.

## Non-negotiable boundaries

P1 offline geometry QA only. **No vendor asset uploads, Combat mechanics, game runtime, network/event protocols, equipment mutations, gore G1, Silver Knight replacement, merge or deployment.**

**Draft PR #1041 remains ART / NATIVE / RELEASE HARD HOLD.**
