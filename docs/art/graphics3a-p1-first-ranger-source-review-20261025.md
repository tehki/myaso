# Graphics 3A P1 — Offline Male Ranger Source and Review Harness

**Date:** 2026-10-25 · **Verdict: P1 ART HOLD — no Blender visual render or playable character validation claimed.**

**Repository:** [Draft PR #1041](https://github.com/tehki/myaso/pull/1041), independent of [Silver P0 #1040](https://github.com/tehki/myaso/pull/1040). Original free Standard archive licenses and immutable ZIP SHA256: [acquisition record](graphics3a-p1-acquisition-evidence-20261025.md). Detailed rig comparisons: [pose investigation](graphics3a-p1-rig-rest-pose-20261025.md).

## What was actually executed on X230i

1. `scripts/graphics3a_p1_rig_probe.py` reads original publisher glTF/GLB metadata within their ZIPs without extraction, compares 65-joint order and local rest T/R/S rather than merely the names. **Nine synthetic regression tests PASS on X230i**.
2. Against real free archives: Base↔Outfits Male Ranger **48/65** local rest transforms differ; Base↔UAL1 **62/65** differ; Base↔UAL2 **62/65** differ. KayKit has a separate 23-joint rig with **64 missing / 22 additional** joints versus the Quaternius 65-joint scheme. **Direct clip assignment is not qualified**; root-motion and bind-pose-aware retargeting are future prerequisites.
3. `scripts/graphics3a_p1_outfit_blender_review.py` includes a **prepare-only** mode. Tested against the actual official free `Modular Character Outfits - Fantasy[Standard].zip`, hash `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70`. Staged exactly the eight original `Male_Ranger.gltf` dependencies (one .gltf, one .bin, six .png textures); all bytes remain **private** on the X230i in `~/Downloads/myaso-graphics3a-p1-assets-20261025/offline-character-review/private_vendor_stage/Male_Ranger/` (not in git). Five synthetic staging tests **PASS**.
4. The generated local `Male_Ranger-offline-review.json` correctly says `HOLD_OFFLINE_VISUAL_REVIEW_ONLY` and `frames: 0`. The original source files are staged for reproducible **eight × 160px static rest-pose camera views** through the same script's `render_eight()`; this rendering is **not** yet executed/qualified.
5. Blender is not installed system-wide. An attempt to install isolated Blender Python `bpy==5.2.3` from PyPI on X230i stalled on its ~403 MB wheel; the attempted session was **terminated** without changing system Blender or committing art. **No render/facial/body composition/animation retarget visuals are claimed.**

## Reproduction (offline, once an independent Blender-compatible Python exists)

```bash
python3 scripts/graphics3a_p1_outfit_blender_review.py \
  --outfits-zip "/private/Modular Character Outfits - Fantasy[Standard].zip" \
  --private-output "/private/graphics3a-review" \
  --character Male_Ranger \
  --prepare-only
```

The render function uses Blender's `bpy` import, Cycles CPU, three review lights, a neutral floor, fixed camera, eight directions and **160×160 original-size PNG** output, with each hash recorded. It does **not** claim true real-time frame p50/p95 or animation source retargeting; only static rest-pose reviews. **Do not treat a future eight-row render as gameplay release GO.**

## Acceptance still open

- Install/acquire a working Blender runtime without paid tools or unauthorized system changes; execute **actual** local eight-direction render and review the images for scale, materials, lighting, seams and grounded shadows.
- Bind-pose-aware retarget with real animation samples, authored animation timings and truthful combat-state mapping. Source skeleton names alone are insufficient.
- Compare 160px sprite source scale against original Silver Knight and real **960×540** original World game screenshot; collect Chrome/Firefox 2/4-player frame intervals p50/p95 and Art Director 3 human acceptance.
- Main 0 owns exact integrated branch, GO, merging and release. **No main merge, deploy, P1 enablement, P0 Silver modification, game character replacement or vendor binaries in public repo.**

**Strict owner restriction:** do not use the rejected Mid-Poly Knight.
