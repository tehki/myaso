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
