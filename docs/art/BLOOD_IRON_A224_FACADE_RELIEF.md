# Blood & Iron A2.24 — Greyhaven Red Lion facade relief (strict source-mask-preserving)

**Status:** local 2.5D facade art-review prototype. Real Chrome validated. No live game integration, merge or deployment.

## Goal and limits

In A2.20–A2.23, we proved the new 2.5D Red Lion maintains the authoritative game's flat XY basis, while the cinematic oblique building does not. A2.22 reduced the exaggerated roof ridge by 25px. A2.23 accepted that change in original Chrome, alongside real 120% knight WebPs from independently pinned PR #326.

A2.24 adds **subtle, separately reproducible appearance detail** without re-importing/re-saving Blender or shifting any collision, doorway or world coordinates. The Red Lion building is still an offline proposed prefab, not an active game portal.

## Source-authentic art inputs and exact method

`tools/art/paint_greyhaven_a224_facade.py` consumes the unchanged original A2.22 Red Lion *lossless-alpha Blender-derived* base and roof WebPs, their SHA-256-verified crop metadata, and the real game's original zoom/ground-basis report. It restores the base to a 640×640 visual-door-centered canvas, adds a localized hand-authored soft-color and shadow overlay only in the original visible facade pixel region, and then restores **the original exact alpha channel**. All original silhouette pixels, transparent boundaries, current world-XY door anchor, draw offsets and image dimensions stay unchanged.

The material pass emphasizes under-eave occlusion, timber beam highlights, a more recessed wooden doorway with narrow darker jambs/plank seams/forged hinge hints, original shutter/window-sill contact shadows and the stone step. Shadows are interrupted at the original doorway rather than improperly crossing it. These are **authored RGB accents** on the original art, not newly approved building geometry.

The unchanged A2.22 roof WebP is copied **byte for byte** into the output art folder; its exact SHA-256 is verified. Updated base is stored as an independent **lossless RGBA WebP** and checked against its original cropped source. The original editable Blender scene, source Red Lion WebPs and authentic knight atlases remain untouched.

## Measured outcomes

| Grounded source/art property | A2.24 result |
|---|---:|
| Author-authored pixels refined in RGBA source crop (Pillow RGB comparison) | **8,135 pixels** |
| Visible refined facade pixels in Chrome 154 canvas comparison | **8,070 pixels** |
| Facade alpha pixels differing, original vs A2.24 | **0** |
| Roof WebP SHA-256 differs from A2.22 | **No — binary identical** |
| Roof alpha bounds for both variants | `[204,40,436,231]` |
| Building original facade alpha bounding box | `[209,54,431,345]` — unchanged |
| Visual door pivot | `[320,320]` — unchanged |
| Ground basis | `[33.600006,0], [0,33.600006]` px per authored meter — unchanged |
| Game-XY discrepancy at relative `(+120,-80)` world units | **0.0000216333 px** for both |
| Original knight source A3 sprite sizes | **96px idle / 134px roll** — unchanged |

The difference in the Pillow count versus Chrome visible-pixel count comes from masking transparent source positions and browser canvas rendering; neither count indicates any geometry change.

## Browser acceptance and reproduction

The new **standalone art-only** `web/greyhaven-a224-facade-browser.html` compares A2.22 baseline against the localized A2.24 facade under the same A2.22 roof. The 120% Silver Knight and T1 Sentinel sprites come from independent PR #326 at source exact head `c74fcf90e227f3bc4788728f000cfe6aa083c7ef`. The viewer imports **`projectArenaPoint` from the actual game source** and offers XY movement, sprite choice and manual roof-alpha comparison. It does not implement an authoritative roof-occlusion algorithm.

`tools/art/verify_greyhaven_a224_browser.mjs` uses source-pinned, localhost-only allowlisted knight WebPs. In **Chrome 154.0.8037.99**, the browser completed **four independent screenshots, zero page/network errors**: fully covered roof, Silver Knight walking at `(+120,-80)`, Silver Knight original A3 roll with roof hidden, and T1 Sentinel A3 roll with 80% roof. Real Chrome decodes both source RGBA layers and directly compares their original alpha channels; **0 alpha pixel differences**.

To regenerate from a checkout of PR #350 on the authorized Windows workstation:

```powershell
python tools/art/paint_greyhaven_a224_facade.py --source-dir assets/environment/greyhaven/a222-review --outdir <A2.24 output>
$p=node -p "require.resolve('puppeteer')"
$env:PUPPETEER_MODULE_URL=([System.Uri]::new($p)).AbsoluteUri
$env:CHROME_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
node tools/art/verify_greyhaven_a224_browser.mjs <separate pinned knight PR326 checkout> <A2.24 browser evidence>
node --test tests/art-direction-a224-facade.test.mjs
```

Original comparative Pillow preview, source-hash/crop/alignment report, complete four-image Chrome QA and regression tests are committed under `assets/environment/greyhaven/a224-review/`.

## Acceptance boundaries

No A2.24 graphics files are imported by the game, and the proposed Red Lion doorway `(4365,4075)` is **NOT** an existing server-authoritative entrance. No collision, game sprite pivot, roof occlusion, network, hitbox, physics, combat or world logic is changed. Source original A3 350ms animation, owner's 120% opt-in presentation and 100% rollback remain unchanged. Red Lion, Blacksmith forge and the original seven non-overlapping barrels are unaffected.

The facade pass is visually more legible, but the *roof is still proportionally dominant*. Next art review should improve roof/gable depth and actual per-player foreground sorting without inventing authoritative collisions or merging unready changes. Required exact-head current-base CI must pass; unrelated combat gate failures (latest previous A2.23 run: **M175 confirmed kick/attack arbitration**) cannot be bypassed. Graphics PR #350 remains **DRAFT/unmerged**, knight PR #326 remains separate and unmerged, and **no production deployment** is authorized.
