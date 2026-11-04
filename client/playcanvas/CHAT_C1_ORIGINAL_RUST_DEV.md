# Main0 Alpha 0.2 — Original Rust Chat C1 in PlayCanvas (source-only)

**Status:** source implementation ready for real Chrome/authoritative-server acceptance.
**Release:** HARD HOLD. This is not a public PlayCanvas/Chat C1 activation.

## Reuse and safety

PlayCanvas does not define a new chat packet, sender identity, local message
acknowledgement, rate limit or transport. It imports the original
`src/browser/local-chat.mjs` composer and
`src/network/local-chat-ui-bridge.mjs` (which uses the original
`src/network/chat-codec.mjs`).

The original UI has two optional host/style overrides, leaving existing
`#arena`, `.arena-stage` and `./local-chat.css` behavior unchanged.
PlayCanvas uses `#application` and `#shell`, with the original
`web/local-chat.css` loaded in Vite DEV only.

Chat C1 is attempted ONLY from local Vite DEV with `?rust=1&chatC1=1`
after a real original WebTransport session has connected to the loopback
`https://localhost:PORT/game` endpoint with a pinned SHA256 certificate.
The Rust server must independently enable original Chat C1. Neither query
parameters nor the PlayCanvas UI grant chat authority. An optional denied
chat stream leaves gameplay intact; no WebSocket, synthetic receipt, optimistic
message acceptance, sender spoofing or alternative combat transport is added.

The original UI handles Enter to focus the composer, Escape to cancel,
reliable server acknowledgement, inbound sender NetID, bounded local history,
UTF-8 validation and physical gameplay focus suppression. The canvas is
focusable; composing text suspends original Rust physical Combat input.

## Local Chrome-only genuine acceptance still required

1. Build/start an **isolated** original Rust World on loopback with the
   existing Greyhaven gate and original Chat C1 enabled, using its local-test
   certificate. No production host, keys, listener or users.
2. Start `cd client/playcanvas && npm run dev` with the two existing
   environment variables `VITE_MYASO_DEV_QUIC_URL` and
   `VITE_MYASO_DEV_QUIC_SHA256` set to the exact original loopback endpoint.
3. Open two real desktop Chrome Stable sessions (not fabricated WebDriver
   packets) at `http://127.0.0.1:4174/?rust=1&combatInput=1&chatC1=1`.
   The isolated source must retain original Source0/gesture grants.
4. Verify genuine server-owned NetID + processed input ACK before claiming
   playable Combat. Enter → composer focus must suppress movement, RMB, wheel
   and LMB; Escape must cancel without a chat packet; Enter submit may show
   **Accepted** only after the original reliable Rust Chat ACK, and a second
   browser must display a message with original server-issued sender identity.
5. Verify rejected/timeout chat messages never appear accepted; Chat stream
   disconnect does not close gameplay QUIC; session close removes the panel;
   reconnect and three same-session death/respawn cycles never forge sender
   identity. Then expand to four real Chrome clients and record exact SHA,
   Chrome version, server logs, assertions and first-RED evidence.

## Evidence at initial source increment

- New wrapper contract tests include blocked non-QUIC, Chat-only failure,
  original adapter mount, disconnect isolation and true original UI mounting.
- Existing original Chat C1 tests remain unmodified.
- These Node tests and Vite build are **not** genuine Chat C1 gameplay PASS.
- PlayCanvas Editor and production publishing are untouched.

The browser support decision for Alpha 0.2 is Chrome Stable desktop only.
Historical Firefox tests and failures remain preserved without becoming a
Chrome product-acceptance requirement.
