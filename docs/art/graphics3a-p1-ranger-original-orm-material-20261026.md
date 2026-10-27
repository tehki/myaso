# Graphics 3A P1 — Ranger Hood Original PBR Material Parity

**2026-10-26 | Draft PR #1041 | PRIVATE ORIGINAL SOURCE / ART HOLD**

## Discovered material omission

The real owner-approved free Standard Quaternius `Male_Ranger_Head_Hood.gltf` and female companion supply original `MI_Ranger` with:

- baseColorTexture `T_Ranger_BaseColor.png` (4096x4096)
- metallicRoughnessTexture `T_Ranger_ORM.png` (4096x4096)
- original normal map `T_Ranger_Normal.png`

Prior Graphics 3A offline lookdev loaded only the baseColorTexture, and used the material's glTF metallicFactor and roughnessFactor defaults (both 1) without multiplying them by the actual authored metallicRoughnessTexture. Thus the prior lookdev's perceived shiny gray panels were **not a reliable material-faithful rendering** of the source. This is a preview-material issue, not an assertion about current game-runtime shaders.

Private X230i sampling of the original ORM map (256x256 regular sample grid) confirmed:
- packed Green/roughness channel 5th/median/95th percentiles **183/220/255**, corresponding to predominantly rough surfaces;
- packed Blue/metallic channel 5th/median/95th percentiles **0/0/242**, indicating that most sampled material pixels are nonmetallic and some intentionally metallic;
- Red/occlusion is not independently bound by this change. The normal map is also **not yet rendered**, so this should not be called full PBR parity.

## Isolated, reproducible implementation

An **opt-in** `--hood-material publisher-orm` option was added to `scripts/graphics3a_p1_head_attachment_review.py`. It loads the packed original publisher URI from the owner-approved private ZIP, validates the exact source glTF material `MI_Ranger`, source texture pointer, image name and 4096x4096 size, and supplies the untouched image to `pyrender.MetallicRoughnessMaterial(metallicRoughnessTexture=...)`.

The **default** remains `--hood-material legacy-preview` and reproduces the old baseline. This option affects **only the opt-in private Ranger Hood overlay**, not Peasant garment or Base Character materials, author sources, the Rust game renderer or the P0 Silver Knight.

### Actually executed original-source evidence

On private X230i the committed source-only reviewer rendered both original publisher Peasant+Base Character+Ranger Hood composites with real UAL1 `Walk_Loop` 50% and eight 512x512 collar-closeup yaw viewpoints, approved no-eyebrow private facial experiment, and original atlas with previously qualified neutral-facepaint skin lookdev. Both exact-source runs **completed successfully**.

| Actual source run | 4096x512 contact-sheet SHA-256 |
|---|---|
| Male Peasant + Male Ranger Hood, original ORM enabled | `10149622535660e5364bff4d9cb9604ca8b9ff03e370488e5db2f62da3ea0c61` |
| Female Peasant + Female Ranger Hood, original ORM enabled | `928d30ab3be678b3007bdc7e346d5bd756b8448748904942c0d5562a13cf7a83` |

The new source-ORM and previous `legacy-preview` contact sheets are **not pixel-identical** for either gender. Visual inspection confirms that the hood retains its original brown/green fabrics and authored silver-gray side panels, but source metallic/roughness now participates in the light response. This is **more faithful shading, not complete visual acceptance or a recolored/new skin**.

The original exposed facial seams, mixed green/silver material colorway, hood-to-garment integration and neck geometry remain unresolved. The original head-to-garment rest-surface p95 distances, **10.99 cm Male / 11.84 cm Female**, remain unsigned diagnostics and must not be described as visible gap widths.

Private image and report evidence remains on X230i:
`~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/official_orm_material_20261026/`.

## Tests, provenance and release constraints

- `scripts/graphics3a_p1_hood_pbr_rules.py` enforces the exact author `MI_Ranger` + `T_Ranger_ORM.png` material/texture and rejects wrong source images, invalid pointers and unexpected material indices.
- `tests/test_graphics3a_p1_hood_pbr_rules.py`: **7/7** synthetic source-only tests passed on Serj; source Python compilation passed; the protected `quality` workflow includes them.
- Total Graphics P1 source-only synthetic test count is **134** (127 prior + 7).
- No third-party ZIP, raw glTF, GLB, FBX, Blender source, textures, generated PNG or real private archive bytes added to the repository.
- No change to mandatory World/Core/Combat/browser gates. Every exact-head CI run must pass independently; a green Graphics substep does not establish full release readiness.

**Further art work:** analyze actual hood silhouette/materials under multiple clips and real Blender light, choose appropriately muted medieval fabric colors (with licit derivative/provenance) and close/weld/hide the true scalp, neck and collar seam before judging final visuals. Author and validate original normals/occlusion, four more real action phases, and game-scale 960x540 Chrome/Firefox multiplayer footage with Art Director 3 and Main0 signoff.

**Verdict: SOURCE MATERIAL DIAGNOSTIC PASS / ART HOLD / RELEASE HARD HOLD. No merge, staging, deployment or Silver Knight replacement.**
