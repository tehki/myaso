# Graphics 3A — A3A-03 Native-browser Knight crowd rendering microbenchmark

**October 21, 2026** · **Blood & Iron** · **Graphics 3A** · **QA only, not a multiplayer capacity claim**

## Provenance and scope

- Test program: `tools/art/benchmark_knight_crowds_browser.mjs`, run against the opt-in Knight sprite renderer and original `web/assets/knights/*.webp` atlas assets from Graphics 3A parent branch.
- Parent Graphics 3A head at collection: `c712679c50644e2af5a7b5ac41323c5ffc792a14` ([draft #408](https://github.com/tehki/myaso/pull/408)), stacked on existing Knight [#326](https://github.com/tehki/myaso/pull/326).
- Actual browser engines on authorized Windows workstation: Chrome **154.0.8037.99**, Firefox **153.4.0**, both in headless mode.
- Browser canvas viewport **1440 × 900**, 110 `requestAnimationFrame` iterations per crowd scenario, 2/16/50/100/200 **visible** actors, 120% approved knight sprite display scale.
- Uses **unique simulated netIds** for actors; each is a **remote T1 Sentinel** using shared `t1_walk.webp`, with a small positional delta. Nine shipped WebP atlases load and decode at the start, but **this microbenchmark does not exercise mixed character equipment, attack states or independently textured character varieties**.
- Each frame measures elapsed JavaScript canvas draw submission with `performance.now()` and records requestAnimationFrame intervals separately. Values are **p95 over this short local run**, not GPU completion or a sustained FPS guarantee.
- The benchmark never creates real network sessions or changes game server physics, authority, hitboxes or production runtime.

## Observed p95 measurements (milliseconds)

| Actors | Chrome canvas drawing | Firefox canvas drawing | Chrome RAF interval | Firefox RAF interval |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 0.3 | 1 | 16.8 | 16.68 |
| 16 | 0.8 | 4 | 16.8 | 16.68 |
| 50 | 1.3 | 12 | 16.8 | 16.68 |
| 100 | 3 | 42 | 16.8 | 52.38 |
| 200 | 5.9 | 36 | 16.8 | 33.34 |

Both browsers passed all five cases, with zero page/network errors. Each sample had **110 frames**, and every requested atlas draw was executed. Firefox results are nonmonotonic between 100 and 200 actors and may reflect scheduling, caching or transient load; do not extrapolate a capacity threshold from this single run.

## Interpretation

**The Firefox draw path is the clearest candidate for targeted profiling**, because its observed p95 drawing cost at dense counts is materially higher than Chrome's. This evidence does **not** prove 50/100/200-player game support, overall client FPS, server tick stability or networking quality.

Do not weaken the strict Chrome/Firefox combat gates in order to make sprite performance tests pass.

## Reproduction

Install Puppeteer or provide `PUPPETEER_MODULE_URL` pointing at an installed Puppeteer/Puppeteer Core JS module. Optionally set `CHROME_EXECUTABLE` (Chrome) or `KNIGHT_QA_BROWSER=firefox` and `KNIGHT_QA_EXECUTABLE` (Firefox). Run:

```sh
node tools/art/benchmark_knight_crowds_browser.mjs .knight-crowd-local
```

The script writes `crowd_browser.json` to the chosen output directory and prints `KNIGHT_CROWD_BENCH=...`. This script is deliberately non-gating: performance values vary by actual browser and hardware, and no accepted performance budgets have been established.

## Next acceptance gates

1. Record repeated browser measurements with warmup, CPU/GPU/environment context and at least one lower-end device.
2. Investigate Firefox's raster/compositing/frame scheduling and shared sprite cache before adding complex LOD logic.
3. Perform **actual authoritative two-browser multiplayer** with `&knights=1`, real movement and roll, before claims of full in-game acceptance.
4. Integrate with Graphics 3B/3C authored world, roof occlusion, camera and character grounding; test mixed animated NPC/player crowds.
5. Run new exact-head protected quality after a reviewed integration into parent Graphics PR; obtain central review before any merge/deployment.

**No merge or production activation is part of this milestone.**
