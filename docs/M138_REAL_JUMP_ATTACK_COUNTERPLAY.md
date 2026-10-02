# M138 — Real Jump-Attack Counterplay

## Objective
Prove that the existing narrow jump attack can be answered by the existing Wilds-style defensive controls through genuine Chrome/Firefox input and authoritative replication, without changing combat balance.

## Scenarios
M138 adds three real-browser acceptance scenarios:

- `uijumpattackblock`: defender sends two overlapping real wheel-back pulses 100 ms apart. The second extends the client’s unchanged 240 ms short-block input without restarting the authoritative Block action, so impact lands after the 125 ms parry opening while block remains held.
- `uijumpattackparry`: defender sends wheel-back during the 105 ms jump-attack windup so impact lands inside the unchanged parry window.
- `uijumpattackdodge`: defender sends wheel-forward with a perpendicular pointer-owned roll timed so the unchanged 125 ms iframe covers impact.

The dodge flight swaps browser roles so Chrome owns the roll control while Firefox owns the attacking chord.

## Real input proof
Every scenario requires one genuine WebDriver `Space + LMB` chord with:

- exactly one Space keydown/up pair;
- exactly one LMB pointerdown/up pair;
- Space and LMB downs within 60 ms;
- no plain jump before authoritative jump-attack windup.

Defensive proof requires the corresponding real wheel event. The dodge scenario uses a focused pointer + wheel WebDriver timeline so its single browser-owned delay fits the jump attack’s short windup; the older M107 redundant-`S` roll helper remains unchanged.

## Authoritative acceptance
Both browsers must observe the authoritative jump-attack commitment beginning in windup.

Block and dodge must continue through replicated jump-attack active into recovery. A successful parry resolves on the first active server tick, so snapshots must instead replicate jump-attack windup directly into the existing stunned state on both the attacking client and the observing client.

## Combat result
No combat constants change.

- Block: both fighters remain at 100 HP; defender takes exactly 52 guard pressure and does not parry.
- Parry: both fighters remain at 100 HP / 100 guard; defender receives parry success and attacker receives parried/stunned feedback.
- Dodge: both fighters remain at 100 HP / 100 guard; attacker receives dodge-evaded and defender receives dodge-success feedback; no parry is accepted.

## Boundaries
M138 changes no combat timing, damage, reach, arc, stamina cost, movement, packet encoding, snapshot encoding, or server resolution rules.

Production-page code only extends the existing query-gated acceptance observer to the three M138 CI scenarios.

The playable build is not opened for this milestone.
