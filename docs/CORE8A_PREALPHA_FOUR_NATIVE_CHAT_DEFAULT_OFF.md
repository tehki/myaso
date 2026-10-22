# Core 8A Pre-Alpha 0.1 — four native browsers, Chat C1 disabled

**Test-only draft, 2026-10-22.** Direct child of exact previously FULL
protected-green [#713](https://github.com/tehki/myaso/pull/713).
Pre-Alpha original Combat arena only. NOT First Playable Greyhaven or
canonical armory Items/IDR source.

## Coverage gap

The exact real Rust two-QUIC-client gate #713 proves a forged optional
chat stream is not serviced without operator server activation, and both
players keep receiving correctly addressed INPUT_ACK. Positive Chat C1
browser tests prove three/four real Chrome/Firefox clients communicate
with a deliberately enabled ephemeral server. Neither alone requires
the **four real browser UI sessions** to retain playable multiplayer
without the chat operator setting.

## Actual no-chat four-native proof

The new dedicated native staging script builds/launches the unchanged
real Rust WebTransport server with
`MYASO_CHAT_C1_ENABLED` **explicitly absent in the server child
environment**. It uses original disposable loopback ephemeral TLS,
real Chrome/Firefox/Chrome/Chrome WebDriver sessions, the original
Combat arena Canvas and the authentic gameplay binary input protocol.
The untrusted client URL includes `chatC1=1` but no
`chatC1Preview=1` and is served on local HTTP, so it cannot trigger
the explicitly operator-origin-scoped release UI. All four real
browsers must independently see their own server-assigned fighter,
the same four-person scoreboard, authenticated Rust game ticks, and
genuine gameplay input-ACK diagnostics while native W3C keyboard
movement occurs. The chat composer must be absent on all four,
and each actual session must retain advancing server ticks/ACKs.

The real negative chat *wire* refusal is separately and mandatorily
proved by the parent #713 test. This native four-browser test is
additional UI/runtime fallback evidence, not a substitute for
attempted raw WebTransport chat stream refusal.

## Strict boundaries

Client query `chatC1=1` on localhost alone is NOT a claim about a
deployed official lobby. No live/public server configuration changes,
no operator `game-config.json` mutation, no extra listener, no
production chat enable, no mock browser client or invented server ACK.
Four authentic browsers and Rust run on ONE isolated GitHub CI host,
not independent physical computers or four human testers.

Pass does not establish all mouse/light/charge gestures, hit/guard/HP,
cross-host networking, immutable staged rollback, public deployment,
true four Silver rendering in one frame, authoritative physics body
clearance or First Playable armory/pickups. Those are independent Main,
Combat, Physics, UI and Core8C release gates. Keep original full
`quality`, positive Chat C1 native UI and real Rust security tests
mandatory; the Main Orchestrator alone authorizes merging and rollout.
