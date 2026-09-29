# M56 - Secondary FFA Threat Identity

## Objective

Make M55 simultaneous-threat pressure actionable by identifying the next-most-immediate attacker, not only the total threat count.

M54 selects the primary authoritative threat. M55 counts all simultaneous valid threats. M56 preserves both behaviors and adds one deterministic secondary network ID.

## Ranking

Threat eligibility is unchanged from M54/M55:

1. replicated action is `AttackWindup` or `AttackActive`;
2. attacker/local position and attacker facing are finite;
3. the local fighter is inside authoritative attack reach plus fighter radius;
4. the local fighter is inside the attacker's authoritative attack arc;
5. the local fighter is alive.

All valid threats share the same deterministic ordering:

1. active strike before windup;
2. nearer attacker before farther attacker;
3. lower authoritative network ID as the final tie-break.

The primary result remains the existing return value from `fighterThreatNetId()`.
The reusable summary now exposes:

- `count`: total simultaneous valid threats;
- `secondaryNetId`: the second-ranked valid threat, or 0 when fewer than two exist.

The primary and secondary are selected in one pass with scalar state only. No second entity scan and no per-frame result allocation is added.

## UI

The M54/M55 cue remains intact:

- `THREAT #<primary> · WINDUP`
- `THREAT #<primary> · STRIKE`
- `<count> THREATS` when count > 1

M56 adds:

- `NEXT #<secondary>`

The secondary label is hidden whenever fewer than two threats are valid.

## Deterministic coverage

JavaScript coverage proves:

- the second-ranked threat follows the same active/distance/network-ID ordering as the primary;
- primary selection remains unchanged;
- count remains unchanged;
- the previous primary is correctly demoted to secondary when a better threat appears later in iteration order;
- one-threat, zero-threat, dead-local, and invalid/empty-state paths clear `secondaryNetId` to zero.

## Real-browser acceptance

The dedicated `uisecondarythreat` flight reuses the proven M55 three-browser choreography.

Two real attacker clients move inward with genuine keyboard input and commit real left-mouse attacks concurrently toward the center client.

Acceptance requires:

- the center client observes a real `2 THREATS` transition;
- the primary label identifies one of the two actual attackers;
- `NEXT #<id>` identifies the other actual attacker;
- both attackers preserve real pointer-down provenance;
- neither attacker client receives a secondary-threat label for the center player's pressure;
- if authoritative damage resolves before the required simultaneous-threat evidence, the flight fails closed.

No combat state is injected.

## Authority / performance boundary

M56 changes browser presentation, deterministic tests, browser acceptance, CI, and documentation only.

It does not change:

- server simulation;
- attack reach, arc, damage, timing, movement, facing, guard, dodge, or parry rules;
- score or match lifecycle;
- networking protocol or snapshot size;
- persistence;
- deployment, public bind, or runtime activation.

The render hot path retains one existing entity scan. Secondary selection adds only scalar comparisons and one reused integer field.

## Base / rollback

Base is frozen M55 exact head `325b3580dcb0dba9ef4ae15a2fb9d3d9051fbdd0`, validated by quality CI #205 / run `35505133897`, attempt 2 FULL PASS.

Rollback is to close/discard the M56 branch/PR; M55 remains unchanged. No merge or deployment is authorized by this milestone.
