# Graphics 3C P41 — verified X230i original armory source graph

21 October 2026 · Moon Games / myaso.io First Playable Alpha · **diagnostic only**

## Root cause of harness stop, not of the historical resource incident

The previous Graphics 3B [#559](https://github.com/tehki/myaso/pull/559) X230i reproduction aborts **before Chromium** because its exact SHA256 pins were produced from Windows CRLF working-tree copies of original text modules, while Arch Linux checks out the identical Git blobs using LF. This is a QA portability bug, not a verified asset corruption or cause of the earlier `net::ERR_INSUFFICIENT_RESOURCES`.

Proof from original World #493 at exact `07060f981b8a1dac89184b621b6893dd970a08ae`:

| Original text file | Actual X230i LF SHA256 | Original approved CRLF SHA256 |
| --- | --- | --- |
| `src/world/alpha-armory.mjs` | `f9d68a6750784cbe5fce2dd9c2969d479b3394162ebc20900c9cdf4ab91e797a` | `305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf` |
| `src/world/authored-maps.mjs` | `d48c495f3a23881154ce6c93452c44cb7587ebd3707f9434098439d1a67d1987` | `21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144` |
| World #493 Canvas painter | `e05a02812be04ae9a5c1fc0cddd1e2c2b6e54ab55a85950be6d10fa81dbbe4a6` | `db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9` |

The new **Node-only** helper accepts ONLY exact complete LF or complete CRLF bytes. It calculates the original **unchanged** Windows-CRLF SHA256 pin, and rejects mixed newlines, bare CR, binary/invalid UTF-8 or any semantic edit that alters that digest. Raw native source hashes and newline styles are also recorded to avoid misrepresenting on-disk bytes. Browser-imported source is **never rewritten**. Original World, 3B WebPs, server, networking, Combat and 3C painter remain unmodified.

## Actual low-end browser evidence

Machine: physically connected Linux **X230i**, Chromium **152.0.7977.82**, native original source files. The existing bounded #559 browser harness was run directly on that device; **no injected HTTP failure**. Only the QA harness's hash check/report labeling is changed, not the browser assets.

| Source head / config | Completed | Failures | Actual six-draw timing in `draw` group |
| --- | --- | --- | --- |
| World #493 `07060f9`, five groups × **2 repeats** | **10/10** | **0** | Repeat 1: **136, 0.8, 0.5, 1.1, 0.8, 0.4 ms** |
| World #493 repeat 2 | included above | 0 | **48.7, 0.6, 0.4, 1.1, 0.4, 0.4 ms** |
| World #521 `3178b9a`, five groups × **1 repeat** | **5/5** | **0** | **40.2, 0.6, 0.2, 0.3, 0.2, 0.2 ms** |

Groups: minimal source-only images, World-only modules+images, Graphics-only modules+images, full combined graph+images, and full graph plus genuine original World/Graphics Canvas draw. All original rack+sword WebPs decoded, all original modules loaded, all five conditions recorded real response/request timings and correct source SHA pins. No `net::ERR_INSUFFICIENT_RESOURCES` reproduced in these bounded runs. This **does not invalidate** prior failures under a larger source/program/module graph or sustained/parallel resource pressure; those remain to be investigated.

Raw low-end reports (not the old Windows fixtures):

- `assets/environment/greyhaven/armory-p0/resource-load-review/armory_original_world493_x230i_six_draws_p41.json`
- `assets/environment/greyhaven/armory-p0/resource-load-review/armory_consolidated_world521_x230i_six_draws_p41.json`

The initial uncached draw exceeds the provisional **16.7 ms** budget in all three measured groups. Subsequent warm cached draws of this isolated fixture were much lower, but these values are **not actual multiplayer FPS, GPU present timing or full game-loop frame pacing**.

## Verification and governance

- Exact branch parent: Graphics 3B #559 `960762724262e6ceed66f233ac0d34040b598689`.
- Low-end isolated native Chromium source/canvas test: **PASS 10/10 + 5/5**.
- New portable digest checks include LF/CRLF same-pin proof, mutation rejection and mixed-CR/binary rejection.
- Focused P41+parent X230i Node tests **12/12 PASS**. Broader existing `tests/armory-p0-*.test.mjs` suite **42/43 PASS**, with one unmodified inherited `armory-p0-world493-ui503.test.mjs` failure: a separate artifact source hash is pinned to Windows bytes. That identical test **also fails on unmodified #559 on X230i**; it is a separate cross-platform contract to resolve, not a P41 regression. Do not call the entire Linux suite green.
- Existing mandatory Combat/quality CI is **not bypassed**; the previous Graphics 3C #419 strict M34/M193 failed and remains its owner's gate.
- Stage: **TESTED isolated X230i source/module graph**, **NOT full integrated Greyhaven/Blacksmith browser acceptance**, not server-authoritative item/pickup/PvP, not PLAYABLE.
- No new production renderer, altered World coords, updated WebPs, server logic, test waiver, merge or deployment.

Next: repeat exact source tests on the authorized Windows machine to prove the CRLF path, then continue a **larger true online-game module-graph and cold-frame** X230i investigation with the Main Orchestrator's combined Core/World candidate. Coordinate with Graphics 3B #559 and central issues #415/#480/#360.
