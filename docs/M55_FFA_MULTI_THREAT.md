# M55 - Simultaneous FFA Threat Awareness

## Objective

Extend M54 so free-for-all pressure remains readable when more than one remote fighter can currently hit the local player.

M54 already selects one deterministic primary threat. M55 preserves that selection and adds the total number of simultaneous valid attackers.

## Threat count rule

The count uses the exact M54 authoritative threat predicate. A remote fighter is counted only when:

1. its replicated action is `AttackWindup` or `AttackActive`;
2. attacker position, facing, and local position are finite;
3. the local fighter is inside authoritative attack reach plus fighter radius;
4. the local fighter is inside the attacker's authoritative arc;
5. the local fighter is alive.

The primary attacker is unchanged:

1. active strike before windup;
2. nearest attacker;
3. lower authoritative network ID.

The existing selector still returns only the primary network ID. A caller-provided reusable summary receives the simultaneous threat count, avoiding a new per-frame presentation allocation.

## UI

The existing centered M54 cue remains the primary signal:

- `THREAT #<netId> · WINDUP`
- `THREAT #<netId> · STRIKE`

When more than one authoritative threat exists, the cue also shows the total, for example:

- `2 THREATS`

The count badge is hidden for zero or one threat.

## Deterministic coverage

JavaScript coverage proves:

- simultaneous valid attackers are all counted;
- the M54 primary selection still prefers active over windup;
- equal-priority selection remains distance/ID deterministic;
- attackers outside reach or arc are not counted;
- dead local fighters reset the count to zero;
- invalid/empty state resets a reused summary instead of leaking stale count state.

## Real-browser acceptance

The `uimultithreat` flight starts three real browser clients.

The left and right clients move inward with genuine keyboard input, then commit real left-mouse attacks concurrently toward the center client.

Acceptance requires:

- the center client records a visible `2 THREATS` transition while a replicated windup or strike is active;
- the primary label is one of the two real attackers;
- the attacker clients do not receive the center player's two-threat badge;
- both attacker clients record real pointer-down provenance;
- if authoritative damage resolves before the multi-threat cue was observed, the flight fails closed rather than retrying through damage.

No combat state is injected.

## Authority and performance boundary

M55 changes browser presentation, deterministic tests, real-browser acceptance, CI, and documentation only.

It does not change:

- server simulation;
- attack reach, arc, damage, timing, movement, facing, guard, dodge, or parry rules;
- score or match lifecycle;
- networking protocol or snapshot size;
- persistence;
- deployment, public bind, or runtime activation.

The hot path adds only one integer counter to the existing M54 scan and reuses one caller-owned summary object. It does not add a second entity scan or allocate a new presentation object per frame.

## Base / rollback

Base is frozen M54 exact head `4ebdaa4623fd6e30e99f7dd9bcb79cf9022040b6`, whose FULL quality CI #204 / run `35502295257` passed.

Rollback is to close/discard the M55 branch/PR; M54 remains unchanged. No merge or deployment is authorized by this milestone.
