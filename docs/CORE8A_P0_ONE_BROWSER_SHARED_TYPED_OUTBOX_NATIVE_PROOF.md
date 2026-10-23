# Core 8A P0 — One authentic browser shared typed outbox to original Rust World

**DRAFT, NONRELEASE.** Direct isolated child of Core8A [#868](https://github.com/tehki/myaso/pull/868) exact `184121fb81a2c8008d56ed4ce50c4cbda1dc803a`, nested under #858→#852→#848→#846→#841. No production browser/server input modification, public v2 or merge. Only adds a genuine native acceptance harness plus a focused nonrelease GitHub Actions step and path triggers.

## Real instrumented control path

The test process spawns the actual `server/target/debug/myaso-server` Rust binary with original ephemeral OS/TLS certificate, default-OFF experiment expressly enabled on **loopback 127.0.0.1 only**, listens on local ephemeral HTTP fixture, starts real ChromeDriver / headless Chromium and connects native browser `WebTransport` to the original Rust endpoint with SHA-256 certificate hash pinned. It opens the original bidirectional game stream, transmits the exact eight-byte unidirectional `02 10 MYASO1` HELLO with FIN and consumes actual reliable `02 13 00 00` capability grant. Nothing pretends to be an account-authenticated human identity or client-specified actor.

The browser uses a real ES module import of the **existing, unchanged** `src/network/prealpha-lmb-gesture-outbox-proposal.mjs` `ProposedSharedTypedGestureOutbox` and its existing allocator/codec modules, rather than handcrafting wire bytes. A freshly admitted opaque lease token is handed only to this one queue; the browser reads its authenticated QUIC datagram receive stream and routes byte-exact server `0x12` ACKs back to `receiveAck(bytes, sameLeaseToken)`; caller cannot mark hits from ACK.

One W3C browser action schedule (no `dispatchEvent`, synthesized `KeyboardEvent` or fake server HIT) presses physical mouse LMB, presses and releases physical KeyE during original LMB 135ms windup, then releases same-pointer LMB. The **actual shared outbox** must allocate exactly one sequence namespace and two different source gesture IDs. Its four canonical 16-byte `02 11` records must appear as:

- LMB0 PRESS seq1,id1;
- KeyE1 PRESS seq2,id2 (legitimate busy/no-combat, never a second heavy);
- KeyE1 RELEASE seq3,id2;
- LMB0 RELEASE seq4,id1.

Four authentic received `02 12` ACKs must be ACCEPTED, nonzero original authoritative tick and paired with the actual pending source/gesture; all returned outbox receipts must say `transportSettled=true`, `combatCommitted=false`. Exact pointer identity, trusted physical KeyE, correct event order, no rejected/stale errors, zero pending/reservations, open lease, real original `M201_AUTH_ACTION fighter=1 LightWindup1→LightActive2`, and **no phantom HeavyWindup9→HeavyActive10** are mandatory. ACK or World action transition is **not** independently proof of actual target HP/damage.

## Proof and explicit gaps

Local Serj Linux: 4 consecutive unskipped genuine Chromium+QUIC+Core8A outbox lab executions returned `CORE8_NATIVE_ONE_SHARED_OUTBOX_WORLD_PASS`. The current original Rust World tests already prove 34HP/46HP where genuine target contact exists (parent #868), and same parent exact-head focused [#39931523176](https://github.com/tehki/myaso/actions/runs/39931523176) and mandatory protected [#39931523182](https://github.com/tehki/myaso/actions/runs/39931523182) passed. **Those parent greens do not retroactively qualify this new child head**; both focused native and full protected CI must rerun at this exact child source.

This is a laboratory page harness, **NOT the actual `web/online-game.mjs` original player UI, account-authenticated principal or truly multi-host Chrome+Firefox game**. UI10 #859 currently has a dormant physical two-source adapter on a competing KeyE release-only branch (#855), and that branch is **not merged** into this #868 auto-KeyE ancestry. Main+Combat must first decide which independent KeyE semantics; original owner-mandated held **LMB** remains 320ms READY and real matching RELEASE-only. UI10 must attach original game DOM/blur/chat/capture handling and one bounded Core8A retrying outbox to the same real authenticated QUIC connection; Core8B/8C must validate principal, zone, incarnation and new lease after death/respawn. Independently operated four-human Chrome+Firefox and postmerge protected/stage/rollback still required.

**HOLD:** no new `0x52` protocol, no original v1 22/28/34-byte packet change, no lowered assertions, no runtime game imports/activation, no main merge, server restart, stage, public endpoint, production deployment or release GO.
