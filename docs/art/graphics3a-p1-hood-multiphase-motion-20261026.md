# Graphics 3A P1 — Original UAL1 Multi-Motion Ranger Hood Acceptance Sweep

**Date:** 2026-10-26
**Canonical Draft PR:** #1041
**Source:** owner-approved free Standard Quaternius Universal Animation Library 1, Base Characters and Modular Fantasy Ranger Hood
**Status:** NUMERICAL RIG PASS / ROLL VISUAL REVIEW DONE / ART & RELEASE HARD HOLD

## Actual private-source motion execution

The private X230i machine ran the **committed** `scripts/graphics3a_p1_hood_motion_review.py` using the original source UAL1 Standard GLB, the real original Male/Female Peasant glTFs and their corresponding original publisher Ranger Hood modular-part glTFs. The files were not copied to GitHub or altered.

Authentic source clips verified:
`Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Roll`.

Each source animation was sampled at **five time fractions: 0%, 25%, 50%, 75%, 100%**. Both matching Peasant genders were checked, for **70 original-source sampled poses** (35 each). The source rig and hood received their own retargeted local TRS poses from the same real UAL1 source. Each pose was verified for:

- exact corresponding named hood/Peasant joints and finite source skin matrices after applying the original inverse bind matrices;
- identical hood-to-Peasant animated skin matrices, indexed by joint name rather than assuming joint order;
- identical animated Head, neck, spine and clavicle world-joint positions;
- all **1,240 actual original Ranger Hood mesh vertices** fully skinned per pose and checked for finite world coordinates and reasonable bounds;
- source glTF/ZIP hashes, original animation clip/time/duration and output JSON SHA-256.

| Verified result | Male Peasant | Female Peasant |
|---|---:|---:|
| Actual original-source clips | 7 | 7 |
| Sample phases per clip | 5 | 5 |
| Successful source poses | **35/35** | **35/35** |
| Original skinned hood vertices checked per pose | 1,240 | 1,240 |
| Max matching hood/Peasant skin-matrix difference | **0.0** | **0.0** |
| Max Head/Neck/Spine/Clavicle world position difference | **0.0 m** | **0.0 m** |
| Max inverse bind/rest error | 0.0000008443 | 0.0000006925 |
| Maximum sampled hood world-coordinate magnitude | 1.862 m | 1.788 m |
| Private JSON report SHA-256 | `9c4ba72389b489b07912a5ccdeb56d98d5f67e380c2df42f5b5eed1d79b5faad` | `c18bb944b8d7f3ba981537da26b4715c38e797c1194ce4f5076342e25c4765fb` |

**This is a skinned-motion numerical PASS, not absence-of-clipping proof or release acceptance.** The comparison does not prove that cloth surfaces avoid skin, hands, collars, hair or weapon geometry, nor does it validate grounded foot contact, rolling displacement, gameplay action semantics or the eight separate authored movement directions.

## Roll: review-camera bug found and corrected

The fixed `--camera-mode collar-closeup` camera was centered at the **rest-pose neck**, so during the real UAL1 `Roll` at 50% the hood/head moved out of frame. The initial roll contact render **failed closed with `ValueError: Blank composite`**. The review did not count that failed view as passing.

A separate, **opt-in** `--camera-mode animated-neck-closeup` now follows the **actual posed neck joint** and yaw-rotates the tracking point for each of eight inspection facings. The default full-body and original fixed close-up modes are unchanged. The light rig also follows the review camera's inspection target; the in-game camera, controls and directional-light quality gate are unchanged.

Two **successful** real-source `Roll` 50% close-up contact sheets (8 camera yaw views, 512×512 each, actual UAL1 time 0.733333 s of a 1.466667 s clip) were rendered:

| Private source character | Eight-facing Roll close-up PNG SHA-256 |
|---|---|
| Male Peasant + Base head + Male Ranger Hood | `ea663a63cd5ec1fbba2c6e48ff4d658fddbeaf2653d3115fe845469b6cb01e8b` |
| Female Peasant + Base head + Female Ranger Hood | `8ebc5fe169205077d6d2f784ce251c4002d78d60d54ea33c97f01ba113a06ea7` |

The corresponding output remains local at:
`~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/roll_phase050_necktracked_20261026/`.

### Visual review (Roll, eight yaw viewpoints)

The hood remains aligned to the head and visually trackable from each viewpoint in the sampled roll pose. The prototype's skin/cloth combinations still show conspicuous close-range problems: hands and arms crowd the hood/cheek region; the lower hood drape intersects or visually overlaps the shirt collar/shoulder region; face/cheek patches and green/metal-gray hood texture regions require art direction. Camera yaw rotation is a **viewpoint test**, not a claim that independent 8-direction animation clips have been authored.

The original head-to-garment rest-pose unsigned nearest *triangle* p95 remains 10.99 cm male / 11.84 cm female. Adding a hood does not repair the underlying mesh seam or prove watertightness. The new roll pose images cannot establish collision-free motion.

## Repository changes and test gates

- `scripts/graphics3a_p1_hood_motion_review.py`: private-original-source 70-pose numerical evaluator, strict original file inputs and private-only JSON output, no vendor bytes or glTF export.
- `scripts/graphics3a_p1_hood_motion_rules.py`: original-clip allowlist, finite/normalized skin consistency bounds and neck-follow frame positioning.
- `tests/test_graphics3a_p1_hood_motion_rules.py`: **12/12 synthetic tests passed on Serj**, including finite root motion, invalid source clip names, skin-matrix divergence, duplicate phases, mismatched joint anchors and floating-point-safe neck-follow framing.
- `scripts/graphics3a_p1_head_attachment_review.py`: additive animated-neck camera mode. Fixed camera and default original render remain the same.
- Protected `quality` workflow runs all new tests **in addition** to the original Core, Combat, World, Sound and gameplay checks. Current full exact-head CI status must be verified independently.

Graphics P1 source-only synthetic suite count is **127 tests** (prior 115 + 12); the 70 real-source pose checks are separate and not counted as synthetic unit tests.

## Remaining hard gates

**Graphics Art Director 3:** original Blender/collar construction, authentic period-appropriate hood material variant and face retouch, actual close-up head/body intersection checks across a representative set of phase samples.

**Combat/Core/Main 0:** true authored directions and controls, server-authoritative truth, grounded movement and original native 960×540 Chrome/Firefox 2-player/4-player p50/p95 acceptance. Existing Combat M121 directional-light failure must not be bypassed.

**No vendor assets, generated PNGs, real-value tokens, live actors, export bundles, merge, deployment or P0 Silver Knight replacement.** Draft PR #1041 remains **ART / RELEASE HARD HOLD** pending explicit Art Director/Main/owner GO.
