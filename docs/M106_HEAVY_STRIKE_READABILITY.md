# M106 — Heavy Strike Control and Readability

## Objective

Expose the M105 heavy committed strike to real players while preserving the exact authoritative combat/protocol contract proven by M105.

M106 is presentation and control only:

- dedicated `E` heavy-strike input;
- matching offline practice and authoritative online behavior;
- explicit heavy windup/active/recovery readability;
- heavy-aware threat selection and dodge feedback;
- real Chrome/Firefox acceptance using the actual keyboard control.

## Base

M105 exact green head `474cbcc416d73e75d985fdf2a55a7b6b4339cc14`.

Quality run `36106301967`, job `107979493753`: PASS.

M105 already proves:

- 320 / 100 / 420 ms heavy commitment;
- 46 health damage;
- 64 guard damage;
- 28 knockback;
- 82 reach and `PI * 0.68` arc;
- action wire codes 9 / 10 / 11;
- spare input bit 3;
- unchanged 6-byte input sample / 34-byte three-sample packet;
- redundant heavy-edge recovery;
- prediction-history retention;
- complete inherited browser, FFA, input-loss and 512-player capacity acceptance.

## Player control

`E` is the dedicated heavy-strike key.

Existing controls remain unchanged:

- LMB: light attack;
- RMB: block / parry;
- Space: dodge;
- WASD: movement;
- mouse: aim.

A dedicated key avoids modifier ambiguity and keeps light attack immediately available.

The heavy edge remains one-shot:

- a non-repeating `KeyE` keydown arms one heavy request;
- the request is included in the next authoritative input sample;
- it is cleared after send just like light attack/dodge one-shot state;
- blur/visibility input release clears a pending heavy request.

## Offline practice parity

`web/game.mjs` now sends `heavyAttack` through the same combat model used by the M105 kernel.

Practice rendering uses a distinct heavy tell:

- orange windup;
- red active strike;
- heavy reach/arc geometry;
- dashed commitment ring.

The practice bot also recognizes heavy windup as a defendable tell. No bot damage/timing constants changed.

## Authoritative online parity

`web/online-game.mjs` sends `heavyAttack` through the existing authoritative client.

Prediction mirrors only the already-authoritative M105 movement commitment:

- heavy windup: 0.20x movement;
- heavy active: no movement;
- heavy recovery: 0.35x movement.

No local damage, guard, action timing or hit authority is introduced.

The online heavy tell uses the same center-distance envelope as authority:

`COMBAT.heavyAttack.reach + COMBAT.fighterRadius`.

## Readability

Replicated action codes remain:

- 9 — heavy windup;
- 10 — heavy active;
- 11 — heavy recovery.

Readability surfaces expose:

- `HEAVY WINDUP`;
- `HEAVY STRIKE`;
- `PUNISH · Heavy recovery`;
- local heavy commitment/recovery hints.

Threat selection uses the heavy profile's own reach and narrower arc instead of light-attack geometry.

## Dodge parity

The existing authoritative dodge readability state machine now treats both light and heavy attacks as committed strike lifecycles.

A heavy dodge is credited only after:

1. authoritative heavy windup/active threat is observed;
2. the defender is dodging with stable HP/guard;
3. authoritative heavy active is observed;
4. the attacker reaches heavy recovery without defender damage.

The same existing `dodge-success` / `dodge-evaded` feedback is reused.

## Real browser acceptance

Scenario: `MYASO_PVP_SCENARIO=uiheavy`.

The Chrome attacker and Firefox defender must prove:

- real movement keydown/up reaches the arena;
- real `KeyE` keydown/up reaches the arena;
- one authoritative heavy hit leaves the defender at exactly 54 HP;
- attacker renders `Opponent hit - 46 HP.`;
- defender renders `Hit taken - 46 HP.`;
- defender observes `HEAVY WINDUP` or `HEAVY STRIKE`;
- defender observes `PUNISH · Heavy recovery`;
- attacker observes a heavy commitment/recovery hint.

## Focused CI

The M106 gate:

- syntax-checks offline/online/readability/flight modules;
- runs heavy readability and combat-model tests;
- performs the real Chrome/Firefox `uiheavy` flight.

All inherited M105 and earlier quality gates remain required.

## Unchanged

M106 does not change:

- heavy or light damage;
- windup/active/recovery durations;
- reach/arc constants;
- knockback;
- guard pressure;
- dodge/parry/block rules;
- input packet size or protocol version;
- snapshot encoding;
- FFA scoring;
- replication cadence/interest management;
- persistence;
- deployment/runtime configuration.

## Rollback

Close/discard M106; M105 remains the exact green kernel base.
