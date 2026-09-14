# M9 — Replication Priority and Staged Resync

M8 proved that the current authoritative combat simulation is not the first 512-player wall.

At 512 simulated players, the exact-head M8 run kept the 60 Hz simulation tick and 20 Hz replication batch inside budget, while bounded 1100-byte snapshots omitted about 65% of due records and a fresh first resync snapshot omitted about 74%.

M9 therefore changes replication selection, not combat rules or the wire format.

## Objective

Preserve the information that matters to a fight while allowing lower-priority world state to converge over time.

## Selection policy

The authoritative Rust snapshot path now mirrors the established browser/network planning cadence:

- owner state is never cadence-suppressed;
- removals are high priority so stale entities leave promptly;
- vitals, action transitions, active actions, and combat-radius entities bypass background cadence;
- near entities may update every snapshot (3 server ticks / 20 Hz);
- mid entities are scheduled every 6 server ticks;
- far entities are scheduled every 30 server ticks;
- unseen entities bypass cadence and form staged resync backlog;
- long-unsent entities receive starvation priority;
- rotating bucket offsets prevent a stable net-id tail from winning or losing forever.

## Staged resync

A fresh or forced-full snapshot remains one bounded datagram.

If the entire relevant view cannot fit, the first packet prioritizes owner/combat/near state. The acknowledged partial state then becomes the baseline, and still-unseen entities remain full-record candidates in subsequent packets until the client converges.

This does not pretend a 512-player world can fit into one 1100-byte datagram.

## Compatibility boundary

M9 does not change:

- protocol version;
- snapshot wire encoding;
- authoritative combat semantics;
- browser decoding;
- transport;
- public bind/deployment state.

## Acceptance
M9 is acceptable only if:

1. existing Rust, JavaScript, Chrome, and Firefox gates stay green;
2. snapshot packets remain at or below 1100 bytes;
3. near updates remain responsive while mid/far updates obey bounded cadence;
4. dense constrained resync converges across subsequent acknowledged snapshots;
5. M8 capacity evidence shows reduced due-record pressure without hiding CPU or bandwidth costs.

No merge or deployment is part of this work unit.
