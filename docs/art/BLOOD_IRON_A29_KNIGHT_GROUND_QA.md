# Blood & Iron A2.9 — original A3 knight source in Greyhaven roof preview

**Status:** real Chrome review, separate PR sources, **NOT integrated into the multiplayer game**.

## Why

The live client in src/browser/arena-viewport.mjs projects actual world XY at zoom 0.84. The current online fighter presentation in web/online-game.mjs rotates and draws around each fighter's authoritative world-space center. PR #326 proposes opt-in 8-direction Silver Knight and T1 Sentinel sprite atlases with A3 rolls, but **PR #326 is still unmerged**, and the atlas source does not provide an anatomically verified foot/ankle ground anchor.

A2.9 is the first cross-branch **local-only** art acceptance: PR #350's already-authored Red Lion 3/4 base and roof WebPs and PR #326's actual Silver and T1 atlases are rendered together by real Chrome in a separate page. **No PR #326 WebPs are copied into PR #350.** The test requires the exact companion commit c0b08a2a527cc492199db9f1e01dc9727225987f in an independently checked-out worktree, and SHA-256 hashes the actual module and all three source atlases for traceability.

The standalone page is web/greyhaven-a29-knight-lab.html. Unlike A2.8, it does not claim coordinate registration: it is intentionally a visual art comparison at a proposed door-ground pivot, with the known 3/4-vs-flat-XY mismatch still outstanding.

## Reproduce / inspect interactively

On the authorized Windows workstation, while on the graphics PR branch, create a separate companion worktree once (outside the graphics checkout):

    git fetch origin pull/326/head:refs/remotes/qa/pr326
    git worktree add --detach ..\a29-pr326-source refs/remotes/qa/pr326

The example assumes you are in the tracked graphics checkout repo-check and that the sibling a29-pr326-source exists. Do not switch PR #350 to PR #326 and do not commit source atlases across branches.

In PowerShell, from the graphics repo root:

    $env:PUPPETEER_MODULE_URL=([System.Uri]::new((node -p "require.resolve('puppeteer')"))).AbsoluteUri
    $env:CHROME_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
    node tools/art/verify_greyhaven_a29_knights.mjs "..\a29-pr326-source" "..\a29-review" --serve

The script first runs real Chrome assertions and saves screenshots/reports. It then prints A29_INTERACTIVE_PREVIEW=http://127.0.0.1:<port>/web/greyhaven-a29-knight-lab.html and keeps only a **localhost-bound** server available until Ctrl+C. It serves just three allowlisted companion sprite atlas WebPs and their build report from the separate PR #326 worktree. No network login, external-host fetch, game connection or production deployment. Without this companion server, opening the HTML through a generic Python HTTP server correctly reports missing unmerged atlas assets.

## Provenance and exact sprite draw contract

PR #326, source web/knight-sprites.mjs (commit c0b08a2):

| Sprite | Atlas tile size | Runtime drawn size | Presentation offset |
|---|---:|---:|---|
| Silver idle | 160 × 160px | 80 × 80px | (-40,-52) from fighter origin |
| Silver A3 roll | 160 × 160px | 112 × 112px | (-56,-65) from fighter origin |
| Sentinel A3 roll | 160 × 160px | 112 × 112px | (-56,-65) from fighter origin |

The companion renderer's shadow ellipse is centered at (0,+11px), radii (20,8). The A3 roll duration is **350ms** (170ms authoritative roll + 180ms recovery, unchanged). A2.9 does not edit the companion module or play combat; it samples atlas phases/directions for offline visual diagnostics.

## Real Chrome acceptance (Windows, 2026-10-20)

- Chrome 154.0.8037.99, viewport 1370 × 1060, DPR 1; three screenshots show real Silver idle, Silver A3 roll and T1 A3 roll against Red Lion with roof alpha / draw order.
- 36 original atlas frames sampled across four directions and three phases per clip, 12 samples per clip. No page/network errors.
- Bottommost sufficiently opaque alpha pixel, after exact PR #326 draw transform, relative to the **fighter world-center origin**:
  - Silver idle: **+18 to +20.5 px** across sampled frames.
  - Silver roll: **+10.6 to +22.5 px**.
  - T1 roll: **+13.4 to +41.4 px**.
- Three example screenshot states: Silver idle south frame 1 proxy +20px; Silver roll south frame 8 proxy +21.1px; T1 roll east frame 6 proxy +33px.
- These are **silhouette-bounding-box proxies**, NOT verified feet, ankle bones, ground contact locations, physical colliders, per-frame character foot pivots, camera match or gameplay animation continuity. A rolling silhouette can expose hands, cape or limbs below the actual contact position. Never automatically shift game actors or gameplay positions by these values.

Evidence is stored under assets/environment/greyhaven/a29-review. Sprite atlas binaries remain in companion PR #326; this PR only commits code and final rendered local QA screenshots/report, with source SHA-256 hashes.

## Release boundaries

- The 3/4 Red Lion art still cannot be globally world-registered against flat XY. The 0.84 zoom and art 40-world-units-per-meter remain unchanged.
- The A2.9 canvas is not a game map, server, combat scene, authoritative portal, hitbox test or FPS benchmark. Roof alpha is manual only. No automatically activated roof fading or correct player occlusion is claimed.
- PR #350 stays draft; PR #326 remains independently governed. No source GLBs/Blender knight files copied, no licensing claims beyond the original companion source provenance.
- Before real opt-in game integration: identify true anatomical feet/pivot from rig/source and projection, test A3 motion/roof sorting against actual server-authoritative player coordinates and doors, and benchmark real online Chrome/Firefox/mobile FPS/VRAM.
- Required GitHub exact-head CI must fully pass and base be current before any merge. No production deployment without separate explicit authorization.
