# Silver Knight original Blender/Cycles locomotion relight — draft visual review

DO NOT MERGE OR DEPLOY. Original five Pre-Alpha assets remain SHA-frozen. No gameplay or authority change.

User-directed corrections (2026-10-23): restore the original normal-light V3 Spartan Kick in review gallery #845; fix the four legacy East/West and diagonal facings in the gallery and game draft #850; and relight the original Idle/Walk/Sprint/Jump using real Blender 5.2.2 and the 22-bone Silver GLB (SHA-256 d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f). Do not redistribute original owner GLB or textures.

Source-only reproducibility: tools/art/relight_original_silver_locomotion.py reads original idle/walk_loop/sprint_loop/jump_loop and reproduces Roll's genuine Cycles studio (key 210W, fill 180W, world .65, Standard Medium High Contrast, orthographic 1.66, 160px original cells). tools/art/pack_original_silver_locomotion.py validates 8×4/8/8/6 = 208 true RGBA source frames and exports lossless WebP with per-PNG SHA manifest. No raster brightening or fake source image.

Legacy luma (mean alpha-visible RGB): Idle 18.94; Walk 19.33; Sprint 18.97; Jump 19.64. Authentic Roll is 35.94; grounded Knockdown 46.42. Normal-light Kick 35.89; overlit support-leg Kick 57.46. New source requires independent full-sheet 8-direction measurement and human artistic review before replacing production assets.

IMPORTANT: newly re-rendered source uses native Roll camera rows; the separate legacy per-clip mirror from #850 must not be applied twice if new assets are integrated.

## Finished authentic bake (all original source)

Blender 5.2.2 Cycles exact-owner GLB bake completed 208/208 original 160px PNG source frames, and four lossless transparent eight-direction WebPs passed **exact alpha and all nontransparent RGB pixel roundtrip**. Every 160×160 PNG has an independent SHA-256 in manifest.source-reviewed.json.

| Source motion | Old luma | Relit luma | Relit SHA-256 |
|---|---:|---:|---|
| Idle | 18.94 | 35.16 | 37e355e5622e983a6150894724fa2d176efe851867ffd860b09508d16761036c |
| Walk | 19.33 | 35.50 | 7c414f51c492c2a6ffaeae71db5ef5243a7e66e344b9e242215612a7c268c4a0 |
| Sprint | 18.97 | 33.59 | 0b1fdd69fe1819d372f80167d5b353dfdb414e22f63c51a2833bc85c4fc5499b |
| Jump | 19.64 | 43.68 | 86f4402cc3dc375bc3691cb9701b5520229556df1b998e2c14e2b09c022912fc |

Luma is alpha-visible RGB luminance averaged over source WebPs; Roll source 35.94 and grounded Knockdown V2 46.42. Normal-light Kick V3 35.89; rejected overlit support-leg Kick 57.46.

**Visual-scale caution:** this independent Cycles review uses exactly Roll's orthographic camera scale 1.66. The newly baked silhouette pixel coverage is smaller than the legacy 320-to-160 downsampled locomotion sheets, which had another original camera setup. That visual-frame change must be reviewed at *actual game size*. This draft does not alter game render scaling, hitboxes or source runtime asset bindings.

The offline reviewer at docs/art/silver-knight-motion-review/silver-knight-motion-gallery-relit-review-offline.html embeds all seven chosen motion atlases and four legacy baselines for a real **New Blender Roll studio / Original dark source** A/B comparison; no remote dependency or CSS brightness filter. When new Cycles sheets are selected, atlas rows use the same native direction order as Roll. The legacy comparison toggle remaps old horizontal rows only.

**No merge/production/staging/main changes. Owner artistic approval required before selecting any of these four new atlases in game.**
