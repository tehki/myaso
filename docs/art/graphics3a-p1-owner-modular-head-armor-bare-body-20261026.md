# 🌕⚔️ MYASO.IO — Character Modularity: Project Owner's Conditional Acceptance

**Owner decision:** October 26, 2026  
**Department:** Graphics 3A — Characters & Animation  
**Project:** https://github.com/tehki/myaso  
**Draft integration:** https://github.com/tehki/myaso/pull/1041  
**Graphics Orchestrator:** https://github.com/tehki/myaso/issues/1030  
**Priority:** P1 Graphics work; **NOT** a new Combat Pre-Alpha gate  
**Status:** DIRECTION ACCEPTED CONDITIONALLY / FUNCTIONALITY UNVERIFIED / ART & RELEASE HOLD

## 1. What the owner accepted

The current Quaternius Peasant + Ranger Hood appearance is an acceptable **temporary starting direction**, **only if the eventual character system can**:

1. **Lose its head.** The character has a removable, independently skinned head, explicit neck attachment/separation geometry, coherent eyes/hair/headgear behavior, and a clean intact/separated presentation. The eventual action is combat-related, but **Graphics 3A is only constructing the asset and presentation interface now**. No decapitation mechanics or events are authorized or implemented in this task.
2. **Wear different armor.** Replaceable clothing/armor, not a single baked mesh, with named slot attachments, source rig compatibility, predictable visual ordering and visibility/masking of body surfaces beneath gear. Items can be equipped, replaced and removed while remaining animatable.
3. **Have no equipment at all.** A standalone fully modeled unequipped humanoid body, with all body regions present even when **every garment, hood, helmet and armor slot is empty**. No permanent baked-on clothing and no hollow/missing regions where outfit parts were removed.

These conditions are **not present-day feature acceptance**. Do not call the models accepted for production until the actual geometries and states are demonstrated with real original-source renders and then in the game.

## 2. Combat is explicitly unavailable for this workstream

**Combat Department 4 is busy with Combat Pre-Alpha.** Graphics 3A must not give Combat new issues, QA tasks, sprint requirements, implementation hooks, balance work, or CI exceptions while it finishes its current work.

Graphics is authorized to prepare independent model topology, graphics-only presentation states, item visibility masks, asset provenance and source-only test contracts. **No current Combat, Items, Core, World, networking, economy, or UI runtime changes.** Later integration is explicitly deferred to Main Orchestrator 0's sequencing decision after Combat is free.

## 3. Original approved source audit — real observed limitations

On authorized private X230i, read the actual owner's approved **Universal Base Characters [Standard]** Male/Female Godot/UE glTFs and the associated approved Peasant outfit glTFs. A deterministic, read-only source inspector, `scripts/graphics3a_p1_modular_source_audit.py`, confirmed:

| Source property | Male | Female |
|---|---|---|
| Original Base Character skinned geometry nodes | `Eyebrows`, `Eyes`, `SuperHero_Male` | `Eyebrows`, `Eyes`, `Superhero_Female` |
| Original head as independent *geometry mesh* | **No** | **No** |
| Original torso+head as one combined geometry mesh | **Yes** | **Yes** |
| Authored detached-neck cap mesh found | **No** | **No** |
| Peasant modular outfit source meshes | Arms, Body, Legs, Feet | Arms, Body, Legs, Feet |
| Actual gameplay armor swapping proven | **No** | **No** |
| Fully unequipped, unarmored base-body appearance proven | **No** | **No** |
| Actual cut-off-head system proven | **No** | **No** |

**Important distinction:** the rig *does* have a `Head` joint, but an animation bone is not a detachable, independent head geometry mesh. Existing offline plane clipping merely creates an open cut boundary; it **does not** generate approved watertight head/torso neck caps, materials, or detach-safe anchors. The existence of four outfit meshes is useful evidence for *modular construction* but does **not** itself prove different armor sets can be swapped or that the stripped body looks complete. The actual base texture and anatomy must be inspected directly; full nudity cannot be verified from mesh names.

Thus **ALL THREE owner conditions remain open** for original-source visual and game acceptance.

## 4. Graphics-only source code added, without gameplay behavior

`scripts/graphics3a_p1_modular_character_contract.py` defines a **future-facing pure presentation contract**:

- Mandatory original humanoid body regions: head, neck, torso, pelvis, both arms, hands, legs and feet.
- Bare-body assets separate from equipment; no baked-in clothing.
- A distinct head mesh plus `Head` and `neck_01` anchors; *three distinct original neck assets* for intact join, separated torso cap and separated head cap.
- Equipment catalog with independent `head`, `torso`, `arms`, `hands`, `legs`, `feet`, `back` slots; matching rig identifier and per-item body visibility masks.
- Pure states `attached` and `detached`. A detached head is represented as a separate **graphics bundle**, headgear is visually suppressed from the attached torso but **inventory/ownership is not mutated**. There is no server event, damage calculation, physics, collision or Combat interface here.
- Validation deliberately rejects missing naked-body regions, baked-on equipment, a combined head/torso asset, absent/identical neck cap meshes, malformed slot masks, wrong rig, unknown items and unsafe source identifiers.
- Even a synthetic manifest which passes structurally returns `production_approved=False`. Art quality and origin authenticity require **separate real-source proofs**.

`scripts/graphics3a_p1_modular_source_audit.py` checks read-only glTF mesh roles and reports `ART_HOLD_NO_PRODUCTION_ASSERTION`; its status **never** claims naked-base, swappable-gear or severable-head verification.

**Verification:** **17/17 synthetic modular-contract tests** and **8/8 synthetic source-audit tests** passed on Serj (25/25), Python compile passed. These are additive to the mandatory `quality` workflow, without weakening any prior CI step. Prior Graphics P1 suite had 144 source-only tests; with these 25, the total count is **169 source-only tests**. The separate prior **70 real UAL1 hood poses** remain a rig-only pass and are not misrepresented as modular/decapitation acceptance.

## 5. Ordered Graphics 3A development, no Combat interruption

**3A-MOD-01 — True independent, capped head (Graphics).** Author/cut at a deliberate skinned neck ring in Blender; produce clean intact collar seam and matching separate torso and head cut caps. Verify UVs, normals, shared bone weights, eyes/eyebrows/headgear attachment and multi-phase animations. Capture private 8-facing close-ups of both states; avoid the prior unclosed plane-clip as release art. No combat code.

**3A-MOD-02 — Fully unequipped body (Graphics).** Source or author a coherent, anatomically complete base humanoid with no armor required for silhouette or body regions; confirm that removing **all** items does not expose holes, baked outfits, weird seams or hidden body parts. Approve provenance and licenses first; no paid assets without owner authorization.

**3A-MOD-03 — Modular armor and visibility (Graphics).** Reuse approved modular kit pieces wherever they genuinely fit; validate rig/slot alignment, replacement of tunic with several armor types, independent head/limb parts, per-slot body-hide masks, and unclothed return without changing the body mesh.

**3A-MOD-04 — Art acceptance and later integration (deferred).** Art Director 3 visually approves 8-facing, multi-phase genuine Idle/Walk/Sprint/Jump/Roll and relevant action pose assets, materials, head/collar seam and equipment permutations. A separate Main0-approved future milestone must then integrate the graphics into original 960×540 Chrome/Firefox 2- and 4-player server-authoritative gameplay, with p50/p95 and independent Combat/Core/World checks. **Do not schedule or ask Combat to work on this now.**

## 6. Strict boundaries

- All original third-party asset archives, glTF/GLB/FBX, source Blender files and rendered preview images remain private. No public redistribution without proven licensing basis.
- Source-only scripts, synthetic unit tests and documentation are the **only** additions to Draft PR #1041 in this change.
- Do not alter or replace P0 Silver Knight, World, Combat, Items, player equipment runtime, network authority, live deployment or game economy.
- Preserve all mandatory CI checks, don't bypass Combat failures, and do not merge, stage or deploy. Existing PR #1041 remains **Draft / ART HOLD / RELEASE HARD HOLD**.

**Owner acceptance is conditional on the real features above. Graphics 3A can prepare the art architecture now. Combat continues Pre-Alpha undisturbed.**
