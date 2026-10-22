# Core 8A — dormant JavaScript → Rust v2 LMB wire interoperability

**Scope:** test-only child of Core8A [#724](https://github.com/tehki/myaso/pull/724), ultimately stacked on Combat4 original v2 review codec [#705](https://github.com/tehki/myaso/pull/705). The original 34-byte v1 INPUT remains the only live input protocol. This is NOT the approved v2 ABI, a real QUIC stream, authorized HIT, or a Pre-Alpha release.

## One canonical fixture, two original implementations

`tests/fixtures/core8a-prealpha-v2-js-rust-wire.hex` captures exactly nine immutable original Combat4 16-byte little-endian EVENT/ACK bytes, **not** Core8C's incompatible 0x52 review format.

`tests/core8a-prealpha-v2-js-rust-wire.test.mjs` creates the ACTUAL Core8A `ProposedLmbGestureOutbox`, obtains fast same-client-tick PRESS+RELEASE, held PRESS+UPGRADE+RELEASE, and PRESS+CANCEL bytes, and verifies they match this exact fixture. It also verifies the ACTUAL original Combat4 JS ACK decoder, out-of-order correlated transport-only ACK settlement, and duplicate rejection. No simulated direct encoding may substitute for the outbox.

`server/tests/prealpha_lmb_js_wire_bridge_review.rs` parses the **same fixture** directly into the original Combat4 Rust `decode_event`, feeds the ACTUAL Core8A bounded Rust `ReviewLmbIngress`, verifies reorder/gap/duplicate/lease/0x52 rejection, and serializes accepted/duplicate responses through original Rust `encode_ack`. Exact ACK bytes must match the JS-read fixture. No mock game World or source rewrite.

The dedicated exact-head workflow requires both language tests, original Rust ingress regression tests, full rustfmt, all-target strict Clippy, and unchanged production `server/src/main.rs` and `web/online-game.mjs` module imports.

**Limitations:** All tokens/leases are synthetic in tests; an opaque token is NOT real QUIC authentication. The gate doesn't transmit packets, bind a current World actor, validate combat action legality, commit HP, or deliver network ACKs. These require Main/Combat-approved canonical version negotiation, Core8C actor and death/rejoin authority fencing, real reliable QUIC ingress and server ACK writer, UI trusted DOM input, four real browsers and strict Combat acceptance before activation.

**Release HOLD:** No main merge, production or firewall change, server restart, v2 activation, test waiver or release GO.

## Core8A unscheduled-ACK fence (review-only child)

An enqueued PRESS/UPGRADE/RELEASE/CANCEL exists only in an in-memory pending buffer until a future trusted transport owner requests it through `nextSendBatch`. Before this correction, `receiveAck` settled any correlated pending sequence+gesture on the correct opaque lease token **even if the event had never been included in any send batch**. It therefore conferred a false transport-edge-settled status on a never-scheduled event.

The outbox now rejects an ACK when that exact pending event has `attempts === 0`, without deleting it or closing the proposal lease. A batch containing PRESS but not RELEASE cannot settle the later RELEASE. After `nextSendBatch` includes that event, the existing same-lease, exact sequence+gesture, typed status and anti-replay conditions still apply. An actual STALE/REJECTED ACK for a scheduled event retains its existing fail-closed behavior. Four dedicated negative tests cover all these boundaries and confirm default live v1 remains unmodified.

**Critical trust limit:** `attempts > 0` means only that bytes were **offered to the future transport owner**, never that real QUIC sent, received, delivered or accepted them. No current live session is wired; no source of actual server authentication, World hit or durable outcome is supplied. Main+Core8C+Combat must separately approve the live secure v2 negotiation, ordered stream and authoritative attack/tick contract; public Pre-Alpha remains HOLD.


## Core8A small-batch first-send fairness (review-only follow-up)

**Fail-first:** The original `nextSendBatch(1)` took the oldest pending event even if it was already offered to the transport, and retried its PRESS until `maxAttempts` before ever exposing the same gesture's pending RELEASE (or UPGRADE/CANCEL). Under retry budget 1 this closed the lease on the second call with RELEASE still never scheduled. Four new strict tests reproduce this unchanged-source error, including the same-tick PRESS→RELEASE, full PRESS→UPGRADE→RELEASE, two separate quick taps and small-batch sequence/retry order. Original source baseline: **4 RED among eight tests**; no production traffic was involved.

**Minimal fix:** `ProposedLmbGestureOutbox.nextSendBatch` now selects existing pending events with `attempts===0` first, in their original ascending event-sequence order; only leftover batch capacity goes to previously attempted events. It then emits the selected subset in ascending original sequence. Existing maxPending/maxAttempts, canonical byte copy, reserve-for-terminal, same-lease sequence+gesture ACK, no-ACK-before-schedule, stale/rejected fail-closed and non-authoritative `combatCommitted:false` remain intact. Original 16-byte LMB v2 `0x11/0x12` goldens and all original v1 gameplay are unchanged.

**Local exact branch** authorized Windows Node `node --test`: **28/28 PASS, zero skips**, original 24 plus four negative scheduling regressions. Strict cross-language Rust and protected browser quality require their own exact-head CI.

**Important limit:** Selecting event bytes in `nextSendBatch` means only *offered to a hypothetical transport owner*, not delivered to a genuine admitted QUIC connection. There is still no approved live v2 negotiation or production ingress. No source authority or HP/HIT is created. This small source-only queue fix is necessary but not sufficient for Pre-Alpha instant pointerDOWN light or 320ms READY heavy release.


## Cross-language forward-gap window (Core 8A review follow-up)

**Real source mismatch found:** original dormant Rust `server/src/prealpha_lmb_ingress_review.rs` has `MAX_GAP: u32 = 16` and `MAX_BUFFERED: usize = 16`. In the JS outbox, the independent `maxPending` capacity is configurable up to 256. Although the previous fair-first-send fix preserves first attempts, `nextSendBatch(32)` on 22 pending fast PRESS/RELEASE edges offered sequence 1..22 immediately. If sequence 1 is missing from a reordered stream, original Rust denies seq18 as exceeding its 16-edge forward gap and closes. This is a strict **review model mismatch**, not evidence of actual live QUIC packet reordering; the current real server v1 never imports this proposal.

**Fail-first evidence:** three new exact-source Node regressions in `tests/core8a-prealpha-v2-unsent-ack-fence.test.mjs` were RED against unchanged parent source, while eight original cases remained green:
- A 22-event queue with `maxPending=32` must initially offer only 1..17, leaving 18..22 unscheduled and ineligible for fabricated ACK.
- An out-of-order ACK for seq17 must NOT advance the earliest-unACKed seq1 fence; ACK for seq1 permits exactly seq18's initial attempt.
- As the oldest consecutive pending sequence is individually acknowledged, the permitted window slides 1 step without rewriting original v2 16-byte event bytes or setting `combatCommitted:true`.

**Minimal fix:** JS outbox computes `oldestUnacked` from the existing monotonically inserted pending queue, filters all first attempts/retries to `sequence <= oldestUnacked + 16`, prioritizes first attempts within that bound, and returns selected events in original sequence order. The original `maxPending`, `maxAttempts`, terminal-event reservation, same-lease ACK correlation, initial-send ACK fencing, sequence-ID monotonicity, stale/rejected fail-closed and canonical typed codecs are untouched. The constant mirrors the original Rust review gate; no server changes. Under malformed or missing ACKs, the client may conservatively stop/close instead of emitting beyond the receiver's known bounded window.

**Test outcome:** authorized local Windows Node after the fix **31/31 PASS, zero skipped** (original 28 + three new) with unchanged LMB/KeyE and original production no-import assertions. Native Chrome/Firefox/full Rust/strict protected quality require their own exact-head CI.

**Nonclaims and release HOLD:** This improves an **inactive in-memory outbox**; it has not been attached to an authenticated, version-negotiated QUIC ordered stream and does not show actual arrival, server ACK, actor authorization, HP or attack execution. Real authenticated reliable streams should preserve order independently and still require formal review of retries, delivery guarantees and epoch fencing. Main #723 has not formally activated the draft `0x11/0x12` gesture family; v1 gameplay, live World and browser stay untouched.
