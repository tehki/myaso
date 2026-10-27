# Graphics 3A P1 — Approved Publisher Ranger Hood on Peasant Character

**Date:** 2026-10-26
**PR:** #1041 — Draft
**Authority:** Graphics 3A art-review only
**Verdict:** **TECHNICAL PASS; VISUAL IMPROVEMENT; ART/RELEASE HOLD**

## Source and licensing boundary

This review uses only the owner's already-approved free **Standard** Quaternius Modular Fantasy Outfits and Universal Base Characters and UAL1 animation library. Nothing was purchased or added to the live game. Source files remain in the private X230i archive, no original glTF/BIN/texture bytes, preview PNGs or derivative materials are committed.

**Publisher source ZIP:** `Modular Character Outfits - Fantasy[Standard].zip`
**Original ZIP SHA-256:** `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70`

| Character | Original author hood glTF source | GLTF member SHA-256 |
|---|---|---|
| Male Peasant | `Exports/glTF (Godot-Unreal)/Modular Parts/Male_Ranger_Head_Hood.gltf` | `57affa34c145d2c1a02a3d9b17066e22b84eb4ce2bb79c6c7b90588af00846b6` |
| Female Peasant | `Exports/glTF (Godot-Unreal)/Modular Parts/Female_Ranger_Head_Hood.gltf` | `3ac6867e32cba7793d9393d4844cc21f38c53e833d468d7d5adebfb42bba7d0e` |

Both source members are located below the single exact `Modular Character Outfits - Fantasy[Standard]/` ZIP root. Official author textures, notably `T_Ranger_BaseColor.png`, are loaded from the private source ZIP; they are not fabricated or rewritten.

## Engineering result

Real publisher hood geometry has **1,240 skinned vertices** and **2,136 triangles** per gender, one original `MI_Ranger` material, `TEXCOORD_0`, normals, and four-slot joint/weight attributes. The original 65-joint named skeleton matches the approved Peasant source.

- Head, neck, spine and both clavicle rest-world positions show **0.0 m mismatch** for both matched male/female rigs.
- Hood and Peasant mesh transform differences: **0.0**.
- Male hood inverse-bind/rest skin max absolute error: `8.443e-7`; Female `6.925e-7`.
- Each hood fits the original corresponding Peasant rig without an arbitrary scale correction, invented reorientation, or synthetic remapping beyond names.

The reusable private preview in `scripts/graphics3a_p1_head_attachment_review.py` now has an explicit optional `--approved-hood-archive` argument. **Omitting the argument leaves the original preview unchanged**. The opt-in command locates only the exact whitelisted publisher member for `Male_Peasant.gltf` or `Female_Peasant.gltf`, validates skeleton topology and rest-world anchors, remaps weights by bone name and overlays its real textured mesh using the existing sampled UAL1 animation. No vendor file is modified or gameplay asset exported.

Pure source-side guarantees are in `scripts/graphics3a_p1_hood_review_rules.py`, with **9/9 tests passing on Serj**, including missing/duplicated/mismatched members, invalid target models and nonfinite/displaced anchor rejection. These tests are additive to the protected `quality` workflow. Graphics P1 cumulative synthetic test count: **115** (previous 106 + 9).

## Actual original-source eight-facing preview

Both gender runs of the **committed** preview renderer completed successfully on X230i. They use real UAL1 Standard `Walk_Loop` at 50% (≈0.667 s), 512px collar camera, eight distinct yaw rotations, publisher Dark body atlas with opt-in skin-lookdev neutral paint, opt-in exact plane cut and eyebrow accessory omitted.

| Real original-source composite | Eight-facing 4096×512 private contact SHA-256 |
|---|---|
| Male Peasant + original Base head + approved Male Ranger Hood | `3b7938def4b36c151632e042b02b61fdd4282d6114f5a2bd97f70a5f5090be0e` |
| Female Peasant + original Base head + approved Female Ranger Hood | `5b552c87e50d8de357a1850c36c5117def9b24a189236ebb69077d4c95dfb453` |

Both outputs match the **earlier uncommitted independent local hood prototype** byte-for-byte at the contact-sheet SHA-256 level, verifying reproducible integration of the source-only code.

The reports are private on X230i at:

`~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/ranger_hood_committed_20261026/head-attachment-review.json`

Each private report includes the original hood ZIP SHA-256 and full source member, alongside original animation/archive and contact-sheet hash.

### Visual findings (eight-view review)

- **Improvement:** The supplied fully modeled hood covers the large bald scalp area, supplies a medieval-looking head silhouette and visually surrounds parts of the Peasant neck, reducing the naked head/neck appearance. The hood's lower drape follows the authored bone rig rather than being a static attachment.
- **Not yet approved:** Strong olive-green patches and bright metal-like gray side panels clash with the Peasant's predominantly brown fabrics; sections of exposed cheek texture remain rough. Some overlaps along the lower hood/collar are still evident and need in-Blender fitting/art direction. This is an attractive *candidate*, not an accepted authentic gritty-medieval material/style treatment.
- The underlying head-to-garment **unsigned** nearest triangle-surface p95 is **10.99 cm Male / 11.84 cm Female**, unchanged by the hood overlay. These numbers do not equal visible gap width; they also must **not** be used to claim that the open base head/garment seam is physically solved.
- No independent verification of collision, cloth/body penetration, floor contact, dash/kick poses, correct Rust World East/West yaw orientation, actual 960×540 Chrome/Firefox gameplay performance or multiplayer stability has been done.

## Safe reproduction (original private ZIPs only)

```bash
python3 scripts/graphics3a_p1_head_attachment_review.py \
  --target-model "/private/Male_Peasant/Male_Peasant.gltf" \
  --base-archive "/private/Universal Base Characters[Standard].zip" \
  --base-model-suffix "Superhero_Male_FullBody.gltf" \
  --animation-archive "/private/Universal Animation Library[Standard].zip" \
  --animation-model-suffix "Unreal-Godot/UAL1_Standard.glb" \
  --approved-hood-archive "/private/Modular Character Outfits - Fantasy[Standard].zip" \
  --clip Walk_Loop --fraction 0.5 \
  --camera-mode collar-closeup --cut-method plane \
  --face-parts without-eyebrows --head-paint neutral-to-skin-prototype \
  --output "/private/review/Male_Peasant/hood"
```

## Next gates

1. Graphics Art Director 3 review of material colors, drape/collar clipping and skin/headgear style; any alternative material treatment remains private and opt-in until approved.
2. Multi-phase authentic Idle, Walk, Sprint, Jump, Roll (and relevant action) close-ups in all eight view directions; validate remaining exposed neck seam, correct body skin deformation and UV shading.
3. Export only after approved Blender-source model construction and full asset-provenance audit, then verify real native 960×540 Chrome/Firefox 2-player/4-player gameplay and performance p50/p95.
4. Final Art Director 3, Core/Combat QA, Main Orchestrator 0 and owner release GO.

**Draft / ART HOLD / RELEASE HARD HOLD. No Silver Knight, World, Combat, runtime or network changes; no merges or deployments.**
