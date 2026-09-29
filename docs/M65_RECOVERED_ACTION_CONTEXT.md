# M65 - Recovered Action Context Fidelity

## Objective

Preserve the original directional context of one-shot combat actions that are recovered from the existing three-sample redundant input batch after first-send datagram loss.

M63 made accepted historical `attack` / `dodge` edges survive input loss. M64 removed the per-datagram accepted-batch allocation. M65 makes the recovered action semantically faithful to the sample on which the player actually committed it.

## Why this matters

Before M65, action coalescing copied only the recovered action bits onto the newest accepted input sample.

That meant a recovered action could inherit a later idle sample's facing and, for dodge, a later movement vector.

Examples:

- a player commits an attack facing left, releases/turns right on the next tick, and the first attack datagram is lost;
- a player commits a leftward dodge, then returns the stick to neutral before the redundant copy arrives.

The server should recover the committed action, not reinterpret it using the later idle sample's direction.

## Coalescing contract

The accepted batch remains bounded and ordered exactly as in M64.

Continuous state still comes from the newest accepted sample:

- acknowledgement tick;
- held block state;
- ordinary movement when no recovered dodge needs its committed movement vector.

Recovered one-shot action context comes from the newest accepted action-bearing sample:

- `attack` / `dodge` bits;
- facing for both attack and dodge;
- movement vector for dodge because it defines dodge direction.

For a recovered attack, normal movement still comes from the newest accepted sample while the attack uses the original committed facing.

Ingress deduplication remains the replay boundary, so an accepted action tick is recovered at most once.

## Deterministic coverage

The M65 Rust regression proves:

1. an older recovered attack keeps its original facing;
2. newer continuous movement and block state remain intact for the recovered attack;
3. a recovered dodge keeps its original movement vector;
4. a recovered dodge keeps its original facing;
5. when several unseen one-shot actions are present, the newest accepted action-bearing sample still wins.

## End-to-end coverage

M65 reuses the inherited M63 real Chrome/Firefox `inputloss` gate.

That gate still deliberately drops first-send action datagrams on loopback and requires authoritative combat recovery through ordinary input redundancy.

M65 does not add a second transport impairment fixture; its new behavioral claim is deterministic action-context selection inside the already-proven loss-recovery path.

## Performance boundary

The production hot path still performs one bounded reverse scan across at most three accepted samples.

M65 adds only a few scalar assignments after the action-bearing sample is found.

No additional allocation, map lookup, packet field, or entity scan is introduced.

## Unchanged behavior

M65 does not change:

- protocol version or input packet size;
- input redundancy count;
- replay/history bounds;
- server tick or client input cadence;
- attack, dodge, block/parry, guard, damage, death, respawn, or scoring constants;
- snapshot/reliable replication;
- interest management;
- browser prediction/interpolation;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M64 exact head `0d4c8b5f5810d78756c0ebafd591387b7c880718`, validated by quality #261 / run `35673005888` FULL PASS.

Rollback is to close/discard the M65 branch/PR. M64 remains unchanged.
