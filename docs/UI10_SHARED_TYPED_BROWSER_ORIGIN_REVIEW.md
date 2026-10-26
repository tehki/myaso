# UI Department 10 — Key E reserved for Use; LMB-only Combat input (Pre-Alpha 0.1)

**Current authority:** owner-approved **24 October 2026** universal Combat & Core directive. **Release HOLD / review-only.** The selected implementation is [draft #1028](https://github.com/tehki/myaso/pull/1028) on its *current* exact head, not an independently deployable UI10 branch. Main Orchestrator 0 alone owns merges and releases.

> **Supersession notice:** Earlier versions of this document described standalone physical **KeyE source1 heavy** admission, four typed events `LMB0 DOWN → KeyE1 DOWN/UP → LMB0 UP`, and a KeyE RELEASE → Rust World HeavyActive acceptance. Those are **historical evidence of a now-retired control contract**, not release acceptance for the owner-approved LMB-only controls. Do not resurrect source1 tests or mix auto-KeyE and release-only-KeyE reducers.

## Final physical control contract

| Real input | Combat action |
| --- | --- |
| Short LMB, real pointerDOWN/UP | Original server-owned 135ms light windup; valid HIT 34 HP |
| Held LMB, READY after at least 320ms server time, deliberate corresponding LMB UP | One original server-owned heavy; valid HIT 46 HP |
| E DOWN, hold, repeated DOWN, UP, including while LMB is held | **NO Combat event, queue reservation, World action, HIT or heavy audio** |
| E in future | **Use / Interact RESERVED**; no interaction implementation activated here |
| RMB, wheel, Space, sprint and Space+LMB | Preserve separately approved kick/roll/parry/jump/sprint/chord behavior |

Retain the generic `heavyAttack` field in the original v1 input model: this field is still needed for the actual **LMB** heavy-charge pathway. Removing KeyE must **not** change LMB balance, original World timings, actor ownership, source0 gesture ID/sequence reservation, or source0 cancellation.

## UI10 ownership and actual selected code

1. Original playable browser entrypoints `web/online-game.mjs` and `web/game.mjs` ignore canvas `KeyE` keydown as Combat. Their existing physical LMB onHeavy callback remains the only applicable heavy-attack intent producer, including its normal heavy sound. Do not intercept E for an unapproved Use feature and do not consume chat-editable KeyE events.
2. `src/browser/prealpha-shared-ui10-sources-review.mjs` is now a **source0-only LMB review adapter** into ONE existing Core8A `ProposedSharedTypedGestureOutbox`. It no longer imports, constructs, attaches, or exposes `createDormantKeyEOrigin` / `attachDormantKeyEOrigin`. The historical `src/browser/prealpha-keye-source-review.mjs` must not be registered as a Combat producer. No new codec, network writer, actor ownership, or alternate local HIT pipeline is authorized.
3. The original physical LMB gate `src/browser/prealpha-lmb-dom-gesture-review.mjs` retains true mouse/pointer capture including RMB-held mousedown fallback, exact matching physical UP, one optional same-gesture UPGRADE only after approved server policy, focused chat/jump delegation, blur/hidden/lost capture CANCEL, and fail-closed retire. `pagehide` retires the whole lease and clears old pending edges.
4. Core8A source0-only allocator/outbox denies retired source1 before spending valid LMB sequence/gesture IDs, capacity or retries. Core8C/Combat4C must reject **manually crafted old 16-byte typed source1 `0x11` events** before World mutation (not just rely on browser code), and ensure the rejected ACK cannot strand or steal source0. `0x11/0x12` remains loopback-only, default OFF for the public game.
5. This UI10 adapter remains **dormant** until the authenticated, current-seat Core8A/Core8B/Core8C/Combat integration can atomically *replace* the live v1 attack capture. Never attach dormant listeners alongside existing v1 LMB or double-commit physical attacks. Client ACK is transport receipt, not server HIT/34HP/46HP.

## Exact acceptance contract for Main and Combat 4D

**Positive:** genuine trusted Chrome and Firefox short LMB → original World light/34HP; held LMB reaches READY at real 320ms and corresponding real LMB RELEASE → original World heavy/46HP, max one HIT; RMB-held physical LMB, Space jump chord, wheel parry/roll, chat and focus recovery, disconnect/rejoin current-seat fencing all remain consistent.

**Negative:** physical E DOWN, hold, repeat, RELEASE, E during a held LMB or in the chat composer → zero Combat source1 typed events and zero heavy audio/World mutation. Crafted replayed old source1 bytes on original WebTransport → explicit rejection before World ownership state, no HP effect or source0 capacity loss. Cancellation/blur/hidden/pagehide produces no phantom release, stale resend, double input origin or fallthrough to old v1 heavy.

**Historical older tests:** original real Chrome/Firefox and server World KeyE-heavy proofs in #844/#859/#898 belong exclusively to the retired owner contract and **must not be reported as current PASS**. Replace those cases with new **negative** source1 tests; preserve unrelated LMB ACK/lease/retry/capacity/cancellation and strict M-series regressions. Old standalone E-heavy CI runners must be migrated or made clearly archival, not silently waived.

**Review evidence at initial directive handling (not a release assertion):** an independently checked-out earlier #1028 commit `6aa44f232bbb2c1c844f75347d69ade5070409a5` passed **19/19** UI10/client source regressions locally (0 skipped) and syntax/diff checks. Exact current PR head and all required genuine Chrome/Firefox, Core8 native Rust and full protected CI must be checked again after every edit. A local source-only PASS does **not** demonstrate real browser multiplayer Combat readiness.

## Release fence

**NO merge into `main`, no stage, public v2 toggle, service restart, cert/network change, wallet/Use feature, or production deployment from this document.** Cross-review requires Combat 4A physical LMB, 4B mechanics, 4C World/actor rejection, independent 4D strict browser/HP acceptance, Core8A outbox, 8B actor/lease, 8C one 60Hz World, and Main0 owner sign-off. Main integration and blocker tracking: [#695](https://github.com/tehki/myaso/issues/695), [#723](https://github.com/tehki/myaso/issues/723), [#1028](https://github.com/tehki/myaso/pull/1028).

**STATUS: UI10 source contract aligned / exact integrated release HOLD.**
