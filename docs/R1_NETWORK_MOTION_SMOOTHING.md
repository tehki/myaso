# R1 network motion: bounded 60 Hz visual smoothing

## Reported problem and measured baseline

Player: the R0 public multiplayer build at **game.open-trust-layer.org** feels clunky and laggy.

Measured from *two QA machines*, not necessarily the reporting player's connection:

| Machine | 8× ICMP RTT to VPS | Packet loss |
| --- | --- | --- |
| Windows Machine | 137 ms mean, 128–147 ms | 0% |
| Linux X230i | 152.174 ms mean, 126–178 ms | 0% |

These measurements are not WebTransport game-ack RTT, and do not by themselves identify server tick delay, loss bursts, CPU overload or the player's geographical route. They also cannot be removed by frontend animation code.

Source confirmed: authoritative server simulation and inputs run at **60 Hz**, but position snapshots arrive at **20 Hz**, while `web/online-game.mjs` previously computed `renderServerTick = latestServerTick - 90ms` exactly once per RAF using a **static latest received tick**. Therefore remote positions can remain unchanged across consecutive 60Hz RAFs between packets and jump on each fresh 50ms snapshot. Additionally, each ACK in online-game may restore and replay local predicted position; that can cause camera-relative discontinuities despite valid authoritative combat.

## Safe candidate fix

1. `createSnapshotRenderClock`: advance **render-only** interpolation time between 20Hz snapshots using the existing 60Hz simulation rate. Preserve 90ms remote interpolation delay, cap any extrapolation at the existing **100ms** budget, never rewind on stale/out-of-order packets, reset on visibility suspension or tick wrap, and freeze on an extended outage instead of running away indefinitely. No extra network traffic.
2. `createReconciliationCamera`: retain the previous *visual* camera position across small ACK-induced local rebases, fading the bounded difference with a **58ms half-life**, **22-world-unit** offset cap, and a real **96-world-unit hard snap** threshold for large corrections, knockbacks or respawns. The real predicted local coordinates, facing, authoritative health, hitboxes, server gameplay and input state remain unchanged. Other fighters and purely visual impact bursts share the same visual camera coordinate.
3. Six deterministic jitter/20Hz tests plus the existing browser hot-path tests. Assertions include real intermediate RAF movement instead of 20Hz stair-steps, no rewind when packets reorder, strict stale-packet extrapolation bound, 32-bit server tick wrap, camera correction decay/maximum amplitude and unchanged server/client tick constants.

## Limits / rollout gate

This is a **smoothing candidate**, not a claim to reduce ping from ~150ms or improve authoritative server input latency. It deliberately does not adjust movement speed, attack windows, combat reach, physical player positions, stun, stamina or server tick rates. A real 2-client WebTransport input-to-damage acceptance under delay/loss and full strict Chrome/Firefox CI are mandatory before main merge and any public activation. The separately drafted [R1 LMB tap/hold controls PR #292](https://github.com/tehki/myaso/pull/292) is not a dependency and should be rebased/merged only after its own green release gates.

Next: instrument privacy-respecting game UDP ACK RTT/jitter and repeated stale snapshot rebounds, then consider a geographically closer game region if actual player RTT remains high. Do not fake a smoother experience by allowing authoritative attack/hit registration to drift.
