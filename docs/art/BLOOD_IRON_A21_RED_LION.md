# Blood & Iron A2.1 — Red Lion material/geometry polish

**Art-review milestone, not a playable environment or production release.**

A2.1 deliberately builds on the checked-in and owner-reviewed **A2** Blender scene. It never replaces the A1 OBJ, portal locations, barrel coordinates, A3 roll clips or browser physics. Existing A2 source and previews remain intact. Run the script with Blender 4.5 LTS on CPU for the NVIDIA GT 630 workstation.

## Reproduce

    blender --background --factory-startup --python tools/art/polish_red_lion_a21.py -- --base /path/blood_iron_greyhaven_a2.blend --out-dir /path/a21-review --render --samples 4

Outputs:

- blood_iron_red_lion_a21.blend — separate editable derived scene; retains all original A2 Blender objects.
- blood_iron_red_lion_a21.png — same A2 Red Lion close-up camera at 1120 × 720.
- blood_iron_street_a21.png — same A2 wider street review camera at 1120 × 720.
- blood_iron_red_lion_a21_report.json — measured details, no-runtime integration boundary.

## Authoring scope and measured geometry

- 352 original, deterministic handmade clay tiles in **one Blender mesh** (four muted fired-clay material variants). Tile underlayer and original A1 roof geometry remain intact. Mesh tagged **roof-occlusion-candidate** for a future independently reviewed layer bake.
- 56 shallow dressed foundation-stone faces, grouped in **one Blender mesh**; placement is measured against the actual original A1 stone foundation. The tavern door remains untouched.
- 12 oak draw-peg heads, grouped in **one Blender mesh** at exposed timber-frame joints. No new collision.
- Nine new project-authored procedural Blender materials. No third-party textures, asset packages or downloads.
- **289 original A2 mesh objects preserved**; **seven original, nonoverlapping barrel positions unchanged** (minimum verified barrel edge clearance 0.153 m).

This is a three-mesh visual-detail overlay, not a change to the game world. Blender batching does **not** establish a browser draw-call or VRAM budget. Geometry/texture atlases are still pending. Comparable renders must be visually inspected; do not claim photorealism from simple geometry counts.

## Safe boundaries

- No animation, combat, movement, hitbox, collision, networking or server changes.
- No portal logic or Red Lion authored footprint changes.
- No reset or deletion of the approved A3 roll.
- No production export or deployment. PR remains draft until owner art approval and required exact-head CI pass.
