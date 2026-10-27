# Graphics 3A P1 — publisher Dark/Light atlas A/B (2026-10-26)

**Scope:** owner-approved **free Standard** Quaternius Universal Base Characters; private X230i lookdev.
**Verdict:** **ROOT CAUSE LOCALIZED / BOTH STOCK ATLAS VARIANTS ART FAIL / RELEASE HARD HOLD**.

## Original-source question

The previously documented Male/Female Peasant + Base Character head composites display geometric dark-gray patches on the scalp, cheeks, and (especially Female) the horizontal nose-cheek stripe. Removing separate source eyebrow and eye meshes did not remove them. The supplied Base Character color atlas is fully opaque; changing alpha blending is not a warranted repair.

The original official archive contains **both** Dark and Light **body-color atlases** with exactly matching 2048×2048 dimensions, UV layout and approved free Standard provenance. These are legitimate **publisher alternatives**, not image generations or improvised recoloring. The glTF in the free Godot/UE folder selects the **Dark** version by default.

| Source material | Official image in publisher ZIP | SHA256 |
|---|---|---|
| Male Dark (original glTF default) | `Base Characters/Textures/T_Superhero_Male_Dark.png` | `df680cbc1967a61e85998bfafb8f7bc0a36dd604bb3266486c4b06b1a184bb45` |
| Male Light | `Base Characters/Textures/T_Superhero_Male_Ligh.png` (publisher spelling) | `419f96dbb8811511e2d515bcdabc085ff2f219ec7b8b4e91050a84cba6888fe9` |
| Female Dark (original glTF default) | `Base Characters/Textures/T_Superhero_Female_Dark_BaseColor.png` | `d366843ee7d9e9f37ec87a0e1c98c7f2e45573c08eeb80a51a6d9344e68cf288` |
| Female Light | `Base Characters/Textures/T_Superhero_Female_Light_BaseColor.png` | `743f811857db0b950f3ad09a0733dfa4888801ead332313ca25becea14c54f8d` |

All textures remain in the private verified source ZIP on X230i. No vendor asset was uploaded or edited.

## UV-to-color localization of the defect

The actual main head/body mesh `TEXCOORD_0` was decoded from the original free Standard glTF and sampled through its `baseColorTexture`. All analyzed UVs were inside [0,1], so these neutral-gray markings are not caused by an obvious out-of-range UV.

Examples of real original head triangles whose texture samples align with the dark markings:

| Original mesh / UV | Dark pixel RGB | Corresponding Light pixel RGB |
|---|---|---|
| Male scalp UV (0.266, 0.107) | (45,45,45) | (143,143,143) |
| Female face/neck UV (0.185, 0.216) | (54,54,54) | (163,163,163) |

Additional measured source triangles:
- Male: **24 / 2,646** selected head-region triangle-centroid samples had mean RGB intensity below 80, all in sampled scalp region above Y 1.72 m.
- Female: **327 / 2,788** selected head-region triangle-centroid samples had mean RGB intensity below 80, predominantly lower face/neck (314 under Y 1.63 m).
- These are centroid color samples, **not** measured image coverage and **not** a definitive proof of every affected visible triangle. They strongly localize the dark color to the underlying source body atlas/UV mapping rather than an eyelash/eyebrow transparency problem.

## Actually executed Dark vs publisher Light render

Committed private source-review tool now supports **`--body-atlas original|publisher-light`**. Default `original` is retained. The `publisher-light` option is restricted to the exact two official body material filenames, enforces the published 2048×2048 dimensions, and rejects arbitrary file requests. No original glTF, ZIP, or game asset is mutated.

Each variant was rendered from the **same original Male/Female Peasant outfit glTF**, approved Base Character head and eyes, original UAL1 `Walk_Loop` 50% (≈0.667 s), eight 512×512 facings, optional `--cut-method plane`, and `--face-parts without-eyebrows`.

| Gender | Original Dark contact SHA256 | Official Light contact SHA256 |
|---|---|---|
| Male Peasant | `b8ffd6062835ef47b4b575b5a4e90be9ce7239f58563eca9bd7de38003d681b2` | `32dcc529b9753becfa6a5e0217e6691faae62f812b1dbc43a6fcecc31d927f16` |
| Female Peasant | `7dc075b1592a74abbb6d37b2914aec182505982fcabc0c60882a8c830b676941` | `0a66d9eb134b98a63c5fcf1f9eb259cb511eb0b53da875c77645df7f01665a45` |

Both original and Light source runs completed successfully. Source archive SHA256, original outfit SHA256, camera, pose, face-part filter and cut method were identical within each pair.

**Observed visual result:** the official Light version lightens the formerly dark markings to **bright pale-gray/white strips and triangles** in the exact same general regions, including the Female nose/cheek stripe and Male scalp/temple. This makes the problem **more conspicuous**, not resolved. Both Dark and Light source atlas choices therefore **FAIL the gritty medieval appearance requirements** for use on their own. The neck/collar geometry defect also persists and remains unapproved.

## Tests and strict boundaries

- `scripts/graphics3a_p1_head_attach_rules.py` now contains an exact-name `light_base_atlas_member` whitelist: supports only the two publisher filename mappings and the expected original `Base Characters/Godot - UE/` archive folder.
- `tests/test_graphics3a_p1_head_attach_rules.py` adds **3 source-only tests** covering precise official paths, arbitrary/remote/traversing dependency rejection and wrong source folder rejection.
- Python compile and **18/18** head-attachment helper tests passed on Serj. Cumulative Graphics P1 source-only Python tests are **98** (previous 95 plus 3).
- Exact-head GitHub quality is tracked separately. This offline test **cannot waive** any World/Combat/Core browser acceptance gate.

**Art Director action:** stop relying on the stock Dark/Light head body atlases as a ready character solution. Select an appropriate approved face/head asset or author and validate a new **skin-tone-matched** facial atlas/UV treatment, hairstyles or headgear, and real neck/collar geometry in Blender. Follow with eight-facing close-up checks over several authentic animation phases and release gating.

No purchased sources, raw vendor files, generated preview PNGs, game runtime edits, Silver Knight replacement, merge or deployment. **PR #1041 remains Draft / ART FAIL / RELEASE HARD HOLD.**
