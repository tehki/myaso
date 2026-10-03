# M146 — Real delayed parry punish window

## Goal
Prove the existing widened parry punish window is genuinely usable with real browser input, rather than merely configured as a 650 ms stun constant.

M146 changes no combat balance. `COMBAT.block.parryStunMs` remains 650 ms and the normal light attack remains 135 ms windup, 80 ms active, 255 ms recovery, 34 damage, 38 guard damage and 76 reach.

## Real-browser acceptance
Chrome attacks and Firefox performs a genuine wheel-back parry using the proven M33 exchange. The parried Chrome client must enter authoritative `stunned` state and both clients must emit the existing parry feedback.

Firefox then waits deliberately into the stun window instead of punishing immediately. A genuine LMB punish must begin approximately 340–470 ms after the authoritative stun transition. The normal light attack must still land before the 650 ms stun expires, dealing exactly 34 HP damage with both guards untouched.

Acceptance also requires that the attacker has not returned to authoritative idle before the punish input begins, and that the delayed hit produces the normal authoritative 34 HP feedback on both clients.

## Scope
Changes are limited to browser acceptance timing, query-gated acceptance telemetry, CI wiring, and this document. The playable build is not opened.