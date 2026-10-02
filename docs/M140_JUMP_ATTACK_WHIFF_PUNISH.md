# M140 — Jump-attack recovery readability and whiff punish

## Goal
Make the existing jump-attack recovery visibly punishable and prove a real opponent can convert that cue into a light punish before recovery ends.

M140 does not change jump-attack balance. The existing 105 ms windup, 105 ms active phase, 290 ms recovery, 48 reach, narrow `Math.PI * 0.24` arc, 42 damage, 34 knockback and 52 guard damage remain unchanged.

## Readability
The local action hint now describes jump-attack commitment and recovery. Opponents see the authoritative recovery state as:

- state: `jump-attack-recovery`
- label: `PUNISH`
- detail: `Jump attack recovery`

The cue is driven only by replicated authoritative action state.
## Real-browser acceptance
The M140 Chrome/Firefox scenario stages both fighters in the same close spacing used by the proven jump-attack hit acceptance. The Firefox attacker then aims the narrow Space + LMB jump attack 180 degrees away so it genuinely whiffs without changing distance or balance.

Acceptance requires:
- one real same-tick Space + LMB chord;
- replicated `jumpAttackWindup -> jumpAttackActive -> jumpAttackRecovery` on both clients;
- no 42-damage jump-attack contact;
- the Chrome defender renders the authoritative `PUNISH` recovery cue;
- a genuine defender LMB begins promptly after that visible cue;
- the resulting 34-damage light hit lands before either client observes the attacker returning to idle;
- final vitals prove exactly one light punish and no other contact.

## Scope
Changes are limited to combat readability, its unit assertions, query-gated acceptance telemetry, the browser flight gate, CI wiring, and this document. The playable build is not opened.