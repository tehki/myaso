# M138 — Real Jump-Attack Counterplay

## Objective
Prove that the existing narrow jump attack can be answered by the existing Wilds-style defensive controls through genuine Chrome/Firefox input and authoritative replication, without changing combat balance.

## Scenarios
M138 adds three real-browser acceptance scenarios:

- `uijumpattackblock`: defender pre-ages one wheel-back short block so impact lands after the 125 ms parry window but before the unchanged 240 ms block expires.
- `uijumpattackparry`: defender sends wheel-back during the 105 ms jump-attack windup so impact lands inside the unchanged parry window.
- `uijumpattackdodge`: defender sends wheel-forward with a perpendicular pointer-owned roll timed so the unchanged 125 ms iframe covers impact.

The dodge flight swaps browser roles so Chrome owns the roll control while Firefox owns the attacking chord.

## Real input proof
Every scenario requires one genuine WebDriver `Space + LMB` chord with:

- exactly one Space keydown/up pair;
- exactly one LMB pointerdown/up pair;
- Space and LMB downs within 60 ms;
- no plain jump before authoritative jump-attack windup.

Defensive proof requires the corresponding real wheel event, and dodge also requires the redundant real `S` key evidence used by the existing pointer-owned roll acceptance helper.

## Authoritative acceptance
Both browsers must observe jump-attack windup and active state for the attacker.

Block and dodge must continue into jump-attack recovery. Parry must instead transition the attacker from jump-attack active into the existing stunned state on both the attacking client and the observing client.

## Combat result
No combat constants change.

- Block: both fighters remain at 100 HP; defender takes exactly 52 guard pressure and does not parry.
- Parry: both fighters remain at 100 HP / 100 guard; defender receives parry success and attacker receives parried/stunned feedback.
- Dodge: both fighters remain at 100 HP / 100 guard; attacker receives dodge-evaded and defender receives dodge-success feedback; no parry is accepted.

## Boundaries
M138 changes no combat timing, damage, reach, arc, stamina cost, movement, packet encoding, snapshot encoding, or server resolution rules.

Production-page code only extends the existing query-gated acceptance observer to the three M138 CI scenarios.

The playable build is not opened for this milestone.
