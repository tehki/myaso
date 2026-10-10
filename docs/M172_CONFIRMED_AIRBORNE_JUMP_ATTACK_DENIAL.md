# M172 — Confirmed Airborne Jump-Attack Denial

## Goal

Close the remaining jump stamina edge after M168/M169: once a normal jump has already paid its unchanged 14-stamina cost, an airborne LMB conversion must require the additional unchanged 12-stamina jump-attack cost.

## Contract

- Jump cost remains 14 stamina.
- Airborne jump-attack conversion remains 12 additional stamina.
- Jump duration remains 430 ms.
- Jump-attack windup/active/recovery remain 105 / 105 / 290 ms.
- A genuine Space press with at least 14 stamina still starts an ordinary authoritative Jump.
- If the remaining authoritative stamina is below 12, a later genuine airborne LMB must not enter JumpAttackWindup, JumpAttackActive, or JumpAttackRecovery.
- The rejected LMB must not spend the 12-stamina conversion cost and must not damage the opponent.
- The local low-stamina cue is only shown after processedClientTick acknowledges the exact LMB input and authority still reports rejection below 12 stamina.
- Denial telemetry preserves queued → submitted → confirmed-rejected → shown.
- No damage, guard, stamina, movement, timing, hitbox, packet, snapshot, or protocol constants change.

## Acceptance

The existing real Chrome + Firefox uijumpattack flight becomes a strict superset:

1. preserve M136’s genuine same-tick Space + LMB successful jump-attack proof;
2. return to authoritative idle and aim away from the opponent;
3. use genuine held-RMB running to establish 14–25 authoritative stamina;
4. submit one genuine Space press and prove authority enters ordinary Jump with <12 stamina remaining;
5. submit one later genuine LMB while airborne;
6. require the exact LMB client tick to be acknowledged before the low-stamina cue appears;
7. require no local or remote jump-attack state and no extra stamina spend;
8. require the ordinary Jump to recover to Idle with unchanged health and guard.

JS and Rust kernel regressions independently prove that an airborne light edge below the conversion cost remains an ordinary jump.

The playable build remains intentionally closed while combat acceptance continues.
