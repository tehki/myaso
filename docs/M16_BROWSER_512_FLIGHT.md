# M16 — 512-occupant real-browser flight

## Objective

Close the gap between 512-player server capacity evidence and real-browser convergence evidence by attaching Chrome and Firefox to an authoritative map containing exactly 512 occupants.

M16 does not change protocol v1, combat authority, the 1100-byte realtime datagram budget, reliable catch-up scheduling, or production bind policy.

## Loopback flight profile

Each browser runs against:

- 511 loopback-only synthetic authoritative fighters;
- 1 real browser-controlled authoritative player;
- exactly 512 occupants in the map;
- 250 ms reliable-writer delay;
- 5 second flight duration;
- existing mid/far deadline-triggered reliable catch-up;
- existing 2.5 second first-background-convergence budget.

The M15 fixture layout is reused: 150 synthetic fighters apply near-tier realtime priority pressure and the remaining 361 occupy mid/far background space. Synthetic fighters rotate facing while holding Block, with no movement or attacks.
## Browser acceptance

Chrome and Firefox must each prove:

- the initial reliable baseline materializes exactly 512 authoritative entities;
- browser state reaches and retains at least 512 authoritative entities during the flight;
- a post-baseline reliable catch-up advances browser-visible state;
- first background reliable advancement stays within 2500 ms;
- realtime snapshots and input acknowledgements remain active;
- prediction history and reconciliation remain bounded;
- p95 animation-frame interval remains below 25 ms.

## Boundaries

This is loopback scale evidence, not WAN latency evidence or a production deployment. The existing 64→512 capacity probe, 64-client WebTransport load/reconnect evidence, Rust gates, normal Chrome/Firefox flight, M15 convergence flight, and whitespace gate remain required on the exact M16 head.
