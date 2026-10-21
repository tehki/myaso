# Graphics 3B A2.31 — Actual 3C P2.4 source composite and alpha/lighting handoff

**21 October 2026 · DRAFT REVIEW ONLY · no merges, world/gameplay changes or live deployment.**

This deliverable implements [Graphics Orchestrator assignment #459](https://github.com/tehki/myaso/issues/459) as an independently reproducible **first-party art-only review fixture**, with the exact existing source art from **3B #443 A2.30**, **3C #419 P2.4/P2.5**, independently pinned authentic 3A **Silver Knight PR #326** and **draft unclothed adult preview PR #433**. The review does not activate or combine their production branches, and the original source scenes and roof remain unchanged.

## Exact cross-department light/door position contract

| Semantics | World XY | Owner | Purpose |
| --- | --- | --- | --- |
| Red Lion building footprint | (4240,3880), 250×170 | World #336 | Proposed outdoor placement, not a collision polygon |
| World entrance | **(4365,4060)** | World/Core 8C | Authored intended link, not server-authorized |
| 3B facade visual door pivot | **(4365,4075)** | 3B | Real source-art XY pivot, game zoom 0.84 |
| 3C outdoor sconce fixture | **(4365,4045)** | 3C P2.4 | World-owned fixture position: building y+h-5 |
| 3C cobbled-ground pool | **(4365,4069)** | 3C P2.4 | Same X, world y+h+19, radius 108 |

All three door/fixture points differ by design. **Do not silently move the World entrance, collision/portal, facade or sconce** in an attempt to align artistic light with gameplay authority.

Original pinned 3C source files are imported directly in the standalone QA web page from a **separate checkout** at exact commit \`8e85584b6007b38e1a00155b77473e92b0afec6a\`: \`src/browser/greyhaven-atmosphere.mjs\` and \`src/world/authored-maps.mjs\`. No 3C code, pool drawing function or authored World map is copied/modified in 3B. The viewer builds the original **512-world-unit chunk Canvas tiles** for exactly the Red Lion fixture and 3C pool; the other World building lights are filtered **in this isolation-only fixture**, not in world runtime.

## Lighting consistency

The A2.31 daylight facade is **byte-identical** to original A2.30's lossless Blender-rendered dimensional facade. The dusk variant is a restrained source RGB response with warm light only inside the two existing window apertures. Alpha is exactly source-preserved. Unlike A2.28's separate art study, **no new 3B radial/blurred halo exists in this composite**: **3C alone paints one authored sconce and ground pool**. The daylight review suppresses the 3C ground pool to compare unlit daylight against dusk, while still showing the fixture. **This is a conceptual comparison toggle, not a live day/night implementation**; 3C P2.4 is static/cosmetic in the current source.

The source roof is byte-identical to the historical A2.26 roof. It is neither repainted nor reconstructed.

## Art Director's A2.30 silhouette/occlusion concern

The reproducible \`tools/art/build_red_lion_a231_facade_material.py\` independently compares original and derived A2.30 Blender RGBA outputs in the real 640×640, positive-Y-down source canvas. It records all **69 changed alpha pixels**: **51 newly visible** pixels, **0 deleted-to-transparent** and **18 changed partially transparent**. Overall facade bounds unchanged. A real markup \`greyhaven_a231_alpha_hazard_overlay.png\` shows the differences. This is *documentation of the risk*, **not proof that body-wall/roof occlusion is correct in the live game**. The review adds explicit alternative front/behind player draw-order hypotheses; final runtime occlusion requires World/Core/Graphics Orchestrator acceptance.

## Genuine Chrome and Firefox source review

\`tools/art/verify_greyhaven_a231_composite.mjs\` serves an allowlisted localhost fixture and pin-checks three separate Git checkout heads: 3C P2.5, 3A Silver PR326, 3A adult source PR433. It SHA-checks the actual Silver idle and adult masculine idle atlas. Browser imports the actual game \`projectArenaPoint\` module, 0.84 zoom. Three captures per engine: Silver at the proposed door drawn in front; oblique Silver at (+80,-10) in front; Silver at door behind facade. The adult character is separately drawn for relative visual scale. **6 real browser PNGs, 0 browser page/network errors.**

Each browser performs **40 moving-camera redraw samples**, and reports cold build costs for the two 3C 512-unit Canvas tiles and p50/p95 times for each isolated day/dusk scene panel. These are **draw-call timings for the review canvas**, not full game-loop frame time, 50/200 player scaling, client GPU utilization or multiplayer FPS. The qualitative interpretation matters: the available Firefox desktop sample has dusk p95 above 16.7ms, so no 60 FPS claim may be made from this evidence.

Total packed per-mode facade + unchanged roof: day **44,370 + 40,746 = 85,116 bytes**; dusk **41,418 + 40,746 = 82,164 bytes** (excluding two character atlases / scripts). Decoded GPU texture memory depends on backend/stride/mips: CPU RGBA footprint of a single 228×297 facade is **270,864 bytes**, roof 238×197 **187,544 bytes**; each original Silver/Adult 640×1280 atlas is **3,276,800 bytes**. Each of the four 512² review-only precomputed Canvas tiles (two pool, two fixture) has 1,048,576 bytes RGBA CPU backing, total **4,194,304 bytes**, excluding implementation/DOM overhead. Future integration should load one facade variant, share/prune 3C light cache and test actual target GPU resources rather than claiming source viewer memory as a game budget.

## Reproduction

On the authorized Windows machine, obtain separate exact-commit local checkouts for Graphics 3C PR #419, original 3A Knight #326 and adult preview #433. Validate the clone heads before running:

\`\`\`powershell
python tools/art/build_red_lion_a231_facade_material.py
$env:PUPPETEER_MODULE_URL=([System.Uri]::new('C:\path\to\puppeteer.js')).AbsoluteUri
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FIREFOX_EXECUTABLE='C:\Program Files\Mozilla Firefox\firefox.exe'
node tools/art/verify_greyhaven_a231_composite.mjs '<pinned3C_checkout>' '<pinned_Knight_checkout>' '<pinned_adult_checkout>' 'assets/environment/greyhaven/a231-review'
node --test tests/art-direction-a231-composite.test.mjs
\`\`\`

**Release hold:** source fixture only. It does **not** mount the authored-world renderer, real dynamic light, server door/portal, multiplayer character state, correct automatic roof fade/depth sorting, true AI/combat animations or measured integrated 60 FPS. Owner/Graphics Orchestrator and 3C must review near-door glow/occlusion. Parent #350, child #411, 3B #443, 3C #419, adult #433 remain draft/unmerged and current-base compatibility, protected CI, actual game performance and central Development Center #360 gates remain required.
