# M215: observed successful wheel-forward roll feedback, read-only

A second, independent slice of [M196 responsiveness issue #221](https://github.com/tehki/myaso/issues/221) pairs real wheel-forward mouse events with *successful* authoritative roll action and browser-visible "Dodging" event cue. The unchanged rigorous three-browser M162 proof requires genuine W3C wheel events, opener dodge + recovery, third-party suppressor dodge + recovery, original 260ms defender knockdown/no re-catch, verification dodge + fresh knockdown and 100HP/100guard. **M215 logs only after those checks pass**.

The observation samples are three **genuine roll events per successful M162 session**: Chrome opener, Chrome2 suppressor, and Chrome2 post-recovery verification roll. Firefox is still the actual defender in the same strict real-browser flight, but M215 does not pretend its client generated a roll.

Each pair uses only timestamps recorded by the *same actor browser*:
- Wheel `epochMs` → corresponding replicated authoritative dodge action `epochMs` = client-observed transition delay. Neither is the instant of server acceptance or server-to-client latency.
- Wheel `t` → DOM event-text transition `t` = locally visible event cue delay (not a graphics frame present-time). Repeat suppressor cues are bounded to before the next real wheel so a later cue is not misattributed.

Each report includes true sample count, missing count, min/p50/p95/max and per-phase browser, server tick and timings. No cross-browser wall-clock subtraction; missing/negative/stale intervals produce `null` rather than fictional zero. Small-N percentiles are diagnostic and never a performance SLA.

This does **not** qualify human-reported feel, render-present latency, parry/kick/jump success feedback or impaired-network latency. Those remain on #221. No combat, authoritative Rust/protocol, physics, UI rendering, event dispatch, rollback or public playable behavior is changed.
