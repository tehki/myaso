# Graphics 3B — A2.29 facade close-up material and DPR acceptance

**October 21, 2026 — DRAFT art QA, not a rendering-engine or gameplay feature.**

Follows the Graphics Art Director's instructions to focus on **architecture details, lighting, material quality, not roofs**. Builds entirely on [A2.28 draft #443](https://github.com/tehki/myaso/pull/443) without changing original Blender scenes, roof art, facade pixels, World/Combat/server code or game renderer.

## Close-up inspection of authentic source assets

The [standalone inspector](../../web/greyhaven-a229-craft-inspector.html) compares unchanged A2.24 base, A2.28 daylight and dusk facades in a 4-by-3 matrix:

- Door jambs, iron hinges, keyplate and threshold: original canvas ROI [291,249,350,331].
- West/east glazing, mullions and reveals: [242,249,281,291] and [352,249,393,291].
- Stone foundation and mortar: [213,311,428,344].

These are *actual source pixels enlarged for inspection*, not new high-resolution art or a game closeup. It computes RGB differences, alpha differences and mean luminance within each region; source world projection is the same 0.84 zoom and 0.025 authored metres/world unit.

## Native browser evidence

The reproducible browser harness serves only allowlisted files over localhost and launches genuine Chrome 154.0.8037.99 and Firefox 153.4.0, each at display DPR1 and DPR2.

- **4 native screenshots**, each showing twelve facade details, **0 browser/network errors**.
- **Zero alpha differences** per ROI, every pass; untouched existing roof bytes.
- Both windows have **greater average local facade luminance at dusk** than in daylight due to warm authored light; the stone plinth is darker at dusk.
- Device DPR changes display sampling, **not** source resolution: the source facade is still 228×297 RGBA crop. Chrome/Firefox numerical luminance agrees within normal canvas color processing variation; no cross-engine byte-identical screenshots claimed.
- No player sprites, 3C atmospheric sky or world renderer are included in these tight source-art details. A2.28 independently captured real source Knights in Chrome/Firefox at game XY.

Evidence files: assets/environment/greyhaven/a229-review/greyhaven_a229_{chrome,firefox}_dpr{1,2}_craft.png and machine-readable greyhaven_a229_craft_browser_report.json.

## Reproduction

\`\`\`powershell
$env:PUPPETEER_MODULE_URL=([System.Uri]::new('C:\path\to\puppeteer.js')).AbsoluteUri
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FIREFOX_EXECUTABLE='C:\Program Files\Mozilla Firefox\firefox.exe'
node tools/art/verify_greyhaven_a229_craft_browser.mjs assets/environment/greyhaven/a229-review
node --test tests/art-direction-a229-craft.test.mjs
\`\`\`

This source-crop acceptance **does not** certify photorealism, production lighting, 60 FPS multiplayer frame budget, combat readability, roof occlusion, server portal or interiors. Owner art inspection and integration/current-base gates remain mandatory. #443 stays stacked on #411/#350, draft/unmerged; no changes to protected tests or production deployment.
