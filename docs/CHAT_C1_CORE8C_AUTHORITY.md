# Chat C1 — Core 8C authoritative World boundary (Draft)

Issue: [#1085](https://github.com/tehki/myaso/issues/1085). Integration
base: the original public Combat server source `ba85024b27bf09db9a52b06416c1ea3cbbcb40f1`.

## Scope and activation

- This change selectively ports the earlier `integration/prealpha-01-chatc1-20261022`
  Rust codec, bounded routing hub, and real-QUIC transport acceptance. It does not
  transplant its older `main.rs`, alter game input/combat, or enable public chat.
- `MYASO_CHAT_C1_ENABLED` is **OFF by default**; its only valid values are `0`
  and `1`. `MYASO_CHAT_RADIUS` defaults to **160 world units**, allows a
  narrower **32..160**, and fails closed for nonfinite/invalid/larger values.
- A registered C1 stream is a child of a server-accepted game QUIC session,
  not an independent identity. It has a dedicated client uni send stream and
  isolated server uni reply stream. Each request frame is u16 length-prefixed;
  reply frames never enter the realtime combat datagrams/snapshot stream.
- On loopback v2-proposal sessions, the existing 8-byte v2 negotiation must
  complete first; chat does not steal that initial uni stream. Legacy public
  v1 sessions may open C1 directly once the operator enables it.

## World ownership and delivery

- No client message can specify a sender, recipient, coordinates, World or
  session lease. The wire contains only channel, correlation, and UTF-8 text.
- Every chat attempt reads the original `GameState.world` and current
  `chat_leases` map **under the same World mutex** used by 60Hz simulation.
  No await occurs between snapshot creation and bounded fanout.
- Delivery requires the receiver to have a registered chat stream on its
  current lease, to be alive, and to share `world_instance` with the sender.
  Distance uses the server's current `fighter.x/y` and <= radius².
- Disconnect/seat retirement invalidates the lease; removal of a previous
  connection cannot unsubscribe or delete a newer session's World actor.
  Dying disables chat until the genuine World respawns the same live actor.
  Moving/teleporting immediately changes the next routing result.
- Per-sender tokens, replay correlations, 240-byte cap, 512-byte frame bound,
  ingress frame budget, finite parsing timeouts, eight-item try_send queues
  and optional-stream isolation keep chat below combat priority.

## Ownership and acceptance boundary

Core8C owns server World routing and tests; Core8A verifies the authenticated
separate stream, coexistence with v1/v2, loss/reconnect and resource budgets;
UI10 owns visible chat, focus protection and `textContent`; independent 4D
checks combat input does not trigger while the composer is focused. Main0
owns integration and deployment. Neither `MYASO_CHAT_C1_ENABLED=1` nor
`chatC1Enabled: true` in public config is activated by this Draft.

No global chat, DMs, persistence, wallets, economic transactions, or
cross-World relay are permitted. No CI GREEN is a release authorization.
