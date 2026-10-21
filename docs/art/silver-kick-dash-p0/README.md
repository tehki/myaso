# Graphics 3A — Silver Knight original Blender kick + dash P0 source preview

**Visual HOLD / draft / NOT integrated.** Owner animation directive: [#542](https://github.com/tehki/myaso/issues/542). Parent [31-action audit #546](https://github.com/tehki/myaso/pull/546) protected quality [#39605385516](https://github.com/tehki/myaso/actions/runs/39605385516) **SUCCESS**.

## Real review assets — all eight directions

- [**Kick 380ms animated original-source preview**](silver_kick_p0_8direction_loop.gif) / [new 1280×1280 WebP atlas](silver_kick_p0.webp).
- [**Dash 140ms animated original-source preview**](silver_dash_p0_8direction_loop.gif) / [new 1280×1280 WebP atlas](silver_dash_p0.webp).
- [Editable action-only Blender rig source](Graphics3A_Silver_Kick_Dash_action_source.blend), 22 actual Mixamo bones and keyframed `Graphics3A_P0_Silver_Kick_380ms` and `Graphics3A_P0_Silver_Dash_140ms`. Owner's full original Silver GLB mesh is **not** redistributed.
- [SHA-256, timings, per-facing changing-pixel evidence](source_art_manifest.json) / [Blender source/pose bake report](kick_dash_blender_bake_report.json).
- Interactive `web/silver-kick-dash-p0-review.html`: original source Silver idle or sprint vs **new** 160px source action across all eight facings, frame scrub, frame-step, 50% and 25% slow motion; a separately labeled 96px (approved 120%) **neutral scale guide**, not real Greyhaven.

## Original gameplay contracts — graphics does not change them

| Authored motion | Authoritative Combat phase | Server duration |
| --- | --- | ---: |
| Kick | `kickWindup` anticipation | 90ms |
| Kick | `kickActive` leg contact | 70ms |
| Kick | `kickRecovery` return to stance | 220ms |
| Dash | `dash` separate forward lean/burst | 140ms |

The action frames are authored on the original user-supplied **22-bone Silver Knight Blender-imported GLB rig**, not a renamed idle atlas. Kick controls upper leg, knee, planted support leg and counterbalancing arms; dash uses a reduced forward lean and knee compression **without moving the actual fighter root**. Movement/hitboxes/i-frames/displacement/cooldown remain entirely Combat/Core-owned. The 8×8 per-clip atlases are derived from actual Blender CPU transparent 160×160 renders.

### Authoring issues fixed before the delivered art

Initial smoke renders showed **identical frames**: Blender frame evaluation accidentally happened *after* posing bones and overwrote the intended pose before action key insertion. Corrected by advancing the frame **before** applying and keying pose channels. The packer now fails if first-to-action source pixels fail a per-direction motion-difference threshold. An initial dash bent the character nearly horizontal; a separate smoke render rejected that pose and reduced the torso lean. Only corrected source images are included.

## Native original-art browser QA

All screenshot files are original browser captures from actual source WebP assets, **not** generated stock illustrations:

| Frame | Chrome | Firefox |
| --- | --- | --- |
| Kick neutral | [open](silver_p0_chrome_silver_kick_p0_frame0.png) | [open](silver_p0_firefox_silver_kick_p0_frame0.png) |
| Kick anticipation | [open](silver_p0_chrome_silver_kick_p0_frame2.png) | [open](silver_p0_firefox_silver_kick_p0_frame2.png) |
| Kick contact | [open](silver_p0_chrome_silver_kick_p0_frame4.png) | [open](silver_p0_firefox_silver_kick_p0_frame4.png) |
| Dash entry | [open](silver_p0_chrome_silver_dash_p0_frame2.png) | [open](silver_p0_firefox_silver_dash_p0_frame2.png) |
| Dash middle | [open](silver_p0_chrome_silver_dash_p0_frame4.png) | [open](silver_p0_firefox_silver_dash_p0_frame4.png) |
| Dash exit | [open](silver_p0_chrome_silver_dash_p0_frame6.png) | [open](silver_p0_firefox_silver_dash_p0_frame6.png) |

[Chrome JSON QA](silver_kick_dash_chrome.json) / [Firefox JSON QA](silver_kick_dash_firefox.json).

## Reproduction

Requires Blender 4.5, Pillow and the authorized owner `silver-knight.glb` locally. The full original GLB is never committed.

```sh
blender -b --python tools/art/author_silver_kick_dash_p0.py -- --source silver-knight.glb --output .kick-dash-full --samples 1 --engine CYCLES
python tools/art/pack_silver_kick_dash_p0.py --source .kick-dash-full --out docs/art/silver-kick-dash-p0
node --test tests/knight-*.test.mjs tests/silver-kick-dash-source-art.test.mjs
```

## Visual / gameplay acceptance still missing

This is a **real authored source motion candidate**, not a verified natural or completed game animation. Ground contact, support foot/hip biomechanics, no foot sliding, clean kick leg silhouette and distinct balanced dash must still be approved by a human. The neutral studio has no real **Greyhaven** ground or building, no physical occlusion, no multiple real fighters, no true 0.84 game camera and no authenticated local/remote authoritative action lifecycle. Do not claim those tests from source screenshots. Live `web/knight-sprites.mjs` and `web/online-game.mjs` remain unchanged, so the current missing-state Combat fallback still handles real kicks/dashes while new art is not approved. T1 remains genuine NPC only. Item pickup/equip needs Core/Items commit/receipt and is not simulated as successful. Full protected CI on this PR head plus actual Chrome/Firefox game proof required before Orchestrator integration.

**Readiness: genuine source authored / isolated tested / HUMAN VISUAL HOLD, NOT INTEGRATION-READY, NOT PLAYABLE.** No main merge or deployment. Graphics [#344](https://github.com/tehki/myaso/issues/344), Alpha [#480](https://github.com/tehki/myaso/issues/480), Central [#360](https://github.com/tehki/myaso/issues/360).

### Explicit human-review failure modes identified in Chrome source screenshots

At kick contact, the Silver Knight's north/diagonal silhouette appears excessively tilted and potentially airborne relative to the neutral ground guide. This is NOT verified physical footing in Greyhaven. The source dash is visibly different but lacks any actual floor traction or verified server-authoritative 140ms displacement. Browser image loading and frame assertions do not constitute natural biomechanical or multiplayer approval. Reauthor support knee/hip/ankle placement and confirm the full action at true 0.84 gameplay camera over Greyhaven before turning on any new renderer clip.