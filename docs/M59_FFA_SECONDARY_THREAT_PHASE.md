# M59 - Secondary FFA Threat Phase

## Objective

Complete the immediate secondary-threat read by showing whether the M56-selected runner-up attacker is still committing its attack or has entered its active strike.

M54 identifies the primary attacker.

M55 counts simultaneous attackers.

M56 identifies the deterministic secondary attacker.

M57 adds the primary bearing.

M58 adds the secondary bearing.

M59 preserves all of that information and adds the secondary attack phase:

- `WINDUP`
- `STRIKE`

The player can therefore read both *where* the secondary threat is and *how far through its committed attack* it is.

## Authority source

M59 derives presentation only from replicated authoritative combat state already present on the client.

The render path still performs the existing single threat scan.

After M56 selects `secondaryNetId`, the existing M58 `Map.get(secondaryNetId)` supplies the exact secondary attacker object. M59 maps only that entity's replicated action:

- `attackWindup` -> `WINDUP`
- `attackActive` -> `STRIKE`
- every other action -> no secondary phase

No new entity scan, prediction rule, server authority, protocol field, or combat state is introduced.

## UI

The secondary group now reads, for example:

`NEXT #3 WINDUP FROM RIGHT`

and then:

`NEXT #3 STRIKE FROM RIGHT`

The phase is hidden whenever there is no valid simultaneous secondary threat.

Primary threat presentation remains unchanged.

## Deterministic coverage

The M59 deterministic tests prove:

1. the secondary identity still comes from the established M55/M56 ordering;
2. the phase is read from that exact runner-up fighter;
3. `attackWindup` renders `WINDUP`;
4. `attackActive` renders `STRIKE`;
5. non-attack actions render no threat phase;
6. when the simultaneous secondary threat disappears, `secondaryNetId` resets and the phase clears.

## Real-browser acceptance

Scenario: `uisecondaryphase`.

It reuses the stabilized three-browser M55-M58 choreography:

- Chrome is authoritative player #1;
- Firefox is authoritative player #2 and the center observer;
- Chrome2 is authoritative player #3;
- both edge attackers use genuine aim, movement, and mouse input;
- both attacks must overlap authoritatively around the center observer.

M59 additionally requires the center observer to record, for the deterministic secondary identity:

- a visible `WINDUP` phase;
- a visible `STRIKE` phase;
- identity continuity with `NEXT #<secondary>`;
- the M58 opposite-side secondary bearing;
- no secondary phase cue on either attacker client.

If the primary remains in `WINDUP`, an observed secondary `STRIKE` is rejected because the existing threat ordering prioritizes active attacks before windup attacks and would have selected that attacker as primary.

The flight still fails closed if authoritative damage resolves before the simultaneous-threat evidence is observed.

No combat or network state is injected.

## Performance boundary

M59 adds:

- one scalar action-to-label mapping for the already-fetched primary attacker;
- one scalar action-to-label mapping for the already-fetched secondary attacker;
- one cached DOM token updated only when its visible phase changes.

It adds no extra state iteration and no protocol bytes.

## Unchanged behavior

M59 does not change:

- attack windup, active duration, recovery, reach, arc, damage, or movement;
- dodge, iframe, block, parry, guard, stun, death, respawn, or score;
- primary/secondary threat eligibility or ordering;
- server simulation;
- snapshot/network encoding;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M58 exact head `c6fb99978afae20adc2e300ee00f60ef3142d744`, validated by quality #239 / run `35591607620` FULL PASS.

Rollback is to close/discard the M59 branch/PR. M58 remains unchanged.
