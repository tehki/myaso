# Silver Knight genuine Blender Cycles relight — game-scale camera review

**Graphics 3A review-only draft, 2026-10-23. Not game runtime, not release-ready.**

## Purpose
The first source-authentic relighting pass in PR #853 used original Roll's orthographic 1.66 camera. Its Idle/Walk/Sprint/Jump art was noticeably smaller than the original, dark Pre-Alpha locomotion atlases when both were viewed in the same 160px canvas. The game-size review preserves the same original Blender material, armature, action, source frame sampling, key/fill lighting and 8-way camera direction, but uses a narrower **1.29 orthographic scale**. This is an original Blender camera re-bake, NOT enlarging rendered PNGs or brightness filtering.

## Provenance
- Original owner 22-bone Silver model GLB SHA-256: d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f, not redistributed.
- Portable authentic Blender 5.2.2 SHA-256: 3849d17a682cba006075aaa3f3597ecb5c9c30ec31035b2e092c53e40679b535.
- Blender source pipeline: tools/art/relight_original_silver_locomotion.py --ortho-scale 1.29 --samples 3.
- Original Cycles 210W key, 180W fill, world 0.65, Standard/Medium High Contrast, transparent source 160x160.
- Source PNG packer: tools/art/pack_original_silver_locomotion.py, strict all-visible-pixel+alpha lossless WEBP, immutable per-PNG hashes and clip/frame/row metadata in manifest.source-reviewed.json.
- Required complete frames: Idle 32, Walk 64, Sprint 64, Jump 48 = 208 source frames in eight real camera directions.

## Strict review gates
- Every original 160px cell must retain >4 px alpha margin on all sides; no subject clipping during jumps/rolls/sprints or diagonal views.
- Every WEBP pixel with nonzero alpha must match its original Blender PNG RGB and alpha exactly. Alpha of transparent pixels must remain zero.
- The other seven-action original sources remain unchanged: Roll original; normal-light Spartan Kick V3; grounded Knockdown V2; and the separate original dark variants for four locomotion actions.
- THREE mutually exclusive original sources selectable on offline HTML review: genuine size-matched Cycles (1.29 ortho), genuine Roll-Cycles (1.66 ortho), untouched original dark locomotion.
- All fresh 1.29 and previous 1.66 Cycles renders have the native Roll source-facing order. Only old dark locomotion requires horizontal atlas-row reversal. Do not double-flip new Cycles atlases when integrating.
- User's visual approval is needed before any runtime atlas swap. Game Combat/Core/Physics/UI, input, hurtboxes, authenticated identities, animation budgets, public servers and Main protected release gates are unchanged.

The original source GLB and all temporary PNGs remain local to the authorized Windows renderer, not committed.

## Verified complete original source results

Blender 5.2.2 Cycles 1.29-camera bake finished **208/208 original animation source PNGs**; all cells passed strict >=4px alpha edge margin. Four transparent lossless WebP atlases passed complete visible-RGB and alpha pixel fidelity and source SHA256 manifest checks. No image retouching. Original five runtime WebPs remain unchanged.

| Action | Dark original SHA | Roll camera (1.66) SHA | Size-matched camera (1.29) SHA |
|---|---|---|---|
| Idle | 828cf05d... | 37e355e5... | 3ce8809d131e8e06703019f8714c88fcc3d59a051fcdd301180e603ef274c0e3 |
| Walk | 8fd421ea... | 7c414f51... | 4ec5037277f5e50d6aa5ae5a82790f8534f2ff39560c3cd5fa140e0d36b53b6f |
| Sprint | 3ec5b5c2... | 0b1fdd69... | 0866a95df012fd09b87bd1a2a7d0529d140ab0a00667cf7cd2e74561058426a0 |
| Jump | b73c506a... | 86f4402c... | 0735cb6c36c1683ea11d49e348f26c62139bc7c73884c4836eea91e94421e074 |

Visible character pixel coverage matching (alpha >= 64), compared to legacy dark originals:
- Idle 117125 / 121953 = 96.0% character area
- Walk 218015 / 226398 = 96.3%
- Sprint 215724 / 207258 = 104.1%
- Jump 177458 / 173207 = 102.5%

The original 1.66 Roll-camera sheets covered only roughly 58–63% as many visible pixels as legacy originals. Thus the 1.29 Cycles camera restores original gameplay-scale presentation without raster enlargement. Coverage is a useful metric, **not a substitute for owner aesthetic approval**.

Standalone comparison: docs/art/silver-knight-motion-review/silver-knight-motion-gallery-game-scale-compare-offline.html embeds 15 SHA-pinned genuine originals: four source dark + four original Roll camera + four original game-size camera + unchanged Roll, normal-light V3 Kick and Knockdown V2. Three-way selection never applies old horizontal row remap to either newly re-baked source.
