# M61 - Secondary FFA Guard Arc

## Objective

Complete the simultaneous-threat directional read by showing whether the deterministic secondary attacker is inside the local fighter's current authoritative guard arc.

M54 identifies the primary attacker.
M55-M56 expose simultaneous and secondary threats.
M57-M58 add primary and secondary bearings.
M59 adds the secondary attack phase.
M60 adds the primary guard-arc relation.

M61 adds the same compact relation to the M56-selected secondary attacker:

- `FRONT` when the secondary attacker lies inside the unchanged directional block/parry arc;
- `FLANK` when the secondary attacker lies outside that arc.

The cue is presentation only. It does not block, parry, turn the fighter, or predict a future combat result.

## Authority source

M61 derives the secondary relation only from replicated authoritative state already present on the client:

- local fighter position;
- local fighter facing;
- the already-selected M56 secondary attacker position;
- unchanged `COMBAT.block.halfAngleRadians`.

It reuses `fighterThreatGuardArcLabel()`, the same scalar angle-delta presentation helper introduced for M60.

No new entity scan is performed. The existing M54-M60 threat scan still selects primary and secondary identities once, and M61 evaluates the already-fetched secondary attacker.

## UI

A simultaneous-threat group can now read:

`THREAT #1 WINDUP FROM LEFT FLANK 2 THREATS NEXT #3 WINDUP FROM RIGHT FRONT`

With the center fighter facing right, the left attacker is outside the current guard arc while the right attacker is inside it.

The secondary guard relation is hidden whenever:

- fewer than two valid threats exist;
- there is no valid secondary threat identity;
- the relation cannot be derived from valid authoritative position/facing state.

## Deterministic coverage

The M61 unit coverage proves that primary and secondary guard relations are independent:

1. with the center fighter facing right, left is `FLANK` and right is `FRONT`;
2. after an authoritative-facing reversal, left becomes `FRONT` and right becomes `FLANK`.

M60 already covers invalid/coincident geometry for the shared helper.

## Real-browser acceptance

Scenario: `uisecondaryguardarc`.

It reuses the stabilized deterministic three-browser choreography:

- Chrome #1 attacks from the left;
- Firefox #2 is the center observer;
- Chrome2 #3 attacks from the right.

The flight preserves the complete M55-M60 simultaneous-threat evidence:

- two simultaneous authoritative threats;
- deterministic primary/secondary identities;
- opposite primary/secondary bearings;
- authoritative secondary `WINDUP` and `STRIKE` phases;
- primary guard-arc relation.

M61 additionally requires the secondary relation to be the geometric opposite for the unchanged center facing:

- primary left #1 => primary `FLANK`, secondary right #3 => secondary `FRONT`;
- primary right #3 => primary `FRONT`, secondary left #1 => secondary `FLANK`.

The secondary guard-arc cue must not leak to either attacker client.

No combat state, facing, action, damage, or position is injected.

## Performance boundary

M61 adds one scalar guard-arc calculation for the already-fetched secondary attacker and one cached DOM token.

It adds:

- no entity iteration;
- no network field;
- no snapshot bytes;
- no server work.

## Unchanged behavior

M61 does not change:

- block half-angle or parry window;
- attack timing, reach, arc, damage, or movement;
- dodge, guard pressure, guard break, stun, death, respawn, or score;
- primary/secondary threat eligibility or ordering;
- server simulation;
- snapshot/network encoding;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M60 exact head `f2dd857a8346ac669f89a5d16b5e58e3a385b065`, validated by quality #252 / run `35620407841` FULL PASS.

Rollback is to close/discard the M61 branch/PR. M60 remains unchanged.
