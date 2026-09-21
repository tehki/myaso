# M60 - Primary FFA Guard Arc

## Objective

Make the primary incoming threat immediately actionable for directional defense.

M54 identifies the primary attacker.
M55-M56 expose simultaneous and secondary threats.
M57-M58 add primary and secondary bearings.
M59 adds the secondary attack phase.

M60 adds one compact primary-threat relation to the local fighter's current authoritative facing:

- `FRONT` when the attacker lies inside the unchanged directional block/parry arc;
- `FLANK` when the attacker lies outside that arc.

This tells the player whether the current facing is geometrically aligned for a block/parry attempt without changing the block/parry mechanic or performing the defensive action for them.

## Authority source

M60 derives presentation only from replicated authoritative state already present on the client:

- local fighter position;
- local fighter facing;
- M54-selected primary attacker position;
- unchanged `COMBAT.block.halfAngleRadians`.

The helper uses the same angle-delta geometry as the combat model.

No new entity scan is performed. The existing M54-M59 threat scan selects the primary attacker, and M60 evaluates only that already-fetched attacker.

## UI

The primary threat group now reads, for example:

`THREAT #1 WINDUP FROM LEFT FLANK`

or:

`THREAT #3 STRIKE FROM RIGHT FRONT`

`FRONT` means the attacker is inside the current directional guard arc. It does not mean the player is blocking, that the attack has been blocked, or that a parry will succeed.

`FLANK` means the attacker is outside that current guard arc.

The cue is hidden whenever there is no valid primary threat.

## Deterministic coverage

The M60 unit coverage proves:

1. a threat directly along authoritative facing is `FRONT`;
2. the same geometry becomes `FLANK` after the defender turns away;
3. the opposite-side threat changes from `FLANK` to `FRONT` after that same facing reversal;
4. invalid facing/position input produces no label;
5. coincident positions produce no label.

## Real-browser acceptance

Scenario: `uiguardarc`.

It reuses the stabilized M55-M59 three-browser simultaneous-threat choreography and deterministic identities:

- Chrome #1 attacks from the left;
- Firefox #2 is the center observer;
- Chrome2 #3 attacks from the right.

The center fighter keeps its authoritative default facing of 0 radians while both edge attackers use genuine aim, movement, and mouse input.

Therefore:

- if the selected primary is left-side #1, the center must report `FLANK`;
- if the selected primary is right-side #3, the center must report `FRONT`.

The flight also preserves M55-M59 simultaneous count, secondary identity, opposite bearings, and secondary phase evidence, and rejects a guard-arc cue leaking to either attacker client.

No combat state, facing, action, damage, or position is injected.

## Performance boundary

M60 adds only scalar angle math for the already-fetched primary attacker and one cached DOM token.

It adds:

- no entity iteration;
- no network field;
- no snapshot bytes;
- no server work.

## Unchanged behavior

M60 does not change:

- block half-angle;
- parry window;
- attack timing, reach, arc, damage, or movement;
- dodge, guard pressure, guard break, stun, death, respawn, or score;
- primary/secondary threat eligibility or ordering;
- server simulation;
- snapshot/network encoding;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M59 exact head `36ece545620e59a07139e5487904cf9647694d7a`, validated by quality #241 / run `35595576256` attempt 2 FULL PASS.

Rollback is to close/discard the M60 branch/PR. M59 remains unchanged.
