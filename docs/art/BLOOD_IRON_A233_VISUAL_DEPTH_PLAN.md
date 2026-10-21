# Graphics 3B — A2.33 Red Lion visual depth-stage proposal

**21 October 2026 · Source-art experimental render staging. Not integrated into online-game, not a production gameplay feature.**

The current \`web/online-game.mjs\` renders a static arena layer then network-state fighters. It does **not** render the authored Red Lion or sort its facade/roof against multiplayer actors, so no prior A2.24–A2.32 source-art captures can demonstrate real in-game building occlusion. This fact is a critical integration dependency for World/Core 8C and Graphics Orchestrator. Do not present these art-only tests as live-world acceptance.

## Proposed pure draw-order staging

\`src/browser/red-lion-visual-depth-review.mjs\` exports \`createRedLionVisualDepthPlan({actors,visualPlaneY})\`. It accepts candidate fighter world coordinates as read-only data, rejects invalid/duplicate IDs and non-finite positions, sorts deterministically by world Y then actor ID, and returns immutable stages:

1. Existing terrain/background and original 3C practical light ground pool
2. Actors whose **world-space feet have Y < 4075** (behind the artist's facade plane)
3. Original A2.30 dimensional Red Lion facade and single original 3C lantern
4. Actors whose **feet are at or south of Y 4075** (in front of facade; equality breaks toward visibility)
5. Original roof as separate independent **art-review layer**, manually faded only

This is a **visual hypothesis**, not authoritative interior/portal/collision geometry. The World-authored Red Lion entrance is **(4365,4060)**, intentionally different from the 3B visual door at **(4365,4075)**; the 3C P2.4 sconce remains **(4365,4045)** and its ground pool **(4365,4069)**. The proposed rule does not authorize walking through walls, room transitions, server actor depth, a roof fade algorithm or hit detection. It could hide an incorrectly placed player behind solid facade, requiring direct gameplay review.

## Native Chrome + Firefox evidence

The opt-in \`web/greyhaven-a233-depth-browser.html\` imports real first-party 0.84 game projection and separately pin-checks original source trees for **3C PR #419, Knight #326, draft adult #433**, displaying original dimensional A2.30 facade and the **byte-identical frozen A2.26 roof**. Two canvases compare prior always-in-front source-art presentation with automatically staged behind/in-front actor layers.

Three north-knight positions (-20, 0, +20 world units from the artist's door) were tested in genuine Chrome 154 and Firefox 153.4. Visual sorting varies only for the northern/behind-plane case:

| Scene | Chrome changed ROI pixels | Firefox changed ROI pixels |
| --- | ---: | ---: |
| North knight -20 world units | 1,122 | 1,153 |
| Knight exactly on door plane | 0 | 0 |
| Knight +20 units south | 0 | 0 |

The zero-change cases compare identical Y-sorted actor order and art layers. Real **6 browser PNG captures**, 0 page/network errors. The appearance of this compositing difference is **evidence of a working isolated visual stage algorithm**, not a result from the actual multiplayer client. All art-source/WebP, Blender mesh and roof bytes remain unmodified.

## Required integration gates

**Do not merge or deploy** until World/Core 8C defines authoritative indoor/outdoor/portal/collision semantics, then Graphics Orchestrator approves scene compositing. A deterministic stage based on feet Y is insufficient for overlapping doors, Z elevation, corners, canopies, simultaneous fighters or multiple buildings. The final renderer must preserve existing Combat telegraphs, network interpolation and HUD readability, avoid shifting snapshots, and prove front/back/side/roof occlusion in two real server-connected clients with 50/100/200 fighters and p95 FPS budgets. Graphics 3C must approve its source fixture/sconce use. Our project remains a draft review dependency stacked on #470, #466, #443, #411 and #350.

Reproduce from an authorized Windows checkout, separate pinned original 3C/3A sources and installed Puppeteer:

\`\`\`powershell
node --test tests/art-direction-a233-visual-depth.test.mjs
node tools/art/verify_greyhaven_a233_depth_browser.mjs '<3C source checkout>' '<Knight source checkout>' '<adult source checkout>' 'assets/environment/greyhaven/a233-review'
\`\`\`
