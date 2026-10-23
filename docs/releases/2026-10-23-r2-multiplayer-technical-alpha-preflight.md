# myaso.io — 23 October 2026 release preparation: R2 Multiplayer Technical Alpha

**Status: PREPARED — CONDITIONAL HUMAN GO REQUIRED.** This is a documentation-only handoff; it does **not** authorize a code merge, publish, production restart, protocol switch or release announcement.

**Release scope:** existing already-deployed **R2 / legacy v1 Technical Multiplayer Alpha as-is**, for a *small, explicitly invited technical test*. **Not** Combat Pre-Alpha 0.1, Knights V3, full updated Combat, real-value economy, 512-player scaling or a new gameplay build.

**Public existing lobby:** https://game.open-trust-layer.org/web/alpha.html

**Git baseline for this runbook:** `main` = `6fa59b649112c272bcbc018b4a32bf963f9a5bba`. This document is based on that baseline and does not promote any draft release branch. The [historical R2 deployment report #328](https://github.com/tehki/myaso/issues/328) records original installed immutable package revision `6b5e8986e7b4fcb3cf4848b2befd09eed712695b` and a successful rollback to prior R1 after a missing staged `game-config.json`. **Active VPS symlink/binary hash/revision were NOT independently rechecked today.**

## 1. Verified public live observations — Oct 23, 2026

Read-only public checks from **two distinct physical Linux hosts** (Serj and X230i) at approximately **12:53 UTC**:

| Check | Serj | X230i | Conclusion |
| --- | --- | --- | --- |
| HTTPS `/web/alpha.html` | HTTP 200 | HTTP 200 | Public lobby reachable |
| HTTPS `/game-config.json` | HTTP 200 | HTTP 200 | Current public configuration served |
| Original public config | `serverUrl=https://game.open-trust-layer.org:4433/game`, `maxPlayers=8` | Same | Advertised eight-seat cap; **not** evidence eight users can play |
| `/game-config.json` cache policy | `no-store, max-age=0` | — | Current dynamically served config, not cached copy |
| Public HTTPS certificate | valid `2026-10-16T22:26:35Z` to `2027-01-14T22:26:34Z` | same | **HTTPS :443** certificate valid; the distinct pinned WebTransport QUIC cert must be checked via real join |
| Current VPS service, symlink, package SHA256, rollback | **not inspected** | **not inspected** | **GO gate not satisfied** |

Actual public **original browser** tests, using temporary separate headless Chromium/ChromeDriver instances, not synthetic DOM clicks or fake World snapshots:

1. Serj independently loaded the original lobby, clicked the genuine DOM `JOIN MULTIPLAYER` button and entered `/web/`; game HUD reported **`Online - player #7 - server tick 16256610`**, canvas present and local HP100. Test Chrome was closed.
2. Separate *concurrent* headless clients on Serj and X230i loaded the real public game. Serj DOM reported **`Online - player #8`, `NEAREST #9`, HP100**; X230i DOM reported **`Online - player #9`, `NEAREST #8`, HP100**. This is valuable live mutual-peer visibility from two physical hosts. The first test **reported a harness failure** because the test script double-escaped its own expected status regular expression, despite the genuine original UI evidence. It is **not** certified as a clean strict pass.
3. Corrected test's separate repeated attempt: Serj connected as **`Online - player #10`**, but did not retain a visible peer after 12s (`NO RIVAL`, remote HP0); X230i's own original UI displayed **`Multiplayer connection failed. Return to the lobby and retry.`**. This is a **current intermittent admission/join reliability warning**, not a successful two-client retest.
4. All ephemeral test browser sessions were closed. No player attack, health mutation, deployment, production restart or server administration was intentionally performed. These headless checks were **not independently operated humans**, and did **not** establish mutual authoritative 34HP combat, real death/respawn, reconnect ghost cleanup or network uptime.

**Current classification:** HTTPS/lobby and at least one actual QUIC-backed original World join **VERIFIED**; simultaneous mutual peer UI visibility **OBSERVED ONCE**, but fresh stable 2-human same-arena gameplay and server-side environment provenance **HOLD**. Never label the release fully accepted solely from HTTP, a GitHub CI run, or two automated browsers.

## 2. Same-day ship/no-ship contents

| Candidate | Verified engineering evidence | Today |
| --- | --- | --- |
| Existing **R2 legacy multiplayer** (unchanged installed public alpha) | Public lobby/config HTTP200 both physical hosts; one clean live JOIN/HP100, one mutually visible concurrent pair; **repeat failed** | **ONLY CANDIDATE** for a restricted human technical-alpha invitation, after GO below |
| Original Server + four browser Silver/Chat review [#828](https://github.com/tehki/myaso/pull/828) / [#833](https://github.com/tehki/myaso/pull/833) | Exact-head original focused/quality green, but **draft stacked UI branches, not installed R2** | **HOLD** — no opportunistic merge or release implication |
| Knights V3 relit/jump-grounding [#881](https://github.com/tehki/myaso/pull/881) | Original full protected and genuine 4-browser Graphics CI green; explicitly opt-in `?knights=1&knightArt=relit` only; human visual/integration approval still pending | **HOLD** — not in public unchanged R2 |
| Updated Combat true typed 135/320ms release-only protocol [#887](https://github.com/tehki/myaso/pull/887) / UI10 original DOM→Rust World [#898](https://github.com/tehki/myaso/pull/898) | Genuine focused Chrome/Firefox and experimental Rust World QUIC proof, but original live `web/online-game.mjs` has **not** atomically switched to one negotiated v2 outbox | **HOLD** — default OFF, no release |
| Combat4B deterministic server tests [#864](https://github.com/tehki/myaso/pull/864) | Full original protected quality success exact head, **test-only** | **REVIEW-READY**, not a gameplay feature or independent rollout |
| Any real wallet/bank, Greyhaven, terrain expansion, balance changes, server-zone migration | No end-to-end shipping evidence here | **OUT OF THIS RELEASE** |

The owner's earlier **Knights + updated Combat + multiplayer** goal remains the targeted integrated Pre-Alpha, but it is **not equivalent** to releasing the previously deployed R2 alpha today. **Do not advertise Knights or Pre-Alpha v2 features as live.**

## 3. Required same-day operator GO — exact order

**A. Live server operator, read-only first.** On the authorized **VPS**, not the Serj/X230i user machines: independently record `date -u`, `systemctl is-active myaso-alpha.service`, `systemctl show myaso-alpha.service -p MainPID -p ActiveState -p NRestarts -p ExecStart`, current release symlink/REVISION, immutable active binary SHA256 versus documented R2 package manifest, and still-usable previous R1 rollback target. Verify the running **UDP 4433 WebTransport** path, active QUIC certificate's public SHA-256 pin against current `game-config.json.certificateSha256`, and `/web/alpha.html` / `/game-config.json` both HTTP200 with config `no-store`. Check current error/admission/restart logs. **Do not rotate certificates, restart services, publish code or expose private key/secret/token in public evidence.** Public HTTPS :443 certificate equality is **not** a substitute for QUIC certificate-pin verification.

**B. Actual human acceptance.** Two **independently operated physical Chrome/Firefox machines**, preferably independent uplinks, manually enter the same public lobby and click **JOIN MULTIPLAYER**. Each records UTC, distinct authoritative `Online - player #N`, visible reciprocal rival in the *same arena*, responsive native WASD and real original HP. Perform a consensual light attack and require **both** views and authoritative server telemetry show the same victim's real **100→66 HP** damage (34HP) with increasing server ticks. Confirm one actual death/respawn, voluntary leave/rejoin and no stranded ghost blocking capacity. Repeat a fresh join after a clean leave; reproduce prior X230i intermittent failure if it persists. Record screenshots/logs without IP addresses, user secrets or operator private identifiers. **No automated two-process simulation counts as independent-human proof.**

**C. Release owner decision.** Only after A and B PASS, record named authorized Main Deployment Orchestrator release writer and explicit owner **GO for an already-live, unchanged R2 link-sharing technical-alpha cut**. No binary roll-forward is needed when existing installed R2 is healthy. If A/B fails, mark **NO-GO**, preserve current installed service (avoid causing an outage), investigate on inactive isolated stage, retain rollback, and redo checks. Any new package rollout requires separate exact SHA, mandatory protected CI, immutable deploy and rollback approval—not this packet.

## 4. Technical-alpha invite copy — USE ONLY AFTER GO

> **myaso.io — Multiplayer Technical Alpha (R2).** A small live test of the existing shared arena is open at https://game.open-trust-layer.org/web/alpha.html. Use a current desktop Chrome/Firefox with WebTransport support, click **JOIN MULTIPLAYER**, and report the timestamp, displayed player number, rough movement/attack responsiveness, and any connection failure. This is early technical-alpha gameplay: expect latency, input edge cases and possible disconnect/rejoin issues. **Knights V3 and the new 135/320ms Combat v2 are not included yet.** Please do not share broadly until operator GO is announced.

## 5. Protected release fence and abort/rollback

- Main / Deployment Orchestrator holds the **exclusive production writer**. No draft #855/#862/#887/#898, Silver or Combat PR is automatically merge-eligible simply because its own focused CI is green.
- Maintain existing R2 service and public URL without changing the DNS or Caddy/PostgreSQL. Historical rollback workflow in [#328](https://github.com/tehki/myaso/issues/328) is relevant **only if a real new deployment has been explicitly authorized**; do not repeat a manual symlink-only switch that omits stage `game-config.json`.
- Stop invitations and classify **NO-GO** if fresh joins fail, peers cannot see each other, authentic 34HP damage/respawn does not reconcile, cert pin is wrong/expiring, active package unknown, or server actor/seat lifecycle is unreliable. Do not mislabel source-only v2 tests as shipped controls.
- Formal Pre-Alpha 0.1 remains on separate HOLD until the owner-authorized Knights + updated Combat 2–4 independently operated human integration is clean under original strict CI; Main protocol decision [#723](https://github.com/tehki/myaso/issues/723#issuecomment-6363299673) selects KeyE **RELEASE-to-strike** (no 320ms auto-hit).

**Authoritative coordination:** [Main #695](https://github.com/tehki/myaso/issues/695), [Development #360](https://github.com/tehki/myaso/issues/360), [Deployment history #328](https://github.com/tehki/myaso/issues/328), [Combat #696](https://github.com/tehki/myaso/issues/696), [Protocol #723](https://github.com/tehki/myaso/issues/723). Evidence must be updated with exact check time, observed actor/World tick and immutable SHA; this is not a standing GO.
