# M23 — Cross-browser authoritative parry

## Objective

Prove that two real browser clients can execute the existing server-owned parry mechanic through the normal WebTransport input and snapshot path.

## Scenario

- Chrome and Firefox connect concurrently to one loopback authoritative shard.
- The lower authoritative player ID is the attacker; the other client is the defender.
- Both clients approach through ordinary movement input.
- The attacker emits a normal attack only while idle and inside attack reach.
- The defender does not pre-block. It reacts only after its browser observes the attacker's authoritative `AttackWindup` state.
- A short browser-side reaction delay keeps the resulting block entry inside the server's existing parry window rather than adding a server test hook.

## Acceptance

Both browsers must independently observe:

- two distinct authoritative player identities;
- the defender entering `Block`;
- the attacker entering `Stunned`;
- defender HP remaining exactly 100;
- defender guard remaining exactly 100;
- sustained snapshots, acknowledgements and inputs;
- p95 browser frame interval below 25 ms.
