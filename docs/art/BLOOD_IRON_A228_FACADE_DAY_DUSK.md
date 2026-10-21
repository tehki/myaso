# Blood & Iron A2.28 — Red Lion street facade craftsmanship and daylight/dusk

**2026-10-21 · Graphics 3B · ART REVIEW ONLY · draft**.

## Owner-directed change in priority

Following the Graphics Orchestrator's 2026-10-21 directive ([Graphics #344](https://github.com/tehki/myaso/issues/344#issuecomment-6304218614)), this iteration **stops discretionary roof polishing**. Focus is the street-facing Red Lion facade, threshold, window timberwork, stone joints and local material response under daylight and dusk. Existing A2.26 roof is copied **byte-identically**, not modified. This remains Blood & Iron — Medieval Realism, a source-authored 2.5D preview at exact game XY; no gameplay/portal/network changes.

## Art authored at original source coordinates

\`tools/art/paint_greyhaven_a228_facade.py\` consumes original A2.24 lossless Blender-derived Red Lion base WebP (SHA validated by A2.25 handoff) and existing A2.26 roof unchanged. It draws layered anti-aliased RGB-only details onto the original imported facade silhouette: staggered stone/lime mortar courses, mineral flecks and threshold contact, warm/cool timber catches and aged grain, mullion divides, window sill shadows, original doorway jamb relief, forged strap hinges/keyplate and more convincing stone step. Original alpha is restored **bit-exactly**, including antialiased edges. World XY, crop, doorway, eaves and building silhouettes are untouched. No external images or third-party textures.

Separate **daylight** and **dusk** source-derived facade WebPs preserve the same cropped 228×297 pixel bounding rectangle / (-114,-269) visual door draw offset. Daylight adds subtle diffuse timber/stone relief; dusk reduces facade exposure and adds small, localized Gaussian blurred warm window and doorway spill. No sky/weather/dynamic illumination is implemented. **Graphics 3C owns scene-level atmospheric lighting**; A2.28 is only 3B local material response.

## Reproducibility and performance budget

\`\`\`powershell
python tools/art/paint_greyhaven_a228_facade.py
node --test tests/art-direction-a228-facade-light.test.mjs
\`\`\`

Two lossless RGBA facades are generated at 45,050 (day) and 44,110 (dusk) bytes; unchanged A2.26 roof is 40,746 bytes. **Per-mode facade + roof = 85,796 bytes day / 84,856 bytes dusk**, excluding background/chunks/Knight sprites. One mode can be loaded at a time in eventual runtime: do not load all variants without a measured memory budget. One 228×297 RGBA facade is approximately 265 KiB decoded; roof 238×197 ~183 KiB decoded, excluding GPU stride overhead/mipmaps. The current three-panel art reviewer purposefully loads *both* variants and is **not** a production texture budget or representative FPS benchmark.

## Cross-browser first-party art acceptance

\`tools/art/verify_greyhaven_a228_browser.mjs\` runs a localhost-only allowlisted server and actual Chrome 154 and Firefox 153.4 browser processes. Uses independently pinned original Knight PR #326 exact head \`c74fcf90e227f3bc4788728f000cfe6aa083c7ef\`, SHA-checked 96px original Silver Knight idle WebP, and the imported actual \`src/browser/arena-viewport.mjs\` / \`projectArenaPoint\` with zoom 0.84 and 0.025 authored metres/world unit. No Knight assets are copied to Graphics PR.

Capture two actual 2010px native screenshots per browser: proposed art door (0,0) and (+80,-10) relative offset. All **four screenshots captured, no browser/network errors**; original/modified daytime and dusk facade comparisons are included in each three-panel screenshot. Dusk atmosphere in this viewer is static muted canvas background, not a simulated 3C lighting system. Report \`greyhaven_a228_native_browser_report.json\` contains measured per-canvas \`performance.now()\` drawing samples; these are **isolated render-call samples, NOT live 60 FPS, percentile gameplay frame-times or stress-tested 50/100/200 fighter measurements**.

To reproduce using an *independent exact-head Knight PR #326 checkout*:

\`\`\`powershell
$env:PUPPETEER_MODULE_URL = ([System.Uri]::new('C:\path\to\puppeteer.js')).AbsoluteUri
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FIREFOX_EXECUTABLE='C:\Program Files\Mozilla Firefox\firefox.exe'
node tools/art/verify_greyhaven_a228_browser.mjs 'C:\path\to\pinned-knight-checkout' 'assets\environment\greyhaven\a228-review'
\`\`\`

## Outstanding signoffs

Art Director must inspect masonry realism and consistent material age, daylight/dusk exposure, window geometry/low zoom legibility, lighting coordination with Graphics 3C, and the conservative architecture visual style. Browser QA is standalone **art-only**, not the actual multiplayer runtime, automatic roof/actor depth sorting, authoritative portal, complete combat readability or mobile frame-time validation. Parent Graphics #350, stacked #411 and World #336 remain separate/unmerged; this A2.28 review is a new independent **stacked draft** only, not permission to merge or deploy.
