# Chat C1 v1 — Native Firefox stream-opening preface (Core review candidate)

**Owner for approval:** Core & Multiplayer / Networking 8A. **Base:** #403 at `3717435534052f5cf03fa7e31462018a7b313779`. **Consumer:** Department 10 UI C1B draft #412.

## Problem and evidence

Genuine Mozilla Firefox 158.0.1 connects to the existing authenticated Rust WebTransport **game** session and receives normal gameplay snapshots and input acknowledgements, but optional C1 chat stalls waiting for its server reply unidirectional stream. Firefox apparently defers opening an outbound QUIC unidirectional stream until a **nonempty** write. Chromium opens its chat stream even without a write.

Observed on isolated Linux with real Rust server and independent Chrome–Firefox–Chrome W3C sessions:
- Original C1 code: Firefox `local chat reply stream timed out` after 10 seconds; gameplay stays live.
- Writing 0 bytes to the chat writer: same timeout.
- Writing 1 arbitrary byte: Firefox receives server chat reply, but server rejects the incomplete frame and chat fails (not suitable for production).
- **Proposed versioned preface**: `[0x02,0x00,0x30,0x01]` (length 2 + packet 0x30 + v1) is a nonempty, bounded writer operation. Rust consumes it **once as the first chat frame**, without routing/ACK/user text. **PASS:** real Chrome↔Firefox bidirectional chat, far third Chrome excluded, genuine server ChatResult/ChatReceived, pinned ephemeral TLS, and game ACK samples advancing 92→96 (one run observed p95 53ms).

## Wire semantics and safety

The v1 client now sends an explicit chat-stream `hello=0x30` preface as its **first length-prefixed frame**. It contains no sender ID, text, coords, or recipient. Bound its outgoing write to the existing chat handshake deadline; timeout aborts only the optional chat writer, never gameplay datagrams or the shared WebTransport connection.

The authoritative Rust C1 server accepts exactly `[0x30, 1]` with 2-byte payload length **only as the first frame**. It is not a message, not a rate-limit/token-bucket send, and not an ACK. Other 2-byte frames, duplicate or out-of-order prefaces are rejected. Existing legacy clients that start with the ordinary 9+ byte ChatSend **remain accepted unchanged**; the existing three-client Rust acceptance continues to pass.

**Compatibility:** New C1 chat clients require the updated Core server for this optional preface. Before coordinated deployment, the old server will reject the preface, leaving optional chat unavailable; gameplay stays functional. Normal public UI currently does **not** enable C1, so staging/release must keep the protocol and browser integration atomically versioned.

## Acceptance and hold

- Node codec + UI bridge **18/18 pass**; exact wire-order Node test checks preface precedes ordinary ChatSend.
- Rust real-server chat acceptance **7/7 pass** (six prior tests unchanged + legacy-compatible preface test).
- Isolated full C1B Rust + genuine **Chrome/Firefox/Chrome** test passed both directions with separate WebTransport sessions; recipient C excluded and gameplay ACK continuity verified. Cross-machine independent-network/WAN still untested.
- Existing strict Chrome/Firefox PvP M194 fails on UI C1B current head, tracked in #298, unrelated cause not proven.
- **DRAFT ONLY; not merged or deployed.** Core must review protocol ownership, packet ID reservation, malformed preface behavior and compatibility; Development Center #360 coordinates chain Core #399 → 8A #403 → this fix → UI #412. No weakening Combat acceptance or public chat activation.
