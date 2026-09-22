# M63 - Redundant Input Edge Loss Recovery

## Objective

Make the existing three-sample input redundancy actually protect one-shot combat intents when their first datagram transmission is lost.

Before M63, the server accepted redundant samples but applied only the newest accepted sample to the authoritative world. That preserved continuous movement/facing/block state, but an older unseen `attack` or `dodge` edge could be accepted by ingress and then discarded if a newer idle sample was present in the same redundant packet.

M63 closes that gap without making combat client-authoritative.

## Input coalescing contract

The server still:

- deduplicates accepted input ticks through the bounded `InputIngressWindow`;
- uses the newest accepted sample for continuous `move_x`, `move_y`, facing, and block state;
- acknowledges the newest accepted client tick.

For one-shot actions only:

- scan the already-accepted redundant batch from newest to oldest;
- if an accepted sample carries `attack` or `dodge`, copy that newest action edge onto the newest continuous input;
- preserve existing dodge-over-attack priority when both action bits are present on one sample;
- never recover an already-seen tick because ingress deduplication remains authoritative.

This adds no new packet field and does not widen the replay window.

## Why this is needed

The browser already transmits the newest input plus two prior samples.

Example:

1. tick 100 contains a one-shot attack edge;
2. that datagram is lost;
3. tick 101 arrives and redundantly includes tick 100 plus the new continuous state;
4. ingress accepts both unseen ticks;
5. M63 applies tick 101 movement/facing/block while recovering the tick 100 attack edge once.

Without M63, step 5 applied only tick 101 and silently lost the attack intent.

## Deterministic unit evidence

Rust unit coverage proves:

- an older accepted attack edge is recovered onto newer continuous movement/facing/block state;
- when multiple unseen action edges are present, the newest accepted action edge wins;
- the newest accepted tick remains the acknowledgement target.

## Real-browser loss acceptance

Scenario: `inputloss`.

Two genuine browser clients connect over the existing WebTransport path.

The attacker:

- moves into real authoritative melee range;
- emits exactly one attack edge;
- does not issue a second attack attempt.

A loopback-only server fixture, enabled only for this acceptance scenario, deliberately discards the first datagram whose newest sample carries that attack edge.

The runner requires explicit server evidence:

`M63_INPUT_DROP player=<id> sequence=<seq> tick=<tick>`

The next input packet carries the lost edge through the existing three-sample redundancy. The authoritative server must recover it and produce exactly one 34 HP hit.

Acceptance requires on both browsers:

- exactly one defender damage transition;
- defender minimum HP = 66;
- defender guard remains 100;
- no block, dodge, parry, or stun path substitutes for the hit;
- the server drop marker is present.

## Fixture safety

`MYASO_FLIGHT_DROP_FIRST_ATTACK_INPUT=1` is test-only and fail-closed:

- accepted values are only `0` and `1`;
- the fixture is rejected on non-loopback binds;
- production/default behavior is unchanged because the flag defaults off.

## Unchanged behavior

M63 does not change:

- input packet size or protocol version;
- input redundancy count;
- server tick or input send cadence;
- attack/dodge/block timing or combat geometry;
- damage, guard, parry, stun, death, respawn, or score;
- snapshot/reliable replication formats;
- browser prediction or interpolation;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M62 exact head `0c3c8bce935af2e3ee9915e50ee2e2554483a61b`, validated by quality #257 / run `35671822008` FULL PASS.

Rollback is to close/discard the M63 branch/PR. M62 remains unchanged.
