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

Two real attackers move toward the center fighter with genuine keyboard input and commit coordinated genuine left-mouse attacks from opposite sides. If Firefox is an attacker, its pointer-down is confirmed first, then the faster second browser commits immediately so the authoritative windups overlap despite cross-driver startup jitter.

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

## Inherited M36 acceptance stabilization

Quality run #210 / `35515631025` stopped twice at inherited M36 before M58 executed.

Both failures had the same fail-closed signature:

- M24 authoritative dodge acceptance had already passed on the same exact head;
- Firefox recorded genuine `KeyS` + `Space` down/up controls;
- Chrome recorded a genuine left-mouse attack;
- the authoritative strike still landed for 34 HP before the M36 dodge overlap was established.

The previous M36 choreography launched the Chrome pointer-down and Firefox dodge command concurrently with a 20 ms Firefox driver-side pause. That leaves cross-driver command-start ordering uncontrolled: the dodge can begin too early relative to the attack and exhaust its 118 ms iframe before the 135 ms strike.

The stabilization confirms the attacker pointer-down first, waits 35 ms, then issues the genuine Firefox dodge sequence with no additional driver pause. With both clients sending inputs at 60 Hz, each input can wait at most about 16.7 ms for its next send. The resulting authoritative dodge request is therefore expected roughly 18-52 ms after the attack request: after attack commitment, before the strike, and with the unchanged 118 ms iframe covering the unchanged 135 ms strike.

No server code, attack timing, dodge timing, iframe duration, damage, geometry, feedback threshold, or real-input provenance requirement is changed.

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

Validation also restores the previously proven M36 concurrent Chrome/Firefox dodge-command ordering and coordinates M55/M56/M58 dual-attacker pointer-downs to remove cross-driver startup races. These are harness-only changes; combat timing and acceptance thresholds remain unchanged.

## Base / rollback

Base is frozen M57 exact head `a8c4c858f6f133de5438bf61798d3b562cf3945d`, validated by quality CI #208 / run `35512043143` FULL PASS.

Rollback is to close/discard the M58 branch/PR; M57 remains unchanged. No merge or deployment is authorized by this milestone.
