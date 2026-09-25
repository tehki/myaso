# M24 — Cross-browser authoritative dodge

## Objective

Prove that a real browser defender can evade an authoritative attack through the existing dodge i-frame mechanic.

## Scenario

- Chrome and Firefox connect concurrently to one loopback authoritative shard.
- The lower authoritative player ID is the attacker; the other client is the defender.
- Both clients approach through ordinary movement input.
- The attacker starts a normal attack from inside authoritative hit reach.
- The defender reacts only after its browser observes authoritative `AttackWindup`.
- The defender starts ordinary dodge input no earlier than 35 ms after first observing windup, with its movement vector rotated perpendicular to the attacker line. Until authoritative `Dodge` is observed (or the attack window ends), the same request may be carried by subsequent normal input samples so a single transport sample cannot decide the proof; no block input is used.

## Acceptance

Both browsers must independently observe:

- two distinct authoritative player identities;
- the defender in `Dodge` while the attacker is `AttackActive`;
- center distance at or below the server hit envelope (94 world units);
- facing delta inside the server attack arc;
- defender HP remaining exactly 100;
- defender guard remaining exactly 100;
- no defender block and no attacker parry stun;
- sustained snapshots, acknowledgements and inputs;
- p95 browser frame interval below 25 ms.

## Acceptance stabilization

CI #169 exact-head retry exposed a transport/timing flake in which the defender eventually entered authoritative `Dodge`, but the single request sample did not overlap `AttackActive` and the first strike landed. The harness now preserves the >=35 ms reaction threshold while carrying the already-triggered ordinary dodge request until authoritative Dodge confirmation or the attack window ends. Acceptance remains unchanged: active-frame overlap inside the real hit geometry and untouched 100/100 defender vitals are still mandatory.


## M113 control-schema adaptation

M24 now preserves its original authoritative iframe/geometry proof under the Wilds control schema. The defender commits the dodge primitive with its **facing vector set perpendicular to the incoming strike**, matching the player-facing rule that a wheel-forward roll always travels toward the mouse pointer. The movement vector is deliberately redundant and cannot steer the committed roll.

The acceptance still requires a live in-range attack-active/roll overlap, unchanged HP/guard, verified geometry, and no accidental block/parry or roll-collision stun.
