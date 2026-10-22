# 🌕⚔️ Graphics 3A — original Silver Knight Spartan Kick V3 (Contact & Recoil)

**Genuine first-party Blender animation candidate. Human art-review HOLD.** Based solely on the owner's unchanged original `silver-knight.glb` 22-bone Silver Knight, SHA-256 `d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f`, with zero GLB redistributed. This is a direct child of [V2 PR #611](https://github.com/tehki/myaso/pull/611). No AI image-generation, imported substitute Knight, mesh edit, scale modification, world-root motion, game/server/combat edits or generated enemy reactions.

## What V3 actually changes

The owner requested the **higher knee and farther-forward Spartan heel kick**, already realized in V2. V3 refines that actual source motion instead of simply enlarging the heel displacement:

- **Chamber:** the plated right knee tucks higher against the torso, while the left toe remains the support anchor. Full windup reaches source frame 6.4 (~90ms).
- **Brace and acceleration:** a new rig-authored drive pose at frame 8.1 (~118ms) gives the armor a readable weight transfer; an intermediate thrust at frame 9.35 (~139ms) extends the kicking boot forward before the impact pose at frame 10.6 (~160ms). The braced shoulders and left leg counterbalance the hip. There is **no client-side movement burst**.
- **Kick recoil:** a distinct knee re-fold at frame 11.3 (~172ms) removes the stiff transition from heel contact directly into recovery, followed by the earlier guard/rest poses at frames 13.5, 18, 23.8. No opponent knockback, damage, hit flash, sound or strike success may be fabricated from a rendered pose.
- Exactly **ten original Blender pose keys** but still **eight 160×160 actual Blender renders per facing**, eight real directions = 64 genuine source cells. The 1280×1280 original-source transparent lossless WebP is **opt-in art only**, not enabled for Pre-Alpha gameplay. Original camera/facing basis retained.
- **Original Combat kick phase budget unchanged**: 90ms windup, 70ms active, 220ms recovery (380ms total); authored dash remains 140ms. The source supports the existing viewer only; it is not a client/server action duration source.

## Independently reopened rig metrics

The Blender 5.2 original action-only `.blend` file has been independently reopened against V2 by `tools/art/audit_silver_high_forward_kick.py` (saved `source_pose_v2_vs_v3.json`). These distances use local Silver rig source units and are **NOT in-game metres**:

| Metric | Previous V2 | This V3 |
| --- | ---: | ---: |
| Right knee lift above neutral | 0.190181 | 0.202927 |
| Right boot forward -Y reach relative to planted left boot | 0.310309 | 0.328945 |
| Right boot height relative to support toe at contact | 0.406775 | 0.416371 |
| Max support LeftToeBase world-source-joint 3D drift at eight authored reference times | 0.000022 | **0.000020** |

The toe anchor is the ORIGINAL skeleton joint and is compensated via animated pelvis pose. This does **not** independently establish the boot sole is on the actual Greyhaven floor, the center of mass is dynamically stable, or the opponent contact occurred in Rust. The earlier first V3 pass (0.000436 drift) was corrected by additionally pinning the exact fractional Blender source pose used at 8.5, so the saved rig is more stable.

## Review the actual animation

[Original Blender Silver V2 versus new V3 in all eight directions — true 380ms GIF](silver_spartan_v2_vs_v3_contact_recoil_8way_380ms.gif) · [V3 original source 1280px WebP atlas](silver_spartan_contact_recoil_v3_p0.webp) · [editable authentic source armature action-only Blender file](Graphics3A_Silver_Spartan_Contact_Recoil_V3_source.blend) · [Blender source pose audit](source_pose_v2_vs_v3.json).

For interactive playback, serve the repository over local HTTP and open `/web/silver-spartan-contact-recoil-v3-review.html` for all eight facings, real 8 source frames and 25%/50%/100% motion. This source viewer is NOT a real multiplayer gameplay capture. Native actual Chrome/Firefox browser proof and exact-head CI are documented in test output after execution.

## Strict release boundary

The genuine four-human-avatar original Silver PRE-ALPHA 0.1 evidence at [Graphics PR #746](https://github.com/tehki/myaso/pull/746) used **the five original idle/walk/sprint/jump/roll WebPs**. This V3 kick is NOT on that branch and is deliberately excluded from minimal Pre-Alpha. The separately staged opt-in kick game client PR #617 / strict connected receipt PR #634 **do not automatically qualify this new source**. Human visual review, actual kick opt-in with real server-confirmed action/phase + hit receipt, all-native PvP, floor/sole review and full protected CI are required before orchestrator integration.

The latest full quality run for Graphics #746 [#39763537043](https://github.com/tehki/myaso/actions/runs/39763537043) **FAILED inherited M194 real guard-break third short-block resolving as parry**. Combat/Core own that blocker; source art cannot fix it. **No merge, deployment, release, public PLAYABLE claim, hitbox/stamina change, or impact animation fake.**
