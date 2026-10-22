# Core 8A — Pre-Alpha 0.1 Chat C1 default-OFF native QUIC gate

Source review: Main Orchestrator [Pre-Alpha 0.1 #695](https://github.com/tehki/myaso/issues/695) and conditional **OFF by default** Chat C1 integration [#708](https://github.com/tehki/myaso/pull/708).

**DRAFT, staging-free, test-only.** Do not confuse this original Combat arena
release with Greyhaven/First Playable Alpha #480/#488. Chat C1 is optional
and must not prevent the original 2–4-player combat game from operating
when operator configuration has not activated it.

## New independent negative security proof

The previous genuine Chat C1 acceptance starts the actual Rust server with
`MYASO_CHAT_C1_ENABLED=1` to validate proximity routing and real Chrome
/Firefox Enter/Escape/chat messages. The new negative gate starts **the same
unchanged original Rust binary** with `MYASO_CHAT_C1_ENABLED` **removed from
the child process environment**. It does not rely on a mock ChatHub,
test-only bypass, production URL query parameter or fake server response.

Two distinct **certificate-pinned real WebTransport/QUIC clients** then
connect through the original gameplay bidirectional stream, preserving the
server's genuine distinct player ID assignment. Player 1 opens a real
QUIC unidirectional stream and sends a well-formed versioned ChatHello
and a framed ChatSend; it must NOT receive a ChatResult/reply stream
within a bounded 550-ms acceptance window. We explicitly do not
claim QUIC itself rejects creating outgoing streams when C1 is off:
the server must not **accept and service** the optional chat stream.
Both players subsequently send genuine original binary **INPUT**
datagrams with distinct client ticks. Each receives a correctly
addressed server-owned **INPUT_ACK**, proving disabled optional chat
does not starve movement/input authority.

The negative result concerns the *absence of a chat service*, not an
assertion of dropped/rejected client stream creation. The exact
separate-chat-stream promise is that no server chat fanout, ACK or
message success occurs without operator consent; the game stays live.

All existing **positive** Chat C1 tests still enable it explicitly;
the helper's default remains **enabled for existing positive tests**,
while the negative test explicitly clears `MYASO_CHAT_C1_ENABLED`
on the spawned *test server only*. No source under `server/src`,
no original Chat C1 result codes, TLS, authoritative proximity radius,
gameplay input, browser UX, Combat checks, player data, listener config,
runner firewall or `main` modification.

## Strict acceptance and limits

Dedicated `.github/workflows/core8a-prealpha-chat-default-off.yml`
executes the actual Rust integration test (not a source grep),
`cargo fmt --check`, and all-target strict `clippy -D warnings`.
Inherited Chat C1 workflows and full protected `quality` remain
independent requirements. One successful loopback QUIC negative test
is NOT two separate public client machines, signed human account
identity, combat hit registration, four-player long-session load,
fully enabled Chat C1 operator rollout, actual deployment or GO.

Do not merge, deploy, widen public listeners, change firewall rules,
start a production chat backend or activate optional chat; Main
Orchestrator retains release control. The Full First Playable Alpha
armory/canonical sword/physics blockers stay unchanged.
