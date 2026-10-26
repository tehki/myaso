# Graphics 3B — Close Quaternius roof-to-wall gable gap (authored Blender, not image edit)

**Owner feedback, 26 October 2026:** the Blood & Iron Quaternius cottage, warm dusk main-window/door-glass lighting and chimney smoke are approved visually. Remaining issue: the upper triangular gable area between the sloping roof and top of the plaster wall reads as an opaque/empty void. Owner approved correction in real Blender.

## Real authoring implementation

Child of [draft Graphics 3B #1049](https://github.com/tehki/myaso/pull/1049). `tools/art/render_quaternius_greyhaven_preview.py` now uses real original Quaternius `Roof_RoundTiles_4x4` and both original plaster-front-wall imported world-space bounds to validate an independently editable triangular **3D plaster infill**, rather than paint onto a screenshot, move the roof, or fake fill in browser.

- Front gable is a genuine double-sided triangular prism at local front facade y = `-2.07`, base z = `3.09`, top z = `5.10`, half-width `1.85` original authoring/world-meters. Four separate dimensional timber bars form a sill, two sloped rafters and a slim center post. Authoring geometry and physical bounds, dimensions, source asset names and invariant flags are reported as CI evidence.
- Surfaces directly reuse the authentic free CC0 Quaternius imported **`MI_Plaster` and `MI_WoodTrim` PBR materials**. Original glTF mesh vertices, all original source texture files, original roof tiles, untouched door alignment and lighting, chimney and smoke remain unchanged.
- A fail-closed Blender geometry gate rejects gables without original roof/front-wall source meshes, wall-crown continuity, roof-bounds containment, or plausible plaster face area. A fail-closed 2.5D sprite baker and native Chrome+Firefox source World9 editorial-review gate enforce the new source-PBR geometry proof.
- The optional original World9 visual comparison remains **screen-space editorial**, not a new building, collision solid, openable portal, property deed, authoritative entity or game rendering activation.

## Acceptance and limits

Render both actual original Blender day/dusk 640x640 transparent PNGs plus an editable genuine Blender .blend; verify clear visible solid timber/plaster gable in place of void, correct roof silhouette, unchanged door position and warm window/door glow + smoke; produce alpha-preserving WebPs and first-party native Chrome+Firefox Canvas review screenshots with zero changes to World9 pixels outside the comparison inset.

**User art approval pending for THIS gable revision**, even though earlier visuals were accepted. Existing Quaternius 176 original creator archive byte parity, GPL-free CC0 licensing and original A2.32 Red Lion remain preserved. No merge, deploy or World9 placement before Main0 / Graphics 3 & World9/Core8C approvals; Combat P0 independent.
