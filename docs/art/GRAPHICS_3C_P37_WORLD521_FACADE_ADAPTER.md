# Graphics 3C P0 — Canonical World #521 facade-replacement compatibility

**Moon Games / myaso.io First Playable Alpha**
**Date:** 2026-10-21
**Ownership:** Graphics 3C environment renderer, **not** World geometry, gameplay, network, Combat, item authority or facade asset ownership.
**Readiness:** IMPLEMENTED / source-and-browser TESTED; **INTEGRATION-READY BLOCKED**, NOT INTEGRATED, NOT PLAYABLE.

## Real P0 integration problem

The original consolidated World 9 [draft PR #521](https://github.com/tehki/myaso/pull/521), exact SHA `3178b9aad8757ceb3594ff04b9e3099dced6b729`, adds a World-owned presentation contract in `src/world/building-presentation.mjs` and an opt-in `replacedBuildingIds` option in its authored-world renderer. The only World-approved replacement is currently `red-lion`: a separately drawn real facade must not also show the cached authored placeholder. The Blacksmith `smith` is **not** replaceable under this contract; it must remain available beneath the physical four-sword rack from Graphics 3B.

Graphics 3C [draft #419](https://github.com/tehki/myaso/pull/419) is stacked on *older* World #336 and previously painted every authored building unconditionally, so an orchestrator integration that simply substituted 3C's ground painter for World #521's painter would **lose opt-in World placeholder suppression** and risk duplicate Red Lion art.

## Minimal Graphics 3C source change

`src/browser/authored-world-renderer.mjs` now exposes an **optional injection seam**:

```js
import {normalizeWorldBuildingReplacementIds} from "./world/building-presentation.mjs";
// Only after the Main Orchestrator has staged original World #521:
const worldPainter=createAuthoredWorldRenderer({
  replacedBuildingIds:["red-lion"],
  worldReplacementValidator:normalizeWorldBuildingReplacementIds
});
```

This is a **documented integration example**, not shipping runtime wiring. The actual module path depends on the integration caller's location. Graphics 3C **does not copy or redefine** `WORLD_ALPHA_REPLACEABLE_BUILDING_IDS` or the canonical World validator. If no replacement is requested, the previous default canvas drawing is unchanged. A nonempty replacement without an injected World validator, a non-array or duplicate/invalid normalized output, or an unsupported ID fails closed. The returned `renderer.replacedBuildingIds` is an immutable snapshot at cache construction time; changing building art requires a new renderer/cache. Only the World-approved *authored building placeholder paint call* is omitted **at original tile-build time**, not erased later with a background-colored rectangle. Greyhaven road/terrain, portal ring, walls, 3C lamps, World coordinates and collision are unchanged. This is a **visual-only** change.

**Important:** World #521's renderer accepts the canonical `replacedBuildingIds` without an extra callback because it already imports its own validator. Our older-parent 3C renderer deliberately requires the callback for any nonempty request, so **the Main Orchestrator must wire it at the combined branch integration boundary**. No silently accepted untrusted list, duplicated World module or release-mode fallback. The independent World module itself must be part of the centrally approved candidate first.

## Actual source + genuine browser acceptance

The optional [source-pinned real-browser verifier](../../tools/art/verify_p0_world521_3c_building_replacement_browser.mjs) imports the **actual** World #521 `building-presentation.mjs` and byte-identical authored map from an independent exact-head Git worktree and real Graphics 3C environment renderer. HTTP routes are localhost-only and source-allowlisted. Original World source is not edited. The test uses genuine Chrome and Firefox 2D Canvas pixels with a fixed 640×480 backing Canvas, 1× zoom, and newly constructed 3C tile caches for four scenes per browser: Red Lion default, World-approved Red Lion placeholder off, Blacksmith default, and Blacksmith with only Red Lion replacement enabled.

| Acceptance | Windows Chrome 154 | Windows Firefox 153.4 |
|---|---:|---:|
| Canonical World #521 validator imported from original source | PASS | PASS |
| Bad requests (missing validator, `smith`, duplicate Red Lion) rejected | PASS | PASS |
| Red Lion facade-placeholder suppression changes genuine Canvas RGBA pixels | **50,766** | **50,766** |
| Unrelated Blacksmith pixels changed | **0** | **0** |
| Tiles created in each four-scene sample | 6 each | 6 each |
| Browser HTTP/module and page errors | 0 | 0 |

The [Chrome original browser screenshot](../../assets/environment/greyhaven/3c-p37-world521-review/world521_red_lion_3c_chrome.png) and [Firefox original browser screenshot](../../assets/environment/greyhaven/3c-p37-world521-review/world521_red_lion_3c_firefox.png) present **art-only** adjacent before/after city panels; [JSON](../../assets/environment/greyhaven/3c-p37-world521-review/world521_3c_facade_pixels.json) holds immutable source hashes and measurements. The temporary Red Lion placeholder-free patch is transparent original terrain **waiting for 3B's real facade**, not the facade art itself. This browser test **does not render a real replacement asset**; no player, door/portal transfer, NPC, collision, sword/item, network or combat operation occurs.

Additional focused graphics unit tests `tests/graphics3c-world521-replacement.test.mjs` pass 4/4; the previous separate World/3C focused 24/24 tests are unaffected, **28/28 total** on authorized Windows Machine. The browser verifier and tests are source-checked by existing CI; no mandatory Combat/Rust quality gate is weakened. The World source worktree is local for this isolated acceptance only and should be removed after evidence is committed.

## Reproduction

```bash
GRAPHICS_3C_EXPECTED_HEAD=<current exact 3C test-capture SHA> \
CHROME_EXECUTABLE=/path/to/chrome \
FIREFOX_EXECUTABLE=/path/to/firefox \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/verify_p0_world521_3c_building_replacement_browser.mjs \
  /path/to/independent-exact-World-521-source \
  assets/environment/greyhaven/3c-p37-world521-review

node --test tests/graphics3c-world521-replacement.test.mjs
```

The verifier rejects any World source HEAD other than `3178b9aad8757ceb3594ff04b9e3099dced6b729`, and it compares original authored-map SHA256 to Graphics 3C's pinned map before rendering.

## Required central coordination

World #521, Graphics 3B art and the 3C material replacement must be combined under **one immutable official World validator** with compatible cache-creation options. Red Lion actor visual depth still needs real animated 3A actor and actual facade composite acceptance. Importantly, **Blacksmith is unaffected by this opt-in Red Lion replacement**, preserving the four-sword source-art scene previously proved under original World #493.

The complete **owner-mandated four-human City→four real authoritative sword pickups→fists/sword PvP→death/respawn** still has **NO** integrated acceptance. Core/Items/Physics approve zone, unit scale, canonical sword IDs, same-tick reach and LOS; UI/Combat own exact final-painted sword click and the one-LMB attack arbitration; Graphics 3B owns facade/rack/sword art; Graphics 3A owns complete Knight animations. The last PR #419 exact-head [protected CI #39605085694](https://github.com/tehki/myaso/actions/runs/39605085694) **FAILED** mandatory M150 FFA parry-punish. Combat/Core own that failure; no test bypass, silent fallback or release authorization. No merge/deploy by Graphics 3C.
