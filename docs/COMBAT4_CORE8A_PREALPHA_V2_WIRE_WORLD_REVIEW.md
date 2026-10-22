# ⚔️ Pre-Alpha Combat4 × Core8A v2 wire-to-World review proof

**CONDITIONAL, REVIEW-ONLY, DOES NOT ENABLE v2 OR PROVE LIVE QUIC.** For Main [#695](https://github.com/tehki/myaso/issues/695), Combat owner [#696](https://github.com/tehki/myaso/issues/696). This isolated worktree is a direct child of Combat real-World proof [draft #717](https://github.com/tehki/myaso/pull/717) `48c87611a5b85821d3e3869544eaa82f9fe6ab96` plus unmodified six authored commits from Core8A [draft #712](https://github.com/tehki/myaso/pull/712) `01b87d17c5defc47a28ad47186aaaf392630b0d0`, cherry-picked without conflicts or loss. Reconciles actual **local source/test ancestry**, NOT packet protocol disagreement with Core8C.

## Precise new cross-language acceptance

- `tests/prealpha-core8a-combat4-outbox-world-interop.test.mjs` calls the **actual** Core8A `ProposedLmbGestureOutbox` code (not a mocked queue): demonstrates `begin(42);release(42)` preserving *two distinct bytes* even when press/release share the same captured client tick, along with begin/upgrade/release emitted in order under one monotonically identified gesture. Byte-for-byte golden snapshots match Rust checked vectors.
- `server/tests/prealpha_core8a_world_wire_interop.rs` feeds those identical literal source-generated 16-byte event vectors to the **original Combat4 Rust `decode_event`** and then to the server-owned `GestureAuthority` reducer and review-only `World` action adapter. A real 60Hz `World.step()` yields the original `CombatEvent::Hit`: fast tap **34 HP**, target 100→66; early upgrade/hold through 320ms, matching terminal RELEASE **46 HP**, target 100→54. These are original HIT outputs from the production simulation, not test-set HP.
- Demonstrates duplicate release gives no new World command/hit, original v1 browser/main never imports either proposal module, original Core8A typed bytes contain no target/HP/damage authority, and a different tentative Core8C `0x52` envelope is **strictly rejected** by Combat4 `0x11` decoder (no silent decoding as another actor event).
- Core8A's original 10 outbox tests and Combat4's 5 codec + 12 reducer + 11 World source-level integration tests all remain intact.

## Exact local isolated Linux validation

Combined source (no runtime ingress/browser toggle): focused JS 19/19 PASS (Core8A 10 + new interop 4 + Combat codec 5); new Rust cross-language-to-real-World 4/4 PASS. Complete Node **577/577 PASS**; full locked server Rust Cargo including QUIC/WebTransport PASS; strict all-target Clippy `-D warnings` PASS; rustfmt and git diff whitespace PASS.

**These tests do NOT measure network latency, actual authenticated QUIC ACK, WAN loss, retransmission on a real channel, live player lease, DOM W3C actions, true independent humans, exact combined silver/chat release source, or protected exact-head GitHub quality.** Neither the outbox nor the review World adapter has any production caller.

## Core8C competing draft protocol — explicit incompatibility

Core8C [draft #715](https://github.com/tehki/myaso/pull/715) rooted on assembled optional Chat [#708](https://github.com/tehki/myaso/pull/708) independently proposes version2/type **`0x52`** with u64 server-issued session epoch, packet sequence, source-qualified LMB and standalone KeyE events, 1–4 events in one packet and no real ACK layer. Combat4 #705/Core8A #712 instead propose version2 **`0x11`** per-event and **`0x12`** ACK with lease outside the wire payload. Both are dormant and internally self-consistent, but **incompatible on the wire**.

**Main decision requested:** select one negotiated transport/epoch/event/ACK contract; preferably combine Core8C's explicit authenticated actor-session epoch and KEYE source isolation with Core8A's bounded ACK/resend outbox and Combat4's tick/hit/HP fences. Build one cross-language golden corpus for that chosen spec and fail closed on unsupported variants. Do NOT merge both as one v2, infer wire packets or activate online gameplay before Core8A/8C/UI/Combat native browser acceptance.

## Remains on HOLD

- Integrate actual authenticated negotiated QUIC ingress and server ACK; no client-side clock or source claim is an attack authority.
- Server Core8C must own actual actor epoch/death/rejoin/focus/cancel/roll/parry/KeyE and one-gesture atomic World tick mapping. UI10 captures native pointerDOWN/UP/CANCEL/blur even between legacy 30Hz samples; Chat C1 Enter/Escape must not steal a heavy release or create attack after focus recovery.
- Preserve original M41/M107/M108/M111/M121/M147/M155/M156/M171/M194/M206 and full protected exact-head Chrome/Firefox 2–4 actors + two independent human hosts, original Silver atlas/sound/Chat C1 optional OFF combined artifact, formal stage+rollback and Main GO. Original protected #717 quality was in progress at previous check; full Core8A #712 protected failed M144 and its dedicated outbox CI succeeded. Neither outcome qualifies this newly combined head.

**No branch merge to main, no stage, no production restart, no public enablement, no claim of Pre-Alpha READY.**