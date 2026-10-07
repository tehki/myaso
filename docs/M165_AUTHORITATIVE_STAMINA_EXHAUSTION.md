# M165 — Authoritative Stamina Exhaustion

## Goal

Close the remaining stamina authority gap after M163/M164: a real browser action submitted below its stamina threshold must be rejected by the server, the rejected edge must stay consumed while stamina regenerates, and a fresh action must become legal after regeneration.

## Contract

- Roll cost remains 28 stamina.
- A wheel-forward delivered below 28 stamina is genuine input but cannot start Dodge or DodgeRecovery.
- Rejected roll input cannot spend stamina.
- The rejected edge cannot auto-fire later when stamina crosses 28.
- After stamina returns to 100, a new wheel-forward starts Dodge and produces the normal 100 → 72 authoritative stamina transition.
- The visible stamina HUD must match the owner-authoritative stamina snapshot throughout.
- No damage, guard, timing, speed, hitbox, knockdown, input, or packet constants change.

## Acceptance

The M165 CI gate runs:
- JS combat-model exhaustion/retry regression.
- Authoritative Rust exhaustion/retry regression.
- Real Chrome + Firefox production-UI flight using genuine held-RMB movement and wheel-forward inputs.

The browser flight drains stamina below the roll threshold through normal running, submits one rejected wheel-forward, waits through full regeneration while proving no delayed roll starts, then submits a fresh wheel-forward and requires the authoritative 28-point cost.
