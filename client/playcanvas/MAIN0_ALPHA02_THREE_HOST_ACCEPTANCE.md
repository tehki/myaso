# MYASO.IO — Main0 Alpha 0.2 three-machine acceptance preparation

**Status: source-only readiness evidence; NOT runtime acceptance; NOT release authorization.**
**Owner decision 2026-11-08:** no fourth physical machine will be supplied.
**Existing passing Alpha 0.2 draft:** PR #1169 at
`0db881edf292e2c7a95bc9e443345a1c0a5e9769` (31/31 same-HEAD CI green).
This document supplements the single Main0 backlog. It neither changes the
original combat controls nor relaxes Rust World, identity, Chat C1 or security.

## Revised, honestly labeled test topology

| Host | Actual browser (observed 2026-11-08) | Four-Chrome test | Three-machine test |
| --- | --- | --- | --- |
| X230i | Google Chrome Stable 155.0.8059.79 | Chrome seats A+B | Chrome seat A |
| Windows Machine | Google Chrome Stable 157.0.8103.38 | Chrome seats C+D | Chrome seat B |
| Serj | Chromium 152.0.7977.82 | Not eligible for Chrome Stable product seats | Chromium seat C (additional network witness) |

**Track A:** four separate genuine Google Chrome Stable browser processes/
authenticated Rust actors concurrently, distributed **two per Chrome machine**.
This is NOT four independent physical hosts and does not prove four human
operators.

**Track B:** three physically different computers, one session per machine,
using Chrome / Chrome / Chromium; optionally add one more Chrome session on a
Chrome machine to cover four-player concurrency. Chromium is explicitly
supplemental Blink/network evidence, not a Google Chrome Stable product PASS.

The old four-physical-Chrome-host requirement is replaced by these two tracks.
Keep their evidence distinct; never combine runs, sources, browsers or actors
to fabricate the missing fourth physical machine.

## 2026-11-10 portable-driver and two-seat browser-only first acceptance — PASS

The owner-approved **two available Chrome machines** are now capable of
launching two local Chrome Stable browser sessions each with Google-sourced
portable ChromeDriver binaries. These were placed in user-local non-system
QA caches. Chrome installations and system-wide driver/PATH were not changed.

- X230i actual Google Chrome Stable `155.0.8059.79` with portable
  ChromeDriver `155.0.8059.84` in
  `$HOME/.cache/myaso/qa-drivers/155.0.8059.84/chromedriver-linux64/chromedriver`.
  Executable SHA-256:
  `404dd1be5119d3c00b01251d0532fc3d8df1762b6e6835e2bf387b613577494e`.
  Official archive SHA-256:
  `4fe2433044363e5233d642e70fa50278b471bda08032d922402c8bd7c6d743fd`.
- Windows Machine actual Chrome Stable `157.0.8103.39` with portable
  ChromeDriver `157.0.8103.50` under
  `$env:LOCALAPPDATA\myaso\qa-drivers\157.0.8103.50\chromedriver-win64\chromedriver.exe`.
  Executable SHA-256:
  `92f358cb5460b447044fcc2dfd6c7d87ff56f91b00c57ed303b18d0cd8d4b1b3`.
  Official archive SHA-256:
  `408d7da374064d0b01f1918d898b983029294f49be8bb0c23729920390e61376`.
- Google source of both archives:
  [Chrome for Testing latest patch per build](https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json).
  Installed browser-to-driver `MAJOR.MINOR.BUILD` matched on each host.
- Serj remains Chromium `152.0.7977.82` with ChromeDriver `152.0.7977.82`;
  it is the third-machine network witness, **not** a Chrome Stable product seat.

**Real nonrelease browser-only execution** via
`scripts/main0-local-chrome-two-seat-smoke.mjs`:

| Physical host | Chrome versions returned by W3C capabilities | Unique temporary profiles | Real trusted W3C keydown each | Result |
| --- | --- | --- | --- | --- |
| X230i | 155.0.8059.79; 155.0.8059.79 | 2 | YES, both | PASS |
| Windows Machine | 157.0.8103.39; 157.0.8103.39 | 2 | YES, both | PASS |

All four browser sessions launched on actual owner machines, but **the
two-machine runs were performed separately**, not as four simultaneous players
against one Rust World. The only page was an isolated `data:text/html`
browser smoke; ChromeDriver bound to loopback. Each browser used its own
temporary profile which was cleaned up. The runner does not alter production,
use Chrome user profiles, connect WebTransport, spawn a game server, claim
four humans or declare real multiplayer acceptance.

Reproduce locally after reviewing the source:

```sh
CHROME_BIN=/usr/bin/google-chrome-stable \
MYASO_CHROMEDRIVER_BIN="$HOME/.cache/myaso/qa-drivers/155.0.8059.84/chromedriver-linux64/chromedriver" \
node scripts/main0-local-chrome-two-seat-smoke.mjs x230i 155

MYASO_CHROMEDRIVER_BIN="$HOME/.cache/myaso/qa-drivers/155.0.8059.84/chromedriver-linux64/chromedriver" \
node scripts/main0-threehost-readiness.mjs --self x230i

node scripts/main0-threehost-readiness.mjs --matrix client/playcanvas/alpha02-threehost-observed-20261110.json
node --test tests/main0-local-chrome-two-seat-smoke.test.mjs
```

The Windows run uses `CHROME_BIN` pointing to the existing Google Chrome
`chrome.exe`, `MYASO_CHROMEDRIVER_BIN` pointing to the portable driver and
`node scripts/main0-local-chrome-two-seat-smoke.mjs machine 157` from a
reviewed copy of this script. No global PATH edits.

**Driver compatibility: PASS. Two local Chrome seats on each Chrome host:
PASS. Combined four-physical-host and four-player authoritative Rust World:
NOT RUN. Cross-machine private UDP/QUIC forwarding/TLS pinned stage:
NOT AUTHORIZED/NOT RUN. RELEASE HOLD.**

## Historical 2026-11-08 read-only preflight: first-RED and blockers (superseded where noted)

1. X230i Chrome 155, executable ChromeDriver 152: mismatched major versions.
2. Windows Machine Chrome 157; only ChromeDriver 156 found in a Selenium
   cache, **not available on PATH**: mismatched and not executable by the
   existing native harness without a separately reviewed explicit driver path.
3. Serj Chromium 152 / ChromeDriver 152: matching, but not Google Chrome Stable.
4. The existing PlayCanvas native acceptance runner binds its Rust/WebTransport
   and browser development endpoints to **127.0.0.1**. Its secure URL validator
   rejects remote hostnames by design. Real three-machine testing therefore
   needs an isolated, operator-approved **UDP/QUIC-aware loopback tunnel** on
   each machine (not ordinary SSH TCP forwarding), separate test certificate
   pin and authorization. No transport exposure, TLS override or production
   endpoint is authorized under this source-only task.

**Do not** install Chrome, drivers, VPN software or a tunnel, expose public
ports, edit production Caddy/systemd, rewrite the loopback-only security
validator, use a live production game address, or start a nonproduction server
based on this preparation alone. Obtain separate owner approval for any such
operational change. Version-matched driver prerequisites may be resolved
later without relaxing the existing WebDriver native tests.

## Read-only self-check (Linux and Windows, no sockets)

From this source checkout:

```sh
node scripts/main0-threehost-readiness.mjs --self x230i
node scripts/main0-threehost-readiness.mjs --matrix client/playcanvas/alpha02-threehost-observed.json
node --test tests/main0-threehost-readiness.test.mjs
```

On Windows after obtaining the **same reviewed source** (no install required
by this document), run with `--self machine`; the tool reads Chrome's
ProductVersion rather than launching the browser. On Serj, if the reviewed
source becomes available, run `--self serj`. The matrix is a dated record,
not a live connection or a hardware-independent identity proof. Refresh real
read-only observations before actual acceptance. No program in this checklist
modifies system state or opens a network listener.

The matrix command must say `topologyReady: false` while driver versions
are mismatched. Even `topologyReady: true` only means local prerequisites
are consistent, **never** that WebTransport, Rust HIT, respawns, Chat C1,
physical input, security or release were accepted. These remain `NOT_RUN`
and the release decision remains `HOLD`.

## Required independent QA evidence (after separate staging authorization)

- One isolated source-pinned Rust server and client bundle; original source
  SHA, artifact SHA-256, TLS certificate SHA-256, reviewed private QUIC
  forwarding route and non-production endpoint on **each** host.
- Real Chrome/Chromium versions, host alias, UTC times, four distinct concurrent
  client sessions and server-owned player/actor IDs. Explicitly distinguish
  native W3C automation from independent human-operated input.
- Server-authoritative Greyhaven spawn, movement, grounding, static collision
  and reconciliation across four actors. No client-authored position/HP.
- Original RMB kick and hold-run, wheel-forward roll, wheel-back parry,
  Space jump, Space+LMB jump attack, Light34/Heavy46, heavy readiness, guard,
  stun, knockdown/recovery, real Rust attack HIT/HP/guard/stamina and no extra
  victims or duplicate damage. Preserve all previous native fatal assertions.
- Chat C1 owner/peer ACK, Enter/Escape focus, keyboard movement/combat
  isolation, transcript identity and continuity across death/respawn.
- **Three actual same-root death/respawn cycles**, actor incarnation/lease
  fencing, reliable snapshot rebaseline and a separately tested reconnect.
  Reject stale authenticated source0/source1 input and cross-session ACKs.
- A signed independent QA report with PASS/FAIL for each track, raw artifact
  links and exact tested SHA. If any gate is missing or fails, record its
  first-RED without retries disguised as acceptance.

No actual three-host gameplay acceptance has been performed here. Existing
loopback four-browser CI cannot be reclassified as cross-host testing.
**Source-only, PR draft, no merge/deployment/public activation. RELEASE HOLD.**
