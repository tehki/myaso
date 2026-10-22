# 🌕🏰⚡️🚀 Graphics 3B — Red Lion late Canvas draw fail-closed preview

**First Playable Alpha / Greyhaven architectural reliability. QA ONLY.** This work is deliberately separate from the owner-approved **Pre-Alpha 0.1 existing Combat arena**; it does **not** alter the Alpha game client, original city painter, World, 3A/3C assets, Physics, Combat, WebTransport or authoritative item writer.

## Original source provenance

Based on graphics-safe [PR #575](https://github.com/tehki/myaso/pull/575), itself stacked on original World+3C/3B [#570](https://github.com/tehki/myaso/pull/570). All three external assets remain pinned and byte-identical:
- Original World #521 `3178b9aad8757ceb3594ff04b9e3099dced6b729`.
- Original Graphics 3C P37 `efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac`.
- Original Graphics 3B A2.31 Red Lion source `0cbf33adf70beda55b8fcb8bef4ba2efb36084e5`. Original frozen roof SHA256 `f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1` unchanged.

Parent #575 previously established browser fail-closed readiness at **original HTTP/decode stage**: bad day or frozen roof response preserves World placeholder. But if `CanvasRenderingContext2D.drawImage` fails AFTER art decoded and World replacement mode was selected, a naive single-surface canvas can produce a partially drawn Red Lion or blank building.

## New QA-only isolated full-frame mechanism

`src/browser/red-lion-atomic-frame-qa.mjs` exposes a bounded, injected original-size scratch buffer renderer. It paints the full detailed scene into a private scratch Canvas and calls the destination's final `drawImage` exactly once. On a detailed-frame exception after partially drawing the DAY facade, the partial scratch is discarded, and a brand-new scratch Canvas renders the **original World default placeholder** instead. Only that complete fallback scratch is copied to the visible QA canvas. If fallback itself fails, the helper propagates an error *before touching the destination*. There is no second roof, second named-building painter, optimistic item, fake SwordId, server state, or automatic production code path.

**Important technical limit:** this is a synchronous diagnostic demonstration of precommit scratch staging; a browser Canvas destination-compositing error itself can still fail, and no true atomic GPU presentation or zero-pop-in guarantee is claimed. Rendering the whole world into scratch every game frame is not an accepted runtime performance strategy. Real gameplay needs an owner-reviewed immutable predecoded texture and actual World/3C integration plan before activation.

## Reproduced real Chrome/Firefox result

The existing genuine native reviewer `tools/art/verify_p0_real_facade_http_failure.mjs` now adds the opt-in `?lateCanvasFault=1` case. The injected exception occurs **after one real facade WebP has decoded and begun drawing** in a scratch Canvas. This is an intentional QA-generated late draw fault, not evidence that Chrome or Firefox spontaneously threw during normal rendering.

Actual authorized Windows Machine with local original SHA-pinned source worktrees and real native Chrome/Firefox executed **eight conditions** (four per engine). Raw source/HTTP browser screenshots and exact report stored at:

`assets/environment/greyhaven/armory-p0/late-draw-fallback-review/`

| Browser | All original WebPs | Day HTTP503 | Roof HTTP503 | Late original facade draw throws |
| --- | --- | --- | --- | --- |
| Chrome | 63,162 RGBA pixels intentionally changed from original World building | **0** unexpected pixels; original placeholder intact | **0** | **0** |
| Firefox | 63,305 intentionally changed pixels | **0** | **0** | **0** |

The late-draw cases have **no HTTP error** and report `artReady=true`, `actualBrowserImageDecode=true`, `recoveredLateDrawError=true`, `replacementApplied=false`, `replacedBuildingIds=[]` and the genuine original World fallback pixel-exact. All eight actual browser cases had **zero page exceptions** in the harness; only the deliberately injected error was captured within QA staging. The original normal detailed facade still draws with exactly one approved named-building replacement.

Focused source behavioral tests include partial drawing, successful staging, unavailable art, fallback exceptions, malicious canvas input and compositor exception honesty. Node tests do not prove the live connected Greyhaven renderer.

## Integration gate / no premature activation

**Classification:** source TESTED, genuine isolated browser TESTED; **NOT LIVE CLIENT INTEGRATED; NOT GAMEPLAY OR DEPLOYMENT READY**. Before using scratch staging in the real 4-player game, Graphics 3B/3C/World must validate actual source composition at camera 0.84, old placeholder suppression once, 3C lantern once, 3A Silver actor depth at door/corner, frozen roof and original Red Lion portal, source HTTP/decode/drift, actual Chrome+Firefox frame timing/cross-machine X230i, complete visible HUD and all mandatory Combat/Core strict CI.

The owner wants **more stone, timber, windows, ironwork and believable facade lighting**, not roof cosmetic work. This reliability seam preserves earlier Blender architecture; it does not count as additional facade-detail art.

Central [#360](https://github.com/tehki/myaso/issues/360) retains all integration, merge and deployment authority. No Pre-Alpha arena scope expansion and no production changes.
