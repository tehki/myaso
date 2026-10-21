# Graphics 3C P0 — Original Red Lion art over World #521 with cached 3C terrain

**Moon Games · First Playable Alpha · 2026-10-21**

**Classification: IMPLEMENTED optional three-source browser QA / TESTED on Windows Chrome and Firefox only. NOT INTEGRATION-READY, INTEGRATED or PLAYABLE.**

## Why this matters

World [draft PR #521](https://github.com/tehki/myaso/pull/521) has the **canonical World-owned Red Lion facade replacement allowlist**, and Graphics 3C [draft PR #419](https://github.com/tehki/myaso/pull/419) now supports it only when the actual validator is supplied. Graphics 3B [draft PR #481](https://github.com/tehki/myaso/pull/481) owns independently authored **original Blender-derived 228×297 day/dusk facade WebPs and an unchanged 238×197 original roof**, with immutable source draw placements. Until these three are tested together, a missing facade, duplicate tiled placeholder or wrong sconce depth could make the city visibly unusable.

This P38 diagnostic uses exact independently pinned **source checkouts**:

- World #521: `3178b9aad8757ceb3594ff04b9e3099dced6b729`.
- Graphics 3B #481: `c107f613c2f646e99693bc0af0f76ba4795c5364`.
- Graphics 3C renderer: exact PR #419 commit recorded in browser JSON.
- Original 3B WebP SHA-256 day `f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0`, dusk `4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3`, roof `f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1`.

All original byte hashes, original authored map equivalence, source heads and original 3B immutable artist-facing geometry are checked in the isolated browser harness. Both independent sources are imported **read-only via explicit localhost allowlist**, not merged or rewritten.

## Browser composition and fallback

`tools/art/verify_p0_world521_3b481_3c_facade_browser.mjs` draws the fixed **original World map** through **3C's actual cached world renderer** at the authentic UI presentation zoom `0.84`, then draws the original 3B screen-space facade and original roof in that artist-owned order. It awaits all three original WebP decodes **before** instantiating the World-approved placeholder-suppressed renderer. World owns the override permission; 3B owns asset positions and shapes; 3C owns the one static sconce/light and cached ground.

The same online-like 640×480, zoom `0.84`, centered camera at `(4365,4035)` gives these four actual screenshot panels: (1) default original Red Lion placeholder, (2) original daytime facade + historical unchanged roof with World placeholder off, (3) dusk facade + unchanged roof with World placeholder off, (4) **simulated unavailable-art fallback** with the World placeholder ON. The fallback panel deliberately chooses the default painter on missing-art state; it does **not** trigger or prove a real failed network request, and **does not implement fallback in `web/online-game.mjs`**. A real release must verify failure handling and facade lifecycle in the actual app.

| Real browser pixels, 640×480 | Windows Chrome 154 | Windows Firefox 153.4 |
|---|---:|---:|
| Default placeholder vs original daytime facade | 63,223 | 63,367 |
| Original day vs original dusk facade | 24,061 | 24,062 |
| Default placeholder vs simulated missing-art fallback | **0** | **0** |
| World chunks cached in original/replaced painter | 6 / 6 | 6 / 6 |
| Page JS/HTTP errors | **0** | **0** |

Browser result JSON with pinned source SHA-256 and exact commit:
`assets/environment/greyhaven/3c-p38-three-source-review/world521_3b481_3c_art_composite.json`. Genuine browser screenshots:
`red_lion_3c_world521_3b481_chrome.png` and `red_lion_3c_world521_3b481_firefox.png`.

The original World-authored entrance `(4365,4060)`, original 3B artist door `(4365,4075)` and original 3C sconce `(4365,4045)` remain **three intentionally different coordinates**; no collision, portal, reach, LOS or gameplay coordinate is modified. This proof has **zero actors, zero swords and zero pickup requests**. No real 3A Knight/3B roof occlusion has yet been verified, and no day/night server protocol is activated.

## Reproduction (offline, source-exact)

```bash
# Three checked-out SHA-exact sources, with Chrome/Firefox and Puppeteer installed
GRAPHICS_3C_EXPECTED_HEAD=<pinned 3C head used at capture> \
CHROME_EXECUTABLE=/path/to/chrome \
FIREFOX_EXECUTABLE=/path/to/firefox \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/verify_p0_world521_3b481_3c_facade_browser.mjs \
  /path/to/world521-exact-source \
  /path/to/graphics3b481-exact-source \
  assets/environment/greyhaven/3c-p38-three-source-review
```

No external network calls, no change to original Blender/WebPs or source worktrees, no new production module, app service, timer or server. Only an **additive syntax check** for this optional visual QA tool in protected CI. Existing 28 focused Graphics/World tests and all mandatory Rust/Chrome/Firefox/Combat gates remain unchanged.

## Required Main Orchestrator contract

When the official integrated game is ready, require **one** World-owned validated replacement mode, only when the correct, decoded 3B original art is ready; retain original World placeholder otherwise. Compose actors/facade/roof through an explicit approved depth order with 3A animations; verify the 3C sconce does not double-add 3B glow and that a real Red Lion portal remains authoritative to Core/World. Avoid silently changing `world=0` rollback, built-in collision, original road tile geometry or combat HUD. Implement this only in the centrally chosen and fully protected integrated branch, **not** via this test demo.

Original Red Lion three-way composition is **not a substitute** for the owner-required four independent players simultaneously in Greyhaven, four canonical ground swords with exact server-owned pickup, unarmed/fist combat, equipped-sword PvP, death and reconnect. X230i Chromium's earlier original full-review `ERR_INSUFFICIENT_RESOURCES` remained unresolved; the present browser tests were performed on authorized Windows only. The prior Graphics 3C exact-head protected #39615113709 reported an M205 Combat acceptance failure, requiring independent diagnosis. **No merge, deployment or release GO** from Graphics 3C.
