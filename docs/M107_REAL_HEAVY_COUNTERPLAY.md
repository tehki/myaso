# M107 — Real Browser Heavy Counterplay

## Objective

Prove in real Chrome/Firefox play that the M105/M106 heavy committed strike preserves all three core defensive answers:

- directional block;
- fresh parry;
- timed dodge.

M107 is acceptance hardening only. It changes no combat, protocol, prediction, rendering, scoring, replication, or persistence behavior.

## Base

M106 exact green head `7660b10f90106315222700e68aa8c03c23527f79`.

Quality run `36108645317`, job `107986848205`: PASS.

M106 already proves real `E` delivery, one authoritative 46-damage heavy hit, explicit heavy threat phases, and visible heavy recovery.

## Heavy block

Scenario: `uiheavyblock`.

Chrome attacks with the real `E` key. Firefox aims toward the attacker and holds real RMB well before the heavy edge.

The block starts early enough that the 115 ms parry freshness window is expired by the 320 ms heavy active transition.

Acceptance:

- real attacker movement key delivery;
- real `KeyE` down/up;
- real defender RMB down/up;
- defender HP remains 100;
- defender guard becomes exactly 36;
- attacker HP/guard remain 100/100;
- attacker sees `Opponent blocked - guard -64.`;
- defender sees `Block held - guard -64.`;
- no parry feedback is allowed.

This proves the heavy strike applies exactly the M105 64 guard pressure through the normal directional-block path.

## Heavy parry

Scenario: `uiheavyparry`.

Chrome attacks with real `E`. Firefox begins real RMB at approximately 245 ms from the E keydown.

The target timing leaves roughly 75 ms of block age at the 320 ms heavy active frame, inside the unchanged 115 ms parry window while leaving margin for browser/network skew.

Acceptance:

- real attacker movement and `KeyE`;
- real defender RMB down/up;
- both fighters remain 100 HP / 100 guard;
- attacker receives `parried` feedback;
- defender receives `parry-success`;
- attacker exposes an authoritative `STUNNED` overlay.

This proves heavy guard pressure does not bypass the existing fresh-parry rule.

## Heavy dodge

Scenario: `uiheavydodge`.

The browser roles match the already-stable M36 setup:

- Firefox attacks;
- Chrome dodges.

The attacker is staged deeper inside heavy reach, then sends real `E`. Chrome performs a real perpendicular `S + Space` dodge at approximately 270 ms from the E keydown.

That places the unchanged 118 ms dodge iframe across the 320 ms heavy active transition.

Acceptance:

- real attacker movement and `KeyE`;
- real defender `KeyS` and `Space` down/up;
- both fighters remain 100 HP / 100 guard;
- attacker receives `dodge-evaded`;
- defender receives `dodge-success`;
- no parry feedback is allowed.

This proves heavy remains dodgeable in real online play and that M106's heavy-aware dodge readability path resolves correctly.

## Focused CI

The M107 gate:

1. syntax-checks the browser flight runner;
2. runs `uiheavyblock`;
3. runs `uiheavyparry`;
4. runs `uiheavydodge`.

Each scenario starts an independent real-browser/game-server flight so failures remain isolated and no guard/vital state leaks between counterplay modes.

All inherited M106 and earlier gates remain required.

## Unchanged

M107 changes no production gameplay code.

No changes to:

- heavy/light damage;
- guard damage;
- windup/active/recovery timing;
- reach/arc;
- knockback;
- dodge iframe/duration;
- parry window/stun;
- input packet size or protocol version;
- snapshot encoding;
- UI rendering logic;
- FFA scoring;
- replication/capacity;
- persistence;
- deployment/runtime configuration.

## Rollback

Close/discard M107; M106 remains the exact green playable/readable heavy-strike base.
