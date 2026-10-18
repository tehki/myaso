# M250 — Frame-aligned strict M41 visual acceptance

## Evidence

After R1 zoom/smoothing merged, two independent exact-head test-harness branches (which do not change parry rendering) passed M146/M147/M159/M194 and then failed M41's strict `#7fcff4` remote parry indicator check:

- [PR #303 CI #39112706040 attempt 2](https://github.com/tehki/myaso/actions/runs/39112706040): `observer=0 local=0`.
- [PR #304 CI #39115451702 attempt 1](https://github.com/tehki/myaso/actions/runs/39115451702): `observer=0 local=0`.

The M41 visual sampler currently polls the actual canvas `getImageData` raster in a fixed 360×360 central region on a **40ms wall timer**. Headless Firefox can miss a short-lived render window when paint frames and wall-timer callbacks diverge during genuine W3C input and network jitter. These failures do not yet prove whether the ring was outside the region, not drawn, or simply missed by sampling. See [issue #306](https://github.com/tehki/myaso/issues/306).

## Isolated candidate

Install the **same read-only getImageData pixel sampler on native requestAnimationFrame**, rather than a 40ms setTimeout, and cancel it with `cancelAnimationFrame`. On active foreground pages, this captures each browser frame after the existing online renderer is scheduled, improving opportunity to see a genuine transient ring.

Keep the exact `#7fcff4` RGB/alpha pixel filter; the original remote **at least 24 actual pixels**, local **exactly 0**, true Chrome/Firefox native parry input, and post-stun clearing gates remain. The sampled 360×360 region is initially unchanged to isolate timing from camera geometry. No changes to combat, layout, camera zoom, game drawing, animation constants, WebTransport, or server.

No CSS tricks, artificial canvas pixels, synthetic input or assertion weakening. If genuine raster pixels are still absent after frame alignment, the CI must fail and the underlying rendered tell/region investigated.

## Release rules

This is a test-only candidate; no merge without full exact-head Rust/Chrome/Firefox quality and independently green merged-main acceptance. Preserve previous live VPS release until separate real-player testing.
