# Moon Games Graphics 3C P0 — World #493 + real Graphics 3B #508 armory art over Greyhaven materials

Date 2026-10-21 | Graphics Environment 3C | First Playable [#480](https://github.com/tehki/myaso/issues/480), pointer [#488](https://github.com/tehki/myaso/issues/488) | **Integration BLOCKED**

## P0 objective and verified source

This milestone is an **art-only real-browser composite acceptance** of existing separate draft source modules. It does not change runtime world, server, authority, networking, Combat, camera or sword/Blender source assets. The existing World-493 Blacksmith rack QA page from Graphics 3B [#508](https://github.com/tehki/myaso/pull/508) is served from its exact unmodified source checkout, with one controlled variant change: the authored city renderer comes either from the pinned original World #493 source or from this Graphics 3C branch, using the **same original World map, four fixture sockets, original 3B Blender rack/sword WebPs and 3B pointer-alpha visual planner** in both cases.

Pinned exact heads: World [#493](https://github.com/tehki/myaso/pull/493) `07060f981b8a1dac89184b621b6893dd970a08ae`; Graphics 3B [#508](https://github.com/tehki/myaso/pull/508) `2a11b923591a682bbae3cffe6d9f70b0d2036de8`; Graphics 3C environment renderer **capture head** `590f7a1809039aa9388f46351f2a873a95c3a55b`. Script verifies real Git HEAD and source hashes, serves only an explicit localhost allowlist of exact JS/image files, and performs no external HTTP calls or live game interactions.

All sample sword labels begin `ART-ONLY-NO-SERVER`: they are deliberately synthetic QA presentation inputs in Graphics 3B's unchanged official source-art review, **not** authentic server-owned item IDs. No pickup requests, inventory updates, attack suppression, local gameplay armory activation or connected players are involved.

## Windows actual Chrome and Firefox

| Real browser | Original World tile cache | Graphics 3C tile cache | Changed background/composite pixels | Fully opaque 3B sword-core pixels identical |
| --- | ---: | ---: | ---: | ---: |
| Chrome 154.0.8037.99 | 6 tiles | 6 tiles | 67,056 of 409,600 | 1,136 of 1,136 |
| Firefox 153.4.0 | 6 tiles | 6 tiles | 67,705 of 409,600 | 1,136 of 1,136 |

Every case loaded the same four pinned 3B original lossless WebP sprites on actual World #493 sockets. Both real browser engines performed native opaque-sword pointer clicks returning **one art-only visual candidate**, and clicks inside the same sword-image rectangle but on a fully transparent source pixel returned **null**. All four cases had **zero HTTP and uncaught JS page errors**. Canvas 640×640 with original 3B review page viewport 1100×880 at DPR1. All browser source images are preserved: `assets/environment/greyhaven/3c-p32-composite-review/`.

Pixel comparison is independent of the pointer acceptance. `tools/art/verify_p0_armory_sword_opaque_pixels.py` opens both actual 640×640 browser Canvas PNGs per engine and verifies scene pixel differences. For each sword it selects only destination pixels derived from a **5×5 fully-alpha-255 core neighborhood in the original 3B sword source WebP**, shielding against subpixel bilinear mixing at the edge; **all 1,136 screened core pixels match exactly in Chrome and in Firefox**. This proves 3C street materials and lamp painting did not overpaint the opaque sword interiors in this fixed QA scene; it does **not** prove perfect click accuracy under camera movement, CSS scale, GPU composition, final actor occlusion or real gameplay.

Original WebP SHA256 (sword): `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31`. Original Blender rack SHA256: `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8`.

The World-only vs 3C screenshots show visible deterministic street stone/cobble and ground-verge materials with the 3C practical Blacksmith lamp remaining **behind** the four actual-source rack sword image sprites. Rendering the rack and swords is handled by Graphics 3B, not by 3C. Source art and color palettes are **not** final 3A character-composite acceptance.

## Reproduction

With exact pinned source worktrees on the same authorized machine:

```bash
GRAPHICS_3C_EXPECTED_HEAD=<verified-3c-commit> \
CHROME_EXECUTABLE=/path/to/chrome \
FIREFOX_EXECUTABLE=/path/to/firefox \
PUPPETEER_MODULE_PATH=/path/to/installed/puppeteer \
node tools/art/verify_p0_armory_graphics3c_composite_browser.mjs \
  /absolute/path/to/world493-checkout \
  /absolute/path/to/graphics3b508-checkout

python tools/art/verify_p0_armory_sword_opaque_pixels.py \
  /absolute/path/to/graphics3b508-checkout \
  assets/environment/greyhaven/3c-p32-composite-review/p32_original_source_composite_browser.json \
  assets/environment/greyhaven/3c-p32-composite-review/p32_opaque_sword_core_review.json
```

The browser harness defaults to Chrome+Firefox. Set `P0_QA_BROWSERS=chrome` on an independent Linux machine without Firefox for additional cross-machine Chromium evidence; it still does **not** claim an independently connected game client. The optional Python pixel check uses installed Pillow or an installed ImageMagick RGBA decoder fallback and is **not** a mandatory CI/package dependency. A single-engine Linux run is labeled separately from the full Windows Chrome+Firefox two-engine acceptance. Chrome launch and Firefox launch settings are controlled by the explicitly requested browser engine, regardless of GPU flags (fixed in P2.13 QA harness after discovering a mis-bound `else` in the optional GPU path). On X230i, Chromium's CDP screenshot capture can time out even after source readiness, including with GPU disabled: `P0_QA_NO_SCREENSHOT=1 P0_QA_DISABLE_GPU=1 P0_QA_BROWSERS=chrome` runs explicitly labeled **Canvas 2D RGBA pixel-readback FNV32 + native visual-candidate gesture smoke only**. It creates no screenshot and cannot satisfy the independent image/visual-performance gate. The initial X230i full screenshot retry failed with CDP `Page.captureScreenshot timed out`, and the RGBA-readback retry failed with `Runtime.callFunctionOn timed out`; neither is a passed low-end visual check. For focused host diagnostics, `P0_QA_LIGHTWEIGHT=1 P0_QA_DISABLE_GPU=1 P0_QA_BROWSERS=chrome` skips BOTH screenshot and RGBA readback and tests only original source readiness, visible-art metadata, and native visual-only pointer gestures. It reports `ART_ONLY_SOURCE_AND_GESTURE_SMOKE_NO_PIXELS` and must never be presented as a visual pixel or frame-rate pass. Mandatory quality gets only `node --check` for the new harness. All prior World/3C tests and strict Combat/Rust protections remain unchanged.

## Known integration blockers

- World #493 is **draft**, not in main. Original 3B #508 is **draft** stacked on original 3B #500; UI #512 separately verified original hardened pointer gesture, but neither it nor real item presence is wired into the online game.
- The visual review's `ART-ONLY-NO-SERVER` items are illustrative and must not be confused with a committed Core/Items item snapshot; no authoritative 4-player sword rack exists yet in a running game.
- World/3B's QA midpoint rack origin is a **presentation derivation** from World-authority-free fixture coordinates. Server zone, trusted map revision, current worker epoch and canonical unique item IDs remain Core/World/Items integration responsibilities; 3C cannot mint them.
- Exact Graphics 3C previous-head [quality #39583040116](https://github.com/tehki/myaso/actions/runs/39583040116) **FAILED** protected M194 browser guard-break, nested M34 staging observed unblocked 34 HP. No Combat code or test is modified in this QA work.
- Full GPU frame budget/Firefox four-player performance, 3A actor/in-hand weapon animation, real final-game actor/roof depth, server-authoritative pickup and fist/sword combat have not passed. Existing `world=0` fallback remains mandatory.

**Classification: IMPLEMENTED art presentation (3B) + TESTED Graphics 3C cross-source compatibility only. INTEGRATION-READY: NO. INTEGRATED: NO. PLAYABLE: NO.** Keep Graphics [draft PR #419](https://github.com/tehki/myaso/pull/419) unmerged, no production deployment, and coordinate World/Core/Graphics/Combat/Items/UI acceptance through Development Center #360.
