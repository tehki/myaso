# MYASO.IO — Main0 unified Alpha 0.2 backlog

**Owner:** Main0 only. All former departmental work is donor source/evidence, not active handoffs.
**Release:** SOURCE-ONLY / DRAFT / HARD HOLD. No protected-main merge, production
deploy, public PlayCanvas activation, security bypass or server mutation.

## Alpha 0.2 browser support decision — 2026-11-04

**Target browser: desktop Google Chrome Stable only.** Chrome is the
product-supported browser for this playable Alpha. Do not spend Alpha 0.2
implementation time on Firefox-specific compatibility, headless Gecko,
GeckoDriver or Firefox renderer fixes. Firefox, Edge, Safari and mobile
browsers are **not qualified for Alpha 0.2**. They may be reconsidered
after Chrome gameplay is genuinely accepted.

**Acceptance:** validate 2, then 4 **real Chrome browser sessions** against
the original isolated Rust QUIC/WebTransport World. Record actual Chrome
version, OS, separate clients/sessions, precise server source SHA, authoritative
input ACK/NetID, HIT/HP/stamina, 3 same-session deaths/respawns, Chat C1,
collision, reload/reconnect and real browser evidence. Chrome WebGL2 is the
minimum; verify WebGPU/fallback only on available Chrome hardware and never
claim unmeasured parity.

**Evidence preservation:** historical Firefox CI jobs, first-RED artifacts and
earlier cross-browser claims remain unchanged and accurately reported; they
are not Chrome product-acceptance criteria. Do not disable, rewrite, weaken
or falsely pass existing automated assertions or security gates. Mixed CI
that still runs Firefox must report genuine failures; Main0 can later
introduce independently measurable Chrome-only product acceptance without
modifying the historical cross-browser tests. Rust/Combat/security regressions
observed in Chrome remain mandatory blockers.

## Current integration candidate

- Branch: `main0/playcanvas-alpha-0.2-genuine-rust-20261104`.
- Retains original Rust World as sole movement/identity/combat/HP/respawn authority.
- Combined donor #1167 (World9 + Physics6 + Core8A passive QUIC + PlayCanvas
  snapshot lifecycle) with #1168 (Combat4 read-only presentation + original
  physical input bridge), retaining donor commits and test evidence.
- First new Main0 fix: clear local Combat vitals when the original Rust actor
  disappears, then populate only from the next authoritative owned snapshot.
- Tests for adapter lifecycle are **mocked contracts**; no actual Chrome
  interactive Combat acceptance is implied by their PASS.
- PlayCanvas Editor project 1634867 / scene 2639984 must be independently
  inspected while its authenticated MCP service is connected before any edits.

## Prioritized backlog — smallest playable increments first

1. **P0 — Exact-head source health:** run Node client, Vite build, Rust locked
   tests, strict Clippy, workflows and independent Combat QA. Preserve failed
   quality evidence, including M158 and historical M140; never skip assertions.
2. **P0 — Genuine isolated World9 QUIC:** reproduce original Rust startup
   `MYASO_WORLD9_GREYHAVEN_ALPHA=1` only on loopback ephemeral nonproduction
   service with pinned local certificate; prove server-owned map/spawns (4110,
   4160), (4206,4160), (4110,4256), (4206,4256), 23 solids, actor membership
   and removal. The snapshot wire has no trustworthy map ID; use server launch
   proof rather than claiming the renderer selects Greyhaven.
3. **P0 — Actual PlayCanvas physical Combat:** **two real Chromium 152**
   PlayCanvas sessions locally proved distinct original QUIC+ACK+NetIDs,
   server-granted typed source0, trusted W3C D movement, and original Rust
   authoritative **Light34** (defender 100→66 HP, phases 1/2/3) and
   **Heavy46** (defender 100→54 HP, phases 9/10/11) as separate isolated
   fights. Heavy begins with a provisional Light windup 1, upgrades to Heavy
   windup 9 on real held LMB, and does **not** land Light active 2. Strict
   native `main0-chrome-chat-c1-native.mjs` modes are
   `MYASO_CHROME_COMBAT_P0=1` (Light) and
   `MYASO_CHROME_HEAVY_P0=1` (Heavy), both requiring defender-owned
   exact HP and no simulated Combat. The non-moving initial identity probe
   now uses real wheel-back Block/Parry and checks authentic World9 spawn
   anchors; the native harness refuses dirty SHA attribution. Historical
   high-load Light/Heavy first-REDs remain recorded. Not an M147 receipt.
   New source-only `MYASO_CHROME_JUMP_P0=1` is a strict physical
   Space+LMB original Rust JumpAttack42 is now **PASS on exact HEAD
   30b741c6efef5c299fdc9173c831b2867433a649** in two real Chromium 152
   sessions: original World actions 15→16→17→18 and defender HP 100→58,
   exactly 42 damage; native W3C Space-first chord, no false Light/Heavy.
   This is Chromium evidence, not branded Google Chrome Stable qualification.
   **M147 private HIT loopback integration also PASS** at this exact HEAD
   (CI 41868420133): four browser sessions (Chrome/Firefox/Chrome/Firefox),
   one genuine physical Light34, original Rust HIT, contiguous sequence-0
   private receipt delivered to attacker and defender, role-specific first-party
   HUD presentation before application ACK, and no spectator receipt/credit.
   The server feature is compiled only for this test and requires explicit
   original-v2 + loopback gates; Cargo default features remain empty. Packet
   types 5/6 remain proposal/private-lab only, not registered as public gameplay
   packets; QUIC actor leases are not account authentication. This is one
   host, not four independent human machines, and does not yet qualify
   multi-hit/replay/reconnect on independent hosts or public activation.
   New exact-head workflow adds **four branded Google Chrome Stable sessions**
   for three same-session deaths/respawns and Chat C1; awaiting CI evidence.
   Remaining P0: Chrome Stable four-player Combat/reconnect, independent-host
   stress, full Block/Kick/Dodge/stamina acceptance, security and stale-lease/
   focus regression. No client-created gameplay.
   Exact-head CI at 30b741c after failed-job reruns: quality passed and 27/28
   workflows passed. The original two M27/renderer timeout reds were cleared
   by retry; the remaining standard-path M35 first-RED is real: original Rust
   World HIT at tick1121 precedes defender Block admission at tick1122, so the
   attack lands for 34 HP. The same M35 result reproduced on retry. Preserve
   this Combat timing blocker; do not change the 125ms parry window or waive it.
   See runs 41868420936 and 41868420274.
4. **P0 — Actor lifecycle and safety:** three true same-session deaths/respawns,
   reconnect/no duplicate actors, server-owned positions and verified
   authoritative building/ground collision. Preserve M140 <=180ms and
   independent M158 combat QA; do not waive historical first-RED.
5. **P0 — Original Chat C1 integration:** source-only PlayCanvas adapter now
   reuses the exact original Chat C1 panel and reliable game QUIC bridge, with
   Enter/Escape, server ACK, UTF-8 and Combat focus suspension. Node contracts
   passed local mocked contract tests **and** a distinct real two-browser
   Chromium 152 + original Rust WebTransport Chat C1 ACK/receipt test at
   `67bb7eef`. An independent local 3x same-session Rust respawn proof passed
   with a passive PlayCanvas spectator. Google Chrome Stable and four-player
   PlayCanvas physical Combat/reconnect still require separate qualification.
   **Historical first-RED:** under X230i load >20, client #2 remained
   `connecting`. With load ~0.33, the **same strict native two-Chromium test**
   passed on exact `31ade88`: real actor IDs 1/2, original Chat C1 ACK,
   recipient `Player #1`, Escape cancellation, no typing→Combat packet.
   First-RED stays preserved; resource sensitivity requires repeat/stress
   evidence. See `CHAT_C1_ORIGINAL_RUST_DEV.md`.
6. **P1 — Reusable human animations:** drive eight-way locomotion and
   Idle/Walk/Sprint/Jump/Roll/action state exclusively from authoritative
   snapshots. Keep Silver Knight optional until human animation is stable.
7. **P1 — Greyhaven polish and browser acceptance:** reverify actual Editor
   Red Lion/Blacksmith geometry, smoke and materials, measured Chrome Stable
   WebGL2 and optional WebGPU fallback, four real players, accessibility/performance.
8. **P2 — Expansions after playable:** NPCs/AI, magic, inventory/equipment,
   sound, economy and persistence under original Rust authority.

## Donor source / evidence preserved

- Main0 #1152/#1151; Core8A #1155/#1165; Core8C #1150/#1159/#1167;
  World9 #1148/#1160; Physics6 #1147/#1156/#1158;
  UI10 #1157; Combat4 #1161/#1168; Graphics #1142/#1143/#1146 and
  #1162/#1163/#1164/#1166; P0 release #1138/#1140.
- Never close or rewrite historical first-RED or donor tests simply because
  newer unified code compiles. Every independent QA claim needs exact SHA,
  run URL, browser/runner, original Rust server proof and reproducible command.

**Milestone accepted only when genuine gameplay passes on the combined exact HEAD.
Source build, mocked contracts and donor CI are evidence, not multiplayer GO.**
