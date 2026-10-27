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

## Original-source qualification — completed on X230i 2026-10-26

X230i reconnected and both new exact-script source-data runs finished successfully, using the verified publisher free Standard ZIPs and original binary geometry with private reduced-resolution lookdev textures. The original meshes and license/archive proofs are unchanged. The actual sampled pose was **UAL1 `Walk_Loop` at 50% (approximately 0.667 s)**, and the diagnostic measures the **target rest pose**, not a signed gap in the animated pose.

| Real-source collar diagnostic (meters) | Male Peasant | Female Peasant |
|---|---:|---:|
| Outfit mesh top Y | 1.558654785 | 1.518432975 |
| Head cut Y (outfit top + 0.02) | 1.578654785 | 1.538432975 |
| All open head-boundary vertices | 274 | 268 |
| Boundary vertices sampled near collar | **205** | **199** |
| Outfit vertices eligible in collar band | 4,195 | 6,266 |
| Nearest-vertex distance minimum | 0.019887 m | 0.024719 m |
| Nearest-vertex distance median (p50) | **0.085897 m** | **0.080666 m** |
| Nearest-vertex distance p95 | **0.110404 m** | **0.118367 m** |
| Nearest-vertex distance maximum | 0.128442 m | 0.123118 m |
| Sampled vertices with nearest vertex over 2 cm | 99.02% | 100.00% |
| Sampled vertices with nearest vertex over 5 cm | 74.15% | 73.37% |

**Interpretation: ART HOLD.** These numbers can indicate poor collar alignment or simply sparse/offset vertex topology; no visible seam size, watertightness, penetration or garment clipping is established from them. Do not relabel p95 as an actual geometric gap. The next qualification must measure nearest **surface** distance and inspect real close-up collar views at multiple clip phases and eight facings. A small vertex distance would also not prove correctness, because meshes can overlap.

Private evidence is in each X230i `private_head_review_outputs/<Male_Peasant|Female_Peasant>/seam_diagnostic_20261026/head-attachment-review.json`, including the exact source-archive hashes and `neck_collar_rest_pose_geometry_diagnostic`.

Both live-source renders emitted eight views and **reproduced the original contact-sheet hashes** from the previous private prototype:

- Male Peasant: `e3897e4addfb5c651631b00e2b7d3cb4fb463e5e227e7077bfc101c1d8bc287c`.
- Female Peasant: `52db765d080ee610ceeb21ed0ef039303f841cdbb547bd35bc126a7d3d2a0a35`.

The private assets and rendered PNGs remain **outside the repository**. Exactly **10/10** synthetic collar tests passed on Serj; both private source-data render runs exited successfully. This confirms a functioning diagnostic pipeline, **not** an accepted Peasant head seam.

## Release boundaries

This change affects only Graphics 3A private offline tooling, source-only tests, documentation and an additive CI command. No vendor binaries, raw meshes or generated textures were checked into Git. P0 Silver Knight, live player models, authoritative Rust World, Combat and networking are unchanged.

**P1 ART HOLD / no merge, no staging, no deployment.** Main Orchestrator 0 and the owner retain release authority.
