# Knight sprite presentation — v1.1 staging

This directory contains compressed WebP atlases generated from owner-supplied
**Silver Knight** and **T1 Sentinel** GLB models.

- Source pages: https://www.autosprite.io/free-3d-models/silver-knight
  and https://www.autosprite.io/free-3d-models/t1-sentinel
- Source assets were supplied by the project owner and are **not** committed.
- Source pages advertised CC0 at collection time. Confirm license provenance
  and preserve source records before public release.
- Export method: GLB skeletal animation -> RGBA PNG at 8 directions ->
  Lanczos resampling to 160 x 160 per frame -> WebP (quality 83).
- Atlas layout: each *row* is a direction ordered
  south, southwest, west, northwest, north, northeast, east, southeast.
  Each *column* is an animation phase. All assets share a single texture per clip.
- Silver: idle (4), walk (8), sprint (8), jump (6).
- Sentinel: walk (8), sword attack (8), sword block (4).

**Integration**: multiplayer-only, opt in with `&knights=1`. To revert,
remove the flag or use `&knights=0`. If a texture fails to load the renderer
falls back to the existing circles and weapon cues.

Silver is the local presentation and Sentinel the remote presentation for the
first visual experiment. This does **not** add server-side cosmetic selection,
class mechanics, animations for every combat action, or capacity evidence.

The existing world coordinates, hitboxes, combat state, authoritative simulation,
prediction/reconciliation and network protocol remain unchanged.

Renderer tests: `node --test tests/knight-sprites.test.mjs`.

### Forward roll A3 (opt-in prototype)
- New local `silver_roll.webp` and remote `t1_roll.webp`: 8 directions x 8 phases each.
- Source motion authored in Blender 4.5 with 22-bone Mixamo rig; knee bend, hands/shoulder contact, forward tumble and recovery.
- Renderer uses the same 350 ms presentation across authoritative dodge (170 ms) and dodgeRecovery (180 ms). No physics, i-frame or network protocol changes.
- Source owner-provided models are *not* committed. A3 Blender/GLB editing files remain on the authorized Windows workstation.
- Recreate A3 GLB from the original local model with `tools/art/author_knight_forward_roll.py` and Blender Python. Bake 8 x 8 PNG frames with `tools/art/render_knight_roll_sprites.py` (set FPS=60 before GLB import), then pack using `tools/art/pack_knight_roll_sprites.py` and Python Pillow.
- Sprite atlas rows: south, southwest, west, northwest, north, northeast, east, southeast; columns: motion samples 1, 3, 5, 7, 9, 11, 15, 22 at 60 FPS.
- Graphics are staged behind `&knights=1`, with a fallback if textures fail to load. Check the in-repo `web/knight-preview.html` roll buttons before any release.
- **Not yet production approved:** user confirmed A3 motion direction, but in-game optical flow, multiplayer performance, browser and release acceptance still need checking.

#### Reproducible local bake notes
- Silver Knight camera height offset: 0 (asset source has ground near -0.5 m).
- T1 Sentinel camera height offset: `--height-offset 0.67` (T1 has a different model-space origin). Without this the Sentinel is clipped at the top for some facings.
- Each roll bake: `--samples 2` CPU Cycles; 64 transparent 160x160 PNG tiles; the packing tool requires no clipped silhouettes and produces a 1280x1280 WebP.
- Keep Blender source, its export validation JSON, and original owner models off GitHub unless provenance, size budgets and permission are reviewed.

### A2.11 — approved 120% visual-scale calibration (preview only)

The owner reviewed the Red Lion door/knight side-by-side alternatives in [graphics PR #350](https://github.com/tehki/myaso/pull/350) and selected **120%** for the opt-in knight sprite presentation. This change is limited to **drawImage destination rectangles and cosmetic shadows** in `web/knight-sprites.mjs`.

| | Previous | Approved 120% |
| --- | ---: | ---: |
| Standing/walk/attack/block/jump | 80×80 px | **96×96 px** |
| Silver/T1 A3 forward roll | 112×112 px | **134×134 px** |

The source GLB/Blender files, 160×160 atlas tiles, 8-direction mappings, 350ms A3 roll cycle, server-authoritative fighter positions, collision, hitboxes, movement, input and network protocol do not change. The result is horizontally centered on the **same fighter origin**; y offsets scale with the sprite: old standing `(-40,-52)` vs new `(-48,-62.4)`, old roll `(-56,-65)` vs new `(-67,-78)`. Width 134px is the nearest whole pixel to 112×1.2=134.4px.

**Opt-in and rollback:** the main game still defaults to no knight sprites. Add `&knights=1` for the 120% presentation, `&knights=1&knightScale=100` for the previous 100% rendering, or remove `knights=1` to return immediately to the original circle/combat cues. No other scale values are supported by the renderer.

**Verification:** `node --test tests/knight-sprites.test.mjs` and local Chrome `node tools/art/verify_knight_a211_browser.mjs <out-dir>`. The standalone page `/web/knight-scale-a211-preview.html` shows 100% and 120% using the actual WebPs. This is not a measured multiplayer FPS or validated anatomical foot-pivot; the 3/4 Greyhaven camera mismatch remains a separate graphics issue in PR #350. Do not merge on art QA alone without required exact-head CI, current base and owner release governance; do not deploy to production without separate authorization.
