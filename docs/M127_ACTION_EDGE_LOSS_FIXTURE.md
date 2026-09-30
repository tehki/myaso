# M127 — Scheduler-independent action-edge recovery

## Objective

Make first-send action recovery deterministic when several realtime datagrams arrive between two 60 Hz authoritative simulation ticks.

## Defects

Post-merge main run #598 dropped the intended M108 heavy-action datagram. A redundant packet could recover the heavy edge, but a newer idle packet could overwrite that recovered input before the next authoritative step.

The loopback loss fixture also treated held action samples too broadly instead of distinguishing a new press from later held ticks.

## Fix

Each fighter now latches rising edges for light attack, heavy attack, dodge, kick, and jump independently from the latest continuous input state. Movement, facing, block, run, and button levels still follow the newest packet.

Pending edges are merged into the next authoritative simulation step and then cleared. A newer idle packet therefore cannot erase a recovered one-shot before simulation consumes it.

The loopback-only loss fixture now identifies action rising edges and does not re-drop every tick of a sustained action hold.

Regression coverage proves both light and heavy recovered edges survive a newer idle update before the authoritative step, and that the loss fixture drops one held-action press only once.

## Boundary

No packet format, client input cadence, combat timing, stamina, damage, reach, iframe, movement speed, replication format, or UI behavior changes.

The fixture changes remain loopback-only. The production server change only makes already-received one-shot edges survive network/simulation scheduler ordering until the next authoritative tick.
