# Graphics 3C P0 — Original Graphics 3B WebP minimal-load isolation

**2026-10-21 | First Playable Alpha | Graphics 3C QA ownership | NOT an approved integrated browser/gameplay test**

## Why this matters

Prior pinned original-source X230i Chromium World #493/Graphics 3B #508 art review emitted `net::ERR_INSUFFICIENT_RESOURCES` while fetching the original 2,682-byte sword WebP **before any world draw**. The reference [P34 source/first-frame diagnosis](GRAPHICS_3C_P34_X230I_FIRST_FRAME_DIAGNOSTIC.md) retained the error report; it did **not** prove a malformed sword WebP, inherent WebP codec incompatibility or a Graphics 3C terrain problem.

This new P35 test performs the narrowest follow-up: load and decode the **original, SHA-256 verified** Graphics 3B first-party `armory_rack.webp` and `armory_sword.webp` over a localhost-only minimal HTML page, **without** the World map, 3B rack planner, 3C terrain, Canvas, game, server or combat. It offers controlled `P0_QA_IMAGE_LOAD_MODE=sequential|parallel`; `parallel` starts both images before awaiting their load/decode completion, analogous to the original 3B review's `Promise.all`. The script is optional test-only and writes explicit JSON. No repository asset, in-game performance budget or World/Combat authority was changed.

**Exact pinned 3B source:** [PR #508](https://github.com/tehki/myaso/pull/508), `2a11b923591a682bbae3cffe6d9f70b0d2036de8`. Original WebP SHA-256:
- rack `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8` (15,428 bytes, 240×166);
- sword `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31` (2,682 bytes, 42×115).

## Observations (real Chrome/Chromium on independent hosts)

| Browser | Image mode | Rack image decode | Sword image decode | Result |
|---|---|---:|---:|---|
| Windows Machine Chrome 154.0.8037.99 | sequential | 14 ms | 12 ms | Both loaded/decoded |
| Windows Machine Chrome 154.0.8037.99 | concurrent `Promise.all` | 17 ms | 17 ms | Both loaded/decoded |
| Linux X230i Chromium 152.0.7977.82 | sequential | 42 ms | 24 ms | Both loaded/decoded |
| Linux X230i Chromium 152.0.7977.82 | concurrent `Promise.all` | 28 ms | 29 ms | Both loaded/decoded |

All four reports have `status=IMAGES_DECODED`, original asset hashes and their actual `naturalWidth`/`naturalHeight`. The first sequential experiments had **only an incidental favicon HTTP 404** (unrelated to rack/sword assets); the updated concurrent probe deliberately returns an empty 204 for the favicon and has **zero browser request errors** on both hosts.

Actual JSON evidence in `assets/environment/greyhaven/3c-p35-review/`:
`windows_original_webp_load.json`, `windows_parallel_original_webp_load.json`, `x230i_sequential_original_webp_load.json`, `x230i_parallel_original_webp_load.json`.

**Interpretation:** original rack and sword WebPs are loadable and decodable on X230i, sequentially **and concurrently**, in minimal Chromium. The earlier **original full World/3B review remains failed** on X230i with `ERR_INSUFFICIENT_RESOURCES`. Thus it is **not** a deterministic original-asset corruption problem or a simple unconditional failure of concurrent WebP decode. It may involve Chromium request/resource pressure, module runtime interaction, browser context, or an intermittent OS/browser condition. The cause is not established. Since that original error happened before any `world.draw()`, Graphics 3C's own terrain/lights cannot be identified as its cause from this evidence.

## Repeatable isolated test

```bash
# Checkout 3B #508 at exact pinned SHA into independent read-only worktree.
P0_QA_IMAGE_LOAD_MODE=sequential \
CHROME_EXECUTABLE=/path/to/chrome \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/verify_lowend_armory_webp_load_p0.mjs /path/to/3b508-worktree /path/to/sequential-report.json

P0_QA_IMAGE_LOAD_MODE=parallel \
CHROME_EXECUTABLE=/path/to/chrome \
PUPPETEER_MODULE_PATH=/path/to/puppeteer \
node tools/art/verify_lowend_armory_webp_load_p0.mjs /path/to/3b508-worktree /path/to/parallel-report.json
```

The script asserts exact Git source commit and WebP SHA-256; no external network calls, no screenshot/Canvas readback or image replacement, and no extra runtime package installed. Mandatory Graphics quality checks only run `node --check` for this optional QA script, not the offline multi-host browser probe.

## Coordination / integration HOLD

- Graphics 3B should next isolate loading original rack/sword WebPs **with the exact original imported 3B/World module graph** and run a few repeated low-end attempts to determine if the original full-review error is intermittent, module-sensitive or browser-resource-sensitive. Instrument resource timing/errors separately from original `world.draw`. Do not change asset encoding or grow world cache based only on the observed 404 or one Chromium error.
- World #521 documents the presentation-only rack midpoint `(3800,4038)`; Core/Items still own live item ID, authoritative zone/version/fence and replication. Graphics 3B #529 supplies a separate complete-Canvas-frame source-art painter; no full online integration demonstrated here.
- Graphics 3C remains read-only to World/Items, keeps the existing `world=0` fallback, and will validate genuine integrated moving-camera/actor/sword depth and low-end budget only on an orchestrator-approved candidate.
- **Exact-head protected CI predecessor [#39601666919](https://github.com/tehki/myaso/actions/runs/39601666919) FAILED mandatory M34/M193 guard-break exchange**: the second attack was **parried rather than reducing guard by 38**, according to server `M201_AUTH_PARRY` and browser feedback. This is a real strict acceptance failure to be diagnosed by Combat/Core. This graphics QA tool does not alter protected Combat, network or input scripts.

**Readiness: isolated WebP decode TESTED; original full Linux source review BLOCKED; four-human First Playable M1–M5 BLOCKED.** PR [#419](https://github.com/tehki/myaso/pull/419) must remain DRAFT; no merge/deploy/GO without central authority.
