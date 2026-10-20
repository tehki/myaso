# Chat C1 — live server-authoritative local chat contract

**Owner:** Moon Games Department 8 — Core & Multiplayer.
**Integration:** https://github.com/tehki/myaso/issues/360
**UI contract:** Department 10 — UI & Player Experience.
**Source:** `server/src/chat.rs`, `server/src/main.rs`,
`src/network/chat-codec.mjs`, `server/tests/local_chat_multiplayer.rs`.

## Verified baseline (main at 7c5fe9b)

- Rust Tokio/wtransport 0.7.2 server on `/game`, gameplay receives QUIC
  datagrams and uses one client-initiated bidirectional reliable game stream.
- Server assigns a transient `u32` `player_id` at connection admission,
  owns the actual `World::fighters()` positions and removes players on
  disconnect. There is **no production persistent account verifier yet**.
- Main live world is **one arena**, with no integrated multi-zone membership.
  `zone.rs` contains dormant zone-transfer work; do not mistake it for
  live cross-room authorization.
- The existing snapshot interest grid is refreshed every ~50ms for
  replication. Chat instead reads current authoritative fighter coordinates
  under `GameState` lock and uses a capped scan of 512 live entities.
- NPC conversation [PR #353](https://github.com/tehki/myaso/pull/353)
  remains an independent experimental feature; chat packet types and
  channels do not grant NPC or system-message origin.
- The Combat, UI and World departments have active feature stacks. No game
  packet layout, combat input bit, WebSocket service, NPC parser or UI
  component is changed by this C1 milestone.

## Transport: opt-in and separate reliable streams

Browser UI calls `openLocalChat(gameConnection, callbacks)` from
`src/network/chat-codec.mjs` **after** connecting to the existing game.
It opens one **client-to-server** WebTransport unidirectional chat stream.
The server accepts that stream and opens a separate **server-to-client**
unidirectional stream for `ChatResult` and `ChatReceived` packets.

Both streams carry `u16 little-endian frame length` followed by a
versioned chat payload. Each stream has independent QUIC flow control and
is separate from combat datagrams and reliable gameplay snapshots/kill
events. Older clients never create these streams and continue unchanged.

Chat is intentionally unavailable over the unsupported WebSocket fallback
of this Rust server; the module explicitly reports that limitation rather
than pretending to deliver a message.

### Chat protocol v1 — byte offsets

All integers are little-endian, and all text bytes use strict UTF-8.
There are **no client-authoritative sender IDs or coordinates**.

| Packet | Direction | Layout after 2-byte frame prefix |
|---|---|---|
| `0x31 ChatSend` | client → server | `type:u8, version:u8=1, channel:u8=1, correlation:u32, text_bytes:u16, utf8[text_bytes]` |
| `0x32 ChatReceived` | server → client | `type:u8, version:u8=1, channel:u8=1, message_id:u64, sender_net_id:u32, server_tick:u32, text_bytes:u16, utf8[text_bytes]` |
| `0x33 ChatResult` | server → client | `type:u8, version:u8=1, correlation:u32, result_code:u8, message_id:u64` |

All packet types are confined to the **chat stream**. Their numeric values
do not alter existing gameplay `INPUT=1`, `SNAPSHOT=2`,
`INPUT_ACK=3` and `KILL_EVENT=4` on existing channels.

The server accepts a bounded **512-byte** input chat frame (excluding the
2-byte prefix), allowing oversized text submissions to receive a
`TooLong` error instead of silently allocating an unlimited buffer.
Actual accepted text is at most **240 UTF-8 bytes**. A received frame
is at most 261 bytes; a result frame is exactly 15 bytes.

The `correlation` is nonzero and supplied by the client to correlate
results. The `message_id` is monotonic and **server-issued** for an
accepted message; its lifetime is the current server process (not durable).
The only channel is `LOCAL=1`. All text is untrusted display data;
it must never be injected as executable HTML or privileged instructions.

### Stable result codes

| Value | Name | UI meaning |
|---|---|---|
| 0 | Accepted | Server authorized the message and attempted bounded routing |
| 1 | NotConnected | Player no longer exists in authoritative world |
| 2 | Unauthorized | Chat session lacks server admission |
| 3 | Invalid | Unsupported version, control characters, invalid UTF-8, empty/malformed packet |
| 4 | TooLong | Text exceeds 240 UTF-8 bytes |
| 5 | RateLimited | Sender exhausted burst quota |
| 6 | ChannelUnavailable | Unsupported channel |
| 7 | Unavailable | Unsafe/invalid routing conditions |
| 8 | Duplicate | Correlation already processed on this chat connection |

**Accepted is not a read/delivery receipt.** This milestone does not
provide offline mailboxes, permanent transcripts, recipient-read status,
reliable storage, or guaranteed delivery when recipient queues saturate.

## Server authority and routing rules

- The Rust `handle_connection` supplies the **assigned player ID** to
  the chat handler, and never accepts a claimed player identity in the
  `ChatSend` packet. Display name is not authoritative yet; UI should
  display a temporary player label derived from the session net ID.
- A sender must still exist in the server-owned world and have an active
  chat stream. Every route reads the live `World::fighters()` coordinates
  under the game-state lock. No packet contains client location.
- Routing only targets **active opted-in chat peers** whose authoritative
  position is within the speaking radius and whose authoritative zone
  matches the sender's. The live server currently assigns every fighter
  to the **single active arena (`zone=0`)**, so production multi-zone
  isolation is **not yet covered by this integration**; the pure routing
  test verifies zone filtering for synthetic authoritative zone values.
  Wire up the real zone registry before enabling interiors/taverns.
- Initial radius defaults to **160 game units**, configurable using
  `MYASO_CHAT_RADIUS` in the bounded range 32–512 units. It is a
  **provisional engineering value**, not a permanent game-design decision.
  Coordinate the approved radius and UI character limit with World & UI.
- Chat sessions have independent bounded outgoing channels of **8
  messages**. A full recipient queue drops eligible **chat** only;
  gameplay snapshots, combat and inventory queues cannot be displaced.
- Each sender has a four-message burst with one token replenished every
  **600 ms**. Duplicate correlation IDs are retained in a bounded
  **32-result ring** per chat stream and cannot cause repeat delivery.
- Control characters and Unicode bidi overrides/isolation controls are
  rejected. No raw message text or credential is emitted in routine logs.
- More than eight malformed frames terminates **only the chat stream**.
  The combat session remains unaffected.
- An active session is ephemeral, never an account login; disconnect
  removes chat permissions and queue routing. New sessions receive new
  server-issued IDs.

## Test acceptance and limitations

Actual `server/tests/local_chat_multiplayer.rs` starts the **real Rust
WebTransport game binary**, pins its short-lived server TLS certificate
and establishes **three separate QUIC client connections**. With server
spawn locations A=42, B=138 and C=234 (same Y), A↔B can exchange the
requested Greyhaven greeting and response while C (192 units from A)
gets nothing for A's 160-unit radius. Real packets verify authoritative
sender ID, accepted result, invalid requests, bad UTF-8, excessive text,
unsupported channels, forged sender-field extensions and duplicate
submission behavior.

`server/src/chat.rs` unit tests check server proximity and zone
filtering, slow recipients, replay, rate limits, disconnect and malformed
payloads. `tests/chat-codec.test.mjs` checks browser binary codecs,
fragmented inbound QUIC frames and opt-in transport separation.

**This is three separate connections through one loopback server.**
It is not an independent-network test (separate physical hosts/networks).
It also does not assert measured p99 chat load or browser combat coexistence
until dedicated load and combat-under-chat fixtures qualify it.

Protected GitHub quality, including exact-head Rust Clippy/tests and
Chrome/Firefox combat regressions, must remain unmodified and green before
release. Dedicated Chat C1 CI also runs codec and Rust integration tests.

## Follow-up gating before production activation

1. Department 10 owns the accessible composer, chat history presentation,
   keyboard focus, bubbles, notifications and user-visible error messages.
   Integrate only through `openLocalChat` and do not render untrusted
   text using HTML injection.
2. Hook session authentication and actual zone/room membership once the
   Core C2/C4 and World & Buildings stacks are integrated. Until then,
   sender names are transient, and there is just one live zone.
3. Introduce a zone-indexed chat recipient index before scaling beyond the
   bounded 512-player arena. Measure fanout, queue depths, memory, p95/p99
   chat latency and effects on combat, input ACKs and snapshots.
4. Add authenticated mute/block/report and social policy with World.
5. Add cross-network two-host acceptance, disconnect/reconnect under load,
   game combat concurrently with real chat traffic, plus Chrome/Firefox
   browser UI smoke and rollback qualification.
6. Confirm the provisional radius/length with World and UI, and introduce
   staged, reversible feature gating before any live realm rollout.

**No PR merge, main modification, deployment or VPS restart is permitted from
the Chat C1 department branch.** Development Center #360 owns integration.
