# Blood & Iron A2.27 — Real Chrome verification of A2.26 Red Lion roof material

**Status:** genuine local Chrome source-art acceptance, draft Graphics 3B review only; **NOT** a working shared multiplayer building, dynamic roof occlusion or a release.

The A2.26 roof RGB weathering was generated from the authentic A2.24 baked roof while retaining its identical alpha silhouette and paired identical original facade. A2.27 measures those **actual A2.24 and A2.26 source WebPs decoded in Chrome**, using the actual game \`projectArenaPoint\`, **0.84** zoom, A2.25 verified world-XY door anchor, and original 120%-scale PR #326 Knight atlas assets from an **independent exact-commit checkout** \`c74fcf90e227f3bc4788728f000cfe6aa083c7ef\`.

## Acceptance evidence

- Browser: **Chrome/154.0.8037.99**, standalone localhost-only art reviewer.
- **Four native 1500px-wide Chrome screenshots**, zero page/network errors:
  1. Genuine Silver Knight standing at visual door \`(0,0)\`, full roof.
  2. Genuine Silver Knight at \`(+120,-80)\`, roof slider at 55%.
  3. Genuine original Silver Knight 350ms A3 roll at \`(+40,+40)\`, manual roof opacity 0.
  4. Genuine T1 Sentinel A3 roll at \`(-60,+70)\`, manual roof opacity 80%.
- **39,090 visible roof RGB pixels changed** in the Chrome-decoded full visual-door-centered comparison. A2.26 original authoring Pillow count is 39,133 source pixels; counts differ due to rendering/transparent pixel handling.
- **Zero roof alpha pixel differences**, identical canvas bounds \`[204,40,436,231]\`, roof top shift **0px**, roof bottom shift **0px**.
- **0.0000216333px game-XY discrepancy** for both variants at \`(+120,-80)\`.
- Original PR #326 sprites independently pinned: **96px idle**, **134px roll**. Original Blender sources and Knight atlases untouched and not copied into graphics PR.

Source files: \`web/greyhaven-a227-roof-browser.html\`, \`web/greyhaven-a227-roof-browser.mjs\`, \`tools/art/verify_greyhaven_a227_browser.mjs\`, and complete Chrome screenshots + measured report under \`assets/environment/greyhaven/a227-review/\`.

To regenerate from this checkout on the authorized Windows browser machine, using a separate pinned Knight PR #326 checkout:

\`\`\`powershell
$env:PUPPETEER_MODULE_URL = ([System.Uri]::new('C:\path\to\installed\puppeteer.js')).AbsoluteUri
$env:CHROME_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node tools/art/verify_greyhaven_a227_browser.mjs 'C:\path\to\pinned-knight-PR326' 'assets\environment\greyhaven\a227-review'
node --test tests/art-direction-a227-chrome-roof.test.mjs
\`\`\`

The browser has a **manual roof-opacity review slider**. This **does not prove automatic per-player roof occlusion**, correct foreground/back sorting in the actual shared game renderer, multiplayer doorway authorization, collision or server-backed interiors. The original Red Lion art door \`(4365,4075)\` is still a proposed visual anchor belonging to unmerged World PR #336. Runtime authority remains with Core 8C and World & Gameplay.

Graphics PR #350 remains draft, parent of stacked Graphics 3B PR #411. No merge/production deployment, cross-branch source asset mutation, playable door, autorender integration or gameplay input/hitbox/network change occurred. Current-base CI, owner visual review, genuine gameplay renderer acceptance and performance budget remain open.
