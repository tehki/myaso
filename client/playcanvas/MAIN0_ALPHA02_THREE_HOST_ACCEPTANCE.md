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

## Current read-only preflight: blockers, not new gameplay regressions

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
