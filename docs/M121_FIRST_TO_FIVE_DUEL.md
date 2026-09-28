# M121 — First-to-Five Duel Loop

## Goal

Give the arena a clear purpose: win a readable, repeatable duel by reaching **5 kills** before the rival.

The existing authoritative death, respawn, match freeze, and rematch-reset lifecycle remains the foundation. M121 extends the score target and makes the objective visible throughout the fight.

## Authoritative rule

- kill target: **5**
- kills still increment only from authoritative lethal combat
- the first fighter to 5 becomes the authoritative match winner
- at 5, normal gameplay freezes exactly as in M49
- after the existing 2500 ms post-match hold, M50's authoritative reset returns every fighter to 0 kills, full vitals, spawn position and Idle
- no damage, movement, stamina, guard, action timing, hitbox, packet-size, or protocol-version changes

## Match readability

The scoreboard now states **FIRST TO 5**.

At exactly 4 kills, the current leader receives a non-blocking:

`MATCH POINT · #<id> · 4/5 KILLS`

cue. The cue is visible to every client so the final exchange has clear stakes.

At 5 kills, match-point presentation disappears and the existing full-screen result presentation takes ownership:

- winner: **VICTORY**
- others: **MATCH OVER**
- detail: `#<winner> wins · 5 KILLS`

## Real-browser acceptance

The existing M49/M50 production-UI flights are extended rather than duplicated.

The Chrome attacker must earn the score through genuine browser movement and LMB combat:

1. reach authoritative 1-0 through the existing M48 score flow;
2. earn 2-0 and observe a normal authoritative respawn;
3. earn 3-0 and observe a normal authoritative respawn;
4. earn 4-0, observe respawn, and require **FIRST TO 5** plus **MATCH POINT** on both browsers;
5. earn 5-0 and require authoritative VICTORY / MATCH OVER;
6. keep the 5-0 result frozen past the normal respawn time;
7. for the rematch gate, observe the existing authoritative 0-0 reset and prove fresh combat works again.

No score, HP, death, respawn, winner, or reset state is injected by the harness.

## Deterministic coverage

Rust proves the five-kill target declares the winner, freezes state, then resets atomically.

Browser-presentation tests prove:

- 4 kills is not yet victory;
- 4/5 exposes match point;
- 5 kills exposes victory/match-over;
- match point clears after victory and after reset.

## Design intent

A longer first-to-five duel gives the movement/combat system room to breathe: players can adapt to rolls, shoves, feints, directional sweeps, running strikes, parries and stamina pressure before the match ends.
