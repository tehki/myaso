# M208 — bound real Firefox wheel ACK head start for guard-break qualification

## Observed failure
M205 merged-main quality [#38362788674](https://github.com/tehki/myaso/actions/runs/38362788674), first attempt, correctly rejected a genuine first Firefox wheel-back and Chrome LMB exchange: Chrome inflicted **34 HP**, defender guard remained 100 instead of losing 38 guard. Both inputs were W3C, but the 240ms short-block had expired before the light hit. Earlier M203's pacing reduced the *extra* pointer pause but always awaited the entire Firefox wheel WebDriver **response**, which can vary under CI contention.

## M208 acceptance-only experiment

For each exchange, M208 initiates **one** genuine Firefox wheel-back command first. If its W3C acknowledgement arrives within **65ms**, the original M203 bounded 0–40ms Chrome pointer pause is calculated from measured wheel ACK time. If the acknowledgement is still outstanding after 65ms, it dispatches **one** genuine Chrome W3C pointer click with zero additional pointer pause, while awaiting **both** W3C calls and propagating errors.

This caps only the *test runner's wait for driver acknowledgement*, not the game's short-block, parry, attack windup, input server order, or effect of the wheel. A W3C wheel sent first is not proof its event reached the browser before the Chrome click. The unchanged strict authoritative results determine success: no parry, zero HP loss, exact -38 guard per hit, no extra inputs, authentic pointer aim, and exhausted 100 guard after three unique guarded hits. Race-induced unblocked damage or parry must fail closed.

The helper includes deterministic tests for fast ACK, delayed ACK, rejected before dispatch, rejected after concurrent dispatch, bounded input validation, and source-integration guard rails. Observational diagnostics report ACK speed, Chrome dispatch elapsed time and selected pointer pause, without claiming cross-browser clock synchronization.

No Rust server, gameplay, combat constants, client behavior, public playable build or production deployment changes.

## Promotion
Full exact-head 148-step quality including five-session M194 real Chrome/Firefox guard break, M107, M152, M155, M159, FFA and 512-occupant capacity, then *independent* merged-main quality. If parallel dispatch produces genuine input-order errors, do not merge: use server-native input tick instrumentation instead.
