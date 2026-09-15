# M25 — Cross-browser authoritative block

## Objective

Prove that the existing server-owned directional block absorbs a real browser attack as guard damage rather than HP damage.

## Scenario

- Chrome and Firefox connect concurrently to one loopback authoritative shard.
- The lower authoritative player ID is the attacker; the other client is the defender.
- Both clients approach through ordinary movement input.
- The defender establishes normal block before the attacker begins windup, intentionally making the block older than the parry window when the strike becomes active.
- The attacker starts a normal attack only after its browser observes the defender in authoritative `Block`.
- No dodge input is used.

## Acceptance

Both browsers must independently observe:

- two distinct authoritative player identities;
- attacker `AttackActive` overlapping defender `Block` inside the authoritative 94-unit hit envelope and attack arc;
- defender HP remaining exactly 100;
- defender guard dropping below 100;
- no defender dodge and no attacker parry stun;
- sustained snapshots, acknowledgements and inputs;
- p95 browser frame interval below 25 ms.
