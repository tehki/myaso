# Blood & Iron A2.23 — Real Chrome acceptance of refined Red Lion roof

**Status:** original Chrome browser visual acceptance complete, art-only, never merged/deployed. No further boot research.

## Original materials and source boundaries

A2.21 Red Lion and the A2.22 shallower roof were baked directly from the original owner-authored A2.2 Blender source using their separate Blender scripts. Those already exist as **two independent lossless WebP layers per bake**: wall/base and roof, both carrying the same approved **visual-only** Red Lion door pivot.

A2.23 creates an independent, read-only two-panel reviewer:

- `web/greyhaven-a223-roof-browser.html` and `web/greyhaven-a223-roof-browser.mjs` show A2.21 versus A2.22 at identical game-relative player coordinates, controls for East/South, original knight clip and roof alpha, and a visual game-XY marker.
- `tools/art/verify_greyhaven_a223_browser.mjs` serves over **127.0.0.1 only**. It loads the true `projectArenaPoint` and `ARENA_VIEW_ZOOM` from `src/browser/arena-viewport.mjs`, all original Greyhaven WebPs from this draft graphics PR, and a **SHA/provenance and head-pinned separate checkout of original knight PR #326** (head `c74fcf90e227f3bc4788728f000cfe6aa083c7ef`). It validates the authentic original 120% draw contract, 96×96 idle / 134×134 original A3 roll.
- WebP alpha is **decoded in real Chrome** into a 640×640 offscreen canvas, with browser-computed roof source alpha bounding boxes. We do not merely trust old JSON roof bounds.

## Genuine Chrome 154.0.8037.99 results

**4 original 1500px-wide screenshots, 0 browser page/network errors.** Test cases:
- Silver idle, visual-only door pivot `(0,0)`, roof alpha 100%.
- Silver idle, world offset `(+120,-80)`, roof alpha 55%.
- Silver original A3 roll, world offset `(+40,+40)`, roof hidden (alpha 0%).
- T1 Sentinel original A3 roll, world offset `(-60,+70)`, roof alpha 80%.

| Actual browser observation | A2.21 baseline | A2.22 refined |
| --- | ---: | ---: |
| Roof-alpha bbox in 640×640 visual pivot canvas | `[204,15,436,230]` | `[204,40,436,231]` |
| Top moved downward | — | **25 pixels** |
| Lower roof edge shift | — | **+1 pixel** |
| Game-world XY discrepancy, offset `(+120,-80)` | **0.0000216333 px** | **0.0000216333 px** |
| Original knight standing size | **96px** | **96px** |
| Original knight roll size | **134px** | **134px** |

These real Chrome measurements agree with the original A2.22 offline Blender/Pillow report. Both house versions use the **same exact ground basis** from source art and the game's imported projection function.

Screenshots and self-describing acceptance report:
`assets/environment/greyhaven/a223-review/`

**Important:** the selected art-only Red Lion door `(4365,4075)` is *not* an actual server-authoritative entrance. The standalone visual roof opacity slider is *not* dynamically validated actor occlusion or world collision. Neither game live renderer nor independent-network sessions were changed or exercised. The actual multiplayer GPU frame budget/mobile memory and integration to the game's content loader remain outstanding. The owner-approved source animations stay in their independent, unmerged PR. This review does not approve production.

## Reproduce on authorized Windows workstation

From graphics PR #350 checkout and independently verified knight PR #326 at exact pinned head:

```powershell
$p = node -p "require.resolve('puppeteer')"
$env:PUPPETEER_MODULE_URL = ([System.Uri]::new($p)).AbsoluteUri
$env:CHROME_EXECUTABLE = "C:\Program Files\Google\Chrome\Application\chrome.exe"
node tools/art/verify_greyhaven_a223_browser.mjs "..\a29-pr326-source" "..\a223-browser"
node --test tests/art-direction-a223-browser-roof.test.mjs
```

The tool only serves companion knight assets from an explicit allowlist and uses original atlas SHA hashes; **no knight binary is ever copied to this graphics PR**.

## Next art priorities

The A2.22 roof is measurably lower and retains all original clay-tile detail, but *aesthetic evaluation still needs work*: improve genuine front gable depth, stronger timber-and-plaster lighting/shadows, better readable recessed doorway and correct world-XY foreground/background compositing. Preserve the separately baked base and roof, exact game-XY ground, and only integrate into actual game after a reviewed visual design, authoritative World & Gameplay portal semantics, real Chrome/Firefox/mobile frame budget and current-base required CI.

All files remain in draft graphics PR #350. Knight PR #326 remains independent. This milestone does **not** alter gameplay, combat, hitboxes, authoritative server/network, existing Barren/Blacksmith props, knight WebPs, source Blender files, or deployment. **No merge/deploy authorized.**
