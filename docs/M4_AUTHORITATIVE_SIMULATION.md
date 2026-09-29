# M4 Authoritative Simulation and Snapshot Replication

## Objective

M4 moves myaso.io from a validated WebTransport ingress spike into a server-owned gameplay loop.

The client sends intentions. The Rust server owns movement, combat state, health, guard, action timing, death, respawn, and the snapshots returned to clients.

M4 is stacked on the exact M3 server boundary and keeps the existing M2 protocol layout intact.

## Authority model

Client input is untrusted data. A client cannot authoritatively set:

- position;
- health;
- guard;
- combat action state;
- hit results;
- death or respawn state.

The server decodes the existing M2 input packet, accepts only previously unseen samples inside a bounded replay window, applies the newest accepted intention to the player, and advances the shared world on the server clock.

Malformed input is rejected as data. Redundant/reordered samples are deduplicated by client tick.

## Simulation clock

The shared world advances at 60 Hz. Tokio missed ticks use `Skip` rather than accumulating an unbounded catch-up backlog.

The Rust combat model carries the M1 timing and gameplay constants for:

- attack windup, active and recovery phases;
- attack reach, facing arc, damage and knockback;
- dodge duration, recovery, speed and invulnerability window;
- directional block, parry window, guard damage, guard break and parry stun;
- guard regeneration and regeneration delay;
- body separation;
- temporary death and respawn.

The M1 JavaScript suite remains in CI. M4 also mirrors the major M1 invariants in Rust so the server port is tested directly rather than relying only on the browser model.

## Snapshot cadence and wire compatibility

Each connected client receives an authoritative snapshot attempt every 50 ms (20 Hz).

M4 preserves the M2 v1 snapshot format:

- protocol version `1`;
- packet type `2`;
- 14-byte header;
- 16-bit snapshot sequence;
- 16-bit acknowledged baseline sequence;
- 32-bit server tick;
- the existing position, facing, vitals, action and removal field masks;
- the existing coordinate/facing quantization;
- one-datagram maximum budget of 1100 bytes.

A checked-in wire fixture is encoded by the Rust layout and decoded by the existing browser snapshot codec in CI. This is the cross-language compatibility gate for the v1 layout.

## Acknowledged baseline and loss recovery

Each session keeps a bounded history of reconstructed states for recently sent snapshot sequences.

When a client acknowledges a snapshot sequence that is still present, the next delta is built relative to that acknowledged state. Losing a newer snapshot therefore does not silently advance the baseline.

If the acknowledgement is absent (`0xffff`), unknown, or expired from bounded history, the server fails closed to a full snapshot with baseline `0xffff`.

## Interest and datagram pressure

Snapshot construction is bounded before encoding. Records are prioritized in this order:

1. the owning player;
2. removals from the acknowledged baseline;
3. active-combat / combat-radius entities;
4. near entities;
5. mid-range entities;
6. far entities.

Records that cannot fit are omitted from that datagram rather than fragmented past the 1100-byte realtime budget.

The deterministic 512-player dense-state test verifies that the owner survives packet pressure and the packet remains within one datagram. This is a packet-construction bound, not a claim that 512 live network clients are production-ready.

## Real transport evidence

The M4 transport smoke creates eight independent loopback WebTransport sessions against a shared server-owned world. Each client:

1. establishes WebTransport over QUIC;
2. sends an M2-compatible input datagram;
3. has that intention applied by the authoritative world;
4. receives an authoritative M2 snapshot datagram containing its owner state;
5. verifies the datagram is within the conservative realtime budget;
6. acknowledges receipt while the session remains alive.

The test deliberately holds client connections until every server-side session observes its acknowledgement, avoiding teardown timing as a substitute for delivery evidence.

## Explicit remaining protocol gap

The v1 snapshot header does **not** carry the exact client input tick last processed by the authoritative server.

Therefore M4 does not claim exact prediction rewind/replay reconciliation metrics. The server can own truth and the client can acknowledge snapshots, but precise client-side reconciliation needs a deliberate protocol extension or another explicit processed-input acknowledgement channel.

That change belongs in a separately reviewed networking work unit; it is not hidden inside the v1 snapshot format.

## What M4 proves

M4 proves, at repository/CI scope:

- server-owned gameplay state exists;
- M1 combat behavior has direct Rust parity coverage for its major invariants;
- redundant/reordered input samples are bounded and deduplicated;
- Rust snapshot output is browser-compatible with M2 v1;
- acknowledged snapshot baselines recover across loss and force full resync when unknown;
- dense 512-player state remains bounded to one realtime packet by prioritization;
- multiple real WebTransport clients can exchange input and authoritative snapshots against one shared world.

M4 does **not** prove:

- 512 simultaneous production WebTransport clients;
- production CPU, memory, bandwidth or tail-latency capacity;
- internet-path latency/loss/jitter behavior;
- exact client prediction rewind/replay error;
- production deployment, service activation or public exposure.

Those remain later measured gates.
