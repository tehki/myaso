# M141 — Jump-attack threat telegraph

## Goal
Make the existing narrow jump attack visible to the FFA threat/readability system without broadening its gameplay geometry.

M141 does not change combat balance or authoritative resolution. Jump attack remains 105 ms windup, 105 ms active, 290 ms recovery, 48 reach, `Math.PI * 0.24` arc, 42 damage, 34 knockback and 52 guard damage.

## Readability contract
Replicated jump-attack states now participate in threat selection using `COMBAT.jumpAttack` itself:

- `jumpAttackWindup` -> `JUMP WINDUP` -> threat state `windup`
- `jumpAttackActive` -> `JUMP STRIKE` -> threat state `strike`

Because selection uses the unchanged jump-attack reach and arc, players outside that narrow cone do not receive a false jump threat.
## Real-browser acceptance
The M141 Chrome/Firefox flight proves both negative and positive spatial cases at the same close combat spacing:

1. Chrome sends a genuine Space + LMB jump attack aimed 180 degrees away from Firefox. It must whiff, preserve both fighters at full HP, and Firefox must not render `JUMP WINDUP` or `JUMP STRIKE`.
2. After authoritative recovery returns to idle, Chrome sends a second genuine Space + LMB chord aimed at Firefox. Firefox must render `JUMP WINDUP -> JUMP STRIKE`, and the unchanged attack must resolve exactly one 42 HP hit.

Acceptance additionally verifies both chords are real same-tick keyboard/pointer gestures and that pointer ownership proves the first aim was off-axis and the second in-axis.

## Scope
Changes are limited to threat/readability selection and labels, unit assertions, query-gated browser acceptance, CI wiring and this document. No combat constants change. The playable build is not opened.
## Active-phase continuity after contact
A successful jump hit can apply knockback on the same authoritative tick that first exposes `jumpAttackActive`. The UI therefore latches only a jump attacker that was already a valid in-cone `JUMP WINDUP` threat and preserves `JUMP STRIKE` while that same authoritative attacker remains active. This is presentation continuity only: it does not widen threat acquisition, reach, arc, hit geometry, or the active duration.