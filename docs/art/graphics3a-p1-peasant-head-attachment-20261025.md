# Graphics 3A P1 — Peasant head-attachment feasibility preview (2026-10-25)

**Verdict: feasibility demonstrated; HOLD for art and seam review. No asset export.**

## Why this exists

The UAL1 retarget prototype correctly identified that both free Modular Fantasy Outfit Peasant glTFs are headless outfit rigs. To test a non-destructive next step, a private X230i preview combined the approved free Standard Base Character head/face meshes with the Peasant outfit mesh and rendered the real UAL1 `Walk_Loop` at 50% of its duration.

The experiment did not alter any source glTF, export a composite glTF, or place vendor binaries/images in the repository.

## Method

- Used the official free Base Character model matching the outfit gender: `Superhero_Male_FullBody.gltf` for Male Peasant and `Superhero_Female_FullBody.gltf` for Female Peasant.
- Verified the base and outfit rigs share the same named joint set and named parent topology, and that the upper anchors `neck_01`, `Head`, `spine_03`, `clavicle_l`, and `clavicle_r` match within the 0.01 m guard. Observed upper-anchor deltas were zero in the source rest pose.
- Verified the base and target inverse-bind/rest-pose skin matrices before rendering.
- Selected only the upper head/neck faces from the Base Character body mesh using a private geometric cut just above the outfit mesh top, plus the source model's separate eyes and eyebrows. Remapped skin indices by joint name onto the target outfit's skin and applied the same sampled UAL1 local-TRS retarget pose.
- Rendered eight 256×256 yaw views. This is a still-frame lookdev preview, not a final head asset or exportable runtime model.

## Evidence

| Target | Outfit mesh top (m) | Head cut (m) | Head body mesh | Separate face parts | Contact-sheet SHA-256 |
|---|---:|---:|---:|---|---|
| Male Peasant | 1.5587 | 1.5800 | 1,462 vertices / 2,646 faces | Eyebrows: 646 / 984; Eyes: 556 / 768 | `00b0451342b4dfd6805ea3d1b2953e09c117f80c36bf8e4522ebda7aa588998f` |
| Female Peasant | 1.5184 | 1.5400 | 1,534 vertices / 2,788 faces | Eyebrows: 912 / 1,480; Eyes: 556 / 768 | `ca96192f9a767572ef483c572c647f0498ce0d7f331af135ee325d0505763c69` |

- Both previews used UAL1 `Walk_Loop`, sampled at 50% (≈0.6667 s of a 1.3333 s clip).
- Retarget translation-delta scale ratio: Male Peasant **1.01983**, Female Peasant **0.98782**.
- Base and target bind-matrix max errors: Male Base `3.832e-07`, Male Peasant `8.443e-07`; Female Base and Female Peasant each `6.925e-07`.

The private images are at `head_attach_walk_prototype/head_attach_eight_view_contact_sheet.png` under each Peasant's local `render_frames` directory on the X230i. Original archives, textures, and generated preview files remain private and are not checked in.

## What is and is not proven

**Proven:** the Base Character head/face geometry can be skinned to the Peasant rig and follows the sampled real UAL1 walking pose in all eight preview rotations. The first composite is visually coherent enough to justify further art review.

**Not proven / release blockers:**
- The geometric head/neck cut and skin-tone/collar seam are not accepted; inspect from close range in Blender and at game camera distance.
- The supplied Base Character heads are bald/basic and may not fit the desired peasant art direction. Hair/headgear and character identity still need an art decision.
- No composite glTF was exported; no production asset was changed.
- No grounded shadow, foot-contact, action/loop timing, canonical East/West mapping, browser 2/4-player visual acceptance, or performance measurements.
- The existing overall quality run remains governed by its independent Combat browser gates; Graphics 3A results do not waive those gates.

Next safe step: open the private composite in Blender, inspect the collar/neck seam, and get Graphics Art Director approval before making a reusable export path. Keep the Silver Knight P0 and live player model unchanged.

## Reproducible GitHub-side renderer — 2026-10-26

The previous eight-view head attachment was an uncommitted private feasibility script. **That gap is now closed for offline review only:**

- [`scripts/graphics3a_p1_head_attachment_review.py`](../../scripts/graphics3a_p1_head_attachment_review.py) contains the reusable, explicit source-archive/source-model/target-model CLI. It loads the actual approved Base Character, UAL1 Standard GLB and target Peasant glTF; checks named rig parent topology and upper neck/head/clavicle anchor positions; validates inverse-bind matrices; selects only upper face geometry; maps skin indices by joint name; uses the target's actual retargeted Walk pose; and writes eight rotated 256px stills plus a private source-hash report.
- The head cutoff is computed from **the actual upper extent of the target outfit mesh + 0.02 m**, instead of hard-coding distinct male/female collar heights. This is a deterministic lookdev choice, **not** approved seam topology.
- [`scripts/graphics3a_p1_head_attach_rules.py`](../../scripts/graphics3a_p1_head_attach_rules.py) contains source-only fail-closed ZIP-path, cutoff, bone remapping, upper anchor and finite geometry safeguards. [`tests/test_graphics3a_p1_head_attach_rules.py`](../../tests/test_graphics3a_p1_head_attach_rules.py) adds **12 passing source-only unit tests** to protected quality CI. All existing mandatory Combat, Core, World tests remain intact.
- Both originals were rerendered privately on X230i with the generalized pipeline: **Male Peasant** head-attachment sheet SHA256 `e3897e4addfb5c651631b00e2b7d3cb4fb463e5e227e7077bfc101c1d8bc287c`; **Female Peasant** sheet SHA256 `52db765d080ee610ceeb21ed0ef039303f841cdbb547bd35bc126a7d3d2a0a35`. Each was eight actually rotated source-mesh views, sampled at 50% of real UAL1 `Walk_Loop`, with private original-derived textures.
- **Reproducibility:** re-fetching the *committed script* from HEAD `fe5e895916217f4bd208207d38f05ba8f8ea59ad` and rerunning Male Peasant produced the identical contact-sheet SHA256 `e3897e4addfb5c651631b00e2b7d3cb4fb463e5e227e7077bfc101c1d8bc287c` on the same X230i.

Example **private-only** invocation (substitute local paths with your own approved vendor files):

```bash
python3 scripts/graphics3a_p1_head_attachment_review.py \
  --target-model "/private/review/Male_Peasant/Male_Peasant.gltf" \
  --base-archive "/private/Universal Base Characters[Standard].zip" \
  --base-model-suffix "Superhero_Male_FullBody.gltf" \
  --animation-archive "/private/Universal Animation Library[Standard].zip" \
  --animation-model-suffix "Unreal-Godot/UAL1_Standard.glb" \
  --clip Walk_Loop --fraction 0.5 \
  --output "/private/head-attachment-review/Male_Peasant"
```

**Strict HOLD remains**: the output is **not** a composite Blender/glTF master model; there is no cloth/skin seam approval, acceptable hair/head appearance, complete animation source/atlas, cardinal facing verification, grounded/shadow/foot contact, 960×540 native game integration, Chrome/Firefox 2/4-player p50/p95, or Art Director/Main 0 release authorization. The rejected Mid-Poly Knight was not used; no commercial paid assets or vendor binaries were committed.
