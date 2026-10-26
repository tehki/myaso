# Graphics 3A P1 — original Base Character facial-part isolation (2026-10-26)

**Result: TECHNICAL PASS / ART FAIL / RELEASE HOLD.** No playable character or Blender master asset was produced, and no P0 Silver Knight, World or Combat runtime change was made.

## Problem and exact-source material review

The owner-approved free Standard Base Character heads, temporarily attached to the two headless Quaternius Peasant outfits, show unnatural dark bands/triangles at the scalp, face and around the eyebrows. Their 512px eight-facing source lookdev and previous collar plane-clipping experiments made clear that the flaws are not resolved by a neck-plane cut alone.

On private X230i, the **actual publisher ZIP** `Universal Base Characters[Standard].zip` (SHA-256 `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`) was inspected without editing or committing vendor bytes.

Both original Godot/UE glTFs have three separately skinned mesh nodes:

| Male/female Base Character source | Material | Observed source bounds |
|---|---|---|
| `Eyebrows` | `MI_Hair_1` or the source hair variant | Male Y 1.695–1.725 m; Female Y 1.649–1.687 m |
| `Eyes` | `MI_Eyes` | Male Y 1.684–1.714 m; Female Y 1.640–1.673 m |
| `SuperHero_Male` / `Superhero_Female` | `MI_Superhero_Male` / female variant | Source mesh includes the entire head/body, including cheek and scalp triangles |

Actual source material/color images included:

- `T_Hair_1_BaseColor.png`, `T_Hair_2_BaseColor.png` — RGB 2048×2048, fully opaque.
- `T_Eye_Brown.png` — RGBA 256×256, but **all alpha = 255**.
- `T_Superhero_Male_Dark.png`, `T_Superhero_Female_Dark_BaseColor.png` — RGB 2048×2048, fully opaque.

Thus, **a simple change from OPAQUE to alpha-blended materials cannot explain or repair the observed dark patches**. An exact UV/color and geometry inspection of the original head body is still needed; the main head textures' color names alone are not proof of the particular dark-triangle cause.

## Executed controlled experiment

We ran the actual private source combination for **Male Peasant** and **Female Peasant**, with approved Base Character head and eye meshes but with `Eyebrows` intentionally omitted. Everything else remained unchanged:

- Verified original source UAL1 Standard `Walk_Loop` at 50% (`0.666667 s`).
- Experimental clipped/welded planar head cut (`--cut-method plane`).
- Eight genuine 512×512 collar-closeup facings.
- Original approved Base Character glTF, rig, eyes and body/head; original Peasant outfit glTF; source textures private. No substitute model fabricated.
- Original upper anchors and inverse bind matrices passed; prior source neck-surface p95 measurements of **10.99 cm male / 11.84 cm female** remain a separate art gate.

| Private source face-part experiment | 8-facing 4096×512 SHA-256 from committed script |
|---|---|
| Male Peasant, no eyebrows | `b8ffd6062835ef47b4b575b5a4e90be9ce7239f58563eca9bd7de38003d681b2` |
| Female Peasant, no eyebrows | `7dc075b1592a74abbb6d37b2914aec182505982fcabc0c60882a8c830b676941` |

Both source renderer runs exited successfully on X230i. The independently prepared private preview compared to the committed renderer was **pixel-identical for Female**, and differed by **one pixel only** out of 2,097,152 for Male (max single-channel absolute delta 29). It is incorrect to claim byte-identical Male PNG hashes, although its displayed geometry is effectively unchanged.

### Visual result

**Male:** the light-colored, thick synthetic-looking eyebrow accessory disappears as expected. Dark triangular regions on the scalp and patches on cheek/neck **remain**.

**Female:** the light-colored eyebrows disappear, but the conspicuous dark horizontal stripe across the cheeks/nose and dark scalp polygons **remain**.

This identifies the eyebrow accessory as **one** contribution to the visual problem, but demonstrates that it is **not the cause of the remaining objectionable dark polygons**. They persist while the base head/body and eye meshes remain. The original body/head mesh and its material/UVs should be reviewed next; the eye mesh can be isolated separately if there is ambiguity. Do not claim the dark markings are necessarily from texture color alone without UV-localized proof.

## Source-controlled reproducibility

The Draft PR contains opt-in `--face-parts all|without-eyebrows|head-only` in `scripts/graphics3a_p1_head_attachment_review.py`. Its default remains **`all`**, so no previously established source image is silently changed. `scripts/graphics3a_p1_head_attach_rules.py` implements strict whitelisted mesh node selection and **three additional source-only tests** (15/15 for that suite), which compiled and passed on Serj.

Example for an approved private source checkout:

```bash
python3 scripts/graphics3a_p1_head_attachment_review.py \
  --target-model "/private/Male_Peasant/Male_Peasant.gltf" \
  --base-archive "/private/Universal Base Characters[Standard].zip" \
  --base-model-suffix "Superhero_Male_FullBody.gltf" \
  --animation-archive "/private/Universal Animation Library[Standard].zip" \
  --animation-model-suffix "Unreal-Godot/UAL1_Standard.glb" \
  --clip Walk_Loop --fraction 0.5 \
  --camera-mode collar-closeup --cut-method plane \
  --face-parts without-eyebrows \
  --output "/private/Peasant/face-part-review"
```

Vendor ZIPs, glTF/BIN assets, derived textures, private reports and PNG contact sheets remain **off GitHub** on X230i at `~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/face_parts_from_committed_20261026/`.

## Actionable Art Director next steps

Inspect and correct UV assignments, individual scalp/cheek faces, winding, normals and the fully opaque source body/head atlas. Compare approved hair/cowl/hood source pieces or author a non-distracting medieval head/helmet/hood/collar assembly with an intentional neck seam and materials that match the outfit. After this, inspect four or more actual clip phases across eight facings, confirm correct Rust World East/West semantics and grounded 960×540 gameplay presentation. The visual quality and neck seam still fail acceptance.

**Never remove a required Combat/Core CI check to mask the result.** Prior exact-head quality [#40299581526](https://github.com/tehki/myaso/actions/runs/40299581526) was **RED at independent M121 directional-light acceptance**, while Graphics P1 validation was green. Current exact-head CI must be checked afresh. Main Orchestrator 0 and the owner retain release authority.

**ART FAIL / PR DRAFT / RELEASE HARD HOLD.**
