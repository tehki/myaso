# Blood & Iron A2.22 — Red Lion roof proportion study

**Scope:** first roof/gable refinement of the game-XY-grounded Red Lion. This is an **art-only, offline prototype** in draft graphics PR #350. No gameplay, input, server, collision, ownership, NPCs, portal, or multiplayer logic is changed.

## Source and method

The new `tools/art/render_greyhaven_a222_roof_profile.py` reopens the **same original** Blender 4.5.14 A2.2 Red Lion scene used in A2.21, never saves it, and keeps the exact-world XY 33.6 px per authored meter and the fixed proposed door-visual anchor. It uses the same base/shear equation as A2.21 for all walls, chimney, windows, signs, forge details and other non-roof geometry. For vertices on roof objects and the named gable mesh **only**, once original source Z exceeds 3.45 units (eave height), it compresses the extra height contribution by 0.45:

`artRise = 0.85 × (3.45 + 0.45 × (z − 3.45))` for roof/gable vertices above eaves.

At or below the eaves, `artRise = 0.85 × max(z,0)`, exactly as A2.21. This is **deliberate screen-space decorative art**, not physically authoritative roof geometry. In both variants the underlying original XY coordinates are unchanged for **all** transformed vertices; in particular, all 12 explicitly ground-level vertices have zero measured XY drift.

The new `tools/art/encode_greyhaven_a222_roof_profile.py` encodes independent alpha base and roof WebPs with exact lossless RGBA restoration. These are source-authentic render layers, not copies of knight atlas files and not assets wired into any production game renderer.

## Measured visual result

| Measurement | A2.21 baseline | A2.22 refinement |
| --- | ---: | ---: |
| Exact ground basis, source meters → pixels | (33.600006, 33.600006) | (33.600006, 33.600006) |
| Visual door anchor on 640×640 bake | (320,320) | (320,320) |
| Ground-level source vertices shifted XY | 0 | 0 |
| Selected roof top in final art raster | baseline | **25 px lower** |
| Selected roof lower eave | baseline | **1 px shift** |
| Source geometry processed | 4,318 vertices | 4,318 vertices |
| Roof/gable vertices given compressed rise | — | **1,778 vertices** |
| Maximum individual roof-rise reduction | — | **25.13 px** |

The side-by-side PNG `assets/environment/greyhaven/a222-review/greyhaven_a222_roof_before_after_knight.png` uses **the same genuine Silver Knight 96×96 atlas frame from independently pinned PR #326**, merely composited into each art-only comparison. The companion sprite remains in the separate checkout and is **not copied into graphics PR #350**. The actor placement and 55% roof transparency are illustrative, **not a tested multiplayer occlusion rule**. The report contains source SHA-256 for that knight frame.

**Art assessment:** the roof has a visibly shallower ridge with the original clay tile colors and readable timber facade intact. It is still dominant in the overhead-elevation composition; this is not final artistic approval. Refine gable silhouette, wall lighting/shadows, roof foreground/background sorting and doors in later milestones, without breaking ground alignment.

## Reproduce

Run from graphics PR #350 checkout on the authorized Windows workstation:

```powershell
$blender = "C:\Users\ilyav\Documents\blender-4.5.14-windows-x64\blender.exe"
$root = "C:\Users\ilyav\Documents\myaso-blender45-work\blood-iron-a2"
& $blender --background --factory-startup --python tools/art/render_greyhaven_a222_roof_profile.py -- --scene "$root\a22-review\blood_iron_greyhaven_a22.blend" --manifest assets/environment/greyhaven/art-manifest.v1.json --viewport-source src/browser/arena-viewport.mjs --outdir "$root\a222-review" --samples 4 --pixels 640 --height-lift 0.85 --roof-pitch-compression 0.45
python tools/art/encode_greyhaven_a222_roof_profile.py --in-dir "$root\a222-review"
python tools/art/compare_greyhaven_a222_roof.py --old "$root\a221-review" --new "$root\a222-review" --knight "$root\a29-pr326-source\web\assets\knights\silver_idle.webp" --out "$root\a222-review"
node --test tests/art-direction-a222-roof-profile.test.mjs
```

The original 640×640 Blender PNGs are disposable local bake inputs; the GitHub PR stores compact source-authentic WebPs, validation JSON and the comparative PNG. The source `.blend` is not modified or redistributed.

**Next gates:** (1) further artwork review, (2) real Chrome/Firefox/browser GPU timing and roof compositing validation in actual renderer, (3) independent World & Gameplay server portal/door semantics, (4) exact-head CI against current main and separate approval. The 120% knight idle/roll sizes (96/134), original 350ms A3 animation, server-authoritative roll, and gameplay/physics/network remain unchanged. **Do not merge/deploy A2.22 yet.**
