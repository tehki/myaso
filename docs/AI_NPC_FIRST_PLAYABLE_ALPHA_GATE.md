# Moon Games — AI & NPCs First Playable Alpha Integration Contract

**Priority:** P0 First Playable stability before any NPC integration.
**Department:** 1 — AI & NPCs / Living World.
**Orchestrator:** [Main P0 gate #480](https://github.com/tehki/myaso/issues/480) and
[Development Center #360](https://github.com/tehki/myaso/issues/360).
**Experimental source:** [PR #353](https://github.com/tehki/myaso/pull/353),
\`feature/moon-living-world-ai-rfc-20261020\`.

## First Playable default: no NPC pilot

For the first playable multiplayer alpha, **do not enable any NPC pilot flag**.
No NPCs, NPC chat, NPC supply economy, or staged worksite maintenance are
required for the initial accepted gameplay loop of real players joining a world,
moving, fighting, dying and respawning.

Server bootstrap defaults \`MYASO_NPC_PILOT\` to disabled both for public and
loopback binds. An explicit \`MYASO_NPC_PILOT=1\` is rejected on public IPv4/IPv6
addresses. \`MYASO_NPC_MAINTENANCE=1\` is rejected unless the pilot itself is
enabled, and \`MYASO_NPC_GUARD_DETOUR=1\` requires **both** other opt-ins.
All three flags are optional; an ordinary public game requires none.

With the pilot disabled, \`SharedGame\` has **no \`NpcRoutines\` or
\`NpcSupplyWorld\` allocations**. Its existing NPC bootstrap, state, site,
supply and conversation wire emissions are gated behind the opt-in boolean.
The browser's NPC panel remains uncreated until an actual gated server roster
arrives. No NPC data may become necessary to decode ordinary combat and
replication packets.

## P0 regression proof — unchanged fighter simulation

The server binary integration test in \`server/src/main.rs\` runs two
identical authoritative simulated two-fighter games: NPC pilot **off** versus
NPC pilot **on** on the same local test harness. For **600 consecutive server
ticks**, both receive the same movement, attacks, dodge, guard and facing
inputs. The opt-in game additionally advances the real pilot's bounded
supply and social operations on each corresponding tick.

Every tick must preserve **exact equality** of combat events, full fighter
states, fighter count (only the two real players) and server replication
tick. A difference fails protected Rust CI. A companion test enforces
public-address/IPv6 rejection and the entire three-flag opt-in dependency
matrix, and confirms ordinary startup has no allocated pilot state.

**Scope of proof:** isolated Rust execution of the existing server
simulation, **not** a deployed WebTransport session, actual pilot packet
capture, Chrome/Firefox input, or independent-machine multiplayer gameplay.

## Safe promotion sequence

1. **First Playable:** omit all pilot flags. Keep this experiment unmerged.
   Orchestrator tests the actual main candidate against the normal quality,
   independent two-machine Chrome+Firefox, combat, and production rollback
   gates without any NPC prerequisite.
2. **Optional future NPC visibility:** after Core and World approve a named,
   versioned authoritative collider/door/zone interface, extract the minimal
   NPC feature into a short standalone reviewed PR targeting current
   \`main\`. Do not merge the current 16-file, long-lived experiment
   indiscriminately into the first-playable candidate.
3. **Requalify:** exact-head local Rust/JS and mandatory GitHub quality,
   real browsers, concurrent players, loss/reconnect, no NPC-induced
   frame-time or snapshot regressions, and cross-branch ownership review
   (particularly \`server/src/lib.rs\`, \`server/src/main.rs\`,
   \`web/online-game.mjs\`). No gameplay authority over player items,
   money, world collision, doors or combat from NPC text.

**Current classification:** IMPLEMENTED (pilot), TESTED (isolated),
**NOT INTEGRATION-READY, NOT INTEGRATED, NOT PLAYABLE** as an NPC-enabled
multiplayer world. The project alpha may be playable **without NPCs**, once
the Main Orchestrator's independent acceptance gates pass.

**Rollback:** Keep existing stable \`main\` unchanged; close or hold PR #353.
For an isolated localhost evaluation, unset all three NPC pilot environment
flags and restart only that ephemeral test instance—never production.

## P0 roster update — four players, visible rack swords, NPCs optional

The Main Orchestrator's owner-specific P0 [armory acceptance #488](https://github.com/tehki/myaso/issues/488)
requires **four independent human players** sharing the same authored city,
each able to click a **visible individual sword** on a reachable rack, with
server-authoritative exclusive pickup and equipped-hand replication.
Unarmed players punch. This cannot be satisfied by NPC dialogue,
invented equipment or an inventory menu.

Department 1 does not own rack geometry, item identity, gesture-to-pickup
routing, player equipment or melee damage. If an armorer NPC is eventually
included, it is **optional ambience only**, never a prerequisite for getting
the sword. The accepted First Playable role/art split is **human player:
Silver Knight** and **NPC (if present): T1 Sentinel**; adult human models
remain a separate active development preview. Role-to-art and render assets
belong to Graphics, not this department.

To keep optional NPC code from disrupting the four-player experience,
the P0 server parity test now executes **both 2-player and 4-player
deterministic authoritative scenarios**, each for 600 ticks. Both sides
receive identical real game-simulation movement, attacks, block, dodge,
kick and run inputs and advance the same combat engine. The opt-in
control side additionally runs NPC finite supply, social updates and
movement ticks. At every tick, equality is required for combat events,
entire fighter states, replication tick and exact real-player fighter
IDs; the NPC-disabled side must keep both NPC allocations absent. No
fake fighter ID may be introduced by pilot NPCs.

This test is **not** proof of four independent browsers, sword rendering
or equipment ownership. Those are cross-department real-acceptance
gates under #488/#480 and cannot be bypassed. PR #353 remains
experimental, draft and nonrequired for First Playable; production
NPC activation, merges and deployments remain on HOLD.
