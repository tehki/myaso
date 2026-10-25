# Graphics 3A P1 — Original Male Ranger eight-direction static review (2026-10-25)

**Status: REAL SOURCE-BASED EIGHT-VIEW VISUAL PROOF COMPLETED ON X230i; ART / ANIMATION / RELEASE HOLD.**

P1 review is isolated in [Draft PR #1041](https://github.com/tehki/myaso/pull/1041), independent from [P0 Silver Knight #1040](https://github.com/tehki/myaso/pull/1040) and [Core+Combat #1036](https://github.com/tehki/myaso/pull/1036). Main Orchestrator 0 remains the only release authority.

## Verified input

- Actual, owner-approved publisher free Standard `Modular Character Outfits - Fantasy[Standard].zip`, X230i private acquisition, exact ZIP SHA256: `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70`.
- Actual `Male_Ranger.gltf` (original geometry) sha256 `e1033a212332d84d98c19bc4927c621635478d0aa15d13c79da68d3ba9e0196f`; its source `.bin` remains **byte-identical** to the official archived mesh. Original texture files and complete source stay immutable in `private_vendor_stage/Male_Ranger/`; acquisition [license / hashes](graphics3a-p1-acquisition-evidence-20261025.md) identify embedded **CC0 1.0**.
- For only the **static 160px offline review**, created a **separate derived preview** in `offline-character-review/lowres_preview_derived/Male_Ranger/` by resizing original 4096/2048 PNG textures to a maximum 512px with Lanczos. Original `.gltf` and `.bin` copied without modification, each original and derived dependency SHA256 recorded in private `source_mapping.json`. No original source overwritten. Reason: unmodified 4K textures consumed excessive memory on 8GB X230i.
- Original static imported `trimesh` scene bounds: `[[-0.89941466, -0.00396725, -0.2059539], [0.89941466, 1.8650403, 0.1675415]]`; original Y-up approximate height **1.869m**. Geometry scene contained ten primitives; no bogus generated character substituted.

## Actual offline rendering proof

- Reproducible Python source: `scripts/graphics3a_p1_egl_static_review.py`, consuming a private, locally staged glTF (never downloading its assets). Headless EGL on X230i with local isolated `trimesh 5.2.0`, `pyrender 0.1.45`, `Pillow 13.0.0`, `numpy 2.5.4`, `PyOpenGL 3.1.10` and X230i Mesa software-context workaround. Camera fixed; scene rotates **eight rows** by `row * 45°`, with fixed ambient + two directional review lights.
- **Eight real `160×160` transparent RGBA PNG source-rest pose views rendered**. Row alpha-coverage nonzero pixels: `[2514, 2352, 1506, 2349, 2519, 2352, 1508, 2344]`; all pass bounds/no-blank gate.
- Private `1280×160` preview contact sheet on X230i:
  `~/Downloads/myaso-graphics3a-p1-assets-20261025/offline-character-review/render_frames/Male_Ranger/from_repository_script/static_eight_view_contact_sheet.png`
- Contact sheet SHA256: **`fd770b9e15cd569c68796b6dba4f2b4d150bd880a77bfa737c870f5b24947718`**.
- **Reproduction gate passed**: the first private lookdev script and the exact [GitHub-committed](../scripts/graphics3a_p1_egl_static_review.py) standalone script produced the **identical contact-sheet SHA256** on this same X230i environment, even when run separately. This is *local reproducibility*, not guaranteed byte stability across GPUs/driver versions.
- Exact second-run private evidence: `render_frames/Male_Ranger/from_repository_script/static-review.json` records `frames=8`, each per-frame SHA256, offline render duration, eight coverage counts, dependency checksums and explicit `HOLD_P1_OFFLINE_VISUAL_ONLY`.
- Synthetic input-safety tests in `tests/test_graphics3a_p1_egl_static_review.py`: **six passed locally**. GitHub protected `quality` checks this same test, alongside the prior 7+9+5 Graphics P1 checks; all original Combat/Core/World checks remain mandatory.

## What the image DOES and DOES NOT prove

**Proves:** the actual publisher Male Ranger source and materials can be loaded and drawn at 160px from eight distinct rotations; linked textures, character presence, framing and contact-sheet reproducibility on X230i.

**Does not prove:** an actual motion animation (the image is **T/rest pose**), eight-way authored animation, 350ms roll or 140ms Dash, correct east/west cardinal mapping against Rust actor facing, bind-pose-aware retarget, correct combat cues / hitboxes, physical floor-grounded shadow, 960×540 real Canvas gameplay, Chrome/Firefox 2/4-human p50/p95, visual art acceptance, or P0 release readiness.

**Unresolved retarget blocker** ([quantified](graphics3a-p1-rig-rest-pose-20261025.md)): Quaternius Base↔Male Ranger **48** local rest differences; Base↔UAL1/UAL2 **62**; KayKit 23-joint names versus Quaternius 65. Do not blindly apply animation tracks until conversion proven.

## Next guarded iteration

1. Art Director 3 reviews original Ranger T-pose source image (green hood/clothing and nonmetal armor) against myaso.io's intended gritty character style and approved Silver Knight, including appearance, silhouette, camera and lighting. The rendered review has no floor-grounded shadow; add only once original World/Graphics presentation is grounded.
2. Implement an **offline** bind-pose-aware shared original 65-joint animation retarget baseline for UAL1 Idle/Walk/Run/Jump/Roll. Assert original source clip phase, root motion suppression and limb alignment; do not counterfeit Combat actions.
3. Independently map KayKit's 23-joint rig; optional assets are not automatically compatible.
4. Produce *real animated* 8-dir 160px source atlases and full original 960×540 Chrome+Firefox four-client review, then Main 0 explicit GO. Keep current P0 Silver and authoritative Rust World untouched.

**All third-party ZIP/glTF/texture and derived PNG preview bytes remain in the authorized private X230i workspace.** No raw vendor model or derivative PNG committed to GitHub, no gameplay code changed, no merge/staging/deployment authorized. The rejected Mid-Poly Knight remains excluded.
