# 🌕⚡️🚀 Graphics 3B P0 — exact World #493/#521 source-request bisection

**21 October 2026 · myaso.io First Playable #480 · 3B draft child of #550.**

## Why this is a critical low-end graphics diagnostic

Graphics 3C's original X230i Chromium 152 source-pinned World #493/3B #508 QA recorded `net::ERR_INSUFFICIENT_RESOURCES` first on the original sword WebP request, and in a later repeat on **four original JS module requests**: `alpha-armory.mjs`, `authored-maps.mjs`, `armory-world493-visual-bridge.mjs`, and `armory-rack-visual.mjs`. Both runs failed **before a World draw**. The same X230i decoded both original WebPs in minimal sequential and concurrent experiments (3C P35). This rules out a proven deterministic corruption of the original WebP, but does not prove a specific Chromium/OS/resource root cause or fix.

This 3B continuation narrows the source graph under test. Unlike the earlier #550 comparison (consolidated World #521 only, minimal vs all modules), the new harness explicitly accepts **either exactly original World #493 or exactly consolidated World #521**. It rejects all other World revisions and preserves byte-identical original files.

## Five controlled original-source conditions

| Mode | Browser imports before loading both original WebPs | World draw |
| --- | --- | --- |
| `minimal` | no source modules | none |
| `world` | authentic pinned World `alpha-armory`, authored maps and Canvas renderer | none |
| `graphics` | authentic 3B armory renderer bridge, source art constants, original alpha sampler and painter | none |
| `graph` | both complete original World and Graphics imports | none |
| `draw` | both complete original World and Graphics imports | one or six actual World/3B draws |

The same original Blender-derived `armory_rack.webp` (240×166, SHA256 `83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8`) and independently alpha-separated `armory_sword.webp` (42×115, SHA256 `795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31`) are fetched in all modes. No copy, alternate image, recompression or renderer source mutation occurs. Browser requests run over loopback only from an explicit path allowlist.

The exact World #493 head is `07060f981b8a1dac89184b621b6893dd970a08ae`, original renderer SHA `db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9`. Consolidated World #521 is `3178b9aad8757ceb3594ff04b9e3099dced6b729`, renderer SHA `2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a`. The original armory source and authored map SHA files are independently pinned and shared across both heads. 3B branch ancestry must include the exact parent #547 `40112c3d3f0eeeb441a3206beba7c5d21e292852`.

## Native Windows browser results — actual source requests

Authorized Windows Machine, original **Chrome 154.0.8037.99** and **Firefox 153.4.0**. For *exact World #493*: 2 repeats × 5 modes × 2 browser engines = **20/20 completed without HTTP, resource or JavaScript failure**. For *exact consolidated World #521*: 1 repeat × 5 modes × 2 engines = **10/10 completed without error**. All cases loaded both original image bytes, called actual `Image.decode()` and checked their real dimensions. The `draw` case executed the original World tiles plus 3B painter with four source-only `ART-ONLY-NO-SERVER` labels; no connected players or server item events.

| Original World source | Chrome real responses: minimal / world / graphics / graph / draw | Firefox real responses: minimal / world / graphics / graph / draw |
| --- | --- | --- |
| #493 | 3 / 7 / 9 / 12 / 12 | 4 / 8 / 10 / 13 / 13 |
| #521 | 3 / 8 / 9 / 13 / 13 | 4 / 9 / 10 / 14 / 14 |

Windows tests of #493 and #521 were also regenerated during overlapping local runs; **do not treat cross-run first-draw latency differences as controlled performance comparisons**. No current tests qualify as low-end FPS acceptance. The original X230i failure was on the *Linux host*, not measured here; `actualX230iTested:false` is required in all reports.

## Failure persistence and independent-source isolation were tested

An optional **test-only intentional fault** uses `P0_GRAPH_FAIL_ROUTE=/__worldsource__/src/world/alpha-armory.mjs`. It returns localhost HTTP 503 for that one already-allowlisted original-module URL; **it does not alter an original source file**. A five-condition Chrome run on Windows returned the expected outcomes:

| minimal | world | graphics | graph | draw |
| --- | --- | --- | --- | --- |
| DONE | ERROR | DONE | ERROR | ERROR |

The diagnostic marked `experimentalFaultInjection:true`, recorded HTTP503/module failures and explicitly returned a **nonzero** exit code, but continued after each failure. Therefore a future X230i module-load failure can leave comparable successful minimal/graphics-only data in the same report rather than aborting the entire source probe. Fault reports must NEVER be mistaken for real Chromium failures. The test harness limits injected failures to known pinned World module routes, and normal reports contain `faultInjectionRoute:null`.

Reports: `assets/environment/greyhaven/armory-p0/resource-load-review/armory_original_world493_five_source_windows.json`, `armory_consolidated_world521_five_source_windows.json`, and explicitly synthetic `armory_intentional_world493_http503_continuation.json`. The original #550 12-case and six-draw reports remain unmodified. `tests/armory-p0-graph-bisect-exact-world.test.mjs` has four new focused cases. Full cumulative Graphics armory suite: **39/39 Node tests PASS**.

## Portable reproduction for Graphics 3C on authorized X230i

The X230i operator should run this optional script **on the authorized low-end machine** with its own exact source checkouts; this Windows work did not connect to or modify X230i:

```bash
# World #493 ORIGINAL P34 source, bounded Chrome/Chromium-only probe
P0_GRAPH_ENGINE=chrome P0_GRAPH_REPEAT=2 P0_GRAPH_DRAWS=1 \
  P0_GRAPH_TIMEOUT_MS=12000 \
  CHROME_EXECUTABLE=/usr/bin/chromium \
  PUPPETEER_MODULE_URL=file:///actual/path/to/puppeteer/lib/puppeteer/puppeteer.js \
  node tools/art/diagnose_armory_module_graph_resource_p0.mjs \
  /pinned/world493-worktree /tmp/armory_493_x230i_bisect.json

# Only after independent 493-source transport and decode succeeds:
P0_GRAPH_ENGINE=chrome P0_GRAPH_REPEAT=1 P0_GRAPH_DRAWS=6 \
  CHROME_EXECUTABLE=/usr/bin/chromium \
  PUPPETEER_MODULE_URL=file:///actual/path/to/puppeteer/lib/puppeteer/puppeteer.js \
  node tools/art/diagnose_armory_module_graph_resource_p0.mjs \
  /pinned/world493-worktree /tmp/armory_493_x230i_six_draws.json
```

Follow with the **#521** worktree only as a separate source-version comparison. Keep Chromium 152 version, available memory/process limits, actual failed route, HTTP and browser request errors, timing milestones, success/failure counts, and original source SHAs in the report. Never include `P0_GRAPH_FAIL_ROUTE` during real low-end experiments. When a case genuinely fails, the script still writes JSON but exits nonzero; that is intentional, do not convert it to pass.

## Release and cross-department HOLD

This is a read-only QA tool and deterministic tests. No source edits to original World, 3B Blender/WebPs, 3C terrain/lighting, Combat or online-game; no server items, networking, camera/gameplay changes, protected quality skips, live deployments or merges. Original low-end resource failure remains OPEN until the 3C/World authorized X230i controlled run establishes a cause and demonstrates the full original game preview.

Parent **Graphics #550** exact-head quality [#39609712554](https://github.com/tehki/myaso/actions/runs/39609712554) **FAILED mandatory Combat M41 spatial FFA parry tell** (without established Graphics causality). This new head requires its own full protected CI. Core/Items one-writer and server item ID/receipt, UI+Combat single LMB, World/Physics current geometry, 3A complete Silver animation, and real independent-host four-player pickup/PvP remain blocked.

**Classification: IMPLEMENTED / Windows native original-source TESTED / independent X230i BLOCKED / NOT INTEGRATION-READY, INTEGRATED OR PLAYABLE.**
