# Graphics 3A P0 — Original Silver Knight Spartan-style kick V2: higher knee, farther forward

**DRAFT / HUMAN VISUAL HOLD / NEVER LIVE-ACTIVATED**. This is the owner-requested continuation after the owner approved the *conceptual intended motion* shown in the reference sheet with “Exactly.” That conceptual illustration is not a substitute for real source art, and is not used as source geometry.

## Actual original Silver Knight motion

- **90ms windup:** loaded support leg and a sharply folded right knee rising toward the breastplate; full eight-direction original body silhouette. Source `spartaHighChamberV2`.
- **70ms active:** strong hip thrust drives the armored heel and boot much farther forward relative to the stationary left supporting foot. Braced torso/arms offset pelvic rotation; actual 22-bone source mesh is unscaled, and actor server root never moves because of source art.
- **220ms recovery:** pronounced knee retracts then armor settles back into guard. No animation persistence across dead/respawn implied.
- Original authored **8 × 8 = 64** transparent 160x160 Blender renders, genuine 1280² lossless WebP and 380ms eight-direction comparison GIF, reproducible Python, editable action-only Blender source. No owner's original GLB mesh redistributed or overwritten; no fake 2D image transformation.

### Watch the actual new art

[**Real Blender previous PR #602 vs high-forward V2 — eight directions / exact 380ms GIF**](silver_spartan_602_vs_high_forward_8way_380ms.gif) · [genuine transparent WebP atlas](silver_spartan_high_forward_p0.webp) · [action-only editable 22-bone .blend](Graphics3A_Silver_Spartan_Higher_Forward_Kick_source.blend) · [independent reopened source-pose kinematics](source_pose_before_after.json) · [digest manifest](spartan_high_forward_art_manifest.json).

Serve the repository over local HTTP and open `/web/silver-spartan-high-forward-p0-review.html` for genuine original-source all-facing before/after frame scrub and playback, 25%/50% slow motion and Chrome/Firefox review. This is a **source-only preview**, not an actual Greyhaven ground plane, gameplay session, authoritative Combat event or collision metric.

### Source-rig verification

An independent Blender 5.2 evaluator **reopens both saved action-only 22-bone rigs** and samples the same eight authored fractional key times. It compares right-knee world-source Z lift and actual right boot reach along the original rig's forward -Y axis **relative to the original left supporting boot**. Values are source rig units, not gameplay distances. It also measures toe-joint location drift; it cannot prove real shoe-sole contact, center of mass or actual pavement clearance.

**Readiness:** Original Blender source motion CREATED, isolated local tests and native browser source QA required, human visual HOLD. This does not modify `web/knight-sprites.mjs`, `web/online-game.mjs`, server, Combat, hitboxes, stamina, actual damage, knockback, Items or authoritative packets. The 140ms dash is unchanged. Genuine on-contact opponent recoil, impact audio/VFX require verified successful Combat/Core event and multi-player Greyhaven validation, not client-predicted kick visuals.

Protect exact-head CI, no changes to strict inherited Combat M41/M33 checks, no autonomous merge/deployment. Owner issue #542 / Graphics #344 / Central Orchestrator #360 govern approval.
## Exact isolated measurements and browser acceptance

Independent Blender 5.2.2 original-source action reload (units are original rig, not meters or game world): high chamber right-knee rise PR #602 **0.074363** versus new **0.190181**; right boot forward reach relative to planted left boot along rig -Y **0.137522** versus **0.310309**; left toe anchor 3D drift **0.000023** versus **0.000022**. True boot sole floor remains unverified. All original 8 directions × 8 exact fractional-frame 160px CYCLES renders completed.

Actual Chrome 154.0.8037.99: 64/64 strict original-source browser checks, four authentic screenshots, zero errors. Actual Firefox 153.4.0: 64/64, four screenshots, zero errors. Focused Knight/Graphics source tests: 67/67 PASS. Source kick 90/70/220ms and dash 140ms unchanged; this is not proof of authoritative gameplay. Protected full exact-head CI on this child must pass independently. Parent original Spartan PR #602 exact-head CI #39633379249 FAILED inherited M41/M33 genuine browser short-parry (block-confirm instead of expected parry); no Combat CI gate relaxed or changed. Main Orchestrator and Combat/Core own its resolution.