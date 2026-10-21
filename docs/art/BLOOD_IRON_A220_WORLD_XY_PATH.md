# Blood & Iron A2.20 — Re-focus on the playable world-XY art pipeline

**Decision: stop the boot-landmark research. Preserve the approved 120% knight sprites and get Greyhaven working visually in the flat authoritative game camera.**

## Purpose

The owner asked why boot research was consuming so much time. It was disproportionate to its benefit. A2.20 returns the Graphics stream to **actual player-visible alignment and atmosphere**. This art-only acceptance milestone keeps the knight assets unmerged in PR #326 and the Greyhaven environment in independent draft PR #350.

The two environment approaches are already baked in original Blender 4.5-derived WebPs:

- **A2.5 overhead-calibrated Red Lion**, with its ground basis matching the game's exact flat XY projection.
- **A2.6 cinematic 3/4 Red Lion**, dramatically more attractive but its authored ground basis is not aligned with the actual game XY camera.

A2.20 adds an isolated source-backed two-panel review that draws **the real owner-approved 120% Silver Knight standing / A3 roll WebPs**, supplied directly from an independently pinned PR #326 checkout. It imports `ARENA_VIEW_ZOOM` and `projectArenaPoint` from the actual `src/browser/arena-viewport.mjs` game source. The same real world-relative offsets apply to both canvases; there is **no synthetic camera invented to make the mismatch disappear**. The building base/roof/door-ground visual anchor is unchanged. An amber source-ground marker shows where the 3/4 Blender camera would put the same meter-space point.

## Browser-verified findings

**Real Windows Chrome 154**, three screenshots, zero browser page/network errors.

| At identical game-world door-relative offset | A2.5 overhead discrepancy | A2.6 cinematic discrepancy |
| --- | ---: | ---: |
| (0, 0) world units | 0 px | 0 px, by construction at the visual door anchor |
| (+120, −80) world units | **0.000022 px** | **270.766 px** |

The two modes can always coincide at their chosen visual door point; coincidence at a *single pivot does not validate geometry*. At offsets away from that pivot, the large A2.6 mismatch is undeniable. The approval of a 120% knight alone does not solve it.

The page checks the original PR #326 atlas manifest for source frame count/size/350ms roll duration and the original WebPs' native dimensions. **96×96** standing and **134×134** A3 roll are the already owner-selected opt-in draw dimensions, with the fighter world origin unchanged. No 3D foot contact needs to be known to draw this **visual-only comparison**.

Evidence:
- `web/greyhaven-a220-world-xy.html` — interactive two-panel real-knight visual review with world relative X/Y movement, roof alpha and directional mismatch lines.
- `web/greyhaven-a220-world-xy.mjs` — source-baked 3/4 and overhead layer comparison, actual imported game projection, explicit runtime safety flags.
- `tools/art/verify_greyhaven_a220_browser.mjs` — localhost-only Puppeteer acceptance with independently pinned PR326 companion atlas validation and three actual Chrome screenshots.
- `assets/environment/greyhaven/a220-review/greyhaven_a220_xy_knight_report.json` — measured, source-backed browser evidence and integrity SHA-256 of all companion knight atlases.
- `assets/environment/greyhaven/a220-review/*.png` — screenshots at door, large world offset and actual A3 roll.
- `tests/art-direction-a220-world-xy.test.mjs` — assertions about actual game projection, image provenance, screenshot integrity, and safe opt-in boundaries.

## Next development decision

**Do not replace the cinematic Red Lion with an ugly permanent overhead-only building.** The cinematic facade/roof is the desired style. Instead, reauthor a **2.5D composited Greyhaven prefab** in a graphics-only follow-up:

1. **World-XY-aligned contact footprint:** identify and bake a flat collision-compatible ground footprint that uses exactly the real game camera's X-right/Y-down basis (at current zoom 0.84). Door/step ground position belongs to this layer; no client should infer a server-authoritative portal from art coordinates.
2. **Cinematic timber-and-stone facade:** retain the A2.6 material palette and artwork quality, but author the wall faces/elevation as a **separate decorative layer** attached to world-XY ground anchors instead of using oblique ground mesh to imply walkable space. Avoid affine stretching a whole oblique house (it distorts vertical walls).
3. **Roof and foreground occlusion:** own independent roof/foreground layers for future animation and fade; test drawing order in the **actual game** before enabling roof occlusion.
4. **Real actor/door acceptance:** test the approved 120% knight entering and walking beside the art anchor in genuine authoritative multiplayer sessions after a real server zone/portal exists. Do not claim the proposed manifest door (4365, 4075) is already a game portal.
5. **Performance:** measure Chrome/Firefox/mobile draw time, decoded texture memory and multiplayer frame budget before any production integration.

World & Gameplay owns authoritative building ownership, collisions, zones and portals; the Graphics stream owns art and visual anchor metadata only. Keep A3 350ms presentation and 170ms+180ms authoritative roll timing, physics/hitboxes/network, original GLB/sprite assets, Red Lion/Blacksmith forge/entrance and the seven non-overlapping barrels unchanged.

## Reproducibility

From the separate graphics checkout and independent checked-out knight source at **`c74fcf90e227f3bc4788728f000cfe6aa083c7ef`**, run on a Windows workstation with local Puppeteer + Chrome:

```powershell
$p=node -p "require.resolve('puppeteer')"
$env:PUPPETEER_MODULE_URL=([System.Uri]::new($p)).AbsoluteUri
$env:CHROME_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
node tools/art/verify_greyhaven_a220_browser.mjs "..\a29-pr326-source" "..\a220-review"
node --test tests/art-direction-a220-world-xy.test.mjs
```

This makes **no source asset copies** from the knight PR to the graphics PR. The screenshots/report are generated only by the review. Original source files and Blender art, combat/server/client production runtime, actual multiplayer and deployment were not changed.

**No merge or production deployment is authorized by A2.20.** Graphics PR #350 stays draft, knight PR #326 independent. Both require current-base, exact-head quality CI and separate approval before activation.
