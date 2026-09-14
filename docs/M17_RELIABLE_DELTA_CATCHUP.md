# M17 — Reliable delta catch-up

## Objective

Reduce redundant reliable background serialization and payload at 512 occupants without weakening realtime combat/near freshness, reliable backpressure, or cross-channel ordering safety.

M17 keeps snapshot wire v1, the 1100-byte realtime datagram budget, the 60-tick background cooldown, and the existing reliable WebTransport stream.

## Reliable schedule

The initial authoritative baseline remains a complete reliable full snapshot.

After that baseline, accepted background catch-ups follow a bounded cycle:

1. delta against the previous reliable sequence;
2. delta against the previous reliable sequence;
3. delta against the previous reliable sequence;
4. full reliable checkpoint;
5. repeat.

A catch-up is built only after the capacity-1 reliable writer queue is successfully reserved, preserving M13 backpressure behavior.

## Browser merge safety

Reliable deltas are accepted only when `baselineSequence` exactly matches the last accepted reliable sequence. A mismatch fails closed before mutating the reliable shadow state.

The browser maintains an ordered reliable shadow baseline, but applies only fields explicitly carried by a reliable delta record to live browser state. Untouched position, facing, vitals, or action fields are never copied from an older reliable baseline over newer realtime state.

Full checkpoints retain M12 omission/removal reconciliation semantics. If a removal would be stale relative to newer realtime state, it is preserved until a later reliable checkpoint can safely reconcile it.

## Provider acceptance

Both Chrome and Firefox must prove, with exactly 511 synthetic fighters plus one real browser player:

- initial reliable baseline contains exactly 512 authoritative entities;
- at least three reliable delta catch-ups and one later full checkpoint are observed;
- first browser-visible reliable convergence remains <= 2500 ms;
- average post-baseline reliable catch-up payload remains <= 5500 bytes;
- every observed delta payload is smaller than the full checkpoint payload;
- p95 animation-frame interval remains < 25 ms;
- inherited M15/M16, Rust, 64→512 capacity, 64-client load/reconnect, governance and whitespace gates remain green.
