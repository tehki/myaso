# M13 — Reliable Catch-up Backpressure Hardening

## Objective

Prevent a stalled reliable WebTransport writer from consuming realtime CPU through repeated full catch-up serialization.

## Change

- Reliable catch-up queue capacity remains one payload per session.
- The producer now reserves queue capacity before building a catch-up snapshot.
- If the queue is full, catch-up construction is skipped entirely.
- A closed writer still fails the session closed.
- The 60-tick catch-up cooldown, snapshot wire v1, 1100-byte realtime budget, and combat/near freshness policy are unchanged.

## Evidence target

A dense 512-fighter regression fills the reliable queue first and proves the expensive full-state builder is not invoked while backpressured. After the queue is drained, the same builder must run once and produce a payload larger than the realtime datagram budget but within the reliable frame bound.

Existing real Chrome/Firefox, 64-client WebTransport, reconnect, and 64→512 capacity gates remain required on the exact M13 head.
