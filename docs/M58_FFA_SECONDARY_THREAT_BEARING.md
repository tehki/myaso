# M58 - Secondary FFA Threat Bearing

## Objective

Complete the immediate multi-threat spatial read by showing where the M56 secondary attacker is located relative to the local fighter.

M54 identifies the primary attacker.
M55 counts simultaneous attackers.
M56 identifies the deterministic secondary attacker.
M57 adds a bearing for the primary attacker.
M58 preserves all of those behaviors and adds a bearing for the secondary attacker.

## Bearing rule

M58 reuses the M57 authoritative bearing helper.

The secondary bearing is derived from:

- the local fighter's replicated authoritative position;
- the M56-selected secondary attacker's replicated authoritative position.

No additional entity scan is performed.

The existing dominant-axis bearing rule remains unchanged:

- `FROM LEFT`
- `FROM RIGHT`
- `FROM ABOVE`
- `FROM BELOW`

Invalid or coincident positions produce no label.

## UI

Existing threat information remains unchanged:

- `THREAT #<primary>`
- `WINDUP` / `STRIKE`
- `<count> THREATS` when count > 1
- `NEXT #<secondary>`
- primary `FROM <side>`

M58 adds a second compact bearing beside the secondary identity, e.g.:

- `NEXT #3 FROM RIGHT`

The secondary bearing is shown only while at least two valid authoritative threats exist and the M56 secondary ID is valid.

## Deterministic coverage

The M58 composition test proves that:

- the M56 deterministic runner-up identity is preserved;
- its bearing is derived from that exact secondary fighter;
- when the secondary threat disappears and count falls to one, `secondaryNetId` resets to zero and no secondary bearing is produced.

The existing M57 cardinal/dominant-axis edge-case coverage remains unchanged.

## Real-browser acceptance

The dedicated `uisecondarybearing` flight reuses the proven M55/M56 three-browser simultaneous-threat choreography.

Two real attackers move toward the center fighter with genuine keyboard input and commit genuine left-mouse attacks concurrently from opposite sides.

Acceptance requires:

- the center client records `2 THREATS`;
- the primary label identifies one real attacker;
- the M56 secondary label identifies the other real attacker;
- the primary bearing matches the primary attacker's side;
- the secondary bearing matches the opposite real attacker's side;
- both attackers preserve real pointer-down provenance;
- neither attacker client receives a secondary-bearing false positive.

If authoritative damage resolves before the required simultaneous-threat evidence appears, the flight fails closed.

No position, action, damage, or combat state is injected.

## Authority / performance boundary

M58 changes browser presentation, deterministic tests, browser acceptance, CI, and documentation only.

It does not change:

- server simulation;
- attack reach, arc, damage, timing, movement, facing, guard, dodge, block, or parry;
- primary/secondary threat ranking;
- score or match lifecycle;
- networking protocol or snapshot size;
- persistence;
- deployment, public bind, or runtime activation.

The render path retains the existing single threat scan. M58 adds one `Map.get(secondaryNetId)`, scalar bearing math, and cached DOM updates only when the bearing changes.

## Base / rollback

Base is frozen M57 exact head `a8c4c858f6f133de5438bf61798d3b562cf3945d`, validated by quality CI #208 / run `35512043143` FULL PASS.

Rollback is to close/discard the M58 branch/PR; M57 remains unchanged. No merge or deployment is authorized by this milestone.
