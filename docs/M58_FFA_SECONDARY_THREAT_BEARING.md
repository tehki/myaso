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

The failing inherited choreography confirmed Chrome pointer-down, then introduced a 35 ms Node-side delay before starting the Firefox WebDriver command. Cross-driver command startup added unbounded latency after that delay.

M58 restores the exact choreography used by the previously green M54 head: launch the genuine Chrome pointer-down and Firefox KeyS+Space WebDriver commands concurrently, with a 20 ms pause inside Firefox's W3C action sequence. This removes the Node-side cross-driver round-trip from the critical timing path while retaining a deliberate offset so the unchanged 118 ms dodge iframe overlaps the unchanged 135 ms strike.

On the restored ordering, quality run #213 / `35527645041` passed M36 on the exact code before later stopping at M55 choreography.

A later exact-head quality run #218 / `35557960905` exposed the opposite runner edge: M24 again passed, M36 delivered three genuine Firefox dodges with untouched 100/100 vitals and no parry, but the staged perpendicular movement turned each strike into a spatial miss before the dedicated dodge-evade feedback could be emitted.

M36 now keeps its acceptance strict while making that UI proof deterministic:

- the Chrome attacker approaches farther using ordinary real keyboard movement, placing the defender deeper inside unchanged authoritative reach;
- Chrome aim is delivered with a genuine pointer move and given 50 ms to propagate before the timing-critical exchange;
- the timing-critical Chrome action is then button-only, while Firefox retains the genuine KeyS+Space W3C dodge with the proven 20 ms internal pause;
- the existing fail-closed requirements for untouched vitals, no parry, genuine input provenance, and actual dodge feedback remain unchanged.

M24 remains the authoritative exact dodge timing/geometry proof. No server code, attack timing, dodge timing, iframe duration, damage, reach/arc rule, feedback threshold, or production behavior is changed.

## Inherited M55/M56 multi-threat choreography stabilization

Quality run #213 reached M55 after M36 passed but failed closed before M56-M58. Both real attackers delivered pointer input, but the Firefox attacker pointer-down occurred about 223 ms after the Chrome attacker pointer-down. The 135 ms attack windups therefore did not overlap, so the center client correctly observed only one authoritative threat.

The shared M55/M56/M58 harness now coordinates genuine pointer input rather than launching cross-driver commands blindly:

- both attackers first receive genuine pointer-move aim toward the center fighter;
- the harness gives that facing input 50 ms to propagate through the unchanged 60 Hz input/server path before either attack commits;
- the synchronized attack phase then uses button-only pointer-down/up actions, so pointer-move/facing latency is outside the unchanged 135 ms overlap window;
- if Firefox is one of the two attackers, its pointer-down is confirmed first;
- the second attacker commits immediately afterward;
- both pointer inputs are briefly held, then released;
- acceptance still requires two real pointer-down provenance records and overlapping authoritative threat state;
- if damage resolves before simultaneous-threat evidence, the flight still fails closed.

This changes only browser-test choreography. No threat eligibility, ranking, combat state, timing, geometry, or production behavior is changed.

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
