# M235 — native Firefox M38 recovery-ring failure evidence

Parent: [M38 genuine intermittent RED #287](https://github.com/tehki/myaso/issues/287). Base: [M234 merged main `2a3c442`](https://github.com/tehki/myaso/commit/2a3c4427ce20ff5fc1e378d99987123ad21e6312).

## Why

M234 [quality attempt 2](https://github.com/tehki/myaso/actions/runs/38951593240/attempts/2) failed the **unchanged** M38 real Firefox remote-only recovery ring: `observer=0 local=0`, after preceding authoritative hit checks. The Firefox browser also logged a network transport script timeout during shutdown. The legitimate remote gold-ring canvas gate is **observer >= 24 pixels, local 0 pixels**, not just a DOM cue. Green M38 reruns do not resolve the intermittent root cause.

## Strict failure-only evidence

M235 does **not** modify the game client, its renderer, network timing, authoritative Rust simulation, W3C gestures or any acceptance timing or pixel thresholds.

- The **existing** M38 `requestAnimationFrame` / `CanvasRenderingContext2D.getImageData` loop continues to look for exactly the same gold pixels in exactly the same centered 320×320 canvas region. It now counts how many genuine browser RAF samples ran, records the actual canvas/region dimensions, first/last sample times, last pixel count and max-pixel time.
- **Only on** the original strict M38 `observerMax < 24 || localMax !== 0` failure, read the preserved RAF counters together with the authentic Firefox/Chrome HUD focus label/transitions and recovery transitions.
- Correlate at most 16 actual native `M201_AUTH_ACTION` server log edges, if available, rather than inferring replication or rendering from server ticks.
- Report `m235FailureEvidence` **inside the same original thrown error**. Browser readback failures are recorded in bounded strings instead of masking the original pixel failure.
- All successful runs keep their original sampler pixel thresholds and validation path with no extra WebDriver reads. No retries, simulated frames, manufactured pixels or synthetic input.

## Failure decision table

| Observed red evidence | Next investigation |
| --- | --- |
| Firefox sampler `sampledFrames=0` | Native RAF stalled/not scheduled; inspect compositor/browser resource starvation |
| Firefox has RAF samples, `maxPixels=0`, but recovery HUD transition appeared | Compare actual gold-ring draw timing/location and crop with painted canvas frames |
| Firefox has RAF samples, `maxPixels=0`, and no visible recovery HUD transition | Inspect replicated action/state timing before changing paint logic |
| `maxPixels > 0` but below original 24 threshold | Inspect partial visibility, clipping, motion and sampled geometry |
| Server action edges prove recovery, Firefox never observes it | Inspect realtime/reliable state propagation; server proof does not imply replicated or painted evidence |

A recovered green CI run proves no root cause. Keep [#287](https://github.com/tehki/myaso/issues/287), separate M145 [#283](https://github.com/tehki/myaso/issues/283) and M108 [#277](https://github.com/tehki/myaso/issues/277) **OPEN** until actual mechanisms are diagnosed.

## Release gates

Four deterministic tests check real zero evidence, missing RAF, bounded traces and unchanged original strict gate. M235 runs a dedicated test gate plus original full Rust, JavaScript, authentic three-browser M145, two-browser M38, M108 and 512-player qualification. Merge only after **two full consecutive greens on exact head**, then independently verify merged-main CI and `Verify main-push provenance`. No playable build or production deployment.
