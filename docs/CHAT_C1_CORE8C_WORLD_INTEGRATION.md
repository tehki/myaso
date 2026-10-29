# Core 8C — Chat C1 World authority integration (P0, nonrelease)

**Parent:** #1085. **World authority tracking:** #1088.

This patch stacks on Core 8A's `codex/core8a-chatc1-canonical-security-20261029`
Draft, itself based on Main 0's `integration/chat-c1-live-20261029`
release candidate. Main 0 alone determines integration order and activation.
Neither this patch nor green CI enables public chat.

## Invariants

- One original Rust `GameState.world` and one simulation clock; no chat-side
  physics, positions, hitbox, damage authority, alternative message service,
  global broadcast, DMs, persistent log or token settlement.
- Only an admitted WebTransport gameplay session receives a server-issued
  player ID and distinct lease epoch. `chat_leases` maps the current game
  actor to this server lease and is **not represented in a client ChatSend**.
- Every C1 route takes the current original World snapshot, authoritative
  fighter coordinates, alive status and `world_instance()`. The sender must
  be registered on that same lease and same World. Recipients must be alive,
  registered on their own *current* leases and at distance <= radius.
- Default radius is 160 world units; operators may **tighten** it to 32..160
  but not expand it without review.
- The 60 Hz World lock is held while a bounded route is computed. The chat hub
  uses `try_lock()` rather than an await under the World lock, so chat
  congestion is fail-closed `Unavailable`, never a Combat simulation stall.
  Bounded outgoing `try_send` queues never await an individual chat client.
- When the game connection closes, old chat peer removal uses its exact
  lease epoch, then World actor removal only occurs if the current session
  still owns that actor ID. A departed session cannot unsubscribe a rejoined
  peer or erase a replacement fighter.
- No player-controlled location, sender ID, World ID, target ID, or group is
  ever accepted; receiving self-messages is disabled.
- Validation retains Core 8A's extended Unicode/bidi safety cases and
  real 4-client QUIC stream proof; no browser/Gameplay code is replaced.

## Independent acceptance boundary

Qualify `server/src/chat.rs` Rust codec/radius/lease tests,
`server/tests/local_chat_multiplayer.rs` real pinned-TLS 4-client session
tests, full Rust server tests, strict feature-enabled Clippy, full Node suite
and protected GitHub Actions on an **exact integration commit**.

World position changes, death, respawn, teleport and disconnect are reflected
at the next request against original server state. Future multi-World routing
must supply the true `world_instance` for each authoritative actor; the
currently deployed game exposes one shared World per GameState.

Independent Combat 4D must verify no focus leaks or combat input regressions.
Only Main 0 may integrate/merge, package, back up, roll out and reverse
`MYASO_CHAT_C1_ENABLED=1` with a matching trusted browser
`chatC1Enabled:true`. Both flags remain OFF in this Draft.
