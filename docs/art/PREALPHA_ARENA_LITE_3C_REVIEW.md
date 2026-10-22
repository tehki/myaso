# 🌕⚡️🚀 Graphics 3C — Arena Lite original floor, optional Pre-Alpha visual candidate

**Status:** Original candidate art source and native Chrome+Firefox preview TESTED; default gameplay UNCHANGED, Silver/combat readability NOT YET TESTED, human art review and central Pre-Alpha scope approval required. **DRAFT, NO MERGE/DEPLOY.**

## Exact owner scope: do not create a release dependency

The Main Orchestrator's [Pre-Alpha 0.1 #695](https://github.com/tehki/myaso/issues/695) deliberately keeps the existing arena, two-to-four authentic human Silver Knights, real light/heavy input, combat recovery, R4 sound and mandatory CI as the release-critical path. It explicitly **excludes Graphics upgrades as dependencies**. This source **must remain fully optional**. A separate review or later owner-approved additional visual release may use it. Never force a rebase onto Pre-Alpha branch as an unsolicited release feature.

Current `main` baseline SHA: `6fa59b649112c272bcbc018b4a32bf963f9a5bba`. The existing live `web/online-game.mjs` has an opaque `960x540` background Canvas `createArenaLayer()` with #1c1913 flat ground, 48px technical grid and original 12px border. That function has **not been edited**, imported from this source, moved, or substituted.

## Graphics 3C original once-painted art

`src/browser/prealpha-arena-lite-floor.mjs` creates a visually subdued, deterministic floor:

- Directionally gentle packed-earth tones, lightly trampled/scuffed ground, sparse tiny stones.
- Irregular cobblework only along the outer edges, leaving central target combat silhouettes readable.
- A subtle border without imposing World solids/physics walls.
- **Exactly fixed 960×540 original arena dimensions and opaque 2D paint**, bounded seeded random variation; source doesn't use `Math.random`, real time, animation, a render clock or networking.
- Paint called ONCE into a static layer; no ongoing particles, vegetation, moving lights or duplicate render/authority loop.
- No AI images, no external licensed texture fetches, no additional WebP. Authored as original Canvas source.
- Original scene source code remains exactly unchanged until an independent release owner acceptance and reviewed opt-in/rollback.

`web/prealpha-arena-lite-review.html` is a **comparison-only source page** with the unmodified existing grid reproduced at left and new real Canvas paint at right. **No in-game Silver actor, Core/Combat, production deployment, playable scene, or Greyhaven claim**.

## Focused tests + actual browser evidence

`node --test tests/prealpha-arena-lite-floor.test.mjs` — **4/4 PASS** on connected authorized Windows Machine. Tests assert consistent seed/operations, bounded drawing, correct opaque factory, input/size refusal and zero import/edit of live arena.

`tools/art/verify_prealpha_arena_lite_native.mjs` serves only the two original source files via isolated localhost HTTP, then launches **real native Chrome and Firefox** for full-page screenshots and actual Canvas pixel brightness. No game/network/server is started.

Original source-pinned Windows native trials passed 2/2, with zero JavaScript page errors:

| Native engine | Existing technical grid center luminance | Arena Lite center luminance |
| --- | ---: | ---: |
| Chrome | 26.087 | 63.377 |
| Firefox | 26.085 | 63.730 |

The metric is sampled relative visual RGB luminance in the central 480×270 source-pixel region, NOT external display-calibrated nits, player/armor contrast, GPU FPS, browser render-frame cost or multiplayer acceptance. Source does not verify Knight silhouettes, 14 controls, HUD, actor shadows or alpha compositing.

**Actual images from real source, NOT stock/concept art**:
- `original_arena_vs_lite_chrome.png` — genuine native original/new Canvas screenshot
- `original_arena_vs_lite_firefox.png`
- `arena_lite_native_review.json` — source SHA-256, exact versions and pixel measurements

## Release boundaries / definition of done

To request an additional opt-in integration with real multiplayer in a separate review PR, central Main must explicitly approve optional visual scope, baseline must stay byte-identical and rollbackable, and Graphics 3A/Combat/UI must assess actual 2–4 Silver Knight silhouettes, combat parry tells, hit cues, directional movement and screen-space HUD without occlusion at 960×540 and short-page 1280×720/1366×682. Collect real native Chrome/Firefox scene screenshots plus p50/p95/p99 visual game-frame completion timing and ensure strict mandatory protected quality is green on exact source head. Do not classify this source art as native **real-game combat acceptance**.

Graphics 3B can separately submit optional **Blender-authored static wall/fence/brazier ART PREVIEW** outside the active fighter area—no gameplay collision, no fake doors, no interaction or NPC/spawn/portals, no roof/city or textures from live Greyhaven. Any loaded perimeter must avoid shadow/actor occlusion and need not be included if it adds load or clarity issues.

**Central governance:** [Graphics #344](https://github.com/tehki/myaso/issues/344) · [3C #415](https://github.com/tehki/myaso/issues/415) · [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695) · [Main #360](https://github.com/tehki/myaso/issues/360). Unmerged / not deployed. Preserve existing Pre-Alpha 0.1 combat-first release target.
