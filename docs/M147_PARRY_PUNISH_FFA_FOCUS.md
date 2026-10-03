# M147 — Parry punish target in FFA

## Goal
Extend the real M146 delayed parry punish window into three-player FFA readability. A fighter stunned by a successful parry must become the defender's explicit punish target even when another idle rival is geometrically closer.

M147 changes no combat balance. `COMBAT.block.parryStunMs` remains 650 ms and parry, light-attack, guard and movement constants remain unchanged.

## Targeting rule
`fighterParryPunishNetId(...)` selects the nearest remote fighter whose authoritative state is `stunned` with guard above zero — the existing signature of a parry stun. Guard-break stun (`stunned` with guard zero) is excluded.

Parry punish has HUD priority over ordinary recovery focus and nearest-rival focus. During that state the rival card reads `PARRY PUNISH #N` and the existing punish card reads `PUNISH / Parry stun`. When the stun ends, ordinary recovery/nearest focus resumes.
## Real-browser acceptance
The deterministic three-client scenario uses Chrome #1 as attacker, Firefox #2 as parrying defender, and Chrome #3 as a deliberately closer idle rival.

Acceptance requires:
- Firefox begins on `NEAREST #3`;
- Chrome #1 delivers a genuine aimed LMB after real movement into range;
- Firefox #2 delivers a genuine wheel-back parry;
- authority resolves #1 to parry `stunned` with unchanged full HP/guard;
- Firefox switches to `PARRY PUNISH #1` and exposes `PUNISH / Parry stun` despite idle #3 remaining closer;
- idle #3 is never labeled as a parry punish target;
- after the unchanged 650 ms stun ends, Firefox returns to `NEAREST #3` and the parry punish card clears;
- all three fighters keep full HP/guard throughout the proof.

## Scope
Changes are limited to parry-punish target selection, HUD presentation, unit assertions, query-gated browser acceptance, CI wiring and this document. The playable build is not opened.