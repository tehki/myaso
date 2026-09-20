# M57 - Primary FFA Threat Bearing

## Objective

Make the M54-M56 incoming-threat HUD spatially actionable by showing which side of the local fighter the currently selected primary authoritative threat occupies.

M54 identifies the primary attacker.
M55 counts simultaneous attackers.
M56 identifies the deterministic secondary attacker.
M57 preserves all three behaviors and adds one compact primary-threat bearing label.

## Bearing rule

The bearing is derived only after the existing authoritative primary threat has already been selected.

Inputs are the replicated authoritative positions of:

- the local fighter;
- the selected primary attacker.

No additional entity scan is performed.

The presentation uses a stable four-way dominant-axis rule:

- attacker mostly left of local -> `FROM LEFT`
- attacker mostly right of local -> `FROM RIGHT`
- attacker mostly above local -> `FROM ABOVE`
- attacker mostly below local -> `FROM BELOW`

Equal horizontal/vertical displacement resolves to the horizontal axis for deterministic boundary behavior.

Invalid/non-finite positions or identical positions produce no bearing label.

## UI

The existing threat cue remains unchanged:

- `THREAT #<primary>`
- `WINDUP` / `STRIKE`
- `<count> THREATS` when count > 1
- `NEXT #<secondary>` when a secondary valid threat exists

M57 adds one compact label, for example:

- `FROM LEFT`

The bearing label is hidden whenever no valid primary threat is selected.

## Deterministic coverage

JavaScript coverage proves:

- left, right, above, and below labels from authoritative coordinates;
- dominant-axis behavior for diagonals;
- deterministic horizontal resolution on equal-axis displacement;
- invalid inputs and coincident positions produce no label.

M54-M56 primary/count/secondary selection tests remain unchanged.

## Real-browser acceptance

The dedicated `uithreatbearing` flight reuses the proven M54 three-browser choreography.

A real left-side attacker:

1. moves toward the center player using genuine keyboard input;
2. commits a genuine left-mouse attack aimed at the center player;
3. produces replicated authoritative windup and strike state;
4. lands the expected authoritative 34 HP hit.

Acceptance requires the center player's recorded threat transition to include:

- the actual attacker's network ID;
- the existing WINDUP and STRIKE phases;
- `FROM LEFT`.

The attacker and uninvolved third client must not receive a false incoming-threat cue.

No position, action, damage, or combat state is injected.

## Authority / performance boundary

M57 changes browser presentation, deterministic tests, browser acceptance, CI, and documentation only.

It does not change:

- server simulation;
- attack reach, arc, damage, timing, movement, facing, guard, dodge, block, or parry;
- threat ranking;
- score or match lifecycle;
- networking protocol or snapshot size;
- persistence;
- deployment, public bind, or runtime activation.

The hot path performs no new entity iteration. It derives one primitive string from the already-resolved local and primary-attacker positions and updates DOM text only when the bearing changes.

## Base / rollback

Base is frozen M56 exact head `0f39a7df6383e0cb3c1d4f088fdf694cf9613d70`, validated by quality CI #206 / run `35510677973` FULL PASS.

Rollback is to close/discard the M57 branch/PR; M56 remains unchanged. No merge or deployment is authorized by this milestone.
