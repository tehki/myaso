# 🌕⚡️🚀 Core 8C Pre-Alpha 0.1 — World Actor Lease & Retirement (DORMANT REVIEW)

**Department:** Core 8C / World Runtime & Authority  
**Release:** Existing 2–4-player Combat Pre-Alpha arena, not Greyhaven/Items.  
**Source base:** Core 8A [draft #724](https://github.com/tehki/myaso/pull/724), initial exact `7c012c8551809b800889d7a78c1bc540a208c52b`.  
**Main authority:** [#360](https://github.com/tehki/myaso/issues/360), [Pre-Alpha #695](https://github.com/tehki/myaso/issues/695), [one-wire decision #723](https://github.com/tehki/myaso/issues/723).

## Boundaries and what this implements

- `server/src/prealpha_core8c_world_lease_review.rs` is exported but **NEVER CALLED** by `server/src/main.rs`; `PROTOCOL_VERSION=1` and original 34-byte INPUT are unchanged.
- No changes to actual browser, authenticated QUIC, Combat state machine, physics, damage, HP, Silver Knight assets, UI, sound, Chat C1, runtime TLS, operations or production data.
- The adapter uses **only** the previously authored Combat4/Core8A fixed 16-byte v2 type `0x11` EVENT and Core8A's `ReviewLmbIngress` ordering. It neither accepts nor introduces Core8C #715's abandoned unnegotiated `0x52` batched envelope. The canonical v2/KeyE/ACK negotiation remains unapproved.
- `ReviewActorLease` holds actor ID, generation and connection nonce **provided by a test**. `review_from_server_values` is **NOT authentication**; a real lease must be issued/bound by a trusted admitted server connection.
- Construction requires an existing living actor in the **actual** Rust `World`. Ingress checks the corresponding World actor and connection identity and queues **intent**, not simulated damage or an ACK.
- `observe_world_tick` rejects missing/dead/0-HP actors, cleared actors and skipped ticks. Must be invoked for **EVERY** 60 Hz World tick while the lease remains active; otherwise it retires fail-closed. `retire()` drops all pending edges and closes Core8A ingress.
- `review_drain_for_world` rechecks World membership and lease before releasing ordered accepted intent. Original Core8A duplicates never produce an extra downstream edge. Queue holds **at most 16 unconsumed events**, retiring on overflow. This is a review limit, not a production scheduling choice.

## Focused acceptance

```bash
cargo test --locked --manifest-path server/Cargo.toml --test prealpha_core8c_world_lease_review
cargo fmt --manifest-path server/Cargo.toml --all -- --check
cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
```

The new Rust integration suite uses genuine original `World` fighters and original `encode_event` packets. Cases: same-tick short press/release, duplicated terminal, gap/reordered release, stale actor/generation/nonce, explicit disconnect+rejoin, missing actor cleanup, missed-tick fail-close, four genuine distinct World actors, bounded queue, malformed/noncanonical v1/type0x52 input, and a **real World CombatEvent::Death** caused through normal attacks that must clear the victim's pending gesture before stale release.

**Evidence is NOT a live browser or authenticated transport test**, nor proof of instant LMB or qualified 4-human gameplay. Any failed Rust death or native test must be diagnosed, not weakened.

## Mandatory integration follow-up (BLOCKED pending Main decision)

1. **Core 8A + Combat4 + Main**: decide one byte schema with explicit KeyE/LMB provenance, v2 capability negotiation and server-issued ACK over authenticated bounded QUIC. Do not promote independent `0x52`.
2. **Core 8C**: connect actor generation/nonce to actual admitted `/game` QUIC session and authenticated actor ownership. Monitor EVERY World tick under the same state lock used for dispatch. Retire on actual death/respawn/match reset, disconnect and lease supersession; don't use this fixture constructor on untrusted values.
3. **Core 8C + Combat4**: apply ONLY accepted current-lease ordered events to the approved server gesture reducer/real `World.step()`; guarantee the 135ms light and 320ms READY/release-once heavy without double HIT/KeyE aliasing. Don't treat transport accepted/duplicate as a Combat HIT.
4. **Core 8A/8C/UI 10**: preserve existing v1 controls during negotiated migration; verify fast tap, blurred CANCEL, wheel, RMB, Space+LMB, stale/duplicate/reordered/lost edges, zero ghost actors and no Chat C1 blocking.
5. **Main**: exact integrated branch + protected original M tests; genuine Chrome & Firefox 2/4-player real Combat/HP/respawn, independent-host acceptance, immutable artifact, staged rollback, explicit GO.

**Status: IMPLEMENTED DORMANT REVIEW ONLY. Neither `TESTED` nor `PLAYABLE` can be claimed until exact-commit checks actually complete. No main merge / deploy / restart authorization.**
