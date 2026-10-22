# 🌕⚡️🚀 Core 8A — Pre-Alpha 0.1 versioned LMB gesture outbox review

**P0 development proposal ONLY / never live / no main merge or deployment.**

## Exact owning source and requested problem

Main Orchestrator [#360](https://github.com/tehki/myaso/issues/360) authorized *design+implementation+tests only* of a version-negotiated edge-provenance protocol, not a runtime activation. Combat owns [#696](https://github.com/tehki/myaso/issues/696) and [proposal #705](https://github.com/tehki/myaso/pull/705), defining the 16-byte little-endian v2 `PRESS/UPGRADE/RELEASE/CANCEL` gesture envelope and server ACK status. Core 8A owns per-authenticated-connection transport buffering, resend, ACK correlation and old-session fencing. Core 8C owns actual World/actor lease and server timing. UI owns real pointer gestures; Combat owns whether any damage or hit can happen.

The production **v1 34-byte input packet and 30Hz input stream remain unmodified**. A fast real pointerDOWN+UP between samples cannot be reconstructed from current v1 booleans, and `attack=false,heavy=true` represents both standalone KeyE heavy and a lost earlier held LMB. Do not guess from client time or HP.

## Newly authored dormant Core 8A file

`src/network/prealpha-lmb-gesture-outbox-proposal.mjs` imports the **original Combat-owned proposal codec unchanged** and models a strictly bounded *future* per-QUIC-connection ordered outbox.

- Requires explicit v2 negotiation and an **opaque trusted connection-owned lease token object** passed by a future authenticated transport owner, not a client JSON claim. Merely constructing the class does NOT authenticate anything.
- Starts a unique nonzero monotonic 32-bit gesture ID per lease and independent sequence per event; **no silent rollover**. Only one physically held LMB gesture may be active. Accepts `begin→[upgrade]→release` OR `begin→cancel`; new PRESS cannot re-enter an active gesture; terminal events never trigger action themselves in this module.
- Preserves PRESS+RELEASE as **two distinct immediately queued events** even if both occur during one 30Hz input sample interval; clientTick is recorded only for diagnostics. No browser DOM hookup yet.
- `maxPending` bounded 4–256, default 16. New PRESS reserves capacity for its remaining upgrade+terminal edges **before** it is enqueued; no silent sacrifice of release on backpressure. If capacity/ID unavailable, this mock connection closes fail-closed instead of forging a hit.
- `nextSendBatch` returns only copies of exact byte envelopes, preserving canonical pending bytes across retransmissions, defaults to max four messages and bounded `maxAttempts` 1–8. If still unacknowledged after the retry budget, closes fail-closed with error instead of discarding or claiming success.
- `receiveAck` requires the *same trusted connection token by object identity*, exact event sequence AND gesture ID. Replayed, unknown, other-gesture, reserved or other-lease ACKs are denied. Out-of-order correlated ACKs may settle individual edges. Server `STALE/REJECTED` closes the proposal lease. `ACCEPTED/DUPLICATE` mean only transport-edge settlement: **`combatCommitted:false`**, never proof of a legitimate strike or damage.
- On reconnect, a new outbox MUST be constructed with a fresh connection token, and the old outbox closed. Numeric IDs can overlap across different leases, and the old token cannot ACK the new outbox even if IDs coincide.

## Verified and unverified

Exact source local authorized Windows: `node --check` both original Combat codec and Core outbox PASS. `node --test tests/prealpha-lmb-gesture-proposal.test.mjs tests/core8a-prealpha-lmb-gesture-outbox-proposal.test.mjs`: **15/15 PASS**, no ignores. `git diff --check`: PASS. Tests cover fast tap, three-edge heavy, cancel, second gesture monotonicity, double-upgrade/terminal denial, ACK replay/forgery rejection, cross-lease token, out-of-order ACK, terminal reservation, bounded resend/byte-copy isolation, v1 disable, and original production source not importing either dormant codec or outbox.

**NOT YET PROVEN:** a real authenticated QUIC reliable unidirectional stream, full v1/v2 connection handshake/capability negotiation, per-actor World lease binding from Core8C, transport ACK backed by server-side durable per-lease dedupe cache, ordered ingress, queue drain and memory/backpressure behavior under disconnect, actual browser DOM edge capture, long-hold READY at 320ms, server-owned 135ms light windup, same-gesture exactly-one HIT, simultaneous KeyE/Space/RMB/roll/parry, original native Combat M tests, genuine independent-host acceptance. Do not treat an outbox unit test or server ACK as these requirements.

### Remaining gates before any LIVE protocol change

1. **Combat4:** determine authoritative gesture state machine and terminal reconciliation; never count v1 KeyE as an orphan held LMB. Confirm exactly one hit per authenticated gesture and server windup/charge clocks.
2. **Core8A:** negotiate v2 *per secure authenticated QUIC session* before using a **separate bounded reliable ordered** event channel; bind ACK to connection identity, add explicit server dedupe and outcome tracking, drain queue under persistent loss and cancel on close.
3. **Core8C:** bind player/actor to actual current admitted connection, session lease generation and authoritative server tick/world epoch; recheck death/respawn/ghost/tombstone even if queued stale gesture arrives after rejoin.
4. **UI10:** actual W3C pointerdown/up/cancel/lostpointercapture, focus transitions, screen interaction suppression, Space+LMB/RMB+LMB arbitration. No UI direct damage.
5. **Acceptance:** server + browser tests with reordered/lost/delayed presses, 2–4 independently hosted players, strict Combat M tests and no double hit. Only Main Orchestrator authorizes `main` integration, staging, prod and rollback.

**Everything in this branch is nonactivating. Existing Pre-Alpha #707/#708 source, v1 bytes, main and production are left untouched.**
