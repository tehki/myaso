# M50 - Authoritative FFA Rematch Lifecycle

## Objective

Complete the first repeatable match loop by transitioning an authoritative finished match back into a clean, playable 0-0 match without reconnecting clients.

## Authoritative lifecycle

M50 adds a fixed post-match hold:

- `FFA_MATCH_RESET_MS = 2500`.
- M49 winner/freeze behavior remains unchanged during that hold.
- When the hold expires, the server atomically resets the match and emits one `MatchReset` event.

For every connected fighter the reset restores:

- kill score to 0;
- HP to 100;
- guard to 100;
- spawn position;
- `Idle` action;
- cleared attack-hit and recent-interaction state;
- cleared pending input;
- cleared guard-regeneration lockout.

The authoritative winner is cleared at the same transition. Input and new-player admission reopen only after that reset.

## Replication

M50 adds no wire bytes and does not change protocol version.

The existing snapshot/delta fields already carry all state needed to observe reset:

- kill score metadata returns to 0;
- HP/guard return to 100;
- positions return to spawn;
- action returns to idle.

The normal replication frame therefore publishes the entire rematch transition to all connected clients.

## Browser behavior

M49 deliberately latches local input/prediction when a winning score is observed. M50 unlatches only after authoritative replicated scores return to a clean 0-0 state.

The victory/match-over overlay then clears through the same authoritative state derivation; there is no client-owned reset command.

## Deterministic coverage

Rust coverage proves:

- the M49 frozen state remains intact during the hold;
- exactly one `MatchReset` event is emitted;
- winner state clears;
- all fighters reset to 0 kills, full vitals, idle action, and spawn position;
- input is accepted again after reset;
- new-player admission reopens after reset.

Browser presentation coverage continues to require that 0-0 does not present a winner.

## Real-browser acceptance

The M50 `uirematch` Chrome + Firefox flight:

1. completes the full M49 real two-kill match;
2. observes the frozen 2-0 winner state;
3. waits for authoritative reset;
4. requires both browsers to show 0-0, 100/100 vitals, and no match overlay;
5. sends fresh real movement + pointer attack input;
6. requires authoritative non-lethal HP loss while score remains 0-0.

This proves the reset is not cosmetic: the next match is live and playable.

## Scope / risk

Base is M49 exact head `46f7550bc49705d961d1a78cb3e0afe7c233fccc`, validated by FULL quality CI #187 / run `35391040333`.

M50 changes match lifecycle/reset behavior and acceptance coverage only. It does not change combat damage, action timing, movement parameters, packet size, protocol version, persistence, deployment, public bind, or runtime activation.
