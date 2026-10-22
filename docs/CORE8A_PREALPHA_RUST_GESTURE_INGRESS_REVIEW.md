# 🌕⚡️🚀 Core 8A Pre-Alpha 0.1 — DORMANT Rust ingress ordering/replay gate

**Development-only child of [Core 8A outbox #712](https://github.com/tehki/myaso/pull/712), itself a child of Combat4 16-byte v2 codec [#705](https://github.com/tehki/myaso/pull/705). Not a playable feature, not authenticated production transport, not an approved wire cutover.**

## Cross-department decision

Core 8C [#715](https://github.com/tehki/myaso/pull/715) independently proposed v2/type `0x52` multi-event bundles. It is **wire-incompatible** with Combat4+Core8A review type `0x11` EVENT and `0x12` ACK, both fixed-size 16-byte records. Core8C subsequently documented this in [Combat #696](https://github.com/tehki/myaso/issues/696), and recommended retaining `0x11/0x12` as the **single review reference**, while designing authenticated epoch/death/rejoin checks without activating a second schema. Main/Combat still must explicitly approve ANY runtime ABI. This new code consumes **only** the existing Combat-owned codec byte-for-byte; it rejects `0x52` and v1 before any action.

## New source (fully disconnected from live QUIC)

`server/src/prealpha_lmb_ingress_review.rs` is an exported-but-**uninvoked** model; the only addition to `server/src/lib.rs` is `pub mod prealpha_lmb_ingress_review;`. No main.rs WebTransport handler, Gameplay/World tick, Combat4 world adapter, browser DOM or Chat handler uses it.

- `TrustedLeaseKey(actorNetId,generation,connectionNonce)` is a **fixture struct only**, constructed by a named test/review function. It MUST eventually be provided by a real, authenticated, admitted QUIC connection and rechecked on current Core 8C World dispatch. Its numeric fields are NOT a credential, not transmitted in v2 bytes and cannot establish authentication alone.
- Each per-lease gate starts at strictly positive `sequence=1`; monotonic nonzero `gesture_id` must increase on each new PRESS; only one active gesture. `UPGRADE` allowed once for the matching active gesture; RELEASE or CANCEL terminates it, no orphan or second terminal. Client-provided `clientTick` never becomes server windup, heavy READY, hit time, actor ID or World owner.
- A packet received ahead of an absent sequence is held in a bounded 16-entry, 16-sequence-gap out-of-order buffer, **without ACK**. Once missing edges arrive, stage all contiguous edges, validate the **entire batch first** against active gesture state, and only then return **ordered ACCEPTED** typed events + correlated serverTick ACKs. This is still only *transport event acceptance*, not Combat application.
- Replaying an accepted exact (seq,gestureId) generates `DUPLICATE` without a second event. An old previously evicted event generates `STALE`. Mismatching token/generation/actor/nonce gives `STALE` without mutating current lease. Equivocal same-sequence packets, wrong event type/version/reserved, orphan RELEASE, invalid held transition, excessive gap/buffering all fail closed.
- Accepted-event history bounded to 128 tuples; no client-adjustable capacity. The review gate cannot roll a 32-bit sequence to zero on one lease. Explicit close clears buffered events and prevents any new action.
- **No durable dedupe:** process restart loses gate state; future Core8C must own lease/fencing, server tick and state persistence policy. An ACK here is NOT proof of network delivery/read or HP damage and never calls World itself.

## Strict original-content validation

`server/tests/prealpha_lmb_ingress_review.rs` executes the actual Combat-owned Rust `encode_event/decode_event/encode_ack` and new Core review gate; 13 independent negative/positive tests include:
1. Same-clientTick immediate PRESS/RELEASE preserved in order.
2. RELEASE before PRESS held unacknowledged, then flushed only after PRESS.
3. Duplicate accepted event yields only duplicate ACK, not second HIT.
4. Old actor generation/connection nonce cannot enter the new gate.
5. Buffered identical retry vs same-sequence conflicting bytes.
6. Missing prefix excessive forward jump rejected.
7. Orphan RELEASE rejected.
8. Press, upgrade, release, next monotonic gesture.
9. Upgrade after CANCEL denied.
10. Older/lower gesture ID reuse denied.
11. Invalid buffered terminal sequence aborts entire contiguous batch without partial acceptance.
12. Real v1 and alternative `0x52` rejected by unchanged Combat codec.
13. No zero-identity trusted binding fixture.

Source must pass real Rust1.89 `cargo fmt --check`, focused integration `cargo test --locked --test prealpha_lmb_ingress_review`, all-target `cargo clippy -D warnings` and original proposal 15 Node tests on one exact head. This is a **review-only** gate—not browser, not QUIC, not multi-host proof.

## Mandatory Pre-Alpha release HOLD

Actual v2 capability negotiation and versioned current secure connection-owned reliable ordered QUIC channel; bounded replay/ACK protocol on the live server; Core8C current actor lease+death/rejoin/World tick and authority; Combat4 exactly one server-controlled light/heavy hit with real HP, 135/320ms; UI10 W3C pointer DOWN/UP/CANCEL source capture with KeyE/RMB/Space/roll/parry and optional Chat C1 focus separation; independent real players, strict protected Combat browser suite and Main Orchestrator GO. None is implemented or enabled by this child.

No edit to `main`, production listener, TLS, dashboard, server runtime, public chat config, Greyhaven/Items, installed package or deployment scripts.
