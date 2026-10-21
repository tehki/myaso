# Graphics 3A — Adult Character Visual Approval Package R1

**2026-10-21 · Status: VISUAL QA HOLD / NOT READY FOR HUMAN APPROVAL.**

This package is a first-party, genuinely rendered, inspectable snapshot of **A0 adult idle + A1 walk/run + A2 forward roll**. It is not an assertion that the new characters are visually correct. The owner expressly requires actual human visual review **before approval**, so passing functional or browser tests cannot promote this work.

## Open the actual review preview

From the repository root (after checking out the stacked review PR with its A0/A1/A2 parents):

```sh
python -m http.server 8765
```

Open **http://127.0.0.1:8765/web/adult-animation-review-r1.html** in Chrome or Firefox.

The page provides **Play/Pause, single-frame backward/forward, scrubber, playback speed, all eight directions, the three side-by-side bodies (adult masculine / adult feminine / Silver Knight), full 8-direction sheet, idle-vs-walk-vs-run and roll start/middle/end**, always comparing a neutral view with a separately labeled Greyhaven Red Lion 2.5D reference.

**Warning: the Greyhaven panel is NOT a live in-game screenshot.** It uses the real unmerged 3B #350 A2.24 authored Red Lion WebPs and the real `src/browser/arena-viewport.mjs` `projectArenaPoint` at zoom **0.84**, visually arranged at the proposed [4365,4075] door. The live game does not yet load both the adult character renderer and that Greyhaven environment together. Floor collision, camera tracking, roof depth/fading, moving player positions, exact visual feet at the game anchor and live 2-browser multiplayer remain unproven.

## Animated contact sheets: male/female side by side, all eight directions

| Clip | Inspectable looped GIF | Staged A0/A1/A2 browser loop timing |
| --- | --- | --- |
| Idle | [Both adult bodies, 8 facings](adult-idle-both-bodies-8-directions.gif) | 4 frames × 280ms = 1120ms. Preview playback setting, **not server-approved** |
| Walk | [Both adult bodies, 8 facings](adult-walk-both-bodies-8-directions.gif) | 4 frames × 220ms = 880ms. Preview-only |
| Run | [Both adult bodies, 8 facings](adult-run-both-bodies-8-directions.gif) | 4 frames × 125ms = 500ms. Preview-only |
| Forward roll | [Both adult bodies, 8 facings](adult-roll-both-bodies-8-directions.gif) | 8 frames, actual GIF timing **350ms** (40/40/50/40/40/50/40/50ms) |

The GIF contact sheets animate all eight directions concurrently with male/female rows. The PR additionally includes **idle/walk/run/roll source WebP atlases in its A0/A1/A2 parent history**. These are all original Blender-rendered poses, not placeholder motion.

For the original adult roll action, the .blend keyframes are 1..22 at 60fps, with baked atlas samples **1,3,5,7,9,11,15,22**. Source sample elapsed times are approximately **0,33,67,100,133,167,233,350ms**. The previous dormant preview helper advances the 8 atlas cells in uniform **43.75ms** steps. **These are not the same timing map.** Before any Combat synchronization approval, the art director must review the nonuniform source intervals and final impact/recovery rhythm; a correct nominal 350ms loop total does not prove correct impact timing.

## Mandatory side-by-side proof

The HTML review page includes these comparisons in one view:

1. **Adult vs Silver Knight:** authentic Silver Knight idle/walk/sprint/roll WebPs pinned from [Knight Graphics source head `c712679`](https://github.com/tehki/myaso/pull/408). The Knight sprint is the motion equivalent to adult run; these are not the same authored frame counts or proven game cadence.
2. **Masculine vs feminine:** same direction and clip, at approved 96px standing / 134px rolling screen-drawing rectangles.
3. **Idle vs walk vs run:** source animation first-phase comparison of both bodies.
4. **Roll start/middle/end:** source frames 0/3/7 shown concurrently; player can scrub other phases.
5. **Neutral vs Greyhaven:** source neutral on left, pinned PR #350 Red Lion art and game-projection reference on right. **Right is explicitly NOT live game acceptance.**

## Real Chrome + Firefox screenshot evidence

Actual automated browser evidence from `tools/art/verify_adult_animation_review_r1_browser.mjs`: two real browser engines, each checking **4 clips × 8 directions × 3 manual scrub phases = 96 interactive cases**, plus all images decoded, **24 actual 8-way comparison sprite draws and 12 clip-comparison draws**, including all 3 real source characters. The browser QA captures **six actual screenshots per engine**: idle, walk, run, roll start, roll middle and roll end.

- [Chrome: idle](adult_review_chrome_idle.png) · [walk](adult_review_chrome_walk.png) · [run](adult_review_chrome_run.png) · [roll start](adult_review_chrome_roll.png) · [roll middle](adult_review_chrome_roll_frame3.png) · [roll end](adult_review_chrome_roll_frame7.png)
- [Firefox: idle](adult_review_firefox_idle.png) · [walk](adult_review_firefox_walk.png) · [run](adult_review_firefox_run.png) · [roll start](adult_review_firefox_roll.png) · [roll middle](adult_review_firefox_roll_frame3.png) · [roll end](adult_review_firefox_roll_frame7.png)

Local runtime version recorded: **Chrome 154.0.8037.99**, **Firefox 153.4.0**; 96/96 interactive checks **per browser**, zero page/HTTP errors. Screenshots are authentic native-browser captures, but the Greyhaven right panel is a composited art QA environment, not live server/game acceptance.

## Quantified visual blockers — not inferred foot-joint positions

`motion-review-metrics.json` records silhouette alpha bounds and position relative to the existing fighter-origin display rectangles. At an alpha cutoff of 32, observed **silhouette-bottom offsets in screen pixels relative to the origin** across 8 directions and source frames:

| Adult body | Idle | Walk | Run | Roll |
| --- | ---: | ---: | ---: | ---: |
| Masculine | +22.8..27.0 | +22.2..27.6 | +17.4..27.0 | +2.4..56.0 |
| Feminine | +22.8..27.0 | +22.2..27.6 | +17.4..27.0 | +2.4..56.0 |

This strongly suggests a **source camera / sprite-anchor grounding mismatch**. The roll proxy varies **53.6px** across sampled poses, far too large to claim stable foot/shoulder floor contact merely from a common origin. These figures are **bounding silhouette proxies**: feet may be lifted, a head or hand may touch the floor during a tumble, and actual contact joints require measurement in Blender and in real-world geometry. Do not call them verified foot penetration distances.

Initial visual inspection also shows *procedurally simple mannequin-like anatomy and gait*: detail, body weight transfer, real stance/contact, shoulder support, facial/hair treatment and natural recovery need art-direction rework before approval. Neutral and staged Greyhaven panels keep the original source offsets visible to support inspection.

**Verdict: NOT APPROVAL READY.** The evidence shows exactly why the animation should receive correction, not only more passes in CI.

## Missing character animation clips

No approved adult WebP atlases exist for **jump, unarmed attack, parry/block, kick/shove, hit/stun or death/knockdown**. A preview must not label any of these as delivered or display idle/walk while those Combat actions are authoritative.

## Full in-game Greyhaven acceptance — explicit blocker

An actual in-game evidence package must be produced separately using the real gameplay renderer, authoritative 2-browser state and the Greyhaven world slice, with camera zoom 0.84, ground geometry/pivots, door/building scale, roof occlusion and a moving player performing idle/walk/run/roll. *PR #350's original A2.24 report states `actualGameRenderIntegrated:false`*, and this 3A review does not alter that. Core/World/Graphics 3B need to cooperate on an isolated integration fixture before owner acceptance.

## Branch, CI and safety

Parent asset branches: [A0 #433](https://github.com/tehki/myaso/pull/433) → [A1 #448](https://github.com/tehki/myaso/pull/448) → [A2 #457](https://github.com/tehki/myaso/pull/457). This review PR is **separate and stacked on A2**; it does not modify production `web/online-game.mjs`, server, animation physics, hitboxes, Core networking or item ownership.

- Parent [A2 protected CI #39519954136](https://github.com/tehki/myaso/actions/runs/39519954136) is **FAILED** at M205 repeated M201 authoritative server-tick FFA punish proof. This review is **not** a fix for that independent Combat gate.
- Review-only pinned reference images and their exact SHA256/branch origins are in `web/assets/review-r1/source-provenance.json`. These must not be promoted as canonical game assets. They exist so offline reviewers can inspect original unmerged Knight and Greyhaven art without silently replacing their owners.
- R1 review CI link and exact head SHA belong in its draft PR description after publication.
- **NO merge, NO default character activation, NO gameplay deployment, NO human visual approval claimed**.

**Next art iteration should correct grounded root/sprite pivot, roll shoulder/forearm support and actual gait/weight transfer before any more equipment expansion.**
