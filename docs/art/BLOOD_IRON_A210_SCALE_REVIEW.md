# Blood & Iron A2.10 — knight-to-door visual-scale comparison

**Status:** owner-facing, standalone visual review. No knight art source has been edited, no multiplayer presentation updated, no gameplay or production deployment.

## Motivation and actual source

The owner observed that the original Silver Knight and T1 Sentinel look small compared with the Red Lion doors in the A2.9 preview. This A2.10 comparison uses **exact PR #326 original WebP knight atlases**, pinned at `c0b08a2a527cc492199db9f1e01dc9727225987f` in a separate checkout, and the unchanged 3/4 Red Lion wall/roof WebPs in draft PR #350. The active browser game is not loaded; the review is an isolated Chrome page.

A new Blender 4.5.14 LTS script `tools/art/measure_red_lion_a210_door.py` projected the actual `Red Lion / door_front` mesh using the exact A2.6 hero camera parameters and visual door-ground anchor. The authored door is **2.39m tall** in the Blender scene and its 640×640 review camera bounding box is **119.587px high**, 57.5px wide. This is a *camera projection of its 3D bounding-box corners*, not a claim about the portal opening, physics dimensions or player world scale.

## Scale alternatives

All candidates use the SAME exact pose, directional frame, Red Lion camera and art, and illustrative world-center offset next to the visual doorway. They scale the **sprite draw rectangle and its draw offset only**, with no shift in physics or world origin.

| | Baseline | Candidate A | Candidate B |
|---|---:|---:|---:|
| Visual factor | 100% | 112.5% | 120% |
| Idle drawn pixels | 80×80 | 90×90 | 96×96 |
| Roll drawn pixels | 112×112 | 126×126 | 134×134 |
| Silver idle silhouette height* | 59.0px | 66.375px | 70.8px |
| Silver idle / projected Red Lion door | 49.34% | 55.50% | 59.20% |
| Silver A3 roll example silhouette height* | 37.8px | 42.525px | 45.225px |

*Visible silhouette height is the bounding height of source atlas pixels with alpha at least 32/255. It **cannot** identify anatomical heels, ground-contact bones, actual human body proportions, or 3D perspective-matched height. Roll may show hands, cape, shield or arms rather than standing height. This numerical comparison is useful for consistent art review, but cannot establish authoritative game scale.

We inspected three real local Chrome 154 screenshots, one showing Silver idle and two showing A3 roll poses for Silver/T1. All use the exact original source art. **The 120% candidate still appears relatively small beside the tavern**, and is not approved as a final size. The 3/4 building remains inconsistent with the flat game-XY projection, so an eventual final ratio should be revisited after camera/ground-pivot integration.

## Reproduction

Open PR #350 checkout and maintain PR #326 in a separate, unmodified worktree. The existing A2.9 localhost server harness pins the exact PR #326 source and loads its three atlas WebPs without copying them into the graphics branch. In the checked-out graphics repository, on Windows PowerShell:

    $env:PUPPETEER_MODULE_URL=([System.Uri]::new((node -p "require.resolve('puppeteer')"))).AbsoluteUri
    $env:CHROME_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
    node tools/art/verify_greyhaven_a29_knights.mjs "..\a29-pr326-source" "..\a29-review" --serve

The console prints a random localhost port. Use that port for the A2.10 scale comparison page:

    http://127.0.0.1:<port>/web/greyhaven-a210-scale-lab.html

To regenerate the automated A2.10 screenshot package while the above server is running:

    node tools/art/verify_greyhaven_a210_browser.mjs "http://127.0.0.1:<port>/web/greyhaven-a210-scale-lab.html" "..\a210-review" "..\a210-review\greyhaven_a210_door_measurement.json"

The Blender measurement itself can be regenerated using:

    blender --background --factory-startup --python tools/art/measure_red_lion_a210_door.py -- "/path/blood_iron_greyhaven_a22.blend" "/path/greyhaven_a210_door_measurement.json"

The three actual Chrome PNGs and JSON report are under `assets/environment/greyhaven/a210-review/`. The A2.10 harness uses the pinned PR #326 localhost assets and does not copy, modify or claim ownership of those binaries.

## Acceptance boundaries

The PR remains draft. **No production sprite scale has been selected.** A2.10 does not edit PR #326's renderer, sprites, A3 roll timing/GLBs, real combat actions, hitboxes, collision, game camera, authoritative world map/doors, network code, or server. A2.10 is a visually comparable art experiment, not actual-game FPS/VRAM benchmarking.

Before optional game integration: owner reviews candidate visual size, animation readability and doorway relation; verify rigged skeletal feet/pivots; calibrate cinematic building presentation to flat XY game world; perform multiplayer roof/character depth sorting and real Chrome/Firefox/mobile frame-budget tests. Required exact-head CI must be green, the branch base current, and production deploy separately authorized.
