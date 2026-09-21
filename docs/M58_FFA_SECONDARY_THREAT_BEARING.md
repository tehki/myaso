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

Two real Chrome attackers move toward a real Firefox center fighter with genuine keyboard input and commit coordinated genuine left-mouse attacks from opposite sides. The harness establishes authoritative roles deterministically before the flight: Chrome connects as #1, Firefox as #2, and Chrome2 as #3, and fails closed if any assigned ID differs.

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

M36 is a real-control UI/readability acceptance; M24 remains the authoritative dodge timing/geometry proof.

Several exact-head quality runs exposed headless cross-driver timing variance when M36 used Chrome as the attacker and Firefox as the real `KeyS + Space` defender. The repeated fail-closed signature was consistent:

- M24 authoritative dodge acceptance passed on the same code;
- both browsers delivered genuine controls;
- Firefox recorded real `KeyS` + `Space` down/up events;
- Chrome recorded a real left-mouse attack;
- the unchanged 34 HP strike sometimes resolved before Firefox's WebDriver command established the unchanged 118 ms dodge iframe.

Changing Node-side delays or launching the two WebDriver requests together did not remove Firefox command-start jitter reliably.

M58 therefore keeps M36 cross-browser and real-input, but assigns the timing-sensitive defender role to Chrome:

- Firefox is the genuine mouse attacker;
- Chrome is the genuine `KeyS + Space` defender;
- both fighters are positioned and aimed using ordinary real controls before the critical exchange;
- Firefox's slower WebDriver commits the real attack button first;
- after a fixed 20 ms offset, the faster Chrome WebDriver issues the real perpendicular dodge;
- the existing fail-closed requirements remain unchanged: both fighters must keep untouched authoritative vitals/guard, no parry may resolve, and the genuine movement/aim/dodge input provenance must be present.

This changes only browser-test choreography. No server code, attack timing, dodge timing, iframe duration, damage, reach/arc rule, feedback threshold, or production behavior is changed.

## Inherited M55/M56 multi-threat choreography stabilization

Quality run #213 reached M55 after M36 passed but failed closed before M56-M58. Both real attackers delivered pointer input, but the Firefox attacker pointer-down occurred about 223 ms after the Chrome attacker pointer-down. The 135 ms attack windups therefore did not overlap, so the center client correctly observed only one authoritative threat.

The shared M55/M56/M58 harness now removes both sources of cross-driver ambiguity while preserving genuine browser input:

- these three multi-threat scenarios navigate clients sequentially and verify authoritative IDs: Chrome #1, Firefox #2, Chrome2 #3;
- Firefox is therefore deterministically the center observer, while the two Chrome clients are the opposite-side attackers;
- the left spawn's default facing already points toward center, while the right spawn must replicate an approximately π-radian facing change;
- both attackers therefore receive genuine pointer-move aim first, followed by a 60 ms propagation pause;
- authoritative players spawn 96 units apart while unchanged attack reach plus fighter radius is 94 units;
- both edge attackers then use a 260 ms genuine inward movement pulse while that aim remains active, continuously carrying the intended facing through the unchanged 60 Hz input/server path and staging both fighters decisively inside unchanged threat geometry;
- after movement release, another 60 ms settle window lets the persisted facing/movement state reach the server before either attack commits;
- the synchronized attack phase then uses concurrent button-only pointer-down/up actions on the two Chrome drivers, so pointer-move/facing latency and Firefox WebDriver startup latency are outside the unchanged 135 ms overlap window;
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

Validation also stabilizes M36 with deterministic cross-browser control roles and gives M55/M56/M58 deterministic authoritative browser roles plus concurrent same-driver-family attacker commits. These are harness-only changes; combat timing and acceptance thresholds remain unchanged.

## Base / rollback

Base is frozen M57 exact head `a8c4c858f6f133de5438bf61798d3b562cf3945d`, validated by quality CI #208 / run `35512043143` FULL PASS.

Rollback is to close/discard the M58 branch/PR; M57 remains unchanged. No merge or deployment is authorized by this milestone.
