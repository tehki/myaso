# M168 — Confirmed Stamina Actions

## Goal

Extend M167's authority-confirmed exhaustion feedback from roll to every stamina-gated movement control.

The runtime already handles roll, kick, and jump through the same pending-denial path. M168 adds real-browser proof that genuine wheel-forward, RMB kick, and Space jump inputs are each submitted normally and only produce LOW STAMINA feedback after the server acknowledges the exact input tick and still rejects the action for insufficient authoritative stamina.

## Contract

- Roll remains 28 stamina.
- Kick remains 18 stamina.
- Jump remains 14 stamina.
- The client drains below 12 stamina using genuine held-RMB running before each proof when necessary.
- Each action is delivered through its real control:
  - roll: one wheel-forward input;
  - kick: one short RMB press/release;
  - jump: one short Space press/release.
- The input is never suppressed by feedback logic.
- For each action, denial telemetry must preserve:
  `queued → submitted → confirmed-rejected → shown`.
- `processedClientTick` must acknowledge the exact submitted input tick before feedback is shown.
- Authoritative stamina must remain below the unchanged cost for that action.
- No denied action may enter its authoritative action states or spend its action cost.
- HP and guard remain unchanged.
- No combat, stamina, movement, input, packet, snapshot, or protocol constants change.

## Acceptance

The M168 Chrome + Firefox gate proves all three action paths on one authoritative session:

1. establish sub-jump-cost stamina;
2. submit a genuine roll and prove confirmed rejection at <28 stamina;
3. re-establish exhaustion if needed;
4. submit a genuine short RMB kick and prove confirmed rejection at <18 stamina;
5. re-establish exhaustion if needed;
6. submit a genuine Space jump and prove confirmed rejection at <14 stamina;
7. verify every visible LOW STAMINA cue occurs only after server acknowledgement.

The playable build remains intentionally closed while combat acceptance continues.
