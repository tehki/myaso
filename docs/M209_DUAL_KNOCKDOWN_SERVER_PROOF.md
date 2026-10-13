# M209 — authoritative proof for simultaneous roll-knockdown FFA punish

## Flaky evidence
M205 merged-main [#38362788674](https://github.com/tehki/myaso/actions/runs/38362788674) failed M159 on a real 4-browser fight. First victim knocked down at replicated server tick 462, second victim at 465, punisher's sampled light active at 477 — exactly when first victim recovered (tick 477). The test **correctly failed**: both victims were no longer simultaneously knocked down. The next attempt had no sampled 80ms attack-active phase despite a genuine light windup. This is tracked in [issue #242](https://github.com/tehki/myaso/issues/242). Subsequent unchanged reruns completed, but the observed timing/evidence gap requires a fail-closed solution.

## M209 acceptance-only instrumentation
Extend the existing **loopback-only** read-only M201 60Hz Rust server trace to the `uimultiknockdownffahit` real Chrome/Firefox/Chrome2/Chrome3 scenario. Production binds cannot enable the trace. Gameplay and networking remain unchanged. This reuses the trace's real action transitions and hit records; no synthetic combat events or clock interpolation.

The M209 verifier requires a single genuine roller Dodge (server wire action 4), two distinct roll-caused victim Knockdown transitions (wire 19), first contact before second, contacts at most six ticks apart, a single Chrome3 light windup->active (wire 1->2) and exactly one 34HP/66HP server hit to the designated first victim. The attack-active and hit ticks must occur strictly after both knockdowns start and **strictly before the earliest** authoritative recovery from Knockdown. A same-tick active/recovery (the original failure) is explicitly invalid. A conservative 16 tick (260ms at 60Hz) expiry applies even if a recovery transition has not yet arrived in the trace. No damage to the roller or second victim.

Genuine browser evidence remains required separately: one real roller wheel-forward, one real Chrome3 LMB down/up, the selected geometric aim and windup reaim, focus/recovery display, both victim knockdown states, initial and final HP/guard on all four, no collateral, and eventual clean recovery. Browser timestamps are not compared against server ticks. Sampled browser light-active is retained **only as diagnostic information**, never a substitute for a real 60Hz server action edge.

This first increment changes only read-only loopback flag selection, a strict server-origin verifier and negative tests, CI syntax/tests, and the acceptance runner. It does not widen knockdown, attack-active, dodge iframe, range or recovery windows. If the underlying real W3C LMB is genuinely too late, exact-head CI must fail closed and scheduling work can be isolated in a subsequent candidate.

## Release qualification
All Rust/Node quality checks, real Chrome/Firefox four-player M159, M194, three fresh M205 M152 server-tick sessions, M155, M107, M36, FFA lifecycle and 512-occupant capacity in full exact-head CI; then independently confirm merged-main quality. Do not open playable build or deploy production.
