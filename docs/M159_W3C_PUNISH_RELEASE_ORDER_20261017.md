# M159 — authentic simultaneous-knockdown punish input delivery

## Verified failure before this correction

[PR #301 exact-head quality run 39063023983](https://github.com/tehki/myaso/actions/runs/39063023983) passed previously failing **M121 real directional light**. It then failed **M159 actionable simultaneous FFA knockdown punish** twice, with actual 60Hz authoritative evidence rejecting an attack whose `attack-active` phase did not overlap both authentic knockdowns before the first recovery.

One observed attempt had second knockdown at `1792266137191` ms and light active at `1792266137455` ms — 264ms apart, just beyond the **unchanged 260ms** knockdown window. Another had first knockdown at `1792266148419` ms and light active at `1792266148682` ms — 263ms. These are *evidence of missed acceptance*, not grounds to enlarge knockdown duration or accept an after-recovery hit.

## Source-only harness correction

M159 already pre-aims and triggers a genuine LMB shortly after the authentic roller dodge, but its pointer down and pointer up were issued as **two distinct ChromeDriver requests**, separated by 40ms sleeping plus the unpredictable driver request/ACK round trip. The R1 LMB control commits a *light attack on release*, so this delay is inside the real action-to-active critical path.

Use **one real W3C pointer action request** `pointerDown(0) → pause(10ms) → pointerUp(0)`. The same pre-aim remains intact; the true native pointer release still commits the attack. The follow-up after the second knockdown still performs the real windup re-aim. This is equivalent in execution mechanism to the existing M221 genuine one-request W3C click, not a simulated DOM or server packet. The unchanged strict `verifyM209DualKnockdownServerPunish()` requires the **real server attack-active AND exact selected 34HP hit inside both knockdowns**, with full wrong-target/no-multiple-hit checks.

No gameplay rules, 260ms window, 135ms windup, hit points, guard, stamina, field positions, protocol, timestamps, knockdown evidence or retry acceptance are weakened. There is no production deployment.

## Exact-head gate

- Local `node --check scripts/pvp_browser_flight_runner.mjs`, `node --test tests/m121-directional-light-plan.test.mjs tests/m159-genuine-punish-tap.test.mjs tests/light-attack-movement.test.mjs tests/browser-runtime.test.mjs`: **14 tests PASS**.
- The real M159 Chrome/Firefox/Chrome2/Chrome3 quality stage must pass **all authoritative timing proof** on exact new PR head. Check both original M121 and M159 together.
- Full Rust and all other browser/512-quality gates must complete successfully before PR review/merge; no synthetic input, inflated timings, weakened overlap rules, forced green jobs or automatic VPS rollout.
- Run merged-main CI and independent real player-functional acceptance later, separately from this CI harness correction.
