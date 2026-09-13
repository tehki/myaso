# ADR-0001: Realtime networking for large-map skill combat

**Status:** Accepted for M2 foundation; production server library remains benchmark-gated.

## Context

myaso.io targets skillful realtime melee combat and hundreds of players on one logical browser-game map. A networking model that waits for every client, retransmits obsolete state, or broadcasts every entity at full frequency would undermine responsiveness or capacity.

## Decision

Use a server-authoritative state/snapshot model with client-side prediction/reconciliation for the local fighter, interpolation for remote fighters, spatial interest management, priority/budget-based delta replication, and bounded historical lag compensation.

Prefer browser WebTransport over HTTP/3/QUIC: datagrams for realtime inputs/state, reliable streams for control and resync. Preserve WebSocket as a bounded compatibility fallback.

Target one authoritative simulation owner per map first. Only introduce distributed map partitioning if profiling demonstrates it is necessary.

## Consequences

### Positive

- packet loss does not stall the simulation;
- stale world state can be discarded safely;
- bandwidth scales with nearby/relevant entities rather than total map population;
- server remains authoritative over combat and anti-cheat-sensitive state;
- transport can evolve without rewriting combat rules.

### Costs

- prediction/reconciliation and interpolation require careful tuning;
- snapshot baseline tracking adds per-client state;
- WebTransport deployment requires HTTP/3/QUIC-capable infrastructure;
- WebSocket fallback needs application-level stale-frame coalescing because its transport is reliable/ordered;
- large crowded battles require priority degradation rather than perfect full-rate visibility.

## Rejected for primary architecture

- deterministic lockstep for the whole map: player-count and slow-peer coupling are unacceptable;
- peer-authoritative/WebRTC mesh: wrong trust and scaling model for a competitive authoritative game;
- reliable ordered transport for all realtime state: packet loss can turn retransmission into visible latency;
- full-world snapshots to every client: bandwidth grows approximately with players squared;
- early cross-region distributed simulation: too much consistency/handoff complexity before single-shard capacity is measured.
