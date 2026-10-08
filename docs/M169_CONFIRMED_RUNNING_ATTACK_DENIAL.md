# M169 — Confirmed Running-Attack Stamina Denial

## Goal

Close the final discrete stamina-gated attack gap after M168: a genuine held-RMB run plus LMB strike submitted below the unchanged 10-stamina running-attack cost must fail closed and explain the rejection only after server acknowledgement.

## Contract

- Running attack remains 10 stamina.
- The real control chord remains: hold RMB past the 180 ms run threshold, hold movement, then press LMB.
- A committed run+LMB edge is exclusively a running-attack attempt.
- If authority cannot pay the 10-stamina cost, that attack edge is consumed. It must not degrade into a free ordinary or directional light attack.
- Genuine sprint drain may continue while RMB + movement are held; that continuous drain is not an attack cost.
- The low-stamina cue is queued from the genuine control chord but is not shown until `processedClientTick` acknowledges the submitted run+attack input and authority still reports rejection below 10 stamina.
- Denial telemetry preserves `queued → submitted → confirmed-rejected → shown`.
- No running-attack or light-attack action state may occur on the denied edge.
- HP and guard remain unchanged.
- No stamina costs, regeneration/drain rates, damage, guard, movement speeds, timings, hitboxes, packet layouts, snapshot layouts, or protocol constants change.

## Acceptance

The existing early `uistaminaconfirmed` Chrome + Firefox gate is extended as a strict superset of M168:

1. drain authoritative stamina below 8 using genuine held-RMB running;
2. prove confirmed rejection for roll, kick, and jump as before;
3. submit a genuine RMB-hold + movement + LMB running-strike chord;
4. prove the exact submitted client tick is acknowledged before the low-stamina running-attack cue appears;
5. prove no running-strike state and no ordinary/directional light fallback occurs;
6. preserve clean HP/guard and unchanged combat constants.

Dedicated JS and Rust kernel regressions independently prove the low-stamina run+attack edge is consumed without light fallback.

The playable build remains intentionally closed while combat acceptance continues.
