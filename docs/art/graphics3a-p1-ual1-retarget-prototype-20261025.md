# Graphics 3A P1 — UAL1 Standard outfit retarget prototype (2026-10-25)

**Verdict: HOLD — private offline visual review only. Not a playable/release asset.**

## Scope and provenance

This is a local qualification experiment for the owner-approved, free Standard character packs. The animation source is the official `Universal Animation Library[Standard].zip`, member `Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`.

- Source archive SHA-256: `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`
- The original source archive, original outfit glTF/BIN data and full-resolution textures remained on the private X230i. None of those vendor binaries, generated PNG frames, or private JSON reports are committed.
- The preview used locally derived 512px textures. Outfit geometry and skin data were not replaced with fabricated geometry.
- Rendering ran through local EGL on the X230i; the GL renderer emitted a Mesa warning about forcing software rendering while a hardware device was selected. This does not invalidate the captured images, but the environment is not a release performance benchmark.

## Actual result

The prototype sampled real UAL1 source animation channels, applied local TRS deltas relative to source and target rest poses, CPU-skinned the target outfit mesh using its inverse-bind matrices, and rendered eight rotated views per sample. The current clip set samples Idle, Walk and Sprint at 10%, 50%, and 90%; Jump Start, Jump Loop and Jump Land at 50%; and Roll at 10%, 50%, and 90%.

| Private target | Target model SHA-256 | Skeleton height (m) | Outfit mesh bounds height (m) | Head geometry detected |
|---|---|---:|---:|---|
| Male Ranger | `e1033a212332d84d98c19bc4927c621635478d0aa15d13c79da68d3ba9e0196f` | 1.5998 | 1.8690 | Yes |
| Female Ranger | `9b98b2ae6af3b4a1ec22bf8928b939e0751f08b25b636de82bfa7364fb34d3e1` | 1.5496 | 1.7980 | Yes |
| Male Peasant | `8f5a6cf6c1cf96e0a0f8e1a861b4245d42b7f88d44e5076da3d48f3fc52f4e76` | 1.5998 | 1.5626 | **No — outfit-only rig** |
| Female Peasant | `43ba98058b933cae9acbde0f3ef8c3dda4ba9f69f338606f9d87666d9efffb31` | 1.5496 | 1.5252 | **No — outfit-only rig** |

All four rigs have the same 65 named joints and named parent topology as the UAL1 source rig. The inverse-bind/rest-pose skin matrix maximum absolute errors were:

| Rig | Source error | Target error |
|---|---:|---:|
| Male Ranger | `7.501e-07` | `8.443e-07` |
| Female Ranger | `7.501e-07` | `6.925e-07` |
| Male Peasant | `7.501e-07` | `8.443e-07` |
| Female Peasant | `7.501e-07` | `6.925e-07` |

Each rig produced 120 actual mesh frames across seven source clips (15 sampled poses × 8 yaw rotations); total: **480 private rendered frames**. Each report and contact sheet has a SHA-256 recorded in the private `retarget-review.json`. The renderer required nontrivial animation and visible-alpha coverage for every frame. Contact sheets were manually inspected: the Ranger Walk/Roll and Peasant Sprint/Jump samples show differing source-clip poses across phases.

## Important finding: Peasant outfits are headless

Both Peasant glTFs are outfit-only geometry. Their top mesh bounds stop below the rig's Head joint, so the prototype reports `target_head_geometry_detected_by_mesh_bounds: false` and `target_visual_role: headless outfit-only rig; attach an approved Base Character head before player use`. Their animation renders are useful clothing/skin tests, **not complete player-character proofs**. Do not use either Peasant outfit alone as a player model.

## Implementation and tests

- `scripts/graphics3a_p1_cpu_skin_retarget.py`: offline GLB/glTF parsing, source/target topology checks, local rest-pose delta retarget, CPU linear-blend skinning, real texture/material render, eight-yaw frame capture, and a private report.
- `tests/test_graphics3a_p1_cpu_skin_retarget.py`: 19 synthetic unit tests for quaternion math, TRS retargeting, interpolation, interleaved accessor decoding, GLB bounds, path traversal rejection, hierarchy mismatch rejection, normalized material factors, skeleton-height scaling, and headless-outfit detection.
- Local X230i verification: Python compile and **19/19 tests passed** before the four-rig render; all four render runs exited 0.
- Protected GitHub Actions quality run [40203998507](https://github.com/tehki/myaso/actions/runs/40203998507): the Graphics 3A validation step, including the new 19-test suite, passed. Overall quality remains **failed** at the independent existing browser acceptance **M161 bounded kick knockdown**: after recovery, the repeated kick did not create a fresh clean knockdown. Do not bypass this Combat gate or characterize the overall run as green.

## Remaining gates — no release approval implied

1. Art Director review of actual clips, silhouette, materials, facial coverage, lighting, ground contact, and foot sliding.
2. Decide how to attach the approved Base Character head to each Peasant outfit; validate neck seam and weights.
3. Validate directional yaw semantics against Rust World cardinal/East-West mapping; current eight yaws are rotations, not yet accepted world-direction mappings.
4. Decide and test root-motion policy, floor contact, and action-specific clip timing/loop boundaries.
5. Integrate only after explicit Graphics 3A and Main Orchestrator 0 approval, then run authentic Rust World Chrome/Firefox 2-player and 4-player visual/performance checks with p50/p95 data.

No P0 Silver Knight, Combat/Core integration, live player model, deployment, or release status was changed. PR remains Draft / HOLD.
