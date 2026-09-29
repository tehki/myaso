# M27 — Cross-Browser Directional Block Failure

## Objective

Prove that the existing server-owned directional block protects only the facing side in a real two-browser fight.

## Acceptance

- Chrome and Firefox connect concurrently to one loopback authoritative server.
- The lower authoritative player ID attacks; the other client holds ordinary Block while deliberately facing away from the attacker.
- The attacker starts only after observing authoritative Block.
- Both browsers observe `AttackActive + Block` inside the attacker's valid 94-unit hit envelope and attack arc.
- At the same overlap, defender facing must be outside the server block cone (`> PI * 0.46` from the attacker direction).
- The attack must reduce defender HP while defender guard remains exactly 100.
- The attacker must never be stunned and the defender must never dodge, excluding parry/dodge fallback.
- Frame p95 remains below 25 ms with healthy snapshots, ACKs, and input flow.

## Boundaries

This milestone changes only the browser flight harness, CI gate, and documentation. It does not change combat constants, server authority, hit geometry, blocking rules, damage, guard, persistence, deployment, or public-network behavior.

## Rollback

Discard the M27 branch/PR. Exact-green M26 remains unchanged.