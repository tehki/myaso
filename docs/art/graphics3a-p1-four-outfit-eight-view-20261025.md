# Graphics 3A P1 — All Four Free Quaternius Outfits: Eight-Facing Original-Source Proof

**2026-10-25 · VERIFIED LOCAL REVIEW · 32 STATIC PNG VIEWS · ART/ANIMATION/RELEASE HOLD**

This extends [Male Ranger eight-view baseline](graphics3a-p1-ranger-eight-view-proof-20261025.md) to **every actually included free complete outfit**, without claiming the publisher's paid full 12-outfit Source collection.

## Source & actual local execution

- Official author ZIP `Modular Character Outfits - Fantasy[Standard].zip`, **CC0 1.0** embedded, SHA256 `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70`. Stored privately on X230i; originals unmodified.
- Used [offline original ZIP stager](../../scripts/graphics3a_p1_outfit_blender_review.py) in **prepare-only mode** on `Male_Ranger`, `Female_Ranger`, `Male_Peasant`, `Female_Peasant`. Staged **8, 8, 8 and 5** actual glTF/buffer/texture dependencies, respectively (four original rigged complete character glTFs, not substitute generated geometry).
- Prepared **distinct locally derived review copies**: identical original `.gltf`/`.bin` geometry and downscaled **max 512px** PNG textures solely for 160px review. Every original and derived dependency has SHA256 in each private `source_mapping.json`; original 2048/4096 texture resolutions and free publisher ZIP are retained.
- Rendered each source with [committed EGL 8-facing static reviewer](../../scripts/graphics3a_p1_egl_static_review.py): fixed 160×160 orthographic camera, neutral constant lighting, rotations `row*45°`, same bounded original-scale policy, eight individual RGBA PNGs + 1280×160 contact sheet, private `static-review.json`. Current tool uses a Mesa software EGL context fallback on X230i; successful test uses isolated `trimesh 5.2.0/pyrender 0.1.45/Pillow 13.0.0/numpy 2.5.4/PyOpenGL 3.1.10`. The original Blender wheel never installed and is not required for these **static**, nonanimation proofs.

| Actual free outfit | Locally rendered 160×160 source rest-pose frames | Full contact sheet SHA256 | α-pixel coverage min–max |
|---|---:|---|---:|
| **Male Ranger** | 8 of 8 | `fd770b9e15cd569c68796b6dba4f2b4d150bd880a77bfa737c870f5b24947718` | 1,506–2,519 |
| **Female Ranger** | 8 of 8 | `537d21a7be466f3a06a5ae2c2ab3c026b3d2f945a4054804fa65d78203f71f1c` | 1,550–2,492 |
| **Male Peasant** | 8 of 8 | `05a16555f869f74ddc958e080c09e2c0aaef6c0fbfffeaee3970e580dfa2f20f` | 1,633–3,196 |
| **Female Peasant** | 8 of 8 | `e78b6474a27a2203cc0aa6bbb437af4bac3fa827e32c87146a13218edf5b6d0e` | 1,489–2,787 |

**32/32 render checks passed.** Every row exceeds 250 alpha pixels and stays under the 20,000 clipping/sizing ceiling. Local artifacts and reports live at

`~/Downloads/myaso-graphics3a-p1-assets-20261025/offline-character-review/render_frames/<Male_Ranger|Female_Ranger|Male_Peasant|Female_Peasant>/from_repository_script/`

Each directory contains `rest_00.png` through `rest_07.png`, `static_eight_view_contact_sheet.png`, and a source/metadata report `static-review.json`. These are deliberately **NOT** embedded or committed to GitHub; the release is HOLD.

**Reproduction command (with your locally staged review source):**

```bash
python3 scripts/graphics3a_p1_egl_static_review.py \
  --model "/private/review/lowres_preview_derived/Male_Ranger/Male_Ranger.gltf" \
  --output "/private/review/render_frames/Male_Ranger"
```

For other complete free variants, substitute exact `Female_Ranger`, `Male_Peasant`, or `Female_Peasant` names in private source paths. Source safety requires all original referred dependencies present. The synthetic audit tests for the renderer and stager run under protected quality without graphics dependencies.

## Critical art and gameplay HOLD

The stills intentionally show a **T/rest-pose character**. They are suitable for silhouette, source-texture color and camera-offset discussion only. Not proof of legitimate Idle/Walk/Sprint/Jump/Roll or any attack pose, directional server truth, 350ms Roll / 140ms Dash, grounded physical shadow, a 960×540 original Canvas presentation, Chromium/Firefox genuine server-connected multiplayer p50/p95, equipment/hitbox or death/reconnect identity continuity.

**Do not label these static screenshots P0 Silver Knight replacements.** Player role remains the original approved Silver, and the original Rust World is authoritative. Core/Combat unchanged.

**Pending for Art Director 3:** assess whether stylized green Ranger and brown/cream Peasant silhouettes align with desired Moon Games characters at final screen scale. Prioritize a **real rig pose/bind-aware** animation retargeting experiment; the separately measured 48/62 local-rest-pose differences are not resolved by static T-pose renders. Then produce original Blender/FBX source-clip animated 8-dir frames and four-player Chrome+Firefox acceptance.

**Verdict:** P1 OFFLINE SOURCE / STATIC VIEW PASSED; **P1 MOTION, LIVE, P0 RELEASE HOLD.** No merge, paid asset, public raw vendor pack, staging or deployment; Mid-Poly Knight excluded.
