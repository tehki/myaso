# ⚔️ Combat 4 P0 — dormant authoritative LMB gesture reducer

**Decision:** Main Orchestrator [#696](https://github.com/tehki/myaso/issues/696#issuecomment-6326020595) approved versioned gesture-provenance **design, implementation, and testing only**. Central `main`, public v1 protocol, game runtime and production endpoints are unchanged. This candidate is a review-only child of [#705](https://github.com/tehki/myaso/pull/705), which is itself stacked on the server-only #700.

## Source scope and defense boundary

`server/src/prealpha_lmb_gesture_authority.rs` adds a **pure, currently uncalled** per-authenticated-connection gesture decision reducer. It consumes the independently verified 16-byte proposed v2 `GestureEvent` contract from #705, not real network packets. The library module is exported only for isolated tests. No `main.rs`, `simulation.rs`, JS browser listeners, original v1 34-byte datagram decoder, balancing, hit targets, damage, input timings or public feature flags are altered.

This reducer is **not an ingress authenticator**: its constructor `lease_epoch` must be supplied by Core 8A/8C from the genuine authenticated transport/session, never from a client. Likewise `server_ms` must be the actual monotonically advancing World authority clock, never `event.client_tick`, a client send timestamp or a browser UI timer. Integration must only apply the resulting commands if the actual player/world action is compatible and server hit/recovery/damage validation permits it.

| Accepted state/event | Trusted phase/command |
| --- | --- |
| New larger lease-scoped gesture ID, `PRESS` | `BeginLightWindup` immediately, original 135 ms light windup |
| Same gesture `UPGRADE`, unlanded light, original press elapsed **under 135 ms** | `UpgradeHeldHeavy { server_elapsed_ms }`, original elapsed retained, never two hits |
| Actual server time reaches **320 ms** since press while charging | `HeavyReady` once, READY remains indefinitely without auto-strike |
| Matching `RELEASE` while READY / >=320 server ms charging | `ReleaseHeavy` once |
| Matching `RELEASE` before 320 ms | Original light only; if it had been upgraded, `ResumeLight` from original press elapsed |
| Matching `CANCEL` before light hit or during held heavy | `CancelUnlandedLight`, no future heavy from this gesture |
| Late `UPGRADE` after 135 ms / original light active | Rejected; never a second action |
| Duplicate event with matching sequence/gesture/action | Idempotent no-action; previously accepted command not reapplied |
| Reordered/stale/wrong lease/reused gesture ID | Rejected/stale, no command |

The module retains a bounded 64-entry replay journal. IDs and event sequence are monotonic within one authenticated lease. After World has independently completed recovery, `retire()` clears the current gesture but preserves high-water marks to prevent ID replay. Session teardown must discard the entire reducer and its journal. A session whose monotonic u32 event identity approaches wrap must rotate/re-negotiate its lease, not wrap.

## Exact deterministic test scope

`server/tests/prealpha_lmb_gesture_authority.rs` uses real typed event envelopes and **trusted test-owned server-ms arguments**. It tests 135ms windup, upgrade at 80/134ms and rejection at 135ms, strict 319/320ms heavy boundaries, infinite READY with no auto-attack, 5ms fast-press release, early-release light fallback, CANCEL before contact or after READY, one-hit/no double after lost/delayed upgrade, duplicate/stale sequence and forged event rejection, cross-lease fencing, 80 sequential retire/replay cases, and out-of-order events. Parent Rust/Node fixtures remain intact.

## NOT implemented / no release claim

These tests are NOT an independent-machine 2/4 player browser fight or actual hit/damage proof. Further P0 stages, owned jointly by Core 8A/8C, UI 10 and Combat 4, remain **mandatory**:

- Negotiated version-2 admission and authenticated **ordered reliable** event transport separate from the unchanged version-1 34-byte realtime sample packet; persist *actual DOM press/release edges* across 30Hz sampling and packet loss, bound duplicates/retries/ACKs and backpressure; no unauthenticated event can inject a command.
- Core 8C's lease epoch identity, death/respawn/reconnect/world-zone lifecycle, effective tick ownership, action state and actor-fencing; old session events cannot mutate a newly joined fighter.
- Atomic integration with original `World` state: on press start light windup, on upgrade transfer original server clock to heavy, on early release resume legitimate single light, on ready release one heavy after server validation. The reducer does not perform collision/range, HP/guard/parry/hit validation or implement a matching `World` tick adapter.
- Native Chrome+Firefox W3C pointerdown/up/cancel and RMB-held chord, Space+jump attack, KeyE standalone heavy, keyboard-focus/Enter/Escape chat, roll/parry, damage/guard/HP, packet loss/reordering/duplicate, two/four independently controlled humans, and strict original protected M41/M107/M108/M111/M121/M147/M155/M171/M194/M206 plus others without waiver.
- Main's original Silver Knight/Sound/Chat C1 optional candidate combined exact-head CI, isolated staged immutable package SHA, two-host acceptance and rollback, central merge/deploy approval.

**No development here constitutes authorization to merge, deploy, change the live input codec or assert that instant-light is playable.**
