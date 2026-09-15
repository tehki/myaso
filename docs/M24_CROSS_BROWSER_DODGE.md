# M24 — Cross-browser authoritative dodge

## Objective

Prove that a real browser defender can evade an authoritative attack through the existing dodge i-frame mechanic.

## Scenario

- Chrome and Firefox connect concurrently to one loopback authoritative shard.
- The lower authoritative player ID is the attacker; the other client is the defender.
- Both clients approach through ordinary movement input.
- The attacker starts a normal attack from inside authoritative hit reach.
- The defender reacts only after its browser observes authoritative `AttackWindup`.
- The defender sends ordinary dodge input after a short reaction delay; no block input is used.

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
