# 🌕🌲🎨 Graphics 3C P42 — tile cache source pixel parity / Firefox benchmark

21 October 2026 · myaso.io P0 First Playable Alpha · **offline QA only, no shipping renderer edits**.

## Exact provenance and experiment

The experiment compares original Graphics 3C P40 authored tile painter (exact parent `433d6151d5148b3a4c38300df14cffa19e3aa003`) against two optional 512×512 tile source representations using exact authored World #521 (`3178b9aad8757ceb3594ff04b9e3099dced6b729`):

1. Original Canvas-backed tile textures (control).
2. `OffscreenCanvas(512,512)` injected through the existing `makeCanvas` option, **no renderer source edits**.
3. Same offscreen paint, but in-memory-only renderer module substitution `return texture.transferToImageBitmap()`. No game renderer source is changed.

The source is served over a loopback-only allowlist, pinned to original commits. For each alternative, an independent original and candidate renderer draw the same camera route, cached and cold, under zoom 0.84, 1.0, 1.2. Canvas size 640×480, build limit 3 and cache cap 24. Compare **all RGBA bytes on every frame**, not only screenshots.

Two runs × 2 native Windows browsers (Chrome 154.0.8037.99 and Firefox 153.4.0) × 2 candidate formats × 3 zooms × 32 frames = **768 frame comparisons, zero changed RGBA bytes, zero HTTP/JS/browser errors**.

## Firefox: no repeatable performance win

These are sums of synchronous `renderer.draw` self-time over warm frames 10–31 for one configuration (22 warm draws), **not actual GPU present, FPS, full-game p95, or networking**:

| Source and zoom | First native run: original → variant | Repeat: original → variant |
| --- | --- | --- |
| OffscreenCanvas at 0.84 | 84 → 86 ms | 88 → 119 ms |
| ImageBitmap at 0.84 | 79 → 84 ms | 231 → 230 ms |
| OffscreenCanvas at 1.0 | 73 → 69 ms | 101 → 112 ms |
| ImageBitmap at 1.0 | 75 → 74 ms | 237 → 144 ms |
| OffscreenCanvas at 1.2 | 60 → 65 ms | 99 → 151 ms |
| ImageBitmap at 1.2 | 68 → 66 ms | 80 → 83 ms |

Variation between repetitions is substantial, and any improvements were not consistent at the alpha zoom 0.84. The Chrome results often favored alternate sources but **Firefox is the bottleneck** and this does not establish a Firefox win. This only tests isolated world textures, not the 3B facade, 3A fighters, server-owned swords, four clients or full frame presentation.

## Decision

**Reject both alternatives for shipping P42**: tested pixels match exactly, but the original Firefox screen-copy problem is not demonstrably fixed. Preserve original authored painter and tile cache, World geometry, collision, assets, tests, and gameplay authority.

Evidence:
- `assets/environment/greyhaven/3c-p42-tile-source-qa/p42_tile_source_comparison_windows.json`
- `assets/environment/greyhaven/3c-p42-tile-source-qa/p42_tile_source_comparison_windows_repeat.json`
- QA-only program: `tools/art/probe_p42_tile_source_qa.mjs`

This QA does not prove playable Alpha or release readiness and cannot waive protected quality. Main development/orchestrator owns merges. Target next optimizations only with source-exact native Chrome and Firefox pixel proofs, multiple cold/warm trials and actual full multiplayer GPU-present frame timing.
