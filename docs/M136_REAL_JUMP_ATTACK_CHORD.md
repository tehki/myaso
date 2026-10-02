# M136 — Real Jump Attack Chord

## Objective
Prove the M135 `Space + LMB` jump-attack grammar through the real browser and authoritative network path.

## Real input proof
The Chrome attacker uses one WebDriver multi-source action sequence:

- pointer move aims at the real opponent;
- `Space` keydown and left-button pointerdown occur in the same WebDriver tick;
- both controls remain held across multiple browser/input samples;
- both are released once.

The flight records DOM key/pointer events with wall-clock timestamps and rejects the attempt unless the genuine `Space` and LMB downs are within 60 ms.

## Authoritative acceptance
The diagnostic acceptance hook is enabled only for the `uijumpattack` CI scenario and records replicated authoritative actions, not local prediction.

M136 requires both the attacking Chrome client and observing Firefox client to see:

`jump-attack windup -> jump-attack active -> jump-attack recovery -> idle`

The attacker must enter jump attack directly rather than first entering plain `jump`.

## Combat result
The staged real duel places the attacker inside the existing narrow jump-attack range and keeps aim centered on the opponent. Acceptance requires exactly the existing 42 HP jump-attack hit:

- attacker remains at 100 HP / 100 guard;
- defender ends at 58 HP / 100 guard;
- attacker replica sees opponent HP 58;
- no parry result is accepted.

## Boundaries
M136 does not change jump-attack reach, arc, damage, timings, stamina costs, movement, packet encoding, snapshot encoding, replication, persistence, or deployment behavior.

The only production-file change is extending the already query-gated authoritative acceptance observer to the `uijumpattack` test scenario.

The playable build is not opened for this milestone.
