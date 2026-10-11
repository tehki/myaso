# M189 — Authoritative heavy-phase browser acceptance

## Regression

M188 PR #206 merged at `f1e3f7f` after its full quality pass with three repeated heavy blocks and three repeated heavy parries. The subsequent main-branch run [#38131295160](https://github.com/tehki/myaso/actions/runs/38131295160) failed immediately on the first M188 heavy-block repeat. Firefox correctly registered a real wheel-back but the server resolved it as parry, rather than the 64 guard pressure required by a guarded heavy. Chrome's transient `Heavy strike committed` HUD text occurred only about 192 ms before the outcome in that attempt; this is a presentation event, not a reliable server action-start clock.

## Correction

Enable existing **read-only** `__MYASO_ACCEPTANCE_STATE__.ownActionTransitions` telemetry for `uiheavyblock` and `uiheavyparry`. Detect the real server-replicated `heavyAttackWindup` phase (action 9) from the attacker's state and use the observed transition age to schedule exactly one genuine Firefox W3C wheel-back. Initial targets: 80 ms after observed heavy windup for block and 195 ms for parry, before additional WebDriver/input latency. Record the observed server tick, transition age, delay and availability for diagnosis.

This changes test observation/scheduling only. The Rust server, movement, E strike, 320 ms heavy windup, 125 ms parry, 240 ms block, HP, guard, stamina and packet protocol remain untouched. A parry in the block scenario, missing parry, 46 HP hit, or missing browser-origin input fails closed. No artificial JS combat input, no acceptance-state mutation, no retry after a resolved hit.

## Gate

The three independent `uiheavyblock` and three `uiheavyparry` real Chrome/Firefox trials run early after authoritative Rust checks, followed by original M107, M34/M40, the full PvP/FFA suites, and M8 capacity. Final-head full quality must pass prior to merge. No playable build or production rollout.
