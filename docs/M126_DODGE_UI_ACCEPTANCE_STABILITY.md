# M126 — Dodge UI acceptance stability

## Objective

Make the M36 real-browser dodge-feedback gate deterministic without changing production dodge, attack, feedback, or networking behavior.

## Change

The Chrome defender's genuine W3C pointer-directed wheel-forward roll is now submitted first with a 60 ms browser-owned pause. After 20 ms of that pause, Firefox starts the genuine 180 ms LMB hold.

This keeps both real browser commands in flight before the 135 ms light windup can be consumed by a second cross-session WebDriver call.

M24 remains the authoritative post-windup reaction and geometry proof. M36 continues to require the production dodge messages and feedback on both clients, real wheel/KeyS/LMB provenance, 100 HP / 100 guard for both fighters, and no parry result.

The obsolete browser-local windup polling helper is removed.

M24 also receives a bounded 20 ms observed-windup threshold. M125's zero-delay reaction could overtravel the perpendicular 690 u/s roll outside the unchanged 94-unit hit envelope before `AttackActive`; the historical 35 ms threshold could be too late under CI transport jitter. The 20 ms threshold preserves both the active-frame geometry proof and authoritative delivery margin.

## Boundaries

No combat constants, iframe duration, attack timing, roll speed, roll direction, damage, stamina, reach, guard, parry, protocol, replication, persistence, deployment, or production transport behavior changes.

No playable build is opened.
