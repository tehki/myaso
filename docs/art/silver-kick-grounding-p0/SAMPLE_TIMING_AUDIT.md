# Graphics 3A P0 — exact fractional-frame Silver kick source sampling

**Draft / source-only / human visual HOLD.** This child refines the original authored Silver Knight kick stabilization from PR #573, stacked on #558 and the 31-state matrix #546. It does not modify live gameplay, server Combat, timelines, movement authority or NPC/player identification.

## Fault addressed

The original Blender authoring action uses genuine fractional timeline keys: 1, 3.7, 6.4, 8.5, 10.6, 13.5, 18 and 23.8 (60 fps). The prior exporter called `sc.frame_set(round(fr))`, which bakes nearby whole-frame poses rather than the requested sampled action time. At 60 fps this can shift sample timing by up to 8.3ms, particularly important around the 90ms kick windup and 70ms active phase.

## Fix and proof

Evaluate with `sc.frame_set(int(fr),subframe=fr-int(fr))` so Blender uses fractional action time. Record the actual evaluated frame, not the formerly rounded frame, in the Blender bake report. Re-bake the 8 directions × 8 kick poses from the real original local owner Silver GLB and the corrected Hips action; re-pack the new WebP/GIF and manifests, and independently verify native Chrome and Firefox source review screens. The prior original Silver source stays unmodified; owner GLB is never committed.

The new deterministic regression checks all **64** rendered source-frame and evaluated-frame pairs and exact authoritative kick phase budget **90 + 70 + 220 = 380ms**. No changes to source pose geometry, rig keys, or actual Combat phases are intended. Render differences are source sampling corrections only.

## Acceptance limits

This remains **authored source / isolated tested / human visual HOLD**. Toe-joint stabilization is not true planted sole/physical floor verification. Genuine Greyhaven 0.84 camera, lighting/material parity, dash grounding, four local/remote human Silver Knights, server phase synchronization, and browser multiplayer integration are still unproven. Graphics 3A must not activate this source clip in the live renderer or merge/deploy autonomously.

## Current isolated execution evidence

- 64 original Silver kick source frames rebaked with Blender 5.2.2 LTS at exact authored 60fps subframes (8 directions x 8 frames).
- 58/58 focused Knight, source-art, coverage, grounding, and fractional-timing tests PASS.
- Native Chrome 154.0.8037.99: 64/64 rendered-facing canvas checks; four screenshots; zero page/HTTP errors.
- Native Firefox 153.4.0: 64/64; four screenshots; zero page/HTTP errors.
- Parent #573 protected CI #39620659516 FAILED an inherited M176/M33 browser parry result (block-confirm, not expected parry); unchanged Combat cannot be bypassed. This child requires a fresh exact-head protected run.
- The source-only 380ms timeline is not evidence of authoritative gameplay event synchronization.
