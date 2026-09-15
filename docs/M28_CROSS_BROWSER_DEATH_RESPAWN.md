# M28 â€” Cross-browser authoritative death and respawn

## Objective
Prove the existing server-owned death and respawn loop end-to-end between two real browser clients on one authoritative shard.

## Flight
- Lower authoritative net ID is the attacker; the other browser remains passive.
- Attacker uses only ordinary production movement and committed attack inputs.
- Three 34-damage hits must drive the defender to authoritative HP 0 / `Dead` (wire action 8).
- After death, attacker stops attacking.
- The existing server respawn timer remains unchanged at 1250 ms.

## Acceptance
Both browsers must observe the same defender death, then an authoritative return to `Idle` with 100 HP and 100 guard.
The respawn must restore the defender to its original spawn within compact-position tolerance, after death occurred measurably away from spawn.
No block, dodge, parry, server test hook, combat-constant change, or synthetic state injection is permitted.

## Boundaries
Loopback browser flight only. No deployment, public bind, persistence, account system, production activation, or server combat-rule mutation.
