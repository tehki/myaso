# myaso.io Networking Architecture — M2 Foundation

## Goal

Support **hundreds of players on one continuous logical map** while preserving skillful melee combat. The first capacity target is **512 connected players per map instance**. This is a target to prove with load tests, not a claim that production capacity has already been demonstrated.

The design optimizes for low input latency, bounded bandwidth, server authority, graceful packet loss, and predictable degradation under crowd density.

## Architecture decision

### Authoritative map shard

One server shard owns the canonical state of one logical map. Clients never author position, hits, health, guard, death, loot, or other consequential state. They send time-stamped inputs; the shard validates and simulates them.

Start with one authoritative simulation owner per map. Do **not** split melee simulation across distributed regions until profiling proves a single shard cannot hit the target. Cross-shard combat introduces consistency and handoff complexity that should not be paid before it is needed.

### Simulation and replication cadence

- server authoritative simulation: **60 Hz**;
- local client prediction/render simulation: **120 Hz**;
- client input datagrams: **60 Hz**, carrying the newest input plus two redundant prior samples;
- server realtime snapshot/delta datagrams: **20 Hz** target;
- full join/resync state: reliable stream, not fragmented datagrams;
- remote players: interpolated from a small adaptive jitter buffer;
- local player: reconciled against authoritative snapshots by replaying unacknowledged inputs.

The current combat model stays transport-neutral. Networking wraps the model; it does not move combat authority into the browser.

## Transport strategy

### Primary: WebTransport / HTTP/3 / QUIC

Use WebTransport when available:

- **datagrams** for input and realtime snapshot/delta traffic where newer state supersedes old state;
- **reliable streams** for join, authentication/session establishment, map metadata, baseline/resync payloads, and low-volume reliable game events;
- keep realtime datagrams below a conservative **1100-byte** payload target unless the negotiated path explicitly supports a safer larger value;
- never fragment one realtime snapshot into multiple datagrams. Select fewer entities instead.

WebTransport gives us unreliable datagrams and reliable multiplexed streams in one encrypted connection without TCP head-of-line blocking between independent streams.

### Fallback: WebSocket

WebSocket remains a compatibility path for browsers/networks where HTTP/3/WebTransport cannot establish. The application protocol remains the same, but realtime writes are **latest-state coalesced** and stale snapshots are dropped when `bufferedAmount` grows. We must not allow WebSocket reliability to create an ever-growing queue of obsolete world states.

WebRTC data channels are not the primary client/server transport. They add ICE/TURN/signaling complexity that is useful for peer-to-peer topologies but unnecessary for our authoritative server topology. They remain an optional future path if measurements justify them.

## Input protocol

A normal three-sample input datagram is **34 bytes** before QUIC overhead.

Each packet contains:

- protocol version and packet type;
- 16-bit packet sequence;
- last applied snapshot sequence acknowledgement;
- last observed server tick;
- 1–3 input samples, newest first;
- per-sample tick age, normalized movement, facing, and action buttons.

Redundant input samples reduce the effect of isolated datagram loss without reliable retransmission. The server deduplicates by client tick and rejects impossible/future/stale input according to a bounded acceptance window.

Actions are input edges/intents. A client never sends “I hit player 42”.

## Snapshot and delta protocol

Entity wire IDs are server-assigned unsigned 32-bit IDs. Snapshot records use field masks and quantized values:

- position: two 16-bit fixed-point coordinates;
- facing: 16-bit angle;
- HP and guard: 8 bits each;
- combat action and flags: 8 bits each;
- entity removal: compact tombstone record.

Each client acknowledges the most recent snapshot it successfully applied. The server generates later deltas against an **acknowledged baseline**, never merely the last packet it sent. If the baseline is unavailable or too old, the server sends a reliable resync/full baseline.

Do not gzip/brotli individual realtime datagrams. Quantization, field masks, delta baselines, relevance selection, and binary packing are predictable and avoid compression latency/amplification complexity on tiny packets.

## Interest management

“Same map” does not mean “send every player at full rate to every client.”

Use a server-side uniform spatial grid as the first AOI index. The current profile is:

- combat/critical radius: 420 world units;
- near radius: 700, nominally eligible every replication pulse;
- mid radius: 1500, lower update frequency;
- far radius: 2600, sparse awareness updates;
- beyond far radius: not in realtime entity replication unless a game mechanic explicitly requires it.

Priority is dynamic. The planner boosts:

1. the owning player;
2. recent attacker/defender relationships;
3. active nearby combatants;
4. near entities;
5. entities that have waited longest since their previous update.

This creates bounded bandwidth while preventing low-priority entities from starving forever.

## Crowd degradation policy

A dense 200–500-player battle must degrade **fidelity before latency**:

- keep authoritative simulation frequency stable;
- keep local player and direct combat participants highest priority;
- reduce peripheral entity update frequency;
- coalesce superseded state;
- drop stale realtime packets rather than queue them;
- keep join/resync/control on reliable streams;
- preserve input validation, hit authority, and combat rules.

Never “solve” overload by trusting client hits, widening client authority, removing validation, or letting queues grow without bound.

## Client prediction and reconciliation

For the local fighter:

1. apply input immediately to the predicted client copy;
2. record each input by client tick in a bounded circular history;
3. send inputs with redundancy;
4. receive authoritative player state plus the server's last processed client tick;
5. restore the authoritative state at that tick;
6. replay later unacknowledged inputs;
7. visually smooth small correction error while snapping security/significant errors.

For remote fighters, do not predict player decisions. Interpolate authoritative snapshots with an adaptive target around 90 ms and bound extrapolation to roughly 100 ms. Tune these values from real jitter distributions.

## Melee lag compensation

Melee hit resolution remains server-authoritative. The server keeps a short transform history and may evaluate a validated attack intent against a **bounded historical view** corresponding to the input timestamp. Rewind is capped (initial design ceiling: 150 ms), cannot exceed retained history, and never rewinds health/action authority independently of the server timeline.

The exact attacker/defender fairness rule must be play-tested. We will not ship an unlimited “favor shooter” rewind that lets very high-latency attackers hit defenders who visibly escaped long ago.

## Replication worker model

The authoritative simulation thread must not spend its tick budget serializing hundreds of client packets. At each replication pulse it publishes an **immutable, pre-quantized replication frame**. A bounded worker pool then performs AOI queries, acknowledged-baseline delta selection, and packet construction in parallel.

Important rules:

- quantize entity state once per replication frame, not once per client;
- simulation state is read-only to replication workers;
- per-client baseline/ack/send-ledger state belongs to the replication/session layer;
- worker queues are bounded and a superseded frame may be dropped rather than delaying a newer frame;
- worker count is benchmark-driven and leaves CPU headroom for the authoritative simulation and transport runtime.

This allows packet fanout to use multiple cores without making combat simulation itself distributed or racy.

## Backpressure and overload

Every network queue is bounded.

- WebTransport datagrams: if the writer cannot keep pace, discard/coalesce obsolete snapshots.
- WebSocket fallback: stop enqueueing realtime frames when `bufferedAmount` exceeds the bounded threshold and keep only the latest state.
- reliable control streams: explicit message-size caps, bounded pending bytes, timeout and disconnect policy for chronically stalled peers.
- server ingress: token-bucket/rate limit by session plus strict binary decode bounds before expensive work.

## Security and anti-cheat boundary

The server validates:

- session identity and map membership;
- protocol version and message size;
- packet/tick freshness and duplicate/replay windows;
- normalized movement ranges and action bits;
- action cadence against authoritative combat state;
- world bounds and server-side collision;
- all hit, block, parry, death, respawn, and future item/state transitions.

Malformed packets fail closed at the session boundary. Network parsers are fuzz/property-test candidates once the format stabilizes.

## Capacity budget

Initial engineering target, to be benchmarked:

- 512 connected clients in one logical map;
- 60 Hz authoritative simulation;
- 60 Hz input ingress;
- 20 Hz realtime replication opportunity;
- <= 1100 bytes per realtime snapshot datagram;
- typical input packet: 34 bytes;
- no unbounded per-client queue;
- p99 server simulation step stays within the 16.67 ms tick budget with safety margin;
- p99 replication build work stays bounded and does not scan all entities for every client.

At the absolute snapshot cap, 512 clients × 1100 bytes × 20 Hz is about 11.3 MB/s payload outbound before protocol overhead. Real operation should be materially lower through AOI, deltas, idle suppression, and tiered update frequency.

## Server implementation direction

The wire protocol and AOI code are implementation-neutral. For the production realtime shard, **Rust + a maintained QUIC/WebTransport implementation is the leading candidate** because the workload benefits from predictable latency, efficient binary processing, and strong control over memory/queues. `wtransport`/Quinn-class libraries are candidates, not yet admitted dependencies.

Before committing to the server runtime dependency, run an interop and load spike that proves:

- browser WebTransport datagrams + reliable streams;
- certificate/HTTP3 deployment path;
- 512 simulated clients or equivalent traffic generation;
- sustained 60 Hz simulation and 20 Hz replication;
- bounded memory under packet loss/backpressure;
- clean reconnect/resync;
- WebSocket fallback interoperability with the same application protocol.

Dependency selection follows the repository dependency-admission policy; popularity alone is not sufficient.

## M2 acceptance

M2 networking foundation is complete when:

- binary input codec round-trips and stays at the target size;
- snapshot delta codec handles changed/new/removed entities;
- snapshots refuse to exceed the datagram budget;
- spatial AOI exactly matches a naive query in deterministic tests;
- a 512-entity dense test still yields a bounded packet through priority selection;
- sequence wraparound is tested;
- browser transport adapter prefers WebTransport and has bounded WebSocket fallback behavior;
- CI runs the network tests.

This milestone establishes the scalable protocol foundation. It does **not** claim 512-player production capacity until a real server and network load test demonstrate it.
