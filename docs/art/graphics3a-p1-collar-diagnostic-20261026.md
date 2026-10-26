# Graphics 3A P1 — Collar Cut & Head Attachment Diagnostic

**Date:** 2026-10-26  
**Authority:** Graphics 3A (offline-only)  
**Status:** **HOLD — diagnostic code validated; real private-source measurement pending**

## Purpose

The approved Quaternius free Standard Peasant outfits (`Male_Peasant.gltf` and `Female_Peasant.gltf`) are headless. A private X230i lookdev prototype attached the corresponding approved Base Character head, eyes and brows and rendered each at eight orientations using a true UAL1 `Walk_Loop` pose. This established **technical feasibility**, not an approved character or finished neck seam.

The previous head attachment cut the original Base Character body mesh above `outfit mesh top + 0.02 m`, but reported no numerical collar geometry assessment. This update introduces an intentionally conservative, offline diagnostic without modifying vendor assets or any gameplay system.

## Added source-only implementation

- `scripts/graphics3a_p1_neck_seam_qc.py`: computes open-edge vertices of the clipped head mesh, filters boundary vertices near the actual cut, filters nearby outfit vertices, and measures each sampled head vertex's nearest outfit *vertex* in rest-world 3D coordinates. Records minimum, median, p95, maximum distances, as well as fractions over 2 cm and 5 cm.
- `scripts/graphics3a_p1_head_attachment_review.py`: evaluates the new diagnostic immediately after assembling its private head/body components; includes `neck_collar_rest_pose_geometry_diagnostic` in the existing private `head-attachment-review.json`.
- `tests/test_graphics3a_p1_neck_seam_qc.py`: ten synthetic no-vendor regression tests for open-boundary triangle topology, offset and coincident mesh samples, nonfinite coordinates, missing head/collar geometry, and explicit **Art Director review required**.
- Protected `quality` CI: runs the added source-only tests without bypassing any original mandatory Combat/Core/World checks.

**Verification:** Serj ran Python compilation of the committed head attachment reviewer and seam helper, plus the previous 12 head-attachment rule tests and all **10/10 new seam tests**. All passed. No third-party ZIP, glTF, texture or derived PNG was copied to Serj or GitHub.

## Measurement interpretation

A 3D **nearest-vertex** distance is **not** a signed closest-surface distance, and cannot prove that surfaces are watertight, nonintersecting, free of visible cloth/skin seams or appropriately colored. Small distances may conceal penetrating surfaces; larger distances may be artifacts of low polygon density rather than actual gaps. These numbers must **never** be labeled acceptance or used automatically to pass art review.

The helper **always** emits `ART_DIRECTOR_SEAM_INSPECTION_REQUIRED`, and fails closed on missing neck boundary, absent collar geometry, degenerate/nonmanifold cut triangles and nonfinite coordinates.

## Source-data qualification not yet performed

At this checkpoint, the X230i private-assets machine did not respond to a new remote command. Therefore **no new real Male/Female Peasant collar p50/p95 or clearance numbers are claimed**. Prior real-source lookdev images and their verified SHA256 values remain recorded in [Peasant head-attachment evidence](graphics3a-p1-peasant-head-attachment-20261025.md).

The next genuine qualification is to run the **updated exact-head** offline reviewer with both private original Peasant and Base Character models on X230i, record its per-gender `neck_collar_rest_pose_geometry_diagnostic`, inspect close-up neck seam at cardinal and diagonal facings, and repeat across several real UAL1 animation phases. Do not turn off the guard if it reports invalid or absent geometry. Then obtain Graphics Art Director review.

## Release boundaries

This change affects only Graphics 3A private offline tooling, source-only tests, documentation and an additive CI command. No vendor binaries, raw meshes or generated textures were checked into Git. P0 Silver Knight, live player models, authoritative Rust World, Combat and networking are unchanged.

**P1 ART HOLD / no merge, no staging, no deployment.** Main Orchestrator 0 and the owner retain release authority.
