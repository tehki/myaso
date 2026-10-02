# M137 — Real Recovery Jump Attack Buffer

## Objective
Prove the M135 late-recovery `Space + LMB` jump-attack buffer through genuine browser input and authoritative replication.

## Scenario
The Chrome attacker first lands one real 34 HP light attack. During the final part of that committed light recovery, one WebDriver multi-source action sends `Space` and LMB together.

The attacker is staged close enough that the unchanged 18-unit light knockback still leaves the defender inside the existing narrow jump-attack reach.

## Input proof
The flight records real DOM input with epoch timestamps and requires:

- exactly one `Space` keydown/up pair;
- exactly one LMB pointerdown/up pair for the buffered chord;
- Space and LMB downs within 60 ms;
- the chord after authoritative light recovery has begun and late enough to belong to the existing 90 ms jump-attack buffer window;
- the authoritative jump-attack windup only after the chord and after the prior recovery commitment.

## Authoritative acceptance
Both the attacking Chrome client and observing Firefox client must replicate:

`attack recovery -> jump-attack windup -> jump-attack active -> jump-attack recovery -> idle`

A plain `jump` between attack recovery and jump-attack windup is rejected.

## Combat result
Acceptance requires exactly the existing combined result:

- light attack: 34 HP;
- jump attack: 42 HP;
- defender ends at 24 HP / 100 guard;
- attacker remains at 100 HP / 100 guard;
- no parry is accepted.

## Boundaries
M137 changes no combat timing, damage, reach, arc, stamina cost, movement, packet encoding, snapshot encoding, replication rules, persistence, or deployment behavior.

Production-page code only extends the existing query-gated authoritative acceptance observer to the `uijumpattackbuffer` CI scenario.

The playable build is not opened for this milestone.
