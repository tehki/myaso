# Core 8A — Chat C1 authenticated proximity protocol (review only)

**Source:** issue #1085, selective port of \`integration/prealpha-01-chatc1-20261022\` onto Combat \`ba85024b27bf09db9a52b06416c1ea3cbbcb40f1\`.
**Status:** DRAFT, default OFF; no public configuration, deployment, server enablement or gameplay-input changes.

## Ownership and session binding
One server-admitted WebTransport \`/game\` connection owns a real server-assigned player net ID. Only after the original reliable game baseline stream is accepted can that same connection establish a separate optional client→server **unidirectional reliable chat stream** and server→client **unidirectional reliable reply stream**. No new port, WebSocket, account, player ID field, name, recipient address, coordinates, channel list, global chat or external chat service. No chat datagrams. The server obtains the sender ID from the accepted Rust connection task and range/zone/positions from the original World under its own lock. Client text is untrusted, and server receiver labels must come from the server's \`sender_id\`, never sender-provided strings.

**State and guard:** \`MYASO_CHAT_C1_ENABLED=1\` is opt-in on the server (absent/0 = OFF; all other values fail startup). \`MYASO_CHAT_RADIUS\` defaults to 160 original-World units and permits only finite 32..=512 values. An operator-controlled client release configuration and UI10 attachment are **separate prerequisites**. The current experimental v2 typed-gesture hello also uses a client uni stream; to avoid stream-consumer races, this Draft **fails startup if chat and experimental v2 are both enabled** until Core8A/8C approve a single stream multiplexer. Public v2 remains OFF. Do not silently change this gate.

## Binary protocol — version 1
All fields little-endian. Each reliable stream frame is \`u16 payload_length\` followed by payload bytes. Server accepts at most one optional 2-byte preface \`30 01\` before any message. Its isolated reply stream uses the same u16 envelope. The maximum valid client message text is **240 UTF-8 BYTES, not 240 characters**. Never trust sender labels or client-supplied spatial assertions.

| Frame | Payload |
| --- | --- |
| Client ChatSend \`0x31\` | \`u8 type=31, u8 version=1, u8 local_channel=1, u32 correlation (nonzero), u16 utf8_length (1..240), utf8_text[length]\` |
| Server ChatReceived \`0x32\` | \`u8 type=32, u8 version=1, u8 local_channel=1, u64 message_id, u32 sender_net_id, u32 authoritative_world_tick, u16 utf8_length, utf8_text[length]\` |
| Server ChatResult \`0x33\` | \`u8 type=33, u8 version=1, u32 client_correlation, u8 result_code, u64 server_message_id\` |

\`ChatResult\` codes: 0 ACCEPTED, 1 NOT_CONNECTED, 2 UNAUTHORIZED, 3 INVALID, 4 TOO_LONG, 5 RATE_LIMITED, 6 CHANNEL_UNAVAILABLE, 7 UNAVAILABLE, 8 DUPLICATE. **ACCEPTED means authorized/bounded fanout attempted; it does not prove that another player read or displayed the message.**

## Validation and isolation
- Reject malformed lengths, wrong version/channel, invalid UTF-8, empty/whitespace-only message, controls and bidi override/isolate characters. Server limits buffered frame payload to 512 bytes (invalid oversized frames fail closed). Client sends no encoded lone surrogates. UTF-8 decoding is strict, never replacement-based for untrusted input.
- Chat is a distinct reliable uni-stream pair, not the original Combat datagram or baseline reliable stream. The per-player outbound queue is **8 frames**; saturated recipients drop only chat deliveries using \`try_send\`, never block simulation. Chat response queue saturation retires chat, not gameplay.
- Ingress budget **64 frames/second per chat stream** before scanning positions; malformed-frame penalty caps at 8; accepted requests use a **4-token burst/refill 1 token per 600ms**. Dedup remembers the latest **32 client correlation IDs** per chat session. Server-assigned message IDs are monotonically checked; no account/persistent delivery.
- World lock is held only to snapshot authoritative positions and current tick, not across stream reads/writes. The chat hub performs bounded fanout to connected, opted-in, same-zone recipients within radius. Sender is not re-broadcast to self. Sending text, acknowledgements, spam and partial frames cannot create damage/movement events.
- Partial frame/body, stream setup and outbound writes have **10-second deadlines**; an idle chat reader waits for new bytes without rearming partial reads in \`select!\` (cancellation safety). Unexpected stream close, bad frames, timeout, chat writer failure and disconnected gameplay session retire that chat task and unregister the current sender. The chat guard aborts it on gameplay lease termination.
- Network client \`src/network/chat-codec.mjs\` uses one chat stream on the *existing* \`gameConnection.transport\`. \`src/network/local-chat-ui-bridge.mjs\` exposes a bounded ACK/callback interface to UI10 without importing or activating any visual panel. UI10 must use textContent, prevent Enter/Escape from affecting Combat input and explicitly release held inputs when composing.

## Department handoffs
**8C:** Own World position/zone authority, actor registration, radius and future spatial indexing; review the read-only \`fighters()\` snapshot and never move chat authorization to client packets. Add actor-incarnation fencing when persistent account identities exist; existing server-issued player IDs do not recycle within the process.

**10:** Own visual chat composer, keyboard focus and accessible panel. Attach the exported bridge only after the same-origin operator configuration explicitly enables chat, and use the existing authenticated WebTransport session. Never draw raw markup as HTML and never send sender IDs, positions or control strings.

**Main0 / 4D:** Verify exact-source locked Rust and Node tests, three/four genuine Chrome/Firefox browser players, near/far proximity, 240/241 byte rejection, stream cancellation, reconnect/rejoin and independent Combat 34HP/125ms Parry/450ms recovery regression first attempts. Production enablement and rollback belong to Main0. This Draft **does not** include UI10 publication or make production available by default.
