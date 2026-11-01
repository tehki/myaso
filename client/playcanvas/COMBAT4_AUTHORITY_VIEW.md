# Combat 4 → PlayCanvas | authoritative presentation contract

**Source-only, read-only, local PlayCanvas Alpha 0.1 feasibility spike.** The
original Rust 60 Hz World owns action, HP, guard, stamina, HIT, collision,
input admission, death, respawn and session identity. The existing
`web/authoritative-client.mjs` decoder and QUIC snapshot state Map are the
sole source for `projectAuthoritativeCombat(entity)`.

- Actor presentation consumes the original `netId`, `serverTick`, action
  code and decoded vitals unchanged. Incomplete/invalid Combat data yields
  `combat: null` rather than invented full HP, an attack or a recovery.
- Exact action meanings are imported from the existing
  `src/browser/combat-readability.mjs`, never redefined by PlayCanvas.
- M140's `jump-attack-recovery` is a **display-only** indication when the
  original World snapshot action equals 18. It never starts a local
  180 ms punish timer, admits an LMB, or guarantees an attack can HIT.
- A 100→66/54/58 HP snapshot change only updates an existing Rust-owned HP
  display. It is **not** an authenticated per-gesture HIT receipt. To display
  HIT confirmation, Main0/Core8A/Combat4 must connect an existing
  server-validated HIT event and bind it to the original actor, active QUIC
  session and server chronology; a typed gesture ACK is not HIT proof.
- The current `connectDevRustActors` bridge stays snapshot-only. It never
  sends input, falls back to WebSocket, grants stamina locally or manufactures
  an entity. The entire client remains guarded by local Vite DEV `?rust=1`
  plus original loopback WebTransport/certificate SHA256 validation.
- Removal and respawn follow original snapshots/NetID. Reconnect, stale
  lease rejection and real HIT presentation remain **integration acceptance
  gates**, not claims made by this change.

## M140 regression scope

The P0 native test previously measured 201 ms between the defender-rendered
recovery cue and a real W3C pointerDown, exceeding unchanged 180 ms. The
native flight now pre-aims before recovery, sends genuine pointerDown without
a post-cue remote read, and has passed exact-SHA browser/World qualification,
including independent 42 ms evidence and 34 HP server-owned damage.

A later 3C source-donor Quality run exhibited Firefox graphics-driver
allocation/timeouts and a missed original World Light despite a physical
pointerDown. The donor did not modify the P0 floor or Combat runtime and its
same-source failed-job rerun passed M140. This evidence **does not prove**
the intermittent graphics/driver mechanism is resolved. Do not alter 85,
135, 180 or 320 ms thresholds, original Rust recovery, or W3C authenticity
to disguise it. Retain first-RED and run actual mixed-browser Combat against
the PlayCanvas adapter before declaring an interactive client qualified.

**No merge, deployment, migration or public activation. Release HOLD.**
