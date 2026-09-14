# M10 — Spatial Replication Frame

## Objective

Reduce authoritative 20 Hz replication work at 256–512 players without changing protocol v1 or weakening combat-state freshness.

M9 proved cadence/priority scheduling is valuable, but 512-player replication reached 43.525 ms p95 against a 50 ms batch budget. The remaining waste was structural: every session independently re-quantized the full fighter list, rebuilt a current-state map, then scanned it before applying AOI rules.

## Design

M10 introduces an immutable `ReplicationFrame` built once per replication cadence and shared by all snapshot sessions.

The frame contains:

- one quantized `WireEntity` representation per fighter;
- a deterministic spatial grid used to reduce per-viewer AOI candidates;
- exact circular far-radius filtering after coarse cell lookup;
- the authoritative server tick represented by the frame.

The live server stores the current frame behind the same game-state lock as the authoritative world. It refreshes at the 20 Hz snapshot cadence and on player join/leave, then each session clones only an `Arc` and performs its session-local delta/baseline planning outside the world lock.

## Compatibility boundary

Protocol version remains `1`.

No packet header, snapshot record, browser decoder, WebTransport transport, combat model, reconciliation rule, certificate behavior, or datagram budget changes in M10.

`SnapshotSession::build(...)` remains as a compatibility path and constructs a one-off frame. New server/capacity hot paths use `build_from_frame(...)` so existing semantic tests remain meaningful.

## Spatial semantics

The server grid uses 512-world-unit cells. Grid membership is only a coarse candidate filter; exact visibility still uses the existing 2600-unit circular far radius.

Baseline entities that leave the interest radius still produce removal records. Owner state, urgent combat/vitals/action changes, M9 near/mid/far cadence, starvation promotion, rotating fairness, staged resync, and the 1100-byte no-fragmentation budget remain unchanged.

## Planner evidence

Every `SnapshotBuild` now reports:

- interest candidates checked;
- exact visible entity count;
- combat / near / mid / far due and sent counts;
- maximum due/sent age per freshness tier.

The capacity probe additionally reports shared-frame build p95 and candidate scan ratio. This instrumentation is repository/CI evidence only; it is not added to the network protocol.

## Acceptance

M10 is acceptable only if:

1. Rust fmt/check/clippy/tests remain green;
2. M9 cadence and staged-resync tests remain green;
3. M10 spatial queries exactly match naive far-radius visibility;
4. shared-frame snapshots preserve existing wire semantics;
5. Chrome and Firefox real-browser flight remains green;
6. 64→512 capacity evidence is rerun on the exact M10 head;
7. 512-player replication remains below the 50 ms p95 20 Hz budget and demonstrates a material candidate/CPU reduction or the optimization is rejected;
8. no deployment, public bind, merge, or production runtime mutation occurs as part of this milestone.

## Non-goals

M10 does not introduce reliable-stream baselines, protocol v2, sharding, multiple maps, persistence, progression, or a distributed simulation architecture.

A future protocol milestone may move dense fresh baselines to a reliable staged stream, but M10 does not hide that decision inside an optimization patch.
