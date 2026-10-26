# Graphics 3A P1 — Private Neutral Facepaint → Skin Lookdev

**Date:** 2026-10-26
**Project:** Moon Games / myaso.io
**PR:** #1041 (Draft)
**Verdict:** **VISUAL IMPROVEMENT VERIFIED, ART FAIL / RELEASE HOLD**

## Why this experiment was necessary

The owner-approved free Quaternius Universal Base Characters have intentional **fully opaque neutral gray graphic regions** on their original Dark head/body atlases. Exact original glTF UV samples demonstrated this, including male scalp RGB (45,45,45) and female face/neck RGB (54,54,54). The publisher's alternate Light atlas changes those markings to white/gray rather than removing them. Removing independent Eyes and Eyebrows meshes did not eliminate them. See `graphics3a-p1-publisher-atlas-ab-20261026.md` for source evidence and hashes.

## Reversible experimental method

Added a new opt-in, **private/offline** flag to `scripts/graphics3a_p1_head_attachment_review.py`:

```bash
--head-paint neutral-to-skin-prototype
```

The unchanged default is `--head-paint original`. The experimental mode:
1. Applies **only** to source material `MI_Superhero_Male` or `MI_Superhero_Female` of the private approved Base Character head/body mesh. Separate eyes, eyebrows and all Peasant outfit materials are unchanged.
2. Requires the original verified **2048×2048 Dark body atlas** (`--body-atlas original`), rejects absent/unknown textures, and uses **the existing original publisher atlas** in memory. No vendor ZIP or glTF file is rewritten.
3. Selects neutral grayscale pixels with channel span at most 10 and average RGB intensity between 25 and 185 (guarded by source-only `graphics3a_p1_skin_paint_ab.py`). Replaces them with the original source atlas's non-neutral skin-color sample at normalized UV (0.5,0.5).
4. Renders actual CPU-retargeted UAL1 Standard `Walk_Loop` at 50% with eight 512px collar close-up facings. The procedure is a **lookdev A/B**, not production-quality skin authoring, mesh UV retopology, a Blender asset export, or a gameplay shader.

The replacement is intentionally coarse and may recolor **other intentional gray markings** on the head atlas. This is acceptable only for a private diagnosis. **Do not enable in live players.** Future production work requires purposeful skin atlas/UV art by Graphics Art Director and license/provenance verification of any derivatives.

## Authentic private X230i results

Both runs of the **committed** reviewer and helper completed successfully using approved free Standard originals; source anchors and bind matrices passed.

| Source model | Atlas pixels selected for private A/B | Skin RGB reference from original publisher atlas | Eight-facing 4096×512 private contact-sheet SHA-256 |
|---|---:|---|---|
| Male Peasant + approved Base head | 397,257 of 4,194,304 | (171,121,83) | `69e25523044166f7707192ea93049b29412e9434b468c9b5f211ae87663b8a7a` |
| Female Peasant + approved Base head | 254,488 of 4,194,304 | (171,116,81) | `8081463fb964d0cc2f716f927cfb45db9d64edaa82fc08a37c1e3186bf4def3b` |

Files remain under the private X230i workspace:
`~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/neutral_paint_committed_20261026/`

No publisher ZIP, source glTF/BIN, edited/derived atlas, preview PNG or report JSON was checked into the public repository.

**Visual comparison:** the conspicuous neutral-gray/white streaks on the top of the heads and across the female cheeks are significantly less visible. The prototype produces skin-colored heads rather than dark painted or pale-gray painted regions. However, it still has **uneven warm skin shading and visible cheek/scalp polygon transitions**, missing hair or appropriate medieval headgear, and **unresolved neck/collar geometry**.

Critically, the unsigned nearest garment triangle-surface collar distances remain **p95 10.99 cm Male / 11.84 cm Female**. This metric does not prove a visible hole, but the unjoined neck topology and collar appearance still fail art acceptance.

## Tests and gates

- Eight new source-only synthetic tests in `tests/test_graphics3a_p1_skin_paint_ab.py`, including actual source gray samples, rejection of colored skin pixels, invalid RGB, and fixed original UV reference.
- **8/8 passed** on Serj; Python compilation passed.
- Tests were added to the existing protected `quality` job, with all Combat/Core/World/browser acceptance unchanged.
- Previous protected CI #40309342708 failed whitespace validation in two documentation files; those three trailing spaces were **corrected in separate commits without bypassing CI**. The result of the newest exact-head run must be checked before describing full quality as green.

## Remaining work (P0/P1 boundaries)

Real asset completion needs:
- Properly authored medieval face and skin treatment, optional hair/hood/scarf/helmet matching style, and approved source/derived asset licensing.
- Intentional welded/capped/hidden collar seam authored in Blender with normals, UVs, skinning and collision checks.
- Real UAL1 Idle/Walk/Sprint/Jump/Roll phases and eight cardinal/diagonal poses, grounded shadow/foot contact and no sliding.
- Actual Rust World 960×540 Chrome/Firefox 2-player and 4-player verification (p50/p95), followed by Graphics 3 / Main Orchestrator 0 release approval.

**ART / RELEASE HARD HOLD. No Silver Knight P0 change, no vendor binary in PR, no merge, no staging or deployment.**
