# Graphics 3A P0 — Silver Knight KICK planted-toe corrective source art (experimental)

**DRAFT / HUMAN VISUAL HOLD / NOT INTEGRATED OR PLAYABLE.** Direct child of [actual original Silver kick/dash art PR #558](https://github.com/tehki/myaso/pull/558), exact head `72afc96514193e8c8c0fa9ac206b277c1e937fc7`, protected [full quality #39612569720](https://github.com/tehki/myaso/actions/runs/39612569720) **SUCCESS**. This corrective child changes only original-source Blender action, 8-direction **kick** review art, neutral browser QA and focused tests. Dash original 140ms atlas stays intact.

## Actual authoring defect and correction — important provenance

The original first-party Silver Knight 22-bone source kick is readable but has a left supporting foot that moves significantly in studio rig space while the right leg performs a 90ms anticipation, 70ms active strike and 220ms recovery (total **380ms**). Original #558 Blender toe joint displacement across a **49-sample** source-time audit peaked at **0.096586 source units**. This is a *joint-space displacement*, not verified true Greyhaven world-floor sliding.

Blender stabilization solves the original left-toe world-position vs initial contact reference using a measured 3×3 translation response of the original Mixamo Hips pose, then inserts source **Hips.location** action keys. It changes neither the armature object/root world translation nor Core/Combat hitboxes, cooldown, server displacement or attack success. It keeps authored kick pose/leg swing and all eight facing projections; it is **not** an in-browser idle sprite rotation or in-game procedural fake.

Two defects were caught before delivering this revised art:

1. A naïve runtime in-memory plant reported near-zero toe displacement but did not persist at original **fractional Blender key times** (3.7, 6.4, 8.5, etc). A genuine independent reload of the saved `.blend` showed no improvement. **Rejected and repaired.**
2. The correction now keys **all original fractional animation keys and all integer 60fps source ticks**, not merely rounded frames. Independent reopening and evaluating the saved 22-bone `.blend` at all **49 distinct original + integer + half-frame samples** shows maximum toe displacement falling from **0.096586 to 0.000555 rig units** (**99.4% lower**) and maximum torso axis tilt around **18.98°**. This is the **actual persisted source keyframe result**, not just a temporary Blender preview pose.

The corrected editable `Graphics3A_Silver_Kick_Dash_grounded_action_source.blend` has no original owner mesh redistributed. The original dash action remains for future use. The first-party source mesh is supplied separately by the authorized owner for reproduction.

## Open real eight-direction before/after evidence

- [**Watch 380 ms original vs planted-kick all 8 facings**](silver_kick_original_vs_planted_8way_380ms.gif) — top is unchanged actual original #558 kick, bottom new posed/rig-attached source correction, 8 frames per direction, not static-idle replacements.
- [Corrected real 1280×1280 first-party 8-way WebP](silver_kick_planted_p0.webp).
- [SHA-pinned old/new assets and exact 380ms timing](grounded_kick_art_manifest.json).
- [Independently reopened Blender 49-sample before/after toe/tilt report](source_foot_motion_before_after.json).
- [Source-art 22-bone editable action .blend](Graphics3A_Silver_Kick_Dash_grounded_action_source.blend).
- [Blender authoring source](../../../tools/art/author_silver_kick_dash_p0.py) with explicit `--plant-kick --kick-only`, [strict all-eight atlas builder](../../../tools/art/pack_silver_kick_grounding_review.py), [reopened-source audit](../../../tools/art/audit_silver_kick_plant_before_after.py).
- Open `/web/silver-kick-grounding-p0-review.html` from any repo-root static HTTP server: original vs corrected genuine source frames, eight directions simultaneously, play/pause, manual frame stepping, slow motion, and **NO implied actual game client**.

## Native browser evidence

All screenshots below are from real Chrome and Firefox loading the original WebP files from local first-party assets. Each browser is required to check all **8 source frames × 8 facings** and original/corrected **canvas character pixel presence per direction**. This proves pixels load/play; it does not prove natural center of mass or actual World collision.

| Source phase | Chrome | Firefox |
| --- | --- | --- |
| Start f1/8 | [screenshot](silver_grounded_kick_chrome_frame0.png) | [screenshot](silver_grounded_kick_firefox_frame0.png) |
| Anticipation f3/8 | [screenshot](silver_grounded_kick_chrome_frame2.png) | [screenshot](silver_grounded_kick_firefox_frame2.png) |
| Active f5/8 | [screenshot](silver_grounded_kick_chrome_frame4.png) | [screenshot](silver_grounded_kick_firefox_frame4.png) |
| Recovery f8/8 | [screenshot](silver_grounded_kick_chrome_frame7.png) | [screenshot](silver_grounded_kick_firefox_frame7.png) |

[Chrome strict QA JSON](silver_grounded_kick_chrome.json) · [Firefox strict QA JSON](silver_grounded_kick_firefox.json).

## Still blocked / next real acceptance

- The planted **toe joint is not a planted foot contact polygon** and the source studio is not Greyhaven. True World 9 ground plane and support sole normal, center of mass, foot orientation, terrain clearance and physically consistent knee/hip pose still require independent human visual approval and in-world renderer evidence.
- The real ground/camera acceptance requires the **0.84 gameplay zoom**, a building/street size reference, multiple authenticated players, and true server action-state timestamps. The 90/70/220ms Combat gameplay boundaries are source timing only, not authenticated network events.
- No `web/knight-sprites.mjs` or `web/online-game.mjs` change, no production atlas replacement, no server/Combat/Physics/Items/World/UI change, no fake successful sword pickup or use of NPC Sentinel art for remote humans.
- Original dash source and live fallback remain unchanged; the underlying wider 31-action [gap inventory #546](https://github.com/tehki/myaso/pull/546) is not magically closed by an isolated kick-source correction.
- Mandatory exact-head protected CI + independent original source rig verification + human visual approval + actual Chrome/Firefox Greyhaven gameplay remain required. Central Orchestrator [#360](https://github.com/tehki/myaso/issues/360)/[#480](https://github.com/tehki/myaso/issues/480) owns merge, staging, rollback and deployment.

**Status: IMPLEMENTED original-source artistic correction; ISOLATED TESTED, VISUAL HOLD / NOT INTEGRATION-READY / NOT INTEGRATED / NOT PLAYABLE.**
