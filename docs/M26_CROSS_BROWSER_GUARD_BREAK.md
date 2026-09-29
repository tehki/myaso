# M26 — Cross-Browser Authoritative Guard Break

## Objective

Prove the existing server-owned guard-break path end-to-end between two real browser clients.

## Acceptance

- Chrome and Firefox connect concurrently to one loopback authoritative server.
- The lower authoritative player ID attacks; the other client holds ordinary directional Block.
- The attacker starts only after observing authoritative Block and repeats legitimate committed attacks.
- Both browsers observe an in-range, in-arc `AttackActive + Block` overlap.
- Repeated blocked hits exhaust defender guard from 100 to 0 while defender HP remains 100.
- Both browsers observe the defender enter authoritative `Stunned` after guard reaches 0.
- The attacker must never be stunned and the defender must never dodge, excluding parry/dodge fallback.
- Frame p95 remains below 25 ms and the usual snapshot/ACK/input activity stays healthy.

## Boundaries

This milestone changes only the browser flight harness, CI gate, and documentation. It does not change combat constants, server authority, damage, guard, parry, dodge, movement, persistence, deployment, or public-network behavior.

## Rollback

Discard the M26 branch/PR. Exact-green M25 remains unchanged.