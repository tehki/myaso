# R1: align processed-input ACK with authoritative own-player snapshot

## What we measured

Before this change, the client's ACK flush used the newest **global** replicated server tick, not the local fighter's authoritative state timestamp. Thus a processed input ACK at server tick N could trigger a restore-and-replay from the player's own snapshot at N-k. That threw away acknowledged input ticks and replayed the remaining input against a state that was *older than the ACK*, causing avoidable camera correction.

Issue #293 and the merged opt-in local diagnostic PR #296 documented on X230i:

- Real WebTransport input-to-ACK median 260–268ms, p95 387–389ms; higher than the separate ICMP round-trip measurements.
- 20Hz snapshots median interval 50–52ms; some intervals over 100ms.
- 52 stale-own ACKs in a movement sample, and 7.9 world units at p95 camera correction, recorded before this change.

## Candidate fix — client only

- Coalesce pending processed-input ACKs to the newest monotonic client tick; ignore older duplicates/reordered packets.
- On a snapshot or ACK, check that **the own fighter's authoritative server tick has caught up** with the ACK's server tick. Only then discard acknowledged input history and invoke the old authoritative restore/replay. Never use another fighter's or the global latest server tick as an anchor.
- Keep one pending ACK, preserving bounded memory. During idle stationary periods, snapshots may not carry a new own-player position. Do not infer freshness or fabricate input acknowledgment in that case. A future own-player authoritative update releases the pending ACK.
- The network diagnostics keep counting stale **on-arrival** ACK anchors even if reconciliation is deferred, avoiding a misleading improvement in instrumentation.
- The game displays the initial connected status as soon as a player snapshot arrives, without relying on immediate positional reconciliation.
- Strict-flight distinction: a new onProcessedAck callback exposes genuinely accepted server ACK packets while onAck only runs when fresh positional state is available. The strict browser flight still requires 10 true ACKs with the same timing, damage, guard and parry invariants. No tests fabricate ACKs or reduce thresholds.

No server changes, tick-rate changes, hitboxes, inputs, combat damage, stamina settings, animation constants or protocol modifications.

## Verification

Six deterministic ACK gate tests cover freshness, monotonic coalescing, history retention, uint32 wrap, malformed ACK rejection, and integration with legacy reconciliation. Existing M6 browser-authority, net-telemetry and browser-runtime checks passed: **26/26 local**.

On a **real WebTransport / public VPS** session, candidate browser X230i used genuine native WASD events for repeated movement; observed input ACK median 243ms / p95 481ms, snapshot gaps median 46ms / p95 115ms, camera correction p95 **6.4 world units**. This is a single different time window, not a controlled demonstration that network RTT improved. The reported old-value 7.9u was from an earlier sample. Deferred reconciliations appeared as expected and did not prevent joining.

A separate **real cross-machine combat trial** used Linux X230i with candidate local client and public-release Windows Machine, both connected to the same public authoritative Rust server. Linux player #19 saw Windows #20 move **63.9px** in the canvas; defender HP dropped **100 → 66** on a genuine aimed native Chrome LMB hit; both real browser assertions passed.

## Remaining gating and risks

This is still a **draft until strict full CI, independent merged-main quality and human smoke**. Snapshots may omit stationary fighters: stale pending ACKs can be deferred for longer than before and coalesce. Ensure that does not degrade local movement after resume, online identity status, stamina denials, knockback or prediction-history loss under packet jitter, before considering production deployment. Keep the previous production release available and avoid touching shared VPS services.

The client change is deliberately limited to the reconciliation scheduling; it **does not shorten ~150ms network RTT, the server's 20Hz snapshot interval or ~250ms median input-to-ACK delay**. A geographically closer game region may ultimately be required for players on high-latency routes.

## First CI failure and correction

The original PR head failed the M23 cross-browser parry flight: Firefox observed the correct authoritative stun, block, intact HP/guard and 33ms parry reaction but reported only 7 applied reconciliations as acknowledgements during its ~994ms trial. The unchanged test requires 10. The correction counts genuinely received processed-input ACK packets separately from deferred position replays, preserving the strict acceptance and alignment gate. Exact-head browser CI must still pass.
