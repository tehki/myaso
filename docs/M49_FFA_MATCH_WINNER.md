# M49 - Authoritative FFA Match Winner

## Objective

Turn M48 kill scoring into the first complete match rule: a bounded first-to-2 FFA match with one authoritative winner and a persistent match-over state.

## Authoritative rule

- `FFA_KILL_TARGET = 2`.
- The server increments kills only from authoritative lethal combat.
- The first fighter to reach the target becomes `World::match_winner()`.
- The deciding server step emits both the normal `Death` event and `MatchWon { winner, kills }`.
- After a winner exists, simulation ticks continue for networking/replication but gameplay is frozen:
  - no movement;
  - no attacks/actions;
  - no guard regeneration;
  - no respawn;
  - new input is rejected;
  - new fighters cannot join the finished match.
- M49 does not yet reset/restart the arena. Match restart is intentionally a later lifecycle milestone.

## Replication and client presentation

M49 does not add bytes or change protocol version. It uses the M48 authoritative kill score already replicated in the existing metadata byte.

The browser declares match presentation only when an authoritative replicated score reaches the fixed target:

- winner client: `VICTORY`;
- other clients: `MATCH OVER`;
- detail: `#<winner> wins · 2 KILLS`.

The match presentation owns the combat overlay over death/stun presentation. When the winning score arrives, local input is released and local movement prediction stops, preventing post-match prediction/reconciliation jitter.

## Deterministic coverage

Rust coverage proves that:

- the second kill declares the winner;
- `MatchWon` identifies the correct fighter and target score;
- the losing fighter remains dead after the normal respawn interval;
- post-match inputs are rejected;
- post-match joins are rejected;
- fighter gameplay state remains unchanged while server ticks continue.

Browser presentation coverage proves that the same authoritative score produces winner and loser overlays consistently.

## Real-browser acceptance

The M49 `uimatch` Chrome + Firefox flight:

1. reuses the real M48 flow to create an authoritative 1-0 score and normal respawn;
2. performs a second real pointer-input kill;
3. requires both browsers to converge on the same 2-0 scoreboard;
4. requires `VICTORY` for the authoritative winner and `MATCH OVER` for the loser;
5. waits 1500 ms, longer than the normal 1250 ms respawn timer, and requires the loser to remain dead with the same winner state.

No score, death, winner, or match-over state is injected by the harness.

## Scope / risk

Base is M48 exact head `331b121a2727e20647adebb3283c5fd918775a7a`, validated by FULL quality CI #186 / run `35384194178`.

M49 changes match rules and browser presentation only. It does not change damage values, combat timings, movement parameters, snapshot size, protocol version, persistence, public bind, deployment, or runtime activation.
