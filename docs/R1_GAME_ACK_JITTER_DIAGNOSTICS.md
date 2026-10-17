# R1 — Actual WebTransport input/ACK latency diagnostics

## Why this exists

The public game at `https://game.open-trust-layer.org` is smoother after the 60 Hz render-only clock rollout, but its raw network input response can still feel laggy. The previous ~137–152 ms figures were ICMP round trips from two QA computers, **not gameplay input latency**.

This change measures actual browser **client input send → corresponding server processed-input ACK** duration, snapshot cadence, successive ACK jitter, and the amount of client-side camera correction after prediction replay. It is instrumentation, **not a physics or RTT optimization**.

## How to use

Join the normal arena, then add `&netstats=1` to the actual playable URL, which already includes `?server=…&cert=…`. Reload. A small panel appears at the bottom of the game showing:

- **Input→ACK p50 / p95:** time from first send of a particular 32-bit input tick to its matching processed-input ACK, measured with browser `performance.now()`. Includes transport, server scheduling, snapshot/ack pacing and congestion, so is not ping or one-way latency.
- **Jitter p95:** magnitude of difference between consecutive measured input-to-ACK durations. This is a simple user-experience variation indicator, not RFC packet-delay variation.
- **Snapshots p50 / p95:** actual elapsed time between accepted authoritative real-time snapshots. A 20 Hz stream has an ideal 50 ms interval.
- **Camera correction p95:** local pre/post-authoritative-reconciliation displacement in world units; counts large respawn/initialization corrections too.
- **Stale-own ACKs:** number of received processed-input ACKs whose server tick is newer than the latest replicated state tick for the **same player** when the browser attempted reconciliation. This is a diagnostic of possible stale-anchor correction work, not conclusive evidence that each ACK caused visual jitter.
- **Samples:** size of a bounded rolling input-ACK history (at most 96); these values are not an all-time population average.

The panel is opt-in by URL parameter and read-only. It uses `textContent`, with no injected markup, user identifiers, addresses, location, log uploads or persistence. Other clients cannot query or access it.

## Reproducible initial field measurements

Source: **Linux X230i real Chromium browser**, connected by certificate-pinned WebTransport to the public authoritative VPS. This is **one QA path**, not the user's network, and small runs may be affected by warm-up and temporary load.

| Scenario | Input→ACK p50 | Input→ACK p95 | Snapshot gap p50 | Snapshot gap p95 | ACKs with stale own anchor | Correction p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ~12 s idle session | 260 ms | 387 ms | 52 ms | 109 ms | 123 | 0 world units |
| ~11–12 s, repeated native WASD holds | 268 ms | 389 ms | 50 ms | 132 ms | 52 | 7.9 world units |

Both windows contained 96 recent exact-tick ACK samples and were captured using the opt-in panel, not extracted from personal traffic. Initial connection samples were slower and are not representative (for example 372ms p50 during a 4-sample warm-up).

These measurements strongly indicate that the browser experiences **higher gameplay acknowledgment delay and jitter** than the earlier ICMP figures, with a significant number of ACKs arriving before equally fresh authoritative own-player state. They do **not** demonstrate which network hop causes the delay nor prove that dropping or gating ACKs is safe.

## Next controlled experiment

Test **ACK/snapshot-anchor alignment** separately (issue #293): avoid replaying prediction from an own-player state older than the ACK server tick, but do not discard unacknowledged input or break hit confirmation, action recovery, respawn, match completion, or the strict Chrome/Firefox tests. Compare instrumented runs before/after in the same network conditions. Also examine actual WebTransport loss/jitter and whether EU-region game hosting improves local RTT.

Never adjust damage, stamina, server tick rate or acceptance thresholds to make performance numbers look better.
