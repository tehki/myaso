# Blood & Iron A2.7 — isolated browser roof/wall review

**Status:** Tested locally in real Chrome, **not integrated into gameplay**, **not deployed**.

## Purpose and source boundary

The A2.6 per-building 3/4-view Red Lion, Gable Merchant and Blacksmith image layers have credible facades and independently cropped wall/base and roof WebPs. They do **not** agree with the authoritative game's flat-XY ground-plane projection (A2.4 measured 80.9 px error over a small area, and the A2.6 per-meter mismatch is 57–68 px). A2.7 adds a separate *art-only* preview page, rather than modifying the game:

    http://127.0.0.1:8080/web/greyhaven-a27-art-preview.html

Serve the repository root over a local HTTP server first. The page does not appear in the real game navigation, and no feature flag, collision, authoritative map, multiplayer state, network request other than loading same-origin art files, world sprite placement or A3 animations have been changed.

The viewer reads the A2.6 committed JSON manifest and six original lossless WebPs, validates their crop dimensions and composes each layer using the recorded **visual door-relative offsets**. The preview supports switching between Red Lion, Merchant and Blacksmith, manually changing roof alpha from 0 to 100%, showing/hiding an explicitly artificial test silhouette and drawing that silhouette either before or after the roof. The gold cross is **not** an authoritative door/portal or gameplay foot pivot. Its position represents only a centered Blender reference frame.

## Real browser acceptance

The optional test command, on a machine with a supported Chrome and Puppeteer package, is:

    CHROME_EXECUTABLE=/path/to/chrome PUPPETEER_MODULE_URL=file:///path/to/puppeteer.js node tools/art/verify_greyhaven_a27_browser.mjs /tmp/a27-review

The script serves the repository on a random localhost-only port, opens real Chrome, checks all three buildings' images and 100% roof opacity, changes the Blacksmith's roof to 25% alpha, tests draw ordering, resets, checks page/network errors, saves four actual 1220x960 DPR1 screenshots and a structured JSON evidence report. It is **optional**; the ordinary repository CI does not need Puppeteer or network/browser dependencies to run art unit tests.

### Evidence from Windows Machine, 2026-10-20

- Browser: Chrome 154.0.8037.99, local HTTP.
- WebPs decoded: **two per building**, no browser page errors or failed art requests.
- Cold per-building preview decode/load on that workstation: **Red Lion 19.0 ms, Merchant 15.7 ms, Blacksmith 20.7 ms**.
- Blacksmith manually selected **25% roof opacity**, displayed over and under test silhouette; reset to 100%.
- Encoded WebP pair byte sizes: **119,516 B / 102,048 B / 113,264 B** respectively (source A2.6 report).
- Canvas one-time draw times in the acceptance report are advisory and fluctuate; **these are NOT game FPS, decoded VRAM, or frame-pacing measurements**.
- Four screenshots and exact report committed under assets/environment/greyhaven/a27-review/.

## Remaining blockers before any opt-in *game* implementation

1. The A2.6 3/4 oblique projection remains incompatible with direct flat game XY placement; the preview only aligns a single **visual** door anchor. Correct per-building projection/placement has not been solved.
2. Actual player sprite foot pivots, interactive doors, interior portal authority, roof fades based on verified player positions and multiplayer depth ordering are **not implemented or validated**.
3. Quality/performance acceptance must use the real online browser game and measure Chrome/Firefox/mobile FPS, decode/VRAM, responsiveness and required combat suites. **M176 block/attack arbitration failed in required PR #350 quality CI #39439130029; do not weaken or bypass it.** Main has moved since the graphics PR's base SHA.
4. Owner aesthetic review of the visible game slice and a separate explicit production deploy authorization remain mandatory.

**Never merge PR #350 just because art screenshot or isolated Chrome preview succeeded. Keep it draft.**
