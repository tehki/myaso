# M186 — Spatial Punish Cue Intent

## Objective
Distinguish ready geometry from advice to reposition, while preserving all
authoritative combat behavior and the M182–M185 text contract.

## Behavior
- `IN LIGHT ARC` → ready (existing green).
- `FACE TARGET` or `CLOSE FOR LIGHT` → adjust (warm amber).
- `AIM FOR LIGHT` → unknown geometry (neutral text).
- No valid punish target → cue hidden and `data-intent` cleared.
- Text remains the primary cue so color is never the only information.
- Does not guarantee a hit; no server, input, stun, stamina or timing changes.

## Gate
- Local JavaScript and browser syntax checks, all unit tests.
- Full GitHub quality gate including Rust and real Chrome/Firefox after
  ancestors are merged. No playable build opening or deployment.
