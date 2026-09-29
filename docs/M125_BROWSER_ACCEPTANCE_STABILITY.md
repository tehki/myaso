# M125 — Browser acceptance stability

## Objective

Keep the real Chrome/Firefox combat gates deterministic under CI scheduler jitter without weakening gameplay or authoritative acceptance.

## Changes

- M119 running strike: arm RMB first, cross the unchanged 180 ms run threshold, then hold movement and LMB across multiple input-send frames.
- M110/M107 heavy block: overlap the two unchanged 240 ms wheel-back block windows by 140 ms so scheduler jitter cannot create a false fresh parry edge.
- M24 dodge: request roll on the next ordinary input sample after authoritative windup is actually observed; the unchanged 94-unit geometry and 100/100 vitals remain the proof.
- M108 input loss: the loopback-only impairment now drops the first datagram containing each unseen one-shot action tick, then accepts redundant copies of that same tick.
- Headless Chrome/Firefox are launched with explicit anti-background-throttling settings and explicit WebDriver timeouts.

## Boundaries

No combat damage, stamina, recovery, parry, roll, run, reach, arc, protocol, replication, persistence, deployment, or production transport behavior changes.

The action-loss fixture remains disabled by default and rejected on non-loopback binds.

No playable build is opened by this milestone.
