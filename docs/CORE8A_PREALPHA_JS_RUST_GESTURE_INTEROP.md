# Core 8A — dormant JavaScript → Rust v2 LMB wire interoperability

**Scope:** test-only child of Core8A [#724](https://github.com/tehki/myaso/pull/724), ultimately stacked on Combat4 original v2 review codec [#705](https://github.com/tehki/myaso/pull/705). The original 34-byte v1 INPUT remains the only live input protocol. This is NOT the approved v2 ABI, a real QUIC stream, authorized HIT, or a Pre-Alpha release.

## One canonical fixture, two original implementations

`tests/fixtures/core8a-prealpha-v2-js-rust-wire.hex` captures exactly nine immutable original Combat4 16-byte little-endian EVENT/ACK bytes, **not** Core8C's incompatible 0x52 review format.

`tests/core8a-prealpha-v2-js-rust-wire.test.mjs` creates the ACTUAL Core8A `ProposedLmbGestureOutbox`, obtains fast same-client-tick PRESS+RELEASE, held PRESS+UPGRADE+RELEASE, and PRESS+CANCEL bytes, and verifies they match this exact fixture. It also verifies the ACTUAL original Combat4 JS ACK decoder, out-of-order correlated transport-only ACK settlement, and duplicate rejection. No simulated direct encoding may substitute for the outbox.

`server/tests/prealpha_lmb_js_wire_bridge_review.rs` parses the **same fixture** directly into the original Combat4 Rust `decode_event`, feeds the ACTUAL Core8A bounded Rust `ReviewLmbIngress`, verifies reorder/gap/duplicate/lease/0x52 rejection, and serializes accepted/duplicate responses through original Rust `encode_ack`. Exact ACK bytes must match the JS-read fixture. No mock game World or source rewrite.

The dedicated exact-head workflow requires both language tests, original Rust ingress regression tests, full rustfmt, all-target strict Clippy, and unchanged production `server/src/main.rs` and `web/online-game.mjs` module imports.

**Limitations:** All tokens/leases are synthetic in tests; an opaque token is NOT real QUIC authentication. The gate doesn't transmit packets, bind a current World actor, validate combat action legality, commit HP, or deliver network ACKs. These require Main/Combat-approved canonical version negotiation, Core8C actor and death/rejoin authority fencing, real reliable QUIC ingress and server ACK writer, UI trusted DOM input, four real browsers and strict Combat acceptance before activation.

**Release HOLD:** No main merge, production or firewall change, server restart, v2 activation, test waiver or release GO.
