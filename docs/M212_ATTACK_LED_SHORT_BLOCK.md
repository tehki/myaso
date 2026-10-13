# M212 — attack-led genuine short-block acceptance

## Evidence

M211 PR #249 head `39036dcc0cc4c1bd6e9509e45b850cd25950e0d5` failed exact-head quality run [#38432344532](https://github.com/tehki/myaso/actions/runs/38432344532), M194 first fresh Chrome/Firefox real UI block-only guard-break trial. See [Issue #250](https://github.com/tehki/myaso/issues/250).

The browser observer recorded exactly one Chrome LMB pointerDown ~579.7ms, real pointerUp ~782.4ms (**203ms hold despite a nominal 10ms**); Firefox's single true wheel-back arrived at ~538ms with blocking feedback at 576ms. The light hit was registered at ~968ms (defender HP 66, guard 100). Within the Firefox observer clock alone wheel-to-hit was ~430ms, outside unchanged 240ms short block. The M34 fail-closed guard correctly rejected it.

Do **not** compare uncalibrated Chrome and Firefox monotonic clocks.

## Candidate acceptance-only correction

M208 initiated Firefox wheel before Chrome W3C click and capped the Firefox wheel-command ACK wait at 65ms. That cannot bound the subsequent real Chrome pointerDown→pointerUp release duration, and the block can expire while a W3C click is still executing.

M212 uses one genuine Chrome W3C down/pause/up, waits for that W3C command to complete, then immediately dispatches one genuine Firefox W3C wheel-back. It thus aligns the 240ms block with the real Chrome click's *completion* rather than the variable click hold duration. This is a scheduling hypothesis to prove in **real browsers**; it is **not** sufficient to pass merely based on callback order. If the real wheel arrives after strike or inside the unchanged 125ms parry phase, the existing strict CI must fail.

- No synthetic `dispatchEvent`, direct server action, second click/wheel, hidden retries, or forged acceptance.
- No Rust game rules, state machine, protocol, guard/stamina values, 125ms parry, 240ms block or 34HP light damage changed.
- Keep one genuine Chrome click and one genuine Firefox block wheel per exchange, exactly 100 HP and -38 guard on a guarded light, no parry, full final guard-break evidence.
- Deterministic Node tests check slow (203ms) click completion ordering and both browser driver failures.
- Full fresh Chrome/Firefox M194 repetition, all exact-head quality, then independent merged-main quality required. Do **not** merge on green Node tests alone.
- No public playable or production launch.

Potential limitation: if Firefox's genuine wheel ingress after Chrome ACK is too slow, the wheel may enter the parry zone or arrive after the first hit. Reject that real exchange rather than weaken the gate; use server-native tick evidence to tune any future choreography.
