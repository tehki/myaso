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

## Main0 M159 independent first-RED recovery — 2026-11-07

- **Verified exact commit:** `0a32a2f1517e721e346c0c7f0b1ebbb3dfad0402`. Full [quality #42367802686](https://github.com/tehki/myaso/actions/runs/42367802686) SUCCESS, dedicated [M158 job](https://github.com/tehki/myaso/actions/runs/42367802697/job/128389453562) SUCCESS, but [M159 dedicated first-attempt job](https://github.com/tehki/myaso/actions/runs/42367802697/job/128389453845) FAILURE. The batch completed **26/30 workflows SUCCESS**: [M147 third-party](https://github.com/tehki/myaso/actions/runs/42367802807) lacked original Chrome player-ID admission, [M41 standard-path](https://github.com/tehki/myaso/actions/runs/42367802735) lacked a fresh actor-bound World cue, and [four-native original-game QA](https://github.com/tehki/myaso/actions/runs/42367802682) failed recovery-buffer admission. Preserve all first-REDs; a successful full quality run does not supersede independent failures.
- **M159 actual first-RED:** Original Rust read attacker #4 at (144,18) and selected target #2 at (112,144): distance **130**, unchanged maximum reach **94**. Fixed W3C S pulse **45 ms** did not demonstrate an actual World position improvement before the reach assertion, and the test correctly stopped without a fake hit.
- **New source-only staging candidate:** choose bounded (45–240 ms) authentic W3C S pulses from actual server-owned x/y; remeasure after each original snapshot; up to three attempts, keeping >=55 vertical separation from the roll corridor; retain strict **94 reach**, required >=7 margin, original M209 hit/overlap proof, and unchanged 260 ms knockdown. Fail closed with original before/after actor geometry and pulse chronology. This is a test-harness-only attempt, **not** a confirmed M159 fix or a new gameplay mechanic.
- **Pending gates:** exact-head independent native M158/M159 first-attempt runs, full quality, four Chrome PlayCanvas real Rust, Source11 three lives, original-game M41/M147/recovery buffer and independent four physical Chrome hosts. Retain source-only draft / release HOLD. No CI pass should be claimed before GitHub confirms it.

## Independent native gate checkpoint — 2026-11-07

- **Prior source SHA:** `2bbce942c1d6b1eb91f1dd2b9c482f09756e4e8f` on Draft #1169. The exact-head first-attempt batch finished **26 SUCCESS / 3 FAILURE**. This is not a release candidate PASS.
- **Quality first-RED:** [run 42364702894](https://github.com/tehki/myaso/actions/runs/42364702894) stopped on genuine M137 buffered Space+LMB after original Light34. Original Rust committed a second Light34 (defender 100→66→32), not mandatory JumpAttack42; untouched M137 assertion failed. This means the quality sequence did **not** reach M158 or M159: neither is verified at this SHA.
- **Other first-REDs:** [original-game native browser QA 42364702931](https://github.com/tehki/myaso/actions/runs/42364702931) retained a real Chrome original actor in Jump action15 beyond the eight-second idle gate; [PlayCanvas QUIC 42364702964](https://github.com/tehki/myaso/actions/runs/42364702964) had a passive Firefox QUIC timeout, while four real PlayCanvas Chrome and Source11 three-lives native jobs **PASSED**. Firefox is historical regression evidence, **not** the Alpha 0.2 product target.
- **New separate source-only lane:** `.github/workflows/main0-alpha02-m158-m159-independent-native.yml` gives M158 `uimultiknockdownffa` and M159 `uimultiknockdownffahit` independently scheduled **real original Rust + physical W3C driver** jobs, each retaining its own first-attempt run log artifact. Existing full quality, M137, reach94, roll-order and 260ms server World gates remain unmodified. The native QA lane uses the original legacy mixed browsers because those two *historical* scenarios require them; it does **not** claim Chrome-only PlayCanvas release qualification. A new source commit and exact-head runs are **PENDING** until verified.
- **Local source checks for the new QA lane:** YAML parses two matrix jobs; M158 readability contracts 2/2 PASS, M159 staging and early-release contracts 4/4 PASS; original runner `node --check` and `git diff --check` PASS. These are not browser QA PASS.
- **Release signoff remains blocked:** require independent M158 + M159 genuine first-attempt evidence, clean quality/M137 and Chrome Space-chord, source-only 4 PlayCanvas Chrome and three Source11 lives at **the same final SHA**, genuine four physically independent authorized Chrome hosts, original Rust server SHA, authenticated identity/ACK, Chat C1, collision/respawns/reconnect, hit isolation, stamina and preserved security gates. No merge/deploy/public activation.

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
   **Source11 four branded Google Chrome Stable** original-game lifecycle
   **PASS** at `abafa9142fbf3037b456c0687cbdc431f27b8a04` in
   [CI 41911706564](https://github.com/tehki/myaso/actions/runs/41911706564):
   four independent Chrome 156 browser sessions, real original Rust Combat,
   three same-session deaths/respawns, renewed source0 and Chat C1; mixed
   and stale-generation negative lanes also passed. This proves one CI host,
   **not** four independent machines or four PlayCanvas renderer sessions.
   Original feature-gated M147 four-native mixed-engine integration also
   **PASS** at `abafa91` in CI 41911706689. The new independent four-branded
   Google Chrome Stable **private HIT** lane **PASSED** at exact head
   `2671f2aaf191910e51bb80efc4d7844673c7190b` in
   [CI 42219272543](https://github.com/tehki/myaso/actions/runs/42219272543),
   alongside the retained mixed-engine lane: original Rust authoritative Light
   34, attacker/defender-only M147 receipt + present-before-ACK, no spectator
   receipt, all four native browser sessions. This is still one CI host, still
   developer-loopback opt-in, NOT public or independent-host qualification.
   **VERIFIED FOUR-ACTOR PLAYCANVAS Chrome Stable integration:**
   [exact-head CI 42357535014](https://github.com/tehki/myaso/actions/runs/42357535014)
   PASS at `9c129fc271bcb990c68027538a4edf551e0a3982` with actual
   Google Chrome 156 WebGL2, actors [1,2,3,4], original server-owned
   Light34 damage 100→66, independent observers #3/#4 at victim 66
   while own HP100, and Chat C1 receipt to all three peers. Four clients
   share one CI host; no independent physical hosts or PlayCanvas respawn
   continuity is implied.
   **NEW FOUR-ACTOR PLAYCANVAS Chrome Stable native source-only candidate:**
   `MYASO_CHROME_FOUR_P0=1` now requires *four real PlayCanvas WebGL2*
   renderer clients, all with independent original Rust World9 actors at
   (4110,4160), (4206,4160), (4110,4256), (4206,4256), all granted
   original typed source0 + ACK and genuinely connected QUIC. Original
   Chat C1 Player #1 must be ACKed by Rust and delivered to all three real
   peers; local typing must suppress physical gameplay, Escape cancel must
   not send. One real Chrome W3C LMB and original World Light34 must reduce
   actor #2 100→66 HP, *and* third/fourth PlayCanvas actors must independently
   replicate #2 at 66 while preserving their own original HP100. This is
   isolated ephemeral loopback, no fake Combat authority, no private HIT claim.
   The separately named `four-playcanvas-chrome-stable` job in the existing
   nonrelease PlayCanvas CI enforces branded Google Chrome and preserves
   fail-closed native evidence. **Verified exact-head real Chrome 156 CI PASS
   at 9c129fc**, not merely source contracts. These are four PlayCanvas
   sessions on one runner, not four physical hosts.
   **NEXT: actual PlayCanvas Source11 three-lives qualification:** new
   `MYASO_CHROME_RESPAWN_P0=1` opt-in runner and distinct
   `two-playcanvas-source11-three-respawns` nonrelease CI job. Requires
   genuine two Chrome Stable WebGL2 original Rust sessions, real W3C
   100→66→32→0 Light HP for three consecutive same-victim World lives,
   automatic server-owned death/respawn, unchanged victim actor/QUIC root,
   original source11 bound bidi GRANT with increased typedGeneration,
   a fresh trusted post-respawn LMB ACCEPTED on the new generation,
   and original Chat C1 ACK/peer delivery after each new life. No local
   HP/death simulation or protocol fork. **PENDING real exact-head CI**
   (not signed off by source contract tests).
   Remaining P0: four PlayCanvas Chrome Stable Combat/reconnect signoff,
   independent-host private HIT stress, multiple-hit replay/incarnation and
   stamina, full Block/Kick/Dodge/focus acceptance. No client-created gameplay.
   Exact-head CI at 30b741c after failed-job reruns: quality passed and 27/28
   workflows passed. The original two M27/renderer timeout reds were cleared
   by retry; the remaining standard-path M35 first-RED is real: original Rust
   World HIT at tick1121 precedes defender Block admission at tick1122, so the
   attack lands for 34 HP. The same M35 result reproduced on retry. Preserve
   this Combat timing blocker; do not change the 125ms parry window or waive it.
   See runs 41868420936 and 41868420274. At `abafa91` CI was 26/28.
   At `2671f2a`, first-attempt CI was 24/28: branded four-Chrome M147,
   Source11, and all eight mandatory Combat jobs passed. Quality, M151
   three-fighter guard-break, M121 directional Light, and M156 roll-punish
   were RED. Targeted failed-job reruns subsequently passed M151, M121,
   and M156; the quality job was still running at the latest check.
   Historical first-REDs remain relevant despite those successful reruns.
   M121 specifically had real W3C LMB down/up separated by ~239ms rather
   than a native plan's 40ms; original World correctly committed Heavy
   9→24→25→26 instead of directional Light34. Main0 adds a read-only
   actor-bound `M121_NATIVE_PHYSICAL_LIGHT_FIRST_RED` diagnostic with unit
   tests; the original 34 HP and directional presentation gates still fail.
   Earlier M35 HIT-before-Block first-RED and fast-vs-slow W3C wheel
   latency evidence remain preserved; no changes to Parry125 or World rules.
   At `c9d948f`, CI first attempt passed 26/29. Both four-Chrome M147
   and mixed-engine original HIT, Source11 four-Chrome lifecycle, M121
   directional Light, all eight mandatory Combat/M35 lanes and standard M156
   passed. Failures: native M151 missing genuine trusted Firefox wheel inside
   strict 190ms; Firefox passive PlayCanvas QUIC startup timeout; quality
   M140 failed to commit a genuine recovery-window Light. Targeted M151 and
   passive Firefox QUIC reruns subsequently PASSED; quality rerun remained
   in progress at the last verified checkpoint. All first-REDs preserved.
   Review-only `M194_NATIVE_WHEEL_TIMEOUT_FIRST_RED` now attaches original
   W3C dispatch/ACK/attestation clock evidence and bounded original World
   actions to a failed guard-break exchange; neither the missing wheel nor
   simulated Block can satisfy acceptance. No release/up-input after timeout,
   no additional gameplay owner, no parry or server timing change.
   At `3fba648`, first-attempt CI was 25/29; the original native M151
   guard-break punish, M194 five-block, Source11 retired-generation and
   Chrome four-browser JumpAttack review lanes were RED. All four failed-job
   reruns later passed; this means 29/29 workflows eventually SUCCESS, but
   does not prove repeatability or erase their original first-REDs. The
   Chrome Jump review failure was especially actionable: trusted Space DOWN
   reached Chromium approximately **529ms before trusted LMB DOWN** while
   original Rust correctly accepted a plain Jump15 and rejected JumpAttack
   16/17. Original server admission is bounded to 12 World ticks. The
   native *test only* now pre-aims pointer separately and sends Space DOWN,
   then LMB DOWN on the next zero-duration W3C tick, with actual LMB UP
   before Space UP. The original authenticated action5, World16/17, stamina
   and isTrusted requirements remain strictly mandatory. New failure-only
   `combat4-jump-review-FIRST-RED.json` records the actual browser event
   gap plus original Rust journal; no client-side gameplay simulation.
   This change is source-only and requires fresh exact-head CI and native
   evidence before it may be labeled a reliable fix.
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
