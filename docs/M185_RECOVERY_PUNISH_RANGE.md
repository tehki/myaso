# M185 — Recovery Punish Light-Arc Guidance

## Goal
Complete the M182–M184 punish-positioning feedback by providing the same
advisory light-attack geometry cue for a focused opponent recovering from
an attack, dodge, or feint.

## Contract
- Only display while `focusMode === "recovery"` and the current authoritative
  opponent has a recognized recovery action.
- Preserve the established `PUNISH TARGET #id`, `PUNISH`, and exact recovery
  detail labels used by cross-browser checks.
- Reuse the 76+18 light reach and 0.78π aim arc to show `IN LIGHT ARC`,
  `FACE TARGET`, `CLOSE FOR LIGHT`, or `AIM FOR LIGHT`.
- Do not show if the local fighter is committed or unable to act, the target
  is idle/stunned/knocked down, or authoritative positions are unavailable.
- This is present-geometry advice only, not a guaranteed punish. The server
  remains authoritative for timing, distance, damage and stamina.

## Validation
- Focused tests cover light, directional, heavy, running, jumping, dodge, and
  feint recovery as well as facing, reach boundary, local commitment, and
  parry/guard-break/knockdown mutual exclusion.
- Full GitHub quality CI is required after ancestor PRs merge. No playable
  build or production deployment.
