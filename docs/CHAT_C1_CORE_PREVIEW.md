# Chat C1B — real Core transport preview (loopback only)

This PR is **stacked on Department 8A #403**, which is itself stacked
on Core #399. It carries the UI foundation from Department 10 #396
in its own delta to #403, then wires the approved bridge to the
already-connected authoritative game client's `networkClient.transport`.

## Trust and lifecycle

- The browser game client retains the existing authenticated WebTransport
  session. `openLocalChatUiBridge` attaches optional separate reliable
  chat streams; no second connection, no combat datagram changes.
- **Live UI activation is OFF by default.** It is available only from
  `http://localhost`, `http://127.0.0.1` or `http://[::1]`
  with explicit `?chatC1Preview=1` on a local staging page plus
  a successfully connected Core WebTransport server. Remote/deployed
  sites cannot enable it using a URL flag.
- The client uses the Core-generated server ID label `Player #N`, not
  a durable character name. UI input cap equals Core v1: 240 UTF-8 bytes.
- Server-only ACKs may say **Accepted**, never "Delivered". On disconnect
  the adapter unsubscribes and pending UI messages are not confirmed.
- Core cannot establish chat streams on old servers: fallback remains
  visibly unavailable, while gameplay continues unchanged.
- No NPC, guild, global, persistent transcripts, fake server events,
  client-selected recipients/coordinates, production feature toggle,
  or gameplay data mutation.

## Required before merge / release

- Run exact-head focused Node, Core real three-QUIC loopback and browser
  tests with actual ChatResult/ChatReceived over pinned WebTransport.
- Validate genuine Chrome+Firefox near A-B and far C exclusion with
  server-derived positions and sender IDs, UTF-8 240/241, rate/reject,
  disconnect/reconnect, and combat input ACK under chat load.
- Protected quality with unchanged M41/M194 and original Combat acceptance
  must pass. Development Center #360 merges only in dependency order.
- Preserve #396 as an independently reviewed UI foundation or let the
  Center select this combined PR as the canonical integration. **Never
  merge both overlapping UI diffs without reconciling them.**

Core #399 → 8A #403 → this C1B preview PR.
No production activation from this branch.

The localhost preview requires **both** the ordinary online `server` query parameter and `chatC1Preview=1`; local practice never enables a Core adapter. The user-visible live chat remains off by default on every deployed/remote origin.

## Reproducible genuine browser ↔ real server acceptance

Department 10 added `scripts/chat_c1_three_browser_acceptance.mjs` (manual, opt-in). From the repository root on a Linux host with Node, Chromium/ChromeDriver, Python and Rust 1.89:

```bash
cargo build --locked --manifest-path server/Cargo.toml
node scripts/chat_c1_three_browser_acceptance.mjs
```

The script launches an **isolated loopback Rust server**, parses its actual short-lived certificate SHA-256 hash and connects **three independent genuine Chromium WebTransport browser sessions with a pinned certificate**, each with a separate server-issued ephemeral player ID. It asserts A's message receives a **real server ChatResult Accepted**, B receives it labeled `Player #1`, distant C receives nothing from A, then B's reply receives a real server ACK and is displayed by A as `Player #2`. It closes all sessions and child processes in a `finally` block. It never injects a fake adapter and is **not a proof of Firefox/WAN/multizone**, sustained load, read receipts or combat-under-chat. Do not turn the manual script into a production flag or bypass protected quality. No permanent player transcript or TLS key is emitted.

**Observed acceptance, exact pre-script head `d9a1cfe07abc5cb30185ba0fcf4e032f2c8221dd` (2026-10-21):** live loopback Rust build with pinned TLS and three genuine headless Chromium sessions passed both directional near-player deliveries, genuine ACKs, transient identity and far-recipient exclusion. This evidence is separate from the protected CI failure M161, which still blocks release.

## Browser matrix and gameplay ACK continuity

The opt-in acceptance runner defaults to `chrome,chrome,chrome`. Where native
Firefox and GeckoDriver are installed, run `C1_BROWSER_MATRIX=chrome,firefox,chrome
node scripts/chat_c1_three_browser_acceptance.mjs` to test mixed engines against
the **same genuine local Rust server** and pinned ephemeral certificate.
`C1_FIREFOX_BINARY` and `C1_GECKODRIVER` may identify locally installed
executables. The runner does not download a browser or authorize a public
server. An attempted mixed run counts **only** after it completes successfully.

The runner also enables read-only in-arena `netstats` and checks that genuine
gameplay input ACK samples continue to advance after A/B's chat exchange,
including a native movement-key press. This is a narrow coexistence check,
**not** a substitute for timed combat-under-chat M41/M194 acceptance,
measured p95/p99 production loads or network-isolated hosts.

## Native Firefox protocol dependency

The mixed Chrome/Firefox/Chrome real-server acceptance requires the explicit C1 v1 preface under [Core draft #455](https://github.com/tehki/myaso/pull/455), itself stacked on 8A #403. The older stream-opening behavior is not interoperable with Firefox: gameplay works, but chat reply stream negotiation times out. Do **not** turn on public chat unless the client + Core server are deployed atomically, full protected Combat gates pass, and the mixed/browser acceptance is rerun on the integrated main build. This UI change remains disabled outside local preview.


## Native UTF-8 boundary and combat focus acceptance (UI 10 follow-up)

The manual original-source three-browser runner also verifies genuine
240-byte UTF-8 (é×120) acceptance and nearby B delivery with far C
excluded, followed by a deliberately over-limit 242-byte (é×121)
browser composer (set programmatically only to bypass native maxLength)
that must create no pending/sent row and no B delivery. Native Escape clears
that rejected draft and returns focus to the arena before the existing
native movement and server gameplay-ACK continuity check. This is an
acceptance-script-only extension; normal users still cannot type 241
characters past the HTML input limit. It remains a loopback-only, real
Rust WebTransport test and does not prove combat-under-chat or public
activation. No mocks, no production protocol or game client change.

The separate, additive opt-in PR CI workflow at
.github/workflows/chat-c1-ui-browser.yml runs this acceptance on GitHub
ubuntu-latest with the actual Rust binary, ChromeDriver and three native
Chrome sessions. It is *not* a production chat feature toggle, does not
replace Combat quality, and does not prove Firefox/independent-host.

The browser workflow additionally requires a genuine Chrome / Firefox /
Chrome run using the same script and a fresh real Rust local server; each
mode must satisfy identical near/far, UTF-8, Escape and gameplay-ACK gates.

Native browser ACK diagnostics expose a bounded 96-item RTT history, not a
monotonic lifetime ACK count. When the history reaches 96 samples during a
slow Firefox startup, the acceptance runner now requires newer authoritative
server ticks after real native W movement with nonempty ACK telemetry.
Without that fallback it incorrectly requires 98 samples from 96 slots.
This fallback demonstrates authoritative gameplay progress, not proof of
a particular individual input ACK; full Combat/Core gates remain required.

## UI reconnect message identity regression — session-scoped dedup

The Core message ID is server-generated but not globally persistent across
ephemeral server restarts. The UI maintains bounded 60-row history while
binding a distinct Core adapter generation on each authenticated reconnect.
Deduplication keys now include that adapter session generation, so a new
server reusing message ID 1 never silently suppresses the first legitimate
message from the new session. Previously received rows remain visible and
pending pre-reconnect sends retain their existing "Not confirmed" state;
old subscription callbacks and late ACKs remain invalidated before a new
adapter is trusted. Evicting a prior-session row only deletes its original
generation's dedup key, never the current session's matching server ID.
This is presentation-only: the UI neither mints a server message ID nor
changes authoritative sender identity, transport, ACL, payload, or storage.
