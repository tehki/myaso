# M147 — Actionable FFA punish target

## Goal
Close the loop between M143–M145 readability and actual combat: when the HUD and golden ring select a recovering jump attacker as `PUNISH TARGET`, a real player input must be able to punish that exact fighter even while a different idle rival remains geometrically closer.

M147 changes no combat constants and no authoritative combat rules.

## Real-browser choreography
The deterministic three-client flight uses:

- Chrome / #1: jump attacker on the left
- Firefox / #2: observer/punisher in the center
- second Chrome / #3: closer idle rival on the right

#1 and #3 are staged inside Firefox's normal light-attack distance, but #3 is kept closer so Firefox begins at `NEAREST #3`. #1 then aims away from Firefox and sends one genuine same-tick Space + LMB jump attack. The jump attack must whiff cleanly.
During #1's unchanged 290 ms `jumpAttackRecovery`, Firefox must switch to `PUNISH TARGET #1` and expose `PUNISH / Jump attack recovery`. Firefox then immediately aims left and sends one genuine LMB.

Acceptance requires the LMB down edge to occur inside #1's authoritative recovery interval. The resulting unchanged 34-damage light hit must reduce only #1 to 66 HP. Firefox and the closer idle #3 must remain at 100 HP / 100 guard. After #1 returns to idle, Firefox must return to `NEAREST #3`.

The test also proves real Space/LMB and LMB pointer provenance, no accidental 42-damage jump hit, and authoritative hit feedback on the selected target.

## Scope
Changes are limited to query-gated browser acceptance, CI wiring, and this document. The playable build is not opened.