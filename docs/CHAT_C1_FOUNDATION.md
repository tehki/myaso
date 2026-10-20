# Chat C1A — presentation and input foundation (nonproduction)

**Owner:** Department 10 UI & Player Experience. **Base:** `main` `7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`.
**Authoritative Core dependency:** [#395](https://github.com/tehki/myaso/issues/395).
**Coordination:** [Development Center #360](https://github.com/tehki/myaso/issues/360).
**NPC pilot:** draft [#353](https://github.com/tehki/myaso/pull/353), not integrated.

## Scope and deliberately missing functionality

The current Rust game server does **not** accept or route authenticated
player chat. This PR does not add an unreviewed packet type, a second
connection, fake server sender identity, fabricated recipient lists or
a successful-message illusion. Both online and practice UI show
**Chat unavailable** until Core connects a reviewed reliable adapter.
No URL flag enables mocks or a production-looking fake chat.

The C1 component is a small, initially collapsed Blood & Iron panel at
the arena's lower left (moves below canvas on narrow displays), with:
- native toggle/unread count, capped 60-entry DOM/history, safe
  `textContent` sender/message presentation, and Local/System categories;
- a real `role=status` for errors/acks and a bounded non-live history
  so screen readers are not flooded;
- an optional injected adapter with `send({ channel, clientMessageId, text })`
  returning an **explicit correlated server ACK** `{ok:true, clientMessageId}`,
  plus `subscribe(onAuthenticatedEvent)` and optional `ready`.
  This is a **UI-facing interface**, not a server packet specification;
- pending, accepted-by-server (NOT delivered-to-recipient), failed and
  disconnected states. A single in-flight message limits UI queue growth;
  client validation of 240 codepoints/240 UTF-8 bytes is only an early
  guard; the server must independently validate.
- Enter from focused canvas opens composer **only when Core adapter ready**;
  Enter in input submits and Escape cancels/returns canvas focus.
  Canvas blur additionally clears held movement/attack in both existing
  practice and online clients (no synthetic key or command events).
- No gameplay wheel/pointer listeners are installed.
- Combat visual flag softens only a *collapsed* panel via an event-driven
  MutationObserver, with no change to the game render loop.

## Integration contract and release blockers

UI receives only **server-authorized** `{channel,serverMessageId,sender:
{displayName},text}` notifications. No sender/recipient/position fields
are accepted as client authority. Trusted Core must own:
- authenticated session, reliable frame/packet allocation, event ordering,
  server-selected radius/recipient set and interest management;
- rate limits, mute/block/report policy, dead/zone rules, UTF-8 validation,
  deduplication and reconnect-safe identifiers;
- positive/negative ACKs, actual online status, disconnect handling,
  flood control, privacy/retention decision and three-real-client acceptance.

Use `installLocalChat(doc, {online:true,adapter:approvedCoreAdapter})`
only after such an adapter is implemented/reviewed. Do not claim two-player
or proximity communication until the independent real-three-client C1
tests pass with a server. Server field schemas and wire IDs are **pending
Core decision** in #395. NPC messages remain a future, separate contract.

## Test and rollback

Four dedicated Node tests imported by the existing browser runtime suite;
browser checks should cover disabled default, injected mock keyboard
focus, no movement while composing, clear-on-blur, safe HTML-looking
input, pending/ACK/failure, unread count, 390px and accessibility.
Mocks must remain only in test harness, never a query-string feature.
Full existing `quality` including genuine Chrome/Firefox combat
required at exact head. Rollback drops this PR; it does not mutate
server/DB, persistent transcripts or assets. **DRAFT, unmerged,
undeployed** until central review. The separate Core integration
PR must be independently tested and accepted.

## C1A input and reconnect hardening

- A pending send keeps the composer focused but read-only (no double submissions), so the native Escape key remains usable while waiting for a Core ACK.
- Adapter replacement, disconnect (`bindAdapter(null)`) or component disposal cancels a pending client wait. A late ACK cannot turn that old delivery into a successful result; the outgoing row is marked **Not confirmed**, not delivered or definitively rejected.
- Old adapter callbacks are generation-scoped, so queued previous-connection messages cannot contaminate the current transcript. Bidi override controls are rejected in client-composed text to reduce identity spoofing; Core must enforce canonical Unicode policy on the server.
- No wire packet, telemetry, persistence or game-loop change. Run browser tests using a purpose-built **test-only** injected adapter, never a production query switch.

## Core-approved v1 composer limit

Core PR #399 and bridge #403 allocate **240 UTF-8 bytes maximum**, independent of the number of Unicode characters. Composer validation now matches this limit and verifies 240-byte accepted / 241-byte rejected cases for ASCII, accented letters and emoji. This is still **defense-in-depth UI validation**, not server authorization. Actual stream wiring and real near/near/far browser acceptance live in a separate stacked integration change; no preview flag or live network enablement is shipped by this foundation PR.
