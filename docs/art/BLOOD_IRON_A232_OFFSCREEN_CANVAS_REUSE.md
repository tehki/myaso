# Graphics 3B P1 — bounded Red Lion offscreen Canvas staging (review only)

Source base: Graphics 3B draft #831 exact `da5664b015bb1f76b1c60482b5009a6fd5fb7487`.
Scope: `src/browser/red-lion-live-art.mjs` and its existing focused tests only.

## Observed source cost and remedy

The opt-in `?world=1&redlion=1` painter originally assigns `width` and `height` to BOTH World9 and original Blender facade Canvas surfaces on EVERY completed animation frame. Setting Canvas dimensions resets the drawing context and may force backing-store reallocations even for a stable 960×540 viewport.

This child only sets Canvas dimensions when they actually change, with **explicit full-frame clearRect on both surfaces on every prepare** before painting the genuine World9+Graphics3C tiles and exact source Blender facade/unchanged roof. Consequently old camera pixels cannot be retained simply because the prior canvas is reused; original draw order and World building footprint/visual depth remain unchanged. A new focused unit regression counts full-canvas resize assignments at 960×540 over two camera positions and verifies each canvas is cleared on each frame and resized again on a real 1280×720 switch.

**No measured speedup or frame-rate claim.** Node unit tests and existing genuine Chrome/Firefox original-WebP, SHA/fail-closed/pan smoke must pass on the exact new head before this candidate advances; compare CPU/GPU frame cost at unchanged viewport on the same machine before claiming a benefit.

No changes to `web/online-game.mjs`, authored World/Physics, server, network, sword ownership, input, Combat, UI layout, lighting engine, Blender source, RGBA WebPs or frozen A2.26 roof. Default arena remains unchanged and P0 Combat Pre-Alpha #695 has zero 3B dependencies.

Known parent release blocker: #831 exact-head mandatory quality #39928022071 FAIL at Combat M107 heavy-dodge authoritative HP delta, separately from dedicated native graphics PASS. Do not waive this or merge/deploy this child without Main Orchestrator #360 authorization. Actual four-authenticated-player depth/HUD acceptance remains open.
