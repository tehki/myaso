# M110 — Real Heavy Guard-Break Pressure

## Objective

Prove the anti-turtling consequence of the M105 heavy strike through two real browser clients: a defender that simply holds ordinary directional Block cannot absorb repeated heavy commitments for free.

## Real-browser acceptance

The `uiheavyguardbreak` flight runs the production client in Chrome and Firefox against one loopback authoritative server.

- Chrome moves into heavy range and Firefox faces the threat.
- Firefox holds one genuine RMB directional Block continuously beyond the 115 ms fresh-parry window.
- Chrome submits genuine `E` heavy-strike controls.
- The first authoritative blocked heavy must preserve both fighters at 100 HP and spend exactly 64 guard, producing `100 -> 36`.
- The held Block intentionally prevents guard regeneration between strikes, matching the existing server rule that guard regenerates only while the fighter is not in `Block`.
- After the unchanged 840 ms heavy commitment finishes, Chrome submits the second genuine heavy.
- The second authoritative blocked heavy must spend the remaining guard, producing `36 -> 0` while defender HP remains 100.
- The defender must expose the authoritative `STUNNED` guard-break transition and `guard-broken` feedback.
- The attacker must expose `guard-break-confirm`, remain unstunned, and retain 100 HP / 100 guard.
- The sequence must not resolve as a parry.
- Exactly two authoritative heavy commitments are required. Browser E edges may be retried only when the preceding attempt is a completely clean input-latch miss with unchanged authoritative vitals and no new heavy commitment.

## Why this matters

M107 proves that one heavy can be blocked, parried, or dodged. M109 proves that a whiffed heavy can be punished during its long recovery. M110 closes the other side of the commitment loop: passive held Block survives a heavy without taking HP damage, but two committed heavies break full guard and create a real punishable stun.

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
