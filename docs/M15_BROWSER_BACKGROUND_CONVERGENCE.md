# M15 — Browser-visible background convergence

## Objective

Measure the time for reliable background catch-up to advance real browser state while realtime combat traffic remains active.

M15 does not change protocol v1, combat authority, realtime datagram size, or production bind policy.

## Flight fixture

The authoritative server accepts two optional test-only environment variables:

- `MYASO_FLIGHT_BACKGROUND_PLAYERS`
- `MYASO_FLIGHT_RELIABLE_DELAY_MS`

They are rejected on non-loopback binds. The bounded population maximum is 256 synthetic fighters.

The fixture rotates synthetic fighter facing while holding Block, keeping all seeded mid-tier records persistently due without positional drift, attacks, damage, or combat interaction.
## CI profile

- 192 loopback-only background fighters
- 250 ms reliable-writer delay
- 4.5 second Chrome and Firefox flights
- 2.5 second maximum first background convergence budget

A browser passes only if it receives a post-baseline reliable snapshot that actually advances at least one entity which was stale in browser state.

The inherited realtime snapshot, ACK, frame-time, prediction-history, Rust, capacity, load, reconnect and whitespace gates remain required.

## Interpretation

M14 proved a stalled reliable stream does not block realtime datagrams. M15 adds browser-visible convergence timing under controlled reliable delay. A passing result demonstrates that background world state catches up within a measured bound without sacrificing the existing realtime browser flight.
