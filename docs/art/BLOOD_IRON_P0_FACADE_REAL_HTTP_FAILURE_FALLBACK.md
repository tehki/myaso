# 🌕⚡️🚀 Graphics 3B P0 — fail-closed original Red Lion facade asset readiness

**Moon Games myaso.io · 21 October 2026 · draft child of Graphics #570.**

## Verified failure and source contract

World #521 SHA `3178b9aad8757ceb3594ff04b9e3099dced6b729` permits replacement only for `red-lion` through its own `normalizeWorldBuildingReplacementIds`. Graphics 3C P37 #419 exact `efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac` requires that exact callback to suppress the tiled placeholder. Graphics 3B original A2.31 #466 exact `0cbf33adf70beda55b8fcb8bef4ba2efb36084e5` supplies genuine editable-Blender-derived day/dusk facade 228×297 lossless WebPs and unchanged A2.26 original 238×197 roof.

Earlier source review #570 proved successful source rendering but never actually failed an image request. Graphics 3C P38 separately demonstrated a missing-art *chosen fallback scene*, rather than genuine HTTP/decode failure. A real browser can fail one of the three requests before a full city frame is ready. If the renderer creates cache tiles with `red-lion` removed before its image actually decodes, the city can show a blank building indefinitely.

## New Graphics-owned pure presentation helper

`src/browser/red-lion-original-art-readiness.mjs` exports `prepareRedLionSourceArt({paths,loadImage,origin})` and `createRedLionArtGatedWorldPainter({art,createRenderer,worldReplacementValidator,options})`. The first starts all three original facade/roof image decodes, then accepts only complete source dimensions and exact same-origin, queryless configured source URLs. Missing/decode-failed/wrong-sized/wrong-URL/foreign-origin images return an immutable `status:'unavailable'` **without constructing or modifying any World renderer**. This is a visual source-shape/path check, **not cryptographic content integrity verification**; original source file SHA verification is performed in the independent QA harness.

Only a complete `status:'ready'` art set authorizes Graphics 3C's `createAuthoredWorldRenderer` with `replacedBuildingIds:['red-lion']` AND World 9's injected validator. With unavailable art, Graphics 3C is created with `replacedBuildingIds:[]`, keeping the original cached building. The helper checks the returned renderer actually used the requested replacement list, and fails closed on omitted World validator or caller-injected duplicate replacement options. It does not create or mutate any World/3C implementation, no gameplay collider, door, portal or authoritative data.

**Limit:** The helper decides cache construction BEFORE a frame. It cannot atomically undo an already partially drawn Canvas frame or recover from an image-loss after a renderer is activated. The integration caller must recreate/cache a default painter and redraw the whole frame if future Canvas errors occur. No production game client uses this helper yet.

## Native Chrome and Firefox source-failure verification

`tools/art/verify_p0_real_facade_http_failure.mjs` pins original World #521 / 3C P37 / 3B A2.31 source Git HEADs and the SHA256 original day `f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0`, dusk `4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3`, and frozen roof `f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1`. Sources are read-only local exact worktrees exposed by a route-allowlisted loopback HTTP server, without modifying them.

The harness runs **three independent cases in both real Chrome 154 and Firefox 153.4**: (1) original WebPs all HTTP200/decode, (2) QA-only actual HTTP503 for the *day image request*, (3) QA-only actual HTTP503 for the *roof image request*. The error cases are deliberately simulated on the localhost QA server and **not** evidence of a genuine X230i browser failure. Each browser paints the actual 3C World backdrop twice: a default World placeholder scene and the Graphics-readiness-selected scene, then compares real 640×640 RGBA source pixels:

| Native case | Chrome original-placeholder pixel difference | Firefox difference | Approved named replacement |
| --- | ---: | ---: | --- |
| All source WebPs loaded | 63,162 | 63,305 | `['red-lion']` |
| Day image HTTP503 | **0** | **0** | `[]` |
| Frozen roof HTTP503 | **0** | **0** | `[]` |

All six genuine browser cases completed with **zero JS page errors**. The two failure cases per browser record exactly one expected localhost HTTP503 each and no faceless building. The success case retains the actual Blender facade and original unchanged roof. Four forced failures correctly avoid replacement. Source-authentic screenshots and complete machine report: `assets/environment/greyhaven/armory-p0/facade-fallback-review/original_red_lion_art_ready_or_placeholder.json` and `red_lion_art_gating_{chrome,firefox}_{normal,fail-day,fail-roof}.png`.

**49/49 cumulative local P0 Graphics Node tests PASS**, seven new (including fake wrong-dimension/URL/tainted-image shape, missing World validator, dishonest downstream renderer and the real native-browser report). Existing protected Combat tests are untouched.

## Strict release HOLD

Parent [Graphics #570 quality #39618128655](https://github.com/tehki/myaso/actions/runs/39618128655) **FAILED protected mandatory M107 real heavy counterplay**. Root cause is not established and this Graphics-only diagnostic must not mask, waive or misattribute that failure. This new head requires complete protected quality, independent Art Director/World/3C review, and central integration of its readiness seam into the actual game renderer before any real release.

World/3C/3B dynamic actor/facade/roof depth and original 3C sconce placement still require live validation. Core8B/Items2B canonical single sword writer, UI+Combat single physical sword pixel/LMB arbitration, 8A/8C authenticated four real client sessions, physics/LOS, held Silver Knight animations, X230i graphics resource reliability, and real four-player City→Armory→unarmed/sword PvP→respawn remain **not accepted**. No merges, deployments, backend, UI, Combat, authoritative World or original Blender/WebP source edits.

**Readiness: IMPLEMENTED/isolated original-source TESTED; INTEGRATION-READY BLOCKED; NOT INTEGRATED OR PLAYABLE.**
