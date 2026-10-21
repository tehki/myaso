# Graphics 3B A2.34 — first-party World #336 renderer integration review

**2026-10-21 | Isolated source integration experiment. DRAFT, no production/client activation.**

This milestone addresses a discovered integration dependency: the World & Gameplay [PR #336](https://github.com/tehki/myaso/pull/336) already implements **real opt-in exterior authored-map Canvas tiles** in its *own unmerged branch*. Contrary to early A2.33 descriptions of the older 3B branch, the World development branch has an online-client \`?world=1\` rendering hook; it is not present in 3B's currently stacked base. Crucially, World #336's actual \`paintBuilding\` currently draws a rectangular **placeholder Red Lion roof/facade** as a static part of each tile. The World #336 \`web/online-game.mjs\` calls \`authoredWorld.draw\` **before** looping through its fighters, and does not implement fighter/building depth ordering or remove that placeholder before 3B facade compositing.

## New test uses **the actual World renderer source**

\`web/greyhaven-a234-real-world-review.mjs\` directly imports **unchanged** \`src/browser/authored-world-renderer.mjs\` and \`src/world/authored-maps.mjs\` from a separately checked out Git repo **exact head \`260a7b85a33b7a51663a70af8d410e0d33e0e236\`**, not a recreated hand-painted grid. The browser test source-checks that commit before running. It uses the real 512-world-unit authored-map tiles with the same **3 new tiles/frame / 24 max cached tiles** boundary and the same outer translate/scale game-camera transform as World #336's online-game; exact game zoom \`0.84\`.

The test renders two independent side-by-side panels:

- **World #336 original**: the original map, original Red Lion placeholder and authentic pinned PR #326 Silver Knight drawn on top, as in the current opt-in World branch.
- **World #336 with 3B staging candidate**: the *same original World renderer* followed by the real A2.30 Blender-derived facade material and manually review-faded unchanged historical roof, with the pure A2.33 behind/in-front Y=4075 draw plan and the original 3C P2.4 independently pinned forge sconce. Original 3B/3C/World/Combat source files are **not changed**. This panel still paints the World placeholder **under the detailed 3B facade**: the resulting *double-paint* is a known blocker requiring a World-owned artist-facing building rendering hook or explicit replacement layer. This test deliberately does not pretend to solve it.

World entrance **(4365,4060)**, Graphics 3B visual pivot **(4365,4075)** and 3C original fixture **(4365,4045)** remain separate anchors. No server collision, portal, zone transfer, body movement or roof fade algorithm is modified.

## Real Chrome and Firefox source-based acceptance

\`tools/art/verify_greyhaven_a234_real_world.mjs\` verifies independently pinned exact-head Git checkouts for World #336, Graphics 3C #419, authentic Silver Knight #326; executes a localhost-only allowlisted server; opens genuine **Chrome 154.0.8037.99** and **Firefox 153.4.0** and loads original source modules via real relative JS imports. The fixture warms both *real authored-world renderer caches* with a 7-frame prepass before screenshots.

Captured **three genuine screenshots per browser** — actor north of artist door, south of door, and camera shifted 80 world units east — six total with zero page/network errors. Each reports original source tiling, actor screen projection, artist/world door discrepancy, source boundaries and explicit \`actualOnlineGameExecuted:false\`.

Measured on one authorized Windows workstation after warming the six 512-unit map tiles:

| Standalone warm draw sample (20 each/browser) | World source only p95 | World + 3B source proposal p95 |
| --- | ---: | ---: |
| Chrome 154 | 0.3 ms | 0.3 ms |
| Firefox 153.4 | **11 ms** | **37 ms** |

These timings are **isolated review Canvas draw calls, not multiplayer FPS, the full online-game loop, GPU texture budgets or a qualified 60Hz test**. The Firefox composite p95 is above 16.7ms and should block claims of smooth integrated gameplay. The measurements are not controlled statistical regressions and may reflect Firefox software Canvas/readback characteristics.

Original 3B high-resolution Blender scene, its existing 35 added editable facade meshes, original roof bytes and World authored sources untouched. This PR must remain a **stacked draft**. The actual World online-client has not been executed and **no server connection was made**.

## Next explicit cross-team integration contract

1. **World & Gameplay:** provide a named Red Lion building-render replacement hook so #336's placeholder geometry is not drawn behind the new facade. Must preserve original tile-cache bound and other 14 buildings, no silent deletion of portal anchors, collision or door geometry.
2. **Core 8C:** define authoritative exterior/zone/interior state, portal/collision eligibility and potentially an explicit indoor visibility/occlusion flag; do **not** trust simple Y=4075 artist-side splitting as authority.
3. **Graphics 3B + 3C:** integrate original source facade and sconce into the approved World renderer once the hook and lighting ownership are settled, without a competing radial bloom or new roof pass.
4. **Combat + QA:** evaluate actual network-fighter/HUD/telegraph readability and two **real** browser clients; run 50/100/200-character frame/canvas budgets and preserve protected Combat assertions. The standalone 37ms Firefox p95 is a warning, not a pass.
5. **Deployment:** no merge or deployment without the central Development Center #360 integration decision, protected exact-head CI, owner art approval and rollback.

Reproduce using authorized checkout and three exact-head source clones:

\`\`\`powershell
node tools/art/verify_greyhaven_a234_real_world.mjs '<World336Checkout>' '<Graphics3CCheckout>' '<Knight326Checkout>' 'assets/environment/greyhaven/a234-review'
node --test tests/art-direction-a234-world-renderer.test.mjs
\`\`\`
