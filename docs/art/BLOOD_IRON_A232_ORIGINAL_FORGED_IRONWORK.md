# Graphics 3B A2.32 — Red Lion original wrought door and shutter ironwork

**Moon Games / myaso.io · Blood & Iron · Greyhaven First Playable track. Source/Blender TESTED, human art review needed, no live game integration.**

## Intent

The owner has directed Graphics 3B to prioritize **stone, timber, realistic doors/windows, ironwork and lighting**, rather than further cosmetic roof polish. This isolated draft is a real **non-roof geometry addition** to the already created original Red Lion A2.30 Blender scene; it does not replace the inn, the terrain, the roof or the World.

Parent original editable Blender art: [A2.31 Graphics 3B #466](https://github.com/tehki/myaso/pull/466) exact source head `0cbf33adf70beda55b8fcb8bef4ba2efb36084e5`. It incorporates original A2.30 **35-mesh dimensional facade joinery**. The original A2.30 `blood_iron_red_lion_a230_joinery.blend` remains unchanged; the derived A2.32 scene contains actual independently editable Blender meshes.

### Added genuine Blender geometry

- Two forged black-iron door **hinge straps**, each with a barrel and three hand-peened rivet studs on the existing front door.
- One actual ring-geometry **door knocker** and its small blackened metal mount.
- Four pairs of upper/lower iron fasteners on the already-authored **west and east window shutters**.

Exactly **20 added Blender mesh objects**, all named `A2.32 wrought fittings / …`. The previous original source, existing 3D timber, door frame, limestone and windows are preserved. No iron is merely painted onto a stock generated background. The result is not an invented new city.

### Reproducible source generation

1. Use original owner-modified Blender 5.2.2 and the exact source `assets/environment/greyhaven/a230-review/blood_iron_red_lion_a230_joinery.blend`.
2. Run `blender -b <source> -t 2 --python tools/art/build_red_lion_a232_ironwork.py -- <a232-review-path> <repo-root>`.
3. This emits a new editable `red_lion_a232_wrought_ironwork.blend` and **two real source-scene Cycles 640px RGBA renders** (baseline/ironwork). It preserves original World-to-Canvas 33.6px/meter ground basis, source camera zoom 0.84 and original Red Lion artist doorway pivot.
4. Run `python tools/art/export_red_lion_a232_ironwork.py <repo-root>`. This flips Blender Y to game positive-down, crops exactly `228×297` around fixed `(206,51)` in 640 source pixels and creates reproducible lossless WebPs for original daytime and glass-only dusk lighting. The exact historical roof image is copied byte-for-byte **without redesign**.
5. Run `node --test tests/art-direction-a232-forged-ironwork.test.mjs`.

### Real original render measurements

- **6,697 changed RGB source pixels** between the two original 640×640 Blender Cycles renders, demonstrating actually visible architectural work.
- **Zero changed alpha pixels**, no roof change, no new facade silhouette, no modified projection/crop/door anchor.
- Both day/dusk 228×297 WebPs have a lossless decoded RGBA roundtrip; source alpha equal in day and dusk.
- Original geometry visible footprint remains `[209,54,431,345]` in source 640 frame.
- Roof remains byte-identical to original A2.31 frozen roof, no new radial lighting or duplicate Graphics 3C lantern.

View the **actual Blender Cycles before/after image**, not a fantasy concept:
`assets/environment/greyhaven/a232-review/red_lion_a232_original_cycles_compare.png`.
Source report: `assets/environment/greyhaven/a232-review/red_lion_a232_art_report.json`.
Original unaltered and derived editable source SHA manifests: `red_lion_a232_blender_source.json`.

### Boundaries and release criteria

**Not** an actual connected multiplayer Greyhaven screenshot, not a proven door interaction, and not yet human Art Director approved. All original browser-client work still uses the previous facade. The new art has no gameplay effect. Actual First Playable integration requires reviewed World #521 named replacement, 3C external lighting *once*, Red Lion art readiness/fallback from Graphics #575/#761, authentic local/remote Silver Knight depth and strict Chrome/Firefox browser scene/real input acceptance.

The associated original Greyhaven/Red Lion production seam is still absent from Core/UI #702. Never insert new art directly into Pre-Alpha 0.1, which remains the current original combat arena. No World, hitbox, Core/Items, Combat, network, physics or server mutation. No production activation, no independent merge/deployment.

**Status:** Original Blender geometry authored and rendered; pixel/source checks verified. Next: Art Director visual acceptance at actual Greyhaven 0.84 gameplay camera, then source-only Chrome/Firefox render validation, only then World/Core integration review.
