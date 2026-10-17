# M121 — real-browser directional-light input ordering regression

## Evidence and actual failure

Myaso main CI [quality run 39060497356](https://github.com/tehki/myaso/actions/runs/39060497356) on SHA `fe3fa14186c1fc0f0646f0c87f744e14d3fd4978` failed during **Validate M121 real directional light**. The headless Firefox defender received a genuine 34 HP strike (100 → 66), but its observed threat was `WINDUP/STRIKE` with `attack-recovery` instead of the required `LEFT WINDUP/LEFT SWEEP` and `directional-attack-recovery`. That means the previously green quality gates cannot be inferred from public alpha join/replication alone.

The old harness sent perpendicular `W/S` keydown/keyup and LMB pointerdown/up together in a **single multi-device WebDriver action sequence**, with zero-duration keyboard pauses and a 150ms final pointer pause. Since the current short-LMB light commits **on pointer release**, cross-source scheduling/key release relative to actual `pointerup` is a plausible contributor to the missing directional input. This is an **instrumented root-cause hypothesis**, not proof that the game code is correct.

## Isolated harness correction

- Split actual browser W3C actions into three ordered calls: `keyDown(W/S)` → genuine pointer `move/down/40ms/up` → `keyUp(W/S)`. The movement key necessarily remains held across the entire mouse gesture; no synthetic DOM event, server input or fighter state is injected.
- Use `finally` to release the held key on an error; fail closed if any WebDriver stage rejects.
- A small pure action-plan module and new offline tests assert the exact W3C order and cleanup in failure paths.
- Keep all M121 strict evidence gates: real strafe + LMB, 34 HP authoritative damage, **LEFT WINDUP/LEFT SWEEP**, **Sweep recovery**, dual-client damage feedback. No retry on damaging outcomes, fabricated server tick, or relaxed threshold.

## Acceptance and rollout

1. Local `node --test tests/m121-directional-light-plan.test.mjs` and existing browser/control unit tests must pass.
2. Exact PR CI **Validate M121 real directional light** must pass in real Chrome and Firefox; rerun cleanly if timing instability appears and inspect actual defender/attacker outputs.
3. Full Rust and browser quality for the PR must pass before merge. This branch does not change the arena, server authority, combat rules or network protocol.
4. Merge only after test review; subsequent merged-main CI and real-player functionality are separate gates. No automatic VPS/game activation.
5. The newer [zoom and WAN smoothness PR #300](https://github.com/tehki/myaso/pull/300) is a separate gameplay change. Its contemporaneous failure is M46 spatial FFA vitals, not this M121 case; keep independent CI/review gates.

This document is **source-only** and does not authorize game rollout or a public capacity claim.
