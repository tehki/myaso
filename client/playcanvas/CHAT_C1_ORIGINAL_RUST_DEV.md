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

## Genuine local Chromium-engine acceptance — 2026-11-04

Main0 added an **independent browser-to-Rust-to-browser Chat C1 acceptance**
runner: `scripts/main0-chrome-chat-c1-native.mjs`. It uses two real,
independent ChromeDriver-controlled Chromium browser sessions on X230i.
The local evidence at original source `67bb7eef` was:
`MAIN0_PLAYCANVAS_TWO_CHROME_ORIGINAL_CHAT_PASS` with
`Chromium 152.0.7977.82 Arch Linux`, server-owned IDs **1** and **2**,
actual original QUIC reliable Chat C1 send/ACK/receive, server-rendered
`Player #1` identity on the recipient, and no physical input tick advance
when typing. **This proves the local Chromium engine, not separate branded
Google Chrome Stable qualification.**

Run after the *local* original Rust server has been built, from
`client/playcanvas`:

```sh
MYASO_PLAYCANVAS_RUST_BIN=/absolute/path/to/server/target/debug/myaso-server \
CHROME_BIN=/usr/bin/chromium \
npm run smoke:chrome-chat-c1
```

The script itself launches only ephemeral `127.0.0.1` servers and pinned
original Rust certificates, prints its current exact HEAD SHA, and fails
closed with `MAIN0_PLAYCANVAS_TWO_CHROME_CHAT_FIRST_RED` on missing
identities, missing original ACK, forged sender/delivery, missing rendering,
or Chat focus input leakage. Successful runs save source/version evidence
under ignored `client/playcanvas/.artifacts/main0-chrome-chat-c1/`.
A real browser PNG is an **optional additional strict** check using
`MYASO_CHROME_CHAT_SCREENSHOT=1`; software-renderer screenshot capture is not
a gameplay-authority proof. Do not upload the private development certificate
as an artifact.

**Extended-run first-RED (same day):** the stricter reproducible runner,
with independent physical actor admission and Escape cancellation, reached
Rust actor #1 but its second genuine Chromium WebTransport connection stayed
at `connecting` beyond the strict deadline. During this run, X230i's load
average exceeded 20. The cause is **not proven** (resource pressure versus
session startup); this is a release/acceptance blocker, not a pass. The
previous independently observed two-browser original Chat C1 ACK/receive PASS
on `67bb7eef` remains recorded, and the new runner will store first-RED
context in its ignored `.artifacts/main0-chrome-chat-c1/first-red.json`.
Do not relax browser/identity assertions to declare success.

**Exact-head Chromium engine confirmation on X230i:** after host load
fell to 0.33, the unchanged strict `npm run smoke:chrome-chat-c1` completed
**PASS** on source commit `31ade88f9715f2b8f847af63fc1b9890538db980`,
with Chromium 152/ChromeDriver, two original Rust server-issued NetIDs
**1 and 2**, authoritative WebTransport snapshots, original reliable Chat
C1 result ACK and receipt bearing `Player #1`, a cancelled draft after
real Escape, and no movement packet while Chat owned focus. Local proof
`MAIN0_PLAYCANVAS_TWO_CHROME_ORIGINAL_CHAT_PASS`. The first-RED under
overload remains material; reduced load is correlated, not proven causal.

**Additional physical Combat acceptance (same original Rust source on X230i):**
with `MYASO_CHROME_COMBAT_P0=1` on the above command, two Chromium sessions
received original player identities; source0's original Rust typed Combat
lease was **granted**; a genuine W3C D keypress moved the authoritative
player from x=4110 to x=4168; and a genuine W3C LMB produced the original
Rust actor action phases 1/2/3 and a defender snapshot with **66 HP**.
The new regression gate explicitly requires **100→66 HP** on the unchanged
original defender actor; a server-granted input lease or local attack
animation alone is insufficient. This is **Light34 World damage**, not a
private M147 HIT receipt. Re-run this stricter assertion at the new commit
before declaring its exact-head PASS.

```sh
MYASO_CHROME_COMBAT_P0=1 \
MYASO_PLAYCANVAS_RUST_BIN=/absolute/path/to/server/target/debug/myaso-server \
CHROME_BIN=/usr/bin/chromium \
npm run smoke:chrome-chat-c1
```

This remains loopback-only, source-only, Chromium-engine evidence. Do not
equate Chromium with independently qualified Google Chrome Stable, or
light-strike damage with Heavy46, JumpAttack42, private HIT receipts,
four-player performance, or production acceptance.

The existing `smoke:greyhaven:three-respawns` ran locally on `67bb7eef`
with **three actual original Rust World death/respawn cycles**, verified
by two original authoritative input clients and the PlayCanvas passive
spectator, with no client HP mutation or fake respawn. This does not
demonstrate full PlayCanvas physical typed LMB gameplay by itself.

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
