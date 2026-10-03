# M143 — Jump-attack recovery focus in FFA

## Goal
Make punish readability target the fighter who is actually in authoritative recovery, not merely whichever rival is geometrically nearest.

M143 is a readability/focus milestone. It does not change jump-attack timing, damage, reach, arc, stamina, knockback, guard damage, or authoritative combat resolution.

## HUD arbitration
The normal rival card still follows the nearest living opponent. While any remote fighter is in a state already exposed by `opponentRecoveryPresentation`, the card temporarily follows the nearest recoverable fighter instead.

The focus label becomes `PUNISH TARGET #N` during that window, keeping target identity, HP/guard and the existing `PUNISH` recovery cue aligned. When recovery ends, focus returns to the ordinary nearest rival.

Recovery selection is deterministic: nearest recoverable fighter wins, with lower network id as the stable tie-breaker.
## Real-browser acceptance
M143 uses the deterministic three-client FFA layout:

- Chrome / #1: jump attacker
- Firefox / #2: observer
- second Chrome / #3: closer idle rival

The test moves #3 inward until Firefox visibly focuses `NEAREST #3`. #1 then turns 180 degrees away and sends one genuine same-tick Space + LMB jump-attack chord, so the attack whiffs and all vitals remain untouched.

During #1's unchanged 290 ms `jumpAttackRecovery`, Firefox must transition to `PUNISH TARGET #1` and expose `PUNISH / Jump attack recovery`, even though idle #3 remains closer. Once authority returns #1 to idle, Firefox must return to `NEAREST #3` and clear the recovery cue.

The gate also proves the direct authoritative lifecycle `jumpAttackWindup -> jumpAttackActive -> jumpAttackRecovery -> idle`, real keyboard/pointer provenance, and no accidental plain jump.

## Scope
Changes are limited to recovery-focus selection, HUD focus labeling, unit assertions, query-gated browser acceptance, CI wiring, and this document. The playable build is not opened.