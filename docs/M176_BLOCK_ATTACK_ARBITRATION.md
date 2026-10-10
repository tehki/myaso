# M176 — Block / Light-Attack Arbitration

## Goal

Make fresh wheel-back defense consistent with recovery buffering: a simultaneous block/parry edge plus LMB from idle resolves exclusively to Block instead of starting a light attack.

## Contract

- Wheel-back remains the 240 ms short block with the unchanged 125 ms parry window.
- A fresh same-input-tick block + light edge from Idle resolves to Block.
- The simultaneous LMB edge is consumed; no standing or directional light attack may start behind the block.
- Block costs no stamina and the arbitration adds no stamina spend.
- Releasing/expiring block returns to Idle normally.
- Existing attack-windup feints are unchanged because feint handling remains earlier in the action pipeline.
- Existing recovery buffering remains unchanged: block already outranks a late light edge there.
- Roll, kick, jump, running attack, heavy attack, damage, guard, timings, hitboxes, packets, snapshots, and protocol constants are unchanged.

## Acceptance

JS and authoritative Rust kernel regressions prove a true same-input-tick block + LMB resolves only to Block, preserves stamina, deals no damage, and returns to Idle after block release.

The existing real Chrome + Firefox `uiparry` gate becomes a strict superset:

1. preserve the existing M33 genuine parry exchange;
2. wait until both clients recover to authoritative Idle;
3. aim the former defender away from the peer;
4. deliver one genuine wheel-back short-block gesture followed within the live 240 ms block window by one bounded LMB gesture;
5. require both local and remote authoritative action streams to observe Block;
6. require neither stream to observe any standing or directional light-attack state, including after block recovery;
7. require unchanged health and guard.

The staged browser gesture avoids browser-driver multi-source ordering ambiguity; JS/Rust kernels remain the authority for true same-tick resolution.

The playable build remains intentionally closed while combat acceptance continues.
