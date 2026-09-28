# M110 — Real Heavy Guard-Break Pressure

## Objective

Prove the anti-turtling consequence of the M105 heavy strike through two real browser clients: a defender that repeatedly answers with ordinary directional short Block cannot absorb repeated heavy commitments for free.

## Real-browser acceptance

The `uiheavyguardbreak` flight runs the production client in Chrome and Firefox against one loopback authoritative server.

- Chrome moves into heavy range and Firefox faces the threat.
- Firefox uses genuine wheel-back short directional Block pulses. Chrome starts the real `E` gesture first; Firefox schedules two browser-owned wheel-back pulses at 70 ms and 220 ms. Their 240 ms local short-block windows overlap, so the authoritative Block action remains continuous: its parry age keeps increasing while coverage extends beyond heavy impact. The harness still requires the replicated authoritative `HEAVY WINDUP` to be observed; timing no longer depends on when that snapshot reaches WebDriver.
- Chrome submits genuine `E` heavy-strike controls. The acceptance harness keeps each real `E` depressed for 120 ms so headless browsers have multiple input frames to sample it; this does not change the production heavy timing or binding.
- The first authoritative blocked heavy must preserve both fighters at 100 HP and spend exactly 64 guard, producing `100 -> 36`.
- After the unchanged 840 ms heavy commitment finishes, Chrome submits the second genuine heavy and Firefox repeats the same paired short-Block pulse.
- Guard may recover slightly between short-block windows under the production regeneration rule, but it must remain below the 64-point break threshold before the second heavy.
- The second authoritative blocked heavy must exhaust that remaining guard to `0` while defender HP remains 100.
- The defender must expose the authoritative `STUNNED` guard-break transition and `guard-broken` feedback.
- The attacker must expose `guard-break-confirm`, remain unstunned, and retain 100 HP / 100 guard.
- The sequence must not resolve as a parry.
- Exactly two authoritative heavy commitments are required. Browser E edges may be retried only when the preceding attempt is a completely clean input-latch miss with unchanged authoritative vitals and no new heavy commitment.

## Why this matters

M107 proves that one heavy can be blocked, parried, or dodged. M109 proves that a whiffed heavy can be punished during its long recovery. M110 closes the other side of the commitment loop: repeated short Blocks can survive one heavy without taking HP damage, but sustained heavy pressure still breaks guard and creates a real punishable stun.

This keeps the combat north star intact: active defense is valuable, but there is no free turtling.

## Boundaries

M110 changes only the browser acceptance harness, CI gate, and documentation. It does not change heavy damage, heavy guard damage, timings, reach, arc, movement multipliers, parry timing, guard regeneration, guard-break stun, wire protocol, server authority, persistence, or deployment behavior.

The inherited production values remain:

- heavy guard damage: 64
- guard maximum: 100
- guard-break stun: 520 ms
- guard regeneration: 24 / second
- guard regeneration delay after pressure: 520 ms
- heavy commitment: 320 ms windup + 100 ms active + 420 ms recovery

## Rollback

Discard the M110 branch/PR. Exact-green M109 head `7d2e5c969d52f6acf25028b76e4f2c8190609642` remains the frozen baseline.
