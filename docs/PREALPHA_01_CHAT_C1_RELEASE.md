# MYASO.IO — Chat C1 live-Combat integration and release contract

**Status:** Draft, default OFF, not deployed. **Owner authorization for a production chat release has not been granted.**

**Repository:** `tehki/myaso`
**Tracking:** #1085 (Main0), #1087 (8A), #1088 (8C), #1089 (UI10), #1090 (independent 4D).
**Canonical code base:** deployed world-scrolling Pre-Alpha `928754a1a06d4ef2079c4829617ed92bc885c4c4` (source revision confirmed on production VPS 29 Oct 2026).
**Legacy chat source selectively ported:** `integration/prealpha-01-chatc1-20261022` at `ed48ef74e4f88a8f92b1998574140e58d4655f74`. Existing Combat, Silver Knight, camera, arena, private HIT, and reliable baseline code were **not replaced** with legacy versions.

## Canonical protocol and owner boundaries

- Core 8A: one optional, reliable, bounded QUIC **unidirectional stream in each direction**, reusing the already admitted original WebTransport game session. No separate WebSocket, no client-supplied sender/recipient IDs or coordinates.
- Client preface: 16-bit little-endian length of two, followed by `0x30 0x01`; one preface per session.
- Client send: length-prefixed `[0x31, version=1, channel=local(1), correlation:u32LE, textBytes:u16LE, UTF8]`.
- Server result: length-prefixed `[0x33, version=1, correlation:u32LE, status:u8, messageId:u64LE]`. An accepted result means **server acceptance**, NOT confirmed delivery/read.
- Server receive: length-prefixed `[0x32, version=1, channel=1, messageId:u64LE, senderId:u32LE, tick:u32LE, textBytes:u16LE, UTF8]`.
- Core 8C: all recipient identities, positions and same-World radius come from server World state; initial radius **160 world units**, operator range 32–512. No global chat, DMs, accounts, guilds, NPC or persistent transcripts.
- Invalid UTF-8, empty/oversized text (**240 UTF-8 bytes maximum**), control/bidi injection, malformed framing or correlation replay are rejected. Per-session token bucket burst 4, refill every 600ms; ingress capped at 64 frames/s; eight-slot outbound queue; no user text in error logs. Slow chat cannot block Combat.
- UI10: small lower-left panel, escaped text rendering, bounded 60 message history, server-assigned labels only, Enter composer/open/send, Escape cancel/return focus, gameplay input released on canvas blur. No optimistic “delivered” claims.
- 4D: independent tests of the exact combined SHA: two/four real clients, near/far, spoofing, malformed, rejoin, focus, Combat unchanged, security, browser engines, and rollback/release evidence. Results must distinguish local browser proofs from independent two-physical-machine/WAN tests.

## Two separate production gates

1. **Rust:** `MYASO_CHAT_C1_ENABLED=1` explicitly set by the production operator. Absent/0 is OFF, unexpected values fail closed. `MYASO_CHAT_RADIUS` is finite within 32–512.
2. **Public browser:** first-party operator-served `/game-config.json` must contain `chatC1Enabled:true` AND match the existing pinned `serverUrl` and `certificateSha256` on the current URL. URL query `chatC1=1` **alone is not sufficient**. Default first-party config writer emits no chat flag. Nonproduction `chatC1Preview=1` is exclusively localhost HTTP and does not bypass the Rust flag.

**V2 stream compatibility boundary:** the original experimental V2 gesture listener and chat ingress both consume optional incoming uni streams. Until 8A proves a shared multiplexer, server startup with BOTH V2 and Chat C1 enabled **fails closed** rather than allowing either stream to be misclassified. Public Pre-Alpha V2 remains OFF; this does not affect ordinary Combat.

## Current integration and test categories

- Local imports from legacy are isolated Chat hub, wire/client bridge, UI and test suites; current Combat GameState, lease epoch and private-hit implementation remain.
- Main0 integrated rust chat hub under a separate Mutex and current authoritative session admission/removal; chat returns no gameplay authority. The ordinary reliable snapshot/kill writer and input datagrams remain unchanged.
- `server/tests/local_chat_multiplayer.rs` and native unit tests check authoritative router boundaries, frame sizes, replay, invalid text, rate limiting.
- `scripts/chat_c1_three_browser_acceptance.mjs` creates an ephemeral loopback Rust World, real pinned TLS WebTransport, actual Chromium browser clients, and verifies ACKs, physical focus, near/far, markup-safe text, UTF8 limits, and continuous input ACKs. This is **native local browser acceptance**, not live public rollout or separate physical-machine acceptance.
- Required for release: strict Rust fmt/Clippy/native tests, full Node suite, exact-head CI green, mixed Firefox/Chrome runs, 4D independent explicit verdict, validated package/rollback including server-side config activation, explicit owner authorization.

**Production boundary:** Do not enable chat via live flags, edit VPS services, merge protected `main`, or perform production cutover merely because isolated tests or this Draft PR pass. Chat C1 needs a different Rust binary from the running live server and cannot be shipped as a static-only hotfix. The earlier visual rollout backup and cert-rotation controls must remain available.
