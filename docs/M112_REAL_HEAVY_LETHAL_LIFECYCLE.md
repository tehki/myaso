# M112 — Real Heavy Lethal Lifecycle

## Objective

Prove that heavy attack is integrated through the complete authoritative death lifecycle, not only isolated damage/counterplay cases.

M105–M111 establish heavy commitment, readability, counterplay, input-loss recovery, whiff punishment, guard pressure, guard break, and a real post-break punish. M112 closes the lethal path with real browsers.

## Real-browser acceptance

Scenario: `MYASO_PVP_SCENARIO=uiheavydeath`.

Chrome is the heavy attacker and Firefox is the defender.

The flight uses only genuine player controls:

- directional movement via real WASD key edges;
- heavy strike via real `E` keydown/up;
- mouse aim through the real arena;
- no direct simulation mutation;
- no light-attack fallback.

The authoritative HP path must be:

`100 -> 54 -> 8 -> 0 -> 100`

Specifically:

1. first accepted heavy deals exactly 46 HP, leaving 54;
2. second accepted heavy deals exactly 46 HP, leaving 8;
3. third accepted heavy is lethal;
4. the defender renders `DEFEATED · Respawning…`;
5. the attacker renders `Opponent down.`;
6. the authoritative score converges to attacker 1 / defender 0;
7. the defender respawns;
8. both clients converge back to 100 HP / 100 guard;
9. the defeat overlay clears.

Heavy knockback is handled through ordinary movement between committed attacks; the test does not teleport or mutate positions.

## Input reliability

A real WebDriver `E` edge may occasionally miss the client's one-shot outbound latch.

M112 permits a bounded retry only when the attempted heavy is proven to be a completely clean latch miss:

- no new authoritative heavy commitment;
- no HP change;
- no unexpected death or partial resolution.

Any committed whiff, wrong damage, partial state transition, or unexpected resolution fails closed instead of being retried.

The final evidence must contain exactly three authoritative heavy commitments. Extra WebDriver `E` edges caused by clean latch retries do not count as accepted combat actions.

## Scope

M112 changes only the real-browser acceptance harness, CI gate, and documentation.

No production values change:

- heavy damage remains 46;
- heavy guard damage remains 64;
- heavy knockback remains 28;
- heavy timing remains 320 / 100 / 420 ms;
- heavy guard-break stun remains the M111-derived 705 ms;
- light attack, block/parry, dodge, movement, death/respawn, scoring, protocol, replication, persistence, and deployment behavior are unchanged.

## Rollback

Discard the M112 branch/PR. Exact-green M111 head `0281df02a31a69ea292c86f24ad8bef7c7f46b6d` remains the frozen baseline.
