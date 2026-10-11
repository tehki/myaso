# M183 — Guard-Break Punish Geometry

## Objective
Extend M182's replicated light-arc guidance to a real guard-break stun.
The player can read whether a current punish target is in light-attack reach,
whether to turn, or whether to close the distance. This is advisory: a future
strike may miss if target motion, replication, or stun expiry changes.

## Contract
- Recognize guard-break stun only when authoritative action is `stunned`
  and replicated guard equals zero. A positive-guard parry stun must not match.
- Share the unchanged 76 + 18 light reach, 0.78π arc and facing tests with
  parry punish, avoiding divergent client geometry calculations.
- Suppress guidance if local player is committed or disabled, target recovers,
  target identity/geometry becomes unavailable, or the focus switches.
- Preserve existing `GUARD BREAK #id`, `PUNISH`, `Guard break stun` and
  `guard-break-stun` UI names and states used by browser acceptance.
- Rename the subordinate range label from parry-specific to general punish
  semantics; no modification to simulation, authoritative guard calculations,
  packet format, attack damage, stamina costs or stun durations.

## Validation
- Focused JavaScript regression covers parry/guard-break mutual exclusion,
  hit-range boundary, opposite facing, zero guard, recovered target,
  un-actionable own state, null target and action compatibility.
- Full GitHub quality suite including real Chrome/Firefox and Rust is
  mandatory before merge. Do not open playable builds.
