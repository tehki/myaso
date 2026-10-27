# Graphics 3A P1 — Original-Source Skinned Neck-Cap Geometry (2026-10-26)

**Scope:** approved Quaternius Male/Female Base Character + Peasant sources, private X230i lookdev. **Draft PR #1041. ART/RELEASE HOLD.**

## Purpose

The owner conditionally accepted current Peasant/Ranger-Hood visuals if future characters have a separately removable head, interchangeable armor, and a fully modeled unequipped base body. Combat Department 4 remains busy with Pre-Alpha and receives no new tasks.

Original free Standard Base Character glTFs combine head/body geometry into a single skinned mesh. Previous plane clipping produced an **open** neck boundary, so a geometry prototype was needed before any finished character art could be considered.

## Verified original-source cut topology

Actual glTF source analysis determined **two disjoint planar opening loops** per character: a principal neck opening and a small independent anterior opening. An initial one-loop cap attempt correctly refused to proceed; both loops must be handled.

| Exact original source | Male | Female |
|---|---:|---:|
| Head cut plane Y | 1.578655 m | 1.538433 m |
| Main loop boundary vertices | 84 | 80 |
| Additional loop boundary vertices | 4 | 4 |
| Resulting cap triangles | **84** | **80** |
| Source cap planar surface area | 0.01574925 m² | 0.00855009 m² |

The new `scripts/graphics3a_p1_neck_cap_geometry.py` extracts all original geometric boundary loops, rejects nonmanifold, off-plane, self-crossing or nested invalid boundaries, triangulates each disjoint loop separately, and preserves original skinned neck-edge bone influences. A geometric edge-count check confirms that every combined head-shell + cap edge is paired exactly twice in the original rest geometry. The returned status is `OFFLINE_ART_HOLD_NO_BODY_CAP_OR_GAME_EXPORT`.

`scripts/graphics3a_p1_head_attachment_review.py` now supports opt-in `--head-cap geometric-prototype` with `--cut-method plane`. The default remains **`--head-cap open`**, preserving prior preview behavior. The new cap has a temporary private lookdev material, not production UVs.

## Actual X230i original-source rendering

Both real Male/Female Peasant + Base Character + approved Ranger Hood combinations completed eight 512×512 camera views from the genuine UAL1 Standard `Walk_Loop` 50% source pose. All vendor images, source ZIPs and generated PNGs remain private, not in the GitHub PR.

| Private original-source output | SHA-256 |
|---|---|
| Male eight-facing PNG | `406ce05252fe222f6016b600de702d4cdd9cb2d30df1934423bbcf9f39234a18` |
| Female eight-facing PNG | `5df01cadf848ca38e857d52c3b497e44e7f0d30eaffb25db539782ca7e4ba735` |

Private reports also confirm two cap loops each, with original source cap triangle counts as above. Report hashes: Male `be82f8005520d465557e768e3e6d0e08a142a4892e458a4e7ae8d6c27385e416`; Female `8c061925a86fed3bd8fa66fe9db816b644a7ff9fa78d739dab701ab557962977`.

The prior **unsigned** original head-to-outfit nearest triangle-surface p95 remains **0.10994 m Male / 0.11835 m Female**; this is not a direct visible-gap measurement. The torso-side geometry is not finished.

## Tests and boundaries

**12/12** new source-only cap tests passed on Serj; Python compilation passed. Tests cover single and multiple openings, per-vertex joint weights, skinning ambiguity, planar UV/winding, invalid geometry, nonmanifold edges, nested loops, and negative inputs. These tests were added to protected quality CI, keeping all prior Combat/Core/World checks intact. Graphics P1 source-only synthetic tests now total **182**, plus the earlier separate 70 authentic UAL1 hood-pose checks.

**This is only an original-source head underside geometry prototype.** Still required: a matching torso-side neck interface and final art materials, individually extractable head geometry, complete unequipped base body, authentic alternative armor sets, animated seam/fit checks, and independent Art Director/Main0 approval. None of these functionalities is claimed live.

**NO COMBAT work, no game runtime change, no vendor binaries or textures committed, no merge, staging, deployment or P0 Silver Knight replacement. Draft PR remains ART/RELEASE HOLD.**
