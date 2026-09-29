# M12 — Reliable Baseline and Background Convergence

## Objective

Keep the 1100-byte realtime datagram lane focused on combat/near freshness while moving complete initial state and bounded mid/far catch-up onto the existing reliable WebTransport stream.

## Final channel semantics

- Snapshot wire v1 is reused unchanged; no new packet type is introduced.
- The initial visible-state baseline is sent reliably with the larger 16-bit framed payload budget.
- Realtime datagrams do not start until the browser echoes that baseline sequence through the existing input `ackSnapshotSequence` field.
- After confirmation, realtime snapshots stay at 20 Hz and retain the 1100-byte datagram budget.
- Mid/far deadline misses may enqueue a complete reliable catch-up baseline no more than once per 60 server ticks.
- Reliable background writes use a capacity-1 nonblocking writer queue; stream backpressure cannot stall the realtime simulation/snapshot loop.
- If the reliable writer is busy, another catch-up is coalesced/dropped rather than queued without bound.

## Cross-channel ordering safety

QUIC datagrams and streams can overtake one another. Realtime snapshots therefore keep their existing uint16 sequence/ACK lane, while reliable catch-up baselines are merge-only state. The browser applies reliable entities only when their server tick is not older than the currently held entity state. A stale reliable omission cannot delete a newer realtime entity; a later reliable baseline may remove it once that baseline is at least as new.

## Authority and bounds

Rust remains the sole gameplay authority. Combat, prediction, processed-input ACKs and snapshot-v1 bytes are unchanged. Reliable frames remain capped by the existing 65535-byte length prefix. The provider gate must prove Rust correctness, real Chrome/Firefox interoperability, M11 local-combat freshness, and existing 64→512/load evidence before M12 is considered complete.
