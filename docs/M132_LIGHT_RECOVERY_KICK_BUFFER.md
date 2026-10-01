# M132 — Late Light-Recovery Kick Buffer

## Goal

Make short right-click kick taps feel responsive at the end of a committed light attack without allowing a recovery cancel or confusing hold-to-run input.

## Rules

- A fresh kick edge may queue only during the final **90 ms** of centered or directional light recovery.
- The current light recovery always completes before kick windup begins.
- The normal kick stamina cost (**18**) is charged only when the queued kick actually begins.
- A kick cannot queue if stamina is already below the kick cost when the tap arrives.
- An early kick held into the buffer window is not promoted into a free queued kick.
- Held kick input does not auto-repeat; release plus a fresh edge is required.
- A later buffered intent replaces the earlier one, preserving newest-intent behavior across light, block, roll, jump, and kick.

## Right-click safety

The browser control mapping remains unchanged:

- short right-click release below 180 ms emits the one-shot kick request;
- holding right click for 180 ms or more becomes run;
- a run hold does not emit a kick request when released.

M132 adds edge handling inside the combat kernels, so even a client that leaves the kick bit high across more than one simulation tick cannot turn that level into repeated kicks.

## Browser / authority parity

Both combat kernels use the same 90 ms window and fresh-edge rule:

- `src/combat/model.mjs`
- `server/src/simulation.rs`

The authoritative server continues to latch action edges across packet/simulation scheduling, then consumes the recovered kick edge once.

## Acceptance

Deterministic browser and authoritative Rust coverage prove:

1. a late fresh kick waits for full light recovery and pays stamina only on execution;
2. an early held kick is not promoted when the window later opens;
3. held kick input cannot auto-repeat after recovery;
4. a later kick replaces an earlier buffered light attack.

## Boundary

No kick damage, reach, windup, active time, recovery time, knockdown duration, knockback, stamina cost, run threshold, packet format, replication format, or production UI behavior changes.

The playable build is not opened as part of M132.
