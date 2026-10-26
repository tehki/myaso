# Graphics 3B P1 — original Blood & Iron Blacksmith (Blender source review)

**Release state: DRAFT, ART REVIEW ONLY, NO MERGE/DEPLOY.** This is an isolated child of [Quaternius source-only #1070](https://github.com/tehki/myaso/pull/1070), not a new Combat/Core/World branch. The approved cottage [#1054](https://github.com/tehki/myaso/pull/1054) and the original Blender Red Lion are unchanged.

## Genuine artist work

- Import named **CC0 Quaternius Medieval Village MegaKit Standard glTF** walls, brick entrance, timber-framed walls, tiled roof, doorframe, window, chimney and crate from pinned mirror commit `21104b4045261c28fc312360841ed1a7b0ac8782`.
- Construct original **three-dimensional** iron anvil (foot, waist, top, tapered horn), hand-forged hammer and tongs, wooden smith's bench, charcoal masonry forge with chimney stack, glowing ember bed, and a stone working yard in an editable Blender source.
- Use actual PBR materials for iron, soot-darkened masonry, oak and charcoal. Ember/flame shader and light are **cosmetic source-authored** render only, not a new in-game particle/lighting engine.
- Render **authentic Blender day+dusk RGBA images**, record their SHA-256 and the editable `.blend` SHA-256, attach native artifacts to the exact commit's workflow. This is a visual review candidate, **not** the owner's final art approval.
- Use the same orthographic source-review approach as the approved cottage, but allow a larger isolated framing for the forge apron. No changes to the original Greyhaven live camera/projection.

## World-owned anchor remains read-only

World9's existing authored map already contains `smith` at `x=3710,y=3850,w=182,h=162`, and the existing reviewed static-solids document contains `building:smith` on the same rectangle. These are **existing source references only**, not new coordinates or authority.

World9's current facade-replacement allowlist is **only** `red-lion`. This PR does not add `smith` to that allowlist, does not alter World9 files, does not render Blacksmith in the live 960×540 Canvas, and does not grant any building access. Forge/anvil authoring coordinates are **local Blender meters**, not gameplay/item spawn coordinates.

Items2B/Core8/World9 separately own sword/item identity, rack authorization and interactions. Physics6 owns physical collision; Core8C owns zone authority; Graphics3C owns shared environmental atmosphere. Blacksmith fire cannot damage players or grant a weapon. Do not invent portals, walkability or items from this review asset.

## Qualification boundary

An `actual source-backed Blender` PASS establishes imported geometry, source manifests, original Blender-modeled forge/anvil, day+dusk images and SHA provenance. It does **not** establish real Chrome/Firefox live integration, native two/four-player authority, 960×540 rendering, frame performance, collision legality, source art owner approval, or any production/Pre-Alpha readiness.

**Next permitted step:** Graphics Orchestrator 3 and Main0 select a P1 integration branch while World9/Core8C/Physics6 agree canonical `smith` display/occlusion/footprint and entrance behavior. Graphics3B then installs *only* the approved source-backed sprites in existing World9 opt-in rendering with genuine native Chrome/Firefox multiplayer checks. Main0 alone authorizes merge or deployment.

G0 Blood & Iron gore surface compatibility is planning only. G1 runtime gore remains blocked.


## Owner visual corrections — authentic Blender R2 (October 26, 2026)

This draft intentionally remains visually **unaccepted** until the owner inspects the new rendered images. The previous genuine Blender and Chrome/Firefox checks passed source authenticity but did not establish artist acceptance; the owner observed absent door/window, remote anvil, prop–crate overlap, an open roof-to-wall triangular slit and forge–roof intersection.

The new **editable native Blender scene** uses the same original pinned CC0 Standard Quaternius modules with two *additional genuine source meshes* (15 imported modules total):

- Import `Door_1_Round.gltf` at the existing Quaternius door-frame center alignment (source intrinsic +0.513745m center offset), rather than leaving an empty entrance. Retain `DoorFrame_Round_WoodDark`.
- Import genuinely open `WindowShutters_Wide_Round_Open.gltf` on `Window_Wide_Round1.gltf`, and keep scene-only warm emission on the **real imported glass shader** at dusk, returning its original PBR for daytime.
- Create **two true Blender triangular masonry prisms**, one at the front and one at the rear, with oak sill/rafters, calibrated to the actual imported source roof and door/window wall crown. An occluding painted triangle would not close the geometry. Keep source roof meshes untouched.
- Shift the forge's masonry/hood/stack physically outside the original roof's projected bounding geometry; move the anvil to a 1.9m working-center distance, close enough to work between horn and hearth.
- Move the original creator crate away from the toolbench. Put the Blender-modelled hammer and tongs on the bench and measure actual creator crate vs. real hammer and bench meshes. Nothing should hide intersecting geometry behind a camera-only repair.

**Fail-closed actual Blender geometry audit:** compute evaluated *world-coordinate bounding boxes* from genuine imported glTF roof/crate and actual authored forge/hammer/bench objects after parent transforms. Require roof–forge horizontal AABB clearance ≥0.16m and crate–tool/bench clearance ≥0.10m. Verify original roof Z envelope contains both full-height gable tips, authentic door/shutter imported meshes are nonempty and same-run real window glass material slots exist. Record actual numeric clearances and world bounds in the archived source report, then run genuine Blender day+dusk RGBA, real W3C Chrome/Firefox canvas readback and screenshot acceptance. Geometry tests do not replace owner visual judgement.

**Runtime remains prohibited:** no `src/`, `web/`, `server/`, `assets/world/`, Rust/Combat changes, no World9 `smith` replacement authorization, no doors/portals/item pickup/collision contract, no merge/deploy. Source-derived 3D geometry is not a real network authority test.
