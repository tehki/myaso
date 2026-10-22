# Moon Games — Pre-Alpha 0.1 Chat C1 conditional inclusion

Authority: Main Development & Deployment Orchestrator. **DRAFT / no main merge /
no production cutover.** Chat C1 must never gate first playable arena combat.

## Exact original-arena source selection

Do NOT merge the large Greyhaven/UI source stacks (#580/#592/#607) into the
simple Pre-Alpha. The selected original single-zone arena source is Core #399
→ 8A bridge #403 → UI #412, with original four native browser C1 acceptance
from #562. They are all unmerged department drafts; reuse selectively.

The source implements real Rust authoritative local text chat, not a mock:
- same **authenticated** WebTransport game session, chat traffic on separate
  bounded reliable uni streams, isolated from Combat input datagrams;
- 160-unit original-arena server-owned radius (operator-variable 32–512),
  authoritative sender ephemeral ID and fighter positions, per-player 8-result
  queue, token bucket, 64-frame/s ingress prefilter, duplicate dedup, frame
  timeouts and disconnect unregister;
- limit of 240 **UTF-8 bytes**, reject invalid UTF-8/control/bidi/malformed
  frame/oversize/replayed message or spoofing attempt;
- Enter to open/composer submit, Escape restores canvas/game input,
  canvas blur releases any held Combat chord, safe textContent and bounded
  history. ACK means server accepted/routed the message, not read/delivered;
- don't add global, private, voice, permanent transcripts, untrusted sender
  names, NPC, world renderer, item ownership or external network service.

## Two-sided activation gates — default OFF

The real Rust server will accept the optional Chat C1 stream **ONLY** with
`MYASO_CHAT_C1_ENABLED=1`. When absent or 0, the server will not listen
to optional chat streams. Invalid values make server startup fail closed.

The existing official HTTPS multiplayer lobby parses the **operator-served**
same-origin `/game-config.json`, validates the existing TLS-pinned WebTransport
server URL and permits optional `chatC1Enabled: true` boolean. Only a
**true** flag causes its generated `/web/?...&knights=1&chatC1=1` URL. The
normal production default is no chat parameter and no chat UI. The browser
C1 release route requires HTTPS `game.open-trust-layer.org`, pinned cert,
server and this independently enabled URL flag. Even if someone manually
adds the query, the server's authoritative gate prevails.

Development original-arena `?chatC1Preview=1` is allowed **only on loopback
HTTP localhost / 127.0.0.1 / [::1]**. Never enable its preview gate on
public HTTPS origins. Separate exact real Chrome/Firefox browser acceptance
uses opt-in ephemeral loopback server with `MYASO_CHAT_C1_ENABLED=1`.

Existing `ops/alpha/write-staged-config.sh` does NOT activate chat in
production; the explicit server environment AND the operator-controlled
public JSON rollout are **two separate required approvals**. Nothing here
changes public ingress, TLS, DNS, service config or running processes.

## Release acceptance still required

1. Full package remains existing arena, exactly five original Silver Knight
   sprites, all 24 merged R4 original Foley OGG, all four MP3, full lobby/HUD.
2. Actual four independent WebTransport Chrome/Firefox browser sessions
   against *the same* Rust original arena; A→near B, out-of-range C excluded,
   valid server ACK and genuine server-issued sender label, HTML inert,
   240-byte valid / 242-byte invalid and detached/stale-session rejects.
3. Enter/Escape/keydown focus cannot strand Combat movement, hit timing,
   pointerDOWN light/held READY release heavy or prevent authoritative damage.
4. Rust full locked tests, strict fmt/Clippy, complete Node suite, full
   protected CI on exact combined HEAD. The original browser C1 workflow
   may execute independently but is never a waiver for protected Combat.
5. If regression or hard dependency remains, keep Chat C1 **OFF**, exclude
   chat from release if necessary, and do not delay Combat Pre-Alpha.
6. Release candidate package hash, staged independent-host smoke, rollback,
   post-merge protected quality and explicit owner/Main production GO remain
   mandatory. **No deployment has been authorized.**

Combat P0 instant pointerDOWN light/hold heavy input provenance remains
blocked separately by #696; Chat C1 does not attempt to solve or bypass it.
