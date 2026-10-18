# M253 — post-merge intermittent R1 parry visual observation

Two independent full quality runs on unchanged merged main `24f01009` failed strict M41 at `observer=0 local=0`, even though full PR #309 quality passed all 159 checks. At the same time, every previous real-browser M194/M146/M147/M159 check passed. Evidence: main [run 39132086848 attempt 1](https://github.com/tehki/myaso/actions/runs/39132086848) and [attempt 2](https://github.com/tehki/myaso/actions/runs/39132086848), issue #306. This is a real release gate, not grounds to ignore it.

M253 is a **test-only fallback**: instrument native arena pixels on `requestAnimationFrame`, rather than an unsynchronized 40ms wall-clock timer. Keep the exact original **360×360 center region**, precise color `#7fcff4` / alpha threshold, **at least 24** observer pixels, **exactly zero** local pixels, and a post-stun clear gate. No fake input, fake framebuffer, changed gameplay, server, physics, camera, authoritative outcome, or relaxed browser assertions. If no true remote pixels occur, M41 still fails.

This fallback is separated from the fully merged R1 runtime and is NOT authorization to change the already released or staged package. Require full exact-head Rust/Chrome+Firefox quality and valid owner-governance exception before any merge. If unchanged main CI becomes independently green, prioritize deploying the already pinned R1 release first rather than silently swapping source heads.

## M254 fail-only native raster evidence

When the original >=24 remote-ring raster proof fails, emit a bounded **read-only** diagnostic: real observer arm state, number of animation frames sampled, last sampling time, ring pixels maximum, unchanged 360px crop/canvas dimensions, and the latest few genuine browser combat/HUD transitions. The original exact-color/alpha >=24 remote and exactly zero local thresholds, real W3C inputs and post-stun clear proof are unchanged. No pixels are synthesized or treated as passed based on HUD hints; no gameplay or renderer changes. This distinguishes a frozen observer from actual missing remote ring frames without silently approving either failure.
