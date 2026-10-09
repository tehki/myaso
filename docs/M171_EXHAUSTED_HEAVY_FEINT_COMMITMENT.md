# M171 — Exhausted Heavy Feint Commitment

M171 completes the stamina-gated feint contract for heavy attacks.

Contract:
- heavy feint window stays 160 ms;
- light feint window stays 70 ms;
- feint cost stays 12 stamina;
- KeyE remains the heavy input and wheel-back remains the feint input;
- below 12 stamina, an early KeyE + wheel-back must not enter FeintRecovery;
- the original heavy must continue into Heavy Active;
- the rejected feint must not spend 12 stamina;
- HP, guard, movement, damage, timings, hitboxes, protocol, and snapshot constants stay unchanged.

Acceptance extends the existing real Chrome + Firefox uifeint flight:
1. prove normal light feint;
2. prove exhausted light stays committed;
3. re-establish sub-12 authoritative stamina via genuine running;
4. deliver one browser-owned KeyE + wheel-back chord inside 160 ms;
5. require epoch-stamped KeyE/wheel evidence;
6. require Heavy Active with no FeintRecovery;
7. preserve clean HP and guard.

JS and Rust regressions independently prove the same fail-closed heavy commitment.

The playable build remains intentionally closed.
