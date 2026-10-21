# Graphics 3C — P2.8 interactive world-preview acceptance

2026-10-21 | myaso.io / Moon Games / Graphics 3C | PR #419 (draft)

## Why this is distinct from the earlier Canvas benchmarks

The original P2.5/P2.6 benchmark invoked the cached World Canvas renderer in isolation. P2.8 tests the **real project-authored interactive browser preview** at `/web/world-preview.html`: its own requestAnimationFrame loop, keyboard movement, live camera, world chunk caching, HUD, zoom, tavern interior and `E` transition. It captures actual Chromium screenshots rather than invented mockups. Two independent localhost static servers serve pinned **World PR #336 head `260a7b85a33b7a51663a70af8d410e0d33e0e236`** and restored Graphics 3C P2.6 head `f59bbcb34136ad96e0890a2d887fb7b250d7e02a`. No material/texture/geometry is modified by the acceptance harness.

Script: `tools/art/verify_greyhaven_3c_live_preview_browser.mjs`. Set `PUPPETEER_MODULE_PATH` to an installed Puppeteer module, `CHROME_EXECUTABLE` to installed Chrome/Chromium, and `GREYHAVEN_BASELINE_URL` plus `GREYHAVEN_CANDIDATE_URL` to separately served `http://127.0.0.1:PORT` checkouts. Run `node tools/art/verify_greyhaven_3c_live_preview_browser.mjs <output-directory>`. No external website, game multiplayer server or credentials are accessed.

At 1280x960 viewport / DPR1, each version is loaded and inspected: original Greyhaven initial Canvas snapshot (before any input), idle, actual keyboard D/A/W/S routes, an actual wheel zoom event, current final world preview plus HUD screenshots, then moving toward the existing Red Lion portal and **pressing E** to enter the inn, followed by an independently launched `?room=tavern` interior preview and real keyboard movement. Report asserts HTTP 200, no uncaught browser JS errors, progress under keyboard input, and successful authored preview portal. The renderer and the browser preview page are unmodified.

## Two real test hosts (independently executed)

| Interactive-browser metric | Original World #336 | Graphics 3C P2.6 |
| --- | ---: | ---: |
| Windows Machine, Chrome 154, observed overworld rAF intervals | 728 | 702 |
| Windows, intervals above 33.4ms | 2 | 8 |
| Linux X230i, Chromium 152, observed overworld rAF intervals | 714 | 736 |
| Linux X230i, intervals above 33.4ms | 9 | 1 |
| Linux X230i, intervals above 50ms | 4 | 0 |
| Both hosts — WASD/zoom/HUD/interior | Pass | Pass |
| Both hosts — keyboard E at the Red Lion door | Pass | Pass |
| Both hosts — page JS errors | 0 | 0 |

The Windows host is Intel Core i7-2700K, Chrome 154.0.8037.99; Linux host is Intel i3-2370M, Chromium 152.0.7977.82. Browsers ran headless with `--disable-gpu` and the test collects requestAnimationFrame **intervals**, not total game engine frame time. Intervals around 16.7ms reflect monitor/browser-vsync quantization, not proof that each render completed within 16.7ms. An occasional startup/first-chunk spike remains visible. Different results on the two hosts show why cherry-picking one host's FPS would be misleading; the data **does not prove either regression or production budget compliance**.

## Visual and architectural limitations

The fixed initial camera is exactly authored Greyhaven spawn in both checkouts. On Windows, the interactive Canvas screenshot comparison differs at approximately 137,707 RGB pixels; the changed cobblestone/ground-cover and facades' warm pools are intentional, not a claim of superior or ready-to-ship final artwork. Each 3C lighting fixture is static and has no collision/authority effect. The dynamic end-of-travel camera may differ by a few world units because real keyboard timing is inherently variable; use the fixed initial screenshots for side-by-side review.

The preview still displays the **existing simple placeholder knight and World #336 building painter**, not the visually complete adult character animations and Blender facade assets in independent Graphics 3A and 3B draft streams. Accordingly, **this is not the requested final 3A/3B/3C visual composite**. It also uses local simulated interior portals, **not authoritative multiplayer transitions**, and does not measure server, combat, persistence, physics or GPU full-game performance.

Windows report and real screenshots: `assets/environment/greyhaven/3c-p28-review/` including `p28_live_preview_report.json`, the fixed-camera `world336_initial_greyhaven_canvas.png` and `graphics3c_initial_greyhaven_canvas.png`, portal-enter screenshots and the `greyhaven_live_preview_before_after.png` side-by-side montage.

Linux report and real screenshots: `assets/environment/greyhaven/3c-p28-x230i-review/` (separately collected on X230i with the same harness).

## Integration disposition

**Quality and gameplay hold.** Earlier P2.6 CI [#39524848104](https://github.com/tehki/myaso/actions/runs/39524848104) succeeded, but the exact restored branch head [#39528508907](https://github.com/tehki/myaso/actions/runs/39528508907) failed protected M144 multiplayer focus/recovery acceptance. The M144 trace contained focus transitions to both punishable players but was rejected at the strict authoritative arbitration condition; Combat owns triage. No M144 assertion/input/state changes were made. Any new P2.8 exact-head CI must pass before integration. Unmerged World #336 and Graphics 3B #350, plus independent character/animation 3A sign-off, need an actual integrated visual review.

Keep draft PR #419 stacked and unmerged. Do not deploy or activate experimental portals or assert playable multiplayer/FPS readiness.
