# M167 — Confirmed Stamina Denial

## Goal

Make low-stamina feedback authoritative at the input-processing boundary.

M166 made exhaustion readable from the latest replicated stamina value. M167 removes the remaining threshold-edge race: the client can predict that an action is unaffordable, but it does not display the denial until the server has acknowledged the exact input tick and the authoritative fighter state still confirms a stamina rejection.

## Contract

- Roll remains 28 stamina.
- Kick remains 18 stamina.
- Jump remains 14 stamina.
- A low-stamina attempt is queued locally only when the latest replicated authoritative stamina is below the unchanged action cost.
- The real input is still sent to the server normally.
- The client records the exact client tick that carried the attempted action.
- No denial is displayed until processedClientTick reaches or passes that submitted tick.
- If authority accepted the action, the pending denial is discarded.
- If authority no longer reports sub-cost stamina, the pending denial is discarded.
- Only an acknowledged, still-sub-cost rejection can produce the LOW STAMINA text/pulse.
- No combat, stamina, movement, input, packet, snapshot, or protocol constants change.

## Acceptance

The M167 real-browser gate uses Chrome + Firefox and proves the runtime order:

1. low-stamina roll attempt queued;
2. genuine wheel-forward included in a concrete client input tick;
3. server acknowledgement reaches/passes that tick;
4. authoritative stamina remains below 28 and no Dodge/DodgeRecovery begins;
5. rejection is marked confirmed;
6. only then is the stamina-denied feedback shown.

The gate also preserves the M165/M166 invariants: denied roll input spends no stamina, changes no HP/guard, and remains genuine browser input.
