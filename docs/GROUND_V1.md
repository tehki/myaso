# Ground v1.0 — natural medieval battlefield (opt-in)

Ground is intentionally a **client-only, cosmetic** layer. It does not update
fighter positions, combat decisions, hitboxes, movement speed, snapshots, or
server authority. Default graphics and automated acceptance screenshots stay
unchanged until explicit activation.

## Try it

Serve the repository over HTTP and visit `/web/ground-preview.html`.
Use WASD/arrows to pan, mouse wheel to zoom and R to reset.
The figures in this *terrain-only preview* are simplified silhouettes for scale,
not production Silver Knight / Sentinel sprites.

For actual authoritative multiplayer use the regular online-game URL with
`&ground=1`. Remove that flag (or use `&ground=0`) to restore the previous
arena. Existing URLs containing `scenario` intentionally ignore the ground
flag, preserving the baseline strict combat-visual acceptance assertions.

## Rendering contract

- World-coordinate fixed palette: trampled grass, dry earth, damp mud and
  sparse rubble blended from continuous seeded noise.
- 384-world-unit chunks, 96-pixel coarse color raster upscaled with smoothing
  plus thin grass/pebble scatter; **no per-frame procedural sampling** for
  previously cached chunks.
- Hard LRU cap: **24 textured chunks** (roughly 14 MB of 384px RGBA backing
  images before browser overhead). At most **2 new chunks per frame**.
- Cache miss draws a cheap, world-sampled fallback while texture fills in,
  rather than leaving blank or scrolling screen-space patches.
- Terrain is rendered in the same zoom transform and smoothed camera as fighters;
  hit tests and input geometry stay in original world units.
- Two small world-grounded fighter shadow ellipses; airborne sprite lift does
  not lift its contact shadow. No extra shadow for baseline renderer.
- Visible chunk planning bounded to 64 per frame even on oversized canvases.

## Validation and release gates

Focused Node tests check chunk-border continuity, deterministic sampling,
camera translation, zoom bounds, LRU eviction, texture creation rate, shadow
position, and the opt-in rendering order. Run:
`node --test tests/battlefield-ground.test.mjs`

Before enabling by default: compare against existing UI combat-readability
screenshots, visually inspect continuous camera pans and negative-world chunk
coordinates, perform actual Chrome/Firefox multiplayer playtests, and benchmark
60 FPS at 50/100/200 *visible* actors. These FPS targets are **not yet verified**.
The independent M325 strict guard-break synchronization PR and knight graphics
PR remain separate from this terrain change.
