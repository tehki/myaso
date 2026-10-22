# 🌕⚔️ Graphics 3A — original Silver Knight victim knockdown/recovery source (360 ms)

**SOURCE ART REVIEW CANDIDATE — not installed in the live renderer and not approved for Pre-Alpha.**

This is a new **real Blender-authored original Silver Knight reaction** after [PR #772](https://github.com/tehki/myaso/pull/772) established that a genuine Rust-authoritative three-player V3 Spartan Kick can knock a victim down. The kick-knockdown outcome was already genuine in Chrome / Firefox / Chrome #2, but the player who was knocked down had **no original Silver knockdown WebP animation**, so the existing client fell back to the Combat tell instead of inventing another Silver action.

## Actual original source, no substitutions

Recreated from the owner's authorized original `silver-knight.glb`, SHA-256 `d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f`, with the **existing 22-bone original owner skeleton**, additive source bone rotations and hip-relative motion; the actual actor/world root matrix is never moved. No synthetic replacement character, new mesh, generated illustration, game sprite replacement, Rust server modification, damage or physics override.

Source frames: eight keyframed pose samples from the *original action*:

| Source frame | Original Blender frame | Source time | Purpose |
| --- | ---: | ---: | --- |
| 1 | 1.0 | 0 ms | Original Silver guard |
| 2 | 3.0 | 33 ms | Initial blow/recoil |
| 3 | 5.4 | 73 ms | Buckling knees / torso |
| 4 | 8.0 | 117 ms | Fall begins |
| 5 | 10.6 | 160 ms | Lowest spine/head |
| 6 | 14.2 | 220 ms | Low defensive braced pose |
| 7 | 18.2 | 287 ms | Getting back up |
| 8 | 22.6 | 360 ms | Return to original idle orientation |

These are source pose timings for the already existing **360 ms** M153 server knockdown budget, not a new source of authoritative timing. Real Combat and the actual world fall position remain unchanged.

## Open actual original Blender renders

- **[Animated 8-direction source review — 360 ms GIF](original_silver_victim_knockdown_8way_360ms.gif)**. Each native 160px source facing is presented in a 4×2 viewer with labels. The GIF does not prove real in-game floor contact.
- **[Original 1280×1280 lossless WebP source atlas](original_silver_knockdown_360ms_8way.webp)** — real Blender Cycles renders in 8 facing directions × 8 bone poses, genuine 160×160 cells; not installed in `web/assets/knights`.
- **[Editable original 22-bone Blender animation action](Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend)** — original source armature + baked action, original owner mesh removed before publishing.
- **[Independent bpy 5.2 re-open and source pose audit](independent_original_rig_reopen_audit.json)** and [full source SHA/time/facing manifest](original_silver_knockdown_source_manifest.json).

To reproduce, use Blender 5.2 and the original locally available (not included) `silver-knight.glb`, then run:

```powershell
blender -b -t 2 --python tools/art/author_original_silver_knockdown_p0.py -- --source "C:\path\to\silver-knight.glb" --output "<render-dir>" --engine CYCLES --samples 1
py -3 tools/art/pack_original_silver_knockdown.py --input "<render-dir>" --output "docs/art/silver-victim-knockdown-360ms"
blender -b "docs/art/silver-victim-knockdown-360ms/Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend" --python tools/art/audit_original_silver_knockdown.py -- "docs/art/silver-victim-knockdown-360ms/Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend" "docs/art/silver-victim-knockdown-360ms/independent_original_rig_reopen_audit.json"
```

## Independent real-source quality measurements

Blender **reopened the saved original action-only rig**: 22 bones, zero original owner mesh objects, action frame range 1.0–22.6, original root matrix unchanged; head world Z descends by **0.378216 original rig source units** at the low pose and returns to its starting height at frame 22.6. These are **not world gameplay metres**, neither do they prove boot sole has snapped to actual arena or Greyhaven geometry. Head remains above the initial original toe's world source Z reference; support feet may lift while reacting.

The source preview is a **controlled authored fall**, NOT an uncontrolled server ragdoll and NOT confirmed realistic center of mass/IK dynamics.

## Strict HOLD / next release integration

This first revision is **not rendered by the actual networked game**. Before enabling it, Graphics 3A must obtain owner/Graphics Director visual approval, check boot sole, center of mass and camera **0.84** in the actual world, map the atlas **only** to an authenticated server-reported `COMBAT_ACTION.knockdown`, and run a real 3-player native Chrome+Firefox+Chrome #2 flight showing victim original Silver knockdown/recovery frames alongside actual M153 server outcome. Clients must not infer knockdown from a kick animation, input, cosmetic VFX or timer. If no server knockdown occurs, **do not paint the original knockdown source**. Original server timing remains the authority.

The existing V3 kicker `silver_kick_v3.webp` remains byte-for-byte unchanged and **is not merged** into minimal Pre-Alpha 0.1. The new source-only branch changes no production server, combat inputs/hitboxes/stamina/damage, renderer, client event handling or rollout. Full protected quality remains mandatory, independent of source-art test CI. No deployment or merge without orchestrator GO.
