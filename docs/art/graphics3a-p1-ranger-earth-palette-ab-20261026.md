# Graphics 3A P1 — Ranger Hood Earth-Brown Cloth Palette A/B

**2026-10-26 | Draft PR #1041 | ORIGINAL FREE STANDARD SOURCES | ART / RELEASE HARD HOLD**

## Goal and provenance

The original owner-approved Quaternius **Modular Character Outfits – Fantasy [Standard]** Ranger Hood fits the matching Male/Female Peasant 65-bone skeleton and authentic UAL1 motions. The publisher's original baseColor image contains olive-green cloth regions that clash with predominantly brown Peasant clothing; the gray/silver side panels are intentionally present in the source. The approved original `T_Ranger_ORM.png` must remain enabled for an honest material A/B.

This experiment transforms **only an in-memory copy** of the real publisher `MI_Ranger` hood base-color texture for a private lookdev preview. No modified texture, vendor ZIP, glTF, GLB or binary is written to GitHub or the game. **It is not an approved art asset.**

## Implemented reversible option

`scripts/graphics3a_p1_head_attachment_review.py` now accepts:

```text
--approved-hood-archive /private/Modular Character Outfits - Fantasy[Standard].zip
--hood-material publisher-orm
--hood-palette earth-brown-prototype
```

The **default remains `--hood-palette original`**. `earth-brown-prototype` requires the validated original `MI_Ranger` material, exact `T_Ranger_ORM.png` source, author 4096×4096 baseColor texture and original private ZIP; it fails closed otherwise. Other character, skin, eye, eyebrow, outfit, source asset and gameplay materials are unchanged.

Only green-dominant source pixels are selected: `G >= 25`, `G > 1.08 R`, `G > 1.10 B`. They are mapped with deterministic source-shading variation to approximate muted umber:

```text
R' = floor(0.87 G + 0.14 R)
G' = floor(0.54 G + 0.24 R)
B' = floor(0.27 G + 0.17 B)
```

RGB values are bounded to 0–255. Existing brown fabric, neutral gray/silver surfaces and warm skin colors are left alone by this rule. This is a **broad provisional mask**, not painstaking original UV-specific retexturing: on the actual 4096×4096 Ranger atlas it selected **7,817,393 / 16,777,216 pixels (~46.6%)**. It requires detailed Art Director material/UV review before any production derivative can be considered.

## Actually executed publisher-source A/B

On private X230i, rendered real Male/Female Peasant glTF, original Base Character head, genuine Ranger Hood part, UAL1 Standard `Walk_Loop` at 50%, opt-in plane cut and previous neutral-skin *review* experiment, with the true publisher metallic/roughness ORM image. Both independent private prototype and the **committed** implementation completed eight 512×512 orthographic collar-angle facings each.

| Source gender | Committed eight-facing 4096×512 contact-sheet SHA-256 |
|---|---|
| Male Peasant + Ranger Hood, earth-brown A/B | `8dd475106a171066eb0a43d45b8c0a66c9533fee51bc87500a15cc8d3f039205` |
| Female Peasant + Ranger Hood, earth-brown A/B | `da4ac8eeb22e8685774f5fe591b45346a897fda639b8af1807927f6d32efc94c` |

The earlier independent private test and final source-committed renders are **nearly pixel-identical**, but not byte-identical:
- Male: precisely **one RGB pixel** different within the full 4096×512 sheet, maximum channel delta 5.
- Female: one three-pixel-wide RGB variation within the full sheet, maximum channel delta 4.
- The source texture transformation selected the same **7,817,393 pixels** for both. Source camera, actual model, animation, bind diagnostics and preview options match. It would be inaccurate to claim identical PNG hashes.

The original author ORM preview SHA-256 was Male `10149622535660e5364bff4d9cb9604ca8b9ff03e370488e5db2f62da3ea0c61`, Female `928d30ab3be678b3007bdc7e346d5bd756b8448748904942c0d5562a13cf7a83`. This color A/B is visually distinct from those originals.

**Visual review:** the green sections become warm brown/tan fabric that appears more consistent with the existing Peasant clothing. Brown base fabric, original gray/silver side panels and sculpted drape persist; the face still has poor cheek shading and bare-headed proportions inside the hood. The true open neck/collar topology, hood-to-shoulder intersections and silver sides are **not repaired by recoloring**. The old unsigned nearest actual garment-surface p95 remains 10.99 cm Male and 11.84 cm Female (not a literal visible hole width).

## Tests and release scope

- `scripts/graphics3a_p1_ranger_palette_rules.py`: deterministic pure source-pixel inclusion and mapping, with strict RGB validation.
- `tests/test_graphics3a_p1_ranger_palette_rules.py`: **10/10 source-only tests pass** on Serj, covering selected green, preservation of brown/silver/skin, invalid inputs and idempotent unchanged cases. Python compilation passed.
- The protected quality workflow runs these **in addition to all existing** Graphics, Combat, Core, World and browser gates. Graphics P1 synthetic suite count: **144** (134 prior +10); the separately verified 70 real UAL1 pose checks remain distinct.
- No vendor source assets, texture PNGs, modified atlas bytes, gameplay, actual player sprite replacements or test bypasses have been committed.
- The source library licensing and original SHA/provenance remain as documented in the preceding Graphics P1 reports.

Private evidence on X230i: `~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/ranger_earth_palette_committed_20261026/`.

**Next:** art-directed original head/collar construction and detailed fabric/metal UV retouch in Blender or equivalent; multiple real UAL1 actions in eight facings; native 960×540 Chrome/Firefox two/four-player acceptance, then Graphics Director 3/Main 0/Owner explicit GO.

**VERDICT: REVERSIBLE LOOKDEV VISUAL IMPROVEMENT / NOT ART APPROVED / RELEASE HARD HOLD. NO MERGE OR DEPLOY.**
