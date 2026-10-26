# Graphics 3A P1 — Actual Collar Triangle-Surface and Close-Up Visual Audit

**2026-10-26 · ORIGINAL SOURCE ENGINEERING EVIDENCE · ART REJECT / RELEASE HOLD**

## Scope and provenance

This is a **private X230i offline** verification of two approved free Standard Quaternius headless Peasant outfit rigs with their associated owner-approved Universal Base Characters heads/eyes/eyebrows, sampled from actual UAL1 `Walk_Loop` at 50% time (`0.666667 s`). No third-party archive, glTF/BIN, original or downscaled textures, or preview PNG is committed to GitHub. P0 Silver Knight and Core/Combat/World game runtime remain untouched.

All operations used the reproducible head-attachment reviewer `scripts/graphics3a_p1_head_attachment_review.py`, the source-only `scripts/graphics3a_p1_neck_surface_qc.py` and the previously verified `graphics3a_p1_neck_seam_qc.py`. Verified original Base Character ZIP SHA256: `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`; official free UAL1 ZIP SHA256: `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`.

### Actual original-source results

| Measurement | Male Peasant | Female Peasant |
|---|---:|---:|
| Head cut Y = outfit top + 0.02 m | 1.578655 m | 1.538433 m |
| Open head-cut boundary vertices sampled | 205 | 199 |
| Garment triangles overlapping collar Y band | 6,814 | 7,922 |
| Unsigned closest *triangle-surface* min | 1.91 cm | 2.43 cm |
| Unsigned closest *triangle-surface* p50 | **8.54 cm** | **8.06 cm** |
| Unsigned closest *triangle-surface* p95 | **10.99 cm** | **11.84 cm** |
| Unsigned closest *triangle-surface* max | 12.77 cm | 12.30 cm |
| Boundary samples with surface distance above 2 cm | 99.02% | 100.00% |
| Boundary samples with surface distance above 5 cm | 74.15% | 73.37% |
| Equivalent old nearest-*vertex* p95 | 11.04 cm | 11.84 cm |

These distances are **from actual cut-edge head mesh points to nearby garment triangle surfaces**, not estimates derived only from sparse garment vertices. The surface and vertex results closely agree. However, the results are **unsigned** and limited to collar-band triangles: do not call them visible gap widths, signed penetration depths, watertightness measurements, or full animated seam evidence.

### Real eight-direction close-up inspection

The same original source meshes were rendered at **512×512 per facing** (8 facings each) using a real orthographic camera centered at the collar and the exact original `Walk_Loop` 50% retarget pose. The camera mode is now part of the committed reviewer, `--camera-mode collar-closeup`. Private evidence on X230i:

| Actual approved source composite | 8-facing 4096×512 contact-sheet SHA256 |
|---|---|
| Male Peasant + Base head | `22271522bdea4e167d57196482dbc0043a90abe56cfe807ca00e5e07c03072d3` |
| Female Peasant + Base head | `67875d38b2a00c5bc075c02705c80340b597368cbe80e2966ed97fb9ffd724fc` |

Private paths: `~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/collar_closeup_20261026/`.

**Visual inspection verdict — ART FAIL:** both unmodified source composites exhibit visibly jagged/sawtooth head/neck cut edges around the collar, dark triangular/patchy regions on the scalp/head, and conspicuous seams or color discontinuities. The heads are bald/basic and do not satisfy the desired gritty medieval identity. This is independent of the measured unsigned 8–12 cm collar proximity. These source composites are valid **technical tests only**, **not production character art**. Do not present the prior eight-view images as accepted visual quality.

## Why this cannot be fixed by a test threshold

The current source prototype selects Base Character body-head faces by triangle centroid Y, relative to outfit top + 0.02 m. Triangles crossing that horizontal cut are discarded entirely, producing a **sawtooth boundary**, not an explicitly cut/capped/welded neck ring. Lowering an arbitrary diagnostic threshold or approving smaller nearest-vertex distances would not restore missing geometry. Dark scalp triangles likewise require art/source geometry and material investigation, not permission to ignore them.

The next proper art step is an **offline Blender-authored head/neck construction**, with a deliberately resolved collar band and topology (cut/clip and cap, hidden seam beneath a modeled scarf/cowl/high collar, or a better-matching licensed head), material matching and controlled skinning. Inspect real source mesh normals, UVs, hair/headgear compatibility and facial shading. Then measure collision-free surfaces and inspect multiple actual animation phases, each at cardinal and diagonal camera facings. Keep P1 HOLD until the Art Director approves a genuinely better-looking source result.


## Optional geometry correction experiment — same day

The original Base Character head extraction discarded entire triangles whose *centroids* were below the collar plane. The eight-facing close-ups revealed obvious sawtooth neck edges. A new **optional** `--cut-method plane` path now clips the source head triangles exactly at the cutoff, interpolates position/normal/UV and top-four skin influences at intersected edges, and welds matching resulting attributes to restore shared-edge topology. `--cut-method centroid` **remains the default**, preserving reproducibility and avoiding a silent art change.

- [`scripts/graphics3a_p1_head_plane_clip.py`](../../scripts/graphics3a_p1_head_plane_clip.py) is source-only; [12 synthetic tests](../../tests/test_graphics3a_p1_head_plane_clip.py) pass on Serj, including valid cut-plane vertices, shared faces and interpolated weights/UVs. Tests are additive to the protected quality workflow.
- On X230i the first non-welded prototype duplicated every triangle corner, making the boundary diagnostic inefficient. That trial was **stopped**, and the output generator changed to weld matching vertex attributes. The corrected welded version completed for both original private Peasant meshes.
- In the original-source `Walk_Loop` half-phase at the same 512px collar camera, the *welded plane-cut* review contact sheets were:
  - Male Peasant SHA256 `abfd4b1d75902dcfe95d2dab80f41adb9eaed84e1a46df714d91e5eaa47038c5`.
  - Female Peasant SHA256 `a2bd0db76c83d8a2f431293f70d5267220e9feffa6d9f2f047ebbf6827a3a094`.
- Closest garment-*surface* p95 remains **10.99 cm male / 11.84 cm female** to rounding. A cleaner cut boundary does **not** mean the collar geometry is attached, capped, welded to the garment or free of gaps.
- **Visual comparison:** both jaw/neck outlines now terminate along a cleaner near-horizontal plane with fewer polygon-tooth artifacts. The base heads are still conspicuously bald/basic, with persistent dark triangular regions on scalp/face, and apparent skin/collar separation. This is an **improved diagnostic preview only — ART FAIL / HOLD**, not an approved character.

The plane clip remains **open** (no watertight bottom neck cap), uses an approximate top-four skin influence interpolation for newly generated boundary vertices, and requires proper Blender-authored seam/collar/neck topology, normals, UV and materials, posed continuity across animation phases, and Art Director review. No glTF export or game integration has been added.

**Full private evidence paths on X230i:**
`~/Downloads/myaso-graphics3a-p1-assets-20261025/private_head_review_outputs/<Male_Peasant|Female_Peasant>/collar_planeclip_welded_20261026/`.

## Checks

- `scripts/graphics3a_p1_neck_surface_qc.py`: exact closest-point-on-triangle (point/edge/face region) for open head-cut boundary against all nondegenerate outfit triangles overlapping collar Y band; conservative triangle-AABB pruning; explicit ART HOLD result.
- `tests/test_graphics3a_p1_neck_surface_qc.py`: **12 synthetic tests passed** on Serj, including known closest-point analytical cases and verification that polygon surface distances differ from sparse vertex distances when appropriate. Existing **10 collar-vertex tests + 12 attachment-rule tests** remain intact.
- Both actual X230i original-source surface runs and eight-facing 512px close-up render runs **completed successfully**. Local evidence JSON and image hashes are private.
- Protected GitHub quality CI includes additive tests and retains all pre-existing Combat/Core/World gates; its exact-head status must be checked independently.

**NO game/renderer changes, merge, paid assets, public binary export, deployment or P0 Silver replacement. Main 0 retains release authority.**
