# 🌕⚡️🚀 Graphics 3B P0 — original WebP versus complete World module graph/resource transport
**21 October 2026 · Moon Games First Playable #480 · X230i low-end blocker raised by Graphics 3C #419 P34/P35.**
**Read-only browser diagnostic; does not implement gameplay, change WebPs, assert 60 FPS, or approve X230i performance.**
## Evidence and reason for test
Graphics 3C's original source-pinned X230i Chromium 152 full World #493 + Graphics 3B #508 art review recorded `net::ERR_INSUFFICIENT_RESOURCES` while loading the original **2,682-byte sword WebP** and logged no `draw:begin`. In contrast, 3C's isolated X230i original rack and sword WebP tests decoded both sequentially and concurrently in minimal pages: rack 42/28 ms and sword 24/29 ms. This does NOT prove a malformed sword image, lack of memory, or a Graphics 3C terrain cost. See 3C [P34](https://github.com/tehki/myaso/blob/8a470d914db834dc4acbbd997a52ff55502e05d9/docs/art/GRAPHICS_3C_P34_X230I_FIRST_FRAME_DIAGNOSTIC.md) and [P35](https://github.com/tehki/myaso/blob/8a470d914db834dc4acbbd997a52ff55502e05d9/docs/art/GRAPHICS_3C_P35_ORIGINAL_WEBP_ISOLATION.md) for independent original low-end evidence.
To distinguish image loading from full 3B/World module-graph pressure and first-frame draw cost, this 3B branch adds a **repeatable localhost-only 3-condition comparison**:
- **minimal:** one small inline HTML script; load both original 3B WebPs concurrently, verify original dimensions and await each `Image.decode()`; NO World/3B source graph or Canvas.
- **graph:** browser-import the **actual original World #521 authored renderer, authored map and four socket module**, original 3B Blender WebP art constants, original rack-to-world projection bridge, alpha sampler and presented-frame painter. THEN load/decode the same two source images. NO draw.
- **draw:** exactly the same complete module graph and image fetch/decode, followed by either **one** or **six** real World tiles + four separately painted original 3B sword WebPs through the original 3B completed-frame painter, game zoom 0.84. Only synthetic labels `ART-ONLY-NO-SERVER` in the test.
All scripts use an explicit localhost route allowlist and `Cache-Control: no-store`, record real Puppeteer request failures, each HTTP response, browser resource timing entries, image begin/onload/decode stages, World-draw begin/complete, Node wall time and original exact SHA source identities. Original World #521 Git HEAD is pinned `3178b9aad8757ceb3594ff04b9e3099dced6b729`; Graphics branch must descend from the original #547 exact `40112c3d3f0eeeb441a3206beba7c5d21e292852`. No original source/renderer/asset changed.
Original Blender image SHA-256s are immutable: rack `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8` 240×166 and sword `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31` 42×115. These are exactly the original images used by 3C P34/P35, not lightweight substitutes.
## Real Windows Chrome and Firefox measurements
Actual authorized Windows Machine, **Chrome 154.0.8037.99**, **Firefox 153.4.0**, two independent browser pages per condition per browser, one real draw if applicable:
| Engine | Run | Minimal load+decode wall | Complete graph+images wall | Complete graph+one original World/3B draw wall | One Canvas draw duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chrome | 1 | 169 ms | 164 ms | 197 ms | 32.9 ms |
| Chrome | 2 | 111 ms | 127 ms | 199 ms | 31 ms |
| Firefox | 1 | 463 ms | 413 ms | 465 ms | 78 ms |
| Firefox | 2 | 175 ms | 323 ms | 1005 ms | 556 ms |
**12/12** modes/engine/repeat cases reached `DONE`; none reported a failed image request, JS page error or HTTP >=400. The full graph made **13 real browser responses in Chrome / 14 in Firefox** vs minimal **3 / 4**, including original image requests. The images decoded on the original full graph in both engines, on this host. Note that **556 ms Firefox first draw** signals variability and is not acceptable 60 FPS evidence, nor proof of a stable regression cause.
A separate **six-original-draw** budget sampled each condition once per browser:
| Engine | Minimal wall | Full graph+images wall | Full graph+six draws wall | Six consecutive Canvas draw durations (ms) |
| --- | ---: | ---: | ---: | --- |
| Chrome | 166 ms | 172 ms | 217 ms | 35.7, 0.5, 0.4, 0.4, 0.4, 0.4 |
| Firefox | 299 ms | 383 ms | 550 ms | 80, 29, 9, 15, 7, 8 |
All **6/6** six-budget pages finished with original images decoded and no reported errors. Cached-world timings differ from the full first-draw timing and neither represents moving-camera frame time, network behavior, realistic GPU usage or low-end host acceptance. No screenshot/Canvas readback included. The resource timing output is diagnostic only.
## Reproduce with the same source head
Script: `tools/art/diagnose_armory_module_graph_resource_p0.mjs` plus original `web/armory-p0-graph-load-probe.html/.mjs`. The script expects an independently pinned World #521 worktree and uses source from this graphics branch itself. No extra packages installed in the game:
```bash
# X230i/Linux bounded Chromium-only test — needs existing Puppeteer module
P0_GRAPH_ENGINE=chrome P0_GRAPH_REPEAT=2 P0_GRAPH_DRAWS=1 \
  CHROME_EXECUTABLE=/usr/bin/chromium \
  PUPPETEER_MODULE_URL=file:///path/to/puppeteer/lib/puppeteer/puppeteer.js \
  node tools/art/diagnose_armory_module_graph_resource_p0.mjs \
  /pinned/world521/checkout /tmp/armory_graph_lowend_one_draw.json

# Follow-up only after one-draw source fetch and decode succeed:
P0_GRAPH_ENGINE=chrome P0_GRAPH_REPEAT=1 P0_GRAPH_DRAWS=6 \
  CHROME_EXECUTABLE=/usr/bin/chromium \
  PUPPETEER_MODULE_URL=file:///path/to/puppeteer/lib/puppeteer/puppeteer.js \
  node tools/art/diagnose_armory_module_graph_resource_p0.mjs \
  /pinned/world521/checkout /tmp/armory_graph_lowend_six_draw.json
```
The original X230i P34 repro tested **World #493**, whereas this new branch source-pins **the newer World #521 consolidated source**. This is a meaningful source version distinction and results must not be called strict reproduction of P34 until the team also tests the exact #493 graph on that host. Further tests must preserve page/module/asset details and report Chrome version, host resource budget, `ERR_INSUFFICIENT_RESOURCES` and how many image/decode/draw markers completed. No guessing root cause from one transport error.
## Handoff / strict blocker discipline
**On Windows only**, the full graph did not trigger the X230i resource error. **X230i retest is NOT DONE by 3B**; the 3C team owns the X230i independent low-end browser run and may run the portable harness with controlled conditions. No data supports changing source WebP encoding, globally disabling GPU, increasing Canvas cache, converting imagery, granting additional CPU or weakening mandatory CI as a fix. Original World/3B renderer and image bytes remain unchanged.
Other mandatory alpha gates still block integration: Core8B/Items2B one authenticated item writer/ID/receipt, Core8A network ACK, Core8C/World/Physics actual same-tick geometry and collision, UI/Combat single pointer gesture authority, Graphics3A authentic Silver animations and MainHand receipt, and real 4 independent browser clients. Parent Graphics #540 exact-head protected quality SUCCESS; source-only child #547 exact-head [quality #39605809932](https://github.com/tehki/myaso/actions/runs/39605809932) **FAILED original M151 guard-break punish FFA focus** (not assigned to Graphics without evidence). This new head must run its own protected full suite. No bypass, merge or deployment.
**Readiness: IMPLEMENTED diagnostic, Windows Chrome/Firefox TESTED; independent X230i acceptance BLOCKED; NOT INTEGRATION-READY, INTEGRATED OR PLAYABLE.**
