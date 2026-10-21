# Graphics 3A — Silver Knight high-knee Spartan-style power kick (candidate)

**DRAFT — HUMAN VISUAL HOLD — NO GAMEPLAY ACTIVATION.**

Owner direction: “This is Sparta” style — a forceful armored front *push* kick, not a soft leg flick. This is our own Silver Knight 22-bone original Blender animation, **not a copied film clip, new fictional character, or imaginary Greyhaven scene**.

## Original motion design

- **Windup: 0–90 ms**. Heavy support-leg load and visible **high right-knee chamber** (right knee folded, heel beneath knee); shoulders brace, arms guard face and chest. Stance stays on the original left supporting foot.
- **Active: 90–160 ms**. Rapid hip-driven **front boot/heel thrust**, leg opens from the tucked knee to an extended forward impact silhouette. No root teleport, fake push impulse, new damage or changed collision.
- **Recovery: 160–380 ms**. Fold the striking knee back under the torso, lower the foot under armor weight, settle into the original guard. Complete recovery remains visible.
- **All 8 directions**. Blender-rendered first-party 160×160 source cells, packed into the actual transparent 1280×1280 review WebP; 8×8 authentic action frames with precise fractional-frame sampling at 60 fps.

**Original high-knee review:** [all-eight before/after source animation](silver_kick_grounded_vs_spartan_8way_380ms.gif) · [transparent first-party WebP](silver_spartan_kick_p0.webp) · [editable action-only Blender source](Graphics3A_Silver_Spartan_Power_Kick_action_source.blend) · [source geometry audit](source_kinematics.json) · [bake data](spartan_blender_bake_report.json) · [SHA integrity](spartan_kick_art_manifest.json).

Open from a local repo-root HTTP server: `/web/silver-spartan-kick-p0-review.html`. It displays the actual previously grounded original-source baseline above our new original front push-kick, with 380ms full-speed / slowed / manually stepped authentic frames. **Not a real game session.**

## Verified source geometry and safety

The independent Blender audit reopens both saved action-only rigs and measures the original right knee and boot joint coordinates directly. The knee visibly chambers much higher in the original rig than prior kick, and the boot is farther forward at contact. The source support toe stays anchored, **but Blender toe position is not proof of actual boot-sole floor contact**, center of mass, visual acceptance, or Greyhaven ground clearance.

An authoritative hit may later trigger coordinated target hit-reaction and audiovisual impact, **only if Combat/Core confirms actual impact**. The kick art alone must not cause knockback, grant damage, consume stamina, modify simulation phases, or invent a successful hit. Keep original server phases `90/70/220ms` and existing hitboxes. All human players remain Silver Knights, Sentinels only verified NPCs, Adult characters development-only. Original dash `140ms` unchanged.

Chrome/Firefox source previews and exact-head protected CI must pass independently. **No live `web/online-game.mjs` or published Knight atlas activation, no independent merge or deployment.** Central Main Orchestrator #360 owns integration; Graphics #344 and owner directive #542 own visual review.

## Measured and local acceptance evidence

The independently reopened Blender rig at frame 6.4 has knee lift **0.074363** instead of **0.039032** source units (1.9x). Source boot horizontal reach from hips at frame 10.6 is **0.414427** vs **0.385057** units. Source support-toe sampled drift remains **0.000023** units. These are source rig measures, NOT real terrain force/damage proof.

**62/62** local focused Knight tests PASS. Actual native **Chrome 154 64/64** and **Firefox 153 64/64** strict review-cell checks pass, four PNG screenshots each, no page errors. New browser source review can be manually stepped at the 90ms knee chamber and 160ms boot impact. Exact-head full protected CI and human visual review still required.
