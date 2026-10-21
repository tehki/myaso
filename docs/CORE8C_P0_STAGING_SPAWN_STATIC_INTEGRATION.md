# Core 8C — four-session QUIC staging and static Greyhaven collision (P0)

**Status:** integrated in an *explicit, loopback-only disposable staging*
server process, **not** enabled for production, and **not** First Playable Alpha.
Coordination: [#480](https://github.com/tehki/myaso/issues/480),
[#360](https://github.com/tehki/myaso/issues/360).

## Branch/source dependency and integration boundary

This draft PR temporarily carries the exact implementation of standalone
Core 8C [#486](https://github.com/tehki/myaso/pull/486)
at `e40ea0db280c58dd13cb6df5650d993bc82e87b0`
(the staged four-session admission, QUIC test, and profile)
**plus** new opt-in collision activation on Core #519 / #516 / World #509.
This is a combined integration proof. The orchestrator must resolve/rebase
the source PR #486 in the proper dependency order, not merge duplicate
independent copies of the same source.

## Security/authority

- Default: no `MYASO_ALPHA_SPAWN`, no
  `MYASO_ALPHA_STATIC_COLLISION` → **unchanged live behavior**.
- Private staging: `MYASO_ALPHA_SPAWN=greyhaven`,
  `MYASO_MAX_PLAYERS=4`, private/loopback bind, 0 synthetic players,
  server-owned four reserved spawn anchors.
- **Explicit static-collision experiment**:
  `MYASO_ALPHA_STATIC_COLLISION=reviewed-static-only`, requires
  `MYASO_ALPHA_SPAWN=greyhaven`, loopback **only**, cap 2–4,
  0 synthetic players. All these constraints and the initial authoritative
  Rust `World` eligibility check happen **before WebTransport binds**.
- No client-supplied spawn, collision control, geometry coordinates or
  auth scope. All QUIC packets still enter the original authoritative World.
  The optional collision flag is a server-internal bool, not on the wire.
- Four staged original positions near (4110,4160) remain radius-18 clear
  against the embedded World #509 solids, and live admission refuses
  collision-occupied anchors.
- Once enabled, movement/roll/dash/knockback/fighter separation guard
  the 23 pinned AABBs against tunnelling within the authoritative World tick.
  Client replication sees the resulting authoritative coordinates.

## Exact acceptance

Run:
```bash
node scripts/verify-core8c-greyhaven-geometry.mjs
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path server/Cargo.toml --test alpha_greyhaven_spawn_quic -- --nocapture
cargo test --locked --manifest-path server/Cargo.toml
```

Two independent QUIC loopback test processes prove default staging and
explicit static experiment each start a TLS-pinned WebTransport endpoint,
admit four actual simultaneous clients with correct replicated spawn
snapshots, reject the fifth and preserve the first session's input ACK.
Processes are disposable/automatically killed on test teardown.

**New real live-wall negative/positive control:** four concurrent real QUIC
sessions attach to each disposable server. Player #1 uses only normal input
packets and the replicated position stream: walk west from public spawn into
Blacksmith's exterior south aisle, then walk north toward the real authored
smith footprint. Static ON must stop north displacement at radius-18 collision
(roughly y=4032); OFF must continue into the footprint (roughly y=3842).
The test reads byte-decoded authoritative QUIC snapshots from the running
server, NOT a simulated Rust coordinate or a client-supplied teleport. Every
acceptance requires independently observed position changes before claiming
that a blocked fighter has stopped; delta-compressed silent updates are never
accepted as standalone collision evidence. Both modes must pass. This proves
current fixed-solid motion in a four-session, single-loopback-host process;
it does NOT prove Web browser controls or two different computers.

Tests in `server/src/main.rs` prove the profile refuses public/private
LAN and wildcard listener hosts, missing spawn mode, overcap, synthetic
background or unknown string; all checks are pre-bind. Rust simulation
tests prove actual wall/gate/sweep/knockback/respawn behavior.

## Cross-department M1/M2 four-sword approach conformance

The Chief Architect's **test-only** follow-on adds a deterministic check for
**all 16** server-spawn-to-Blacksmith-rack-approach combinations. It uses
World #493's four proposed physical sword **socket** approaches:
`(3740,4088)`, `(3780,4088)`, `(3820,4088)`, `(3860,4088)`,
and Core #486's four immutable `(4110/4206,4160/4256)` arrivals.
For each pair, the route uses city waypoints `(3990,4180)` and
`(3980,4090)`, applies radius-18 circle and continuous segment tests
against the **exact embedded World #509 23-AABB map** and asserts its
existing `solids_sha256` content pin.

This only demonstrates *static* clearance for those **specific 16
corridors**, not autonomous pathfinding, river/bridge safety, dynamic actor
collisions, a current trusted zone/map epoch, reach/LOS for `TryPickup`,
or physical sword-item ownership. The World-designed visual anchor is at
`y=4038`; the accessible player approach is **`y=4088`**. The
server-side pickup owner must validate the 50-unit approach gap with the
actual approved pickup range and same-tick collision/LOS check before any
ACK. Never turn a source-only route result into a positive pickup result.

**Important independent-network conflict:** this branch's combined static
collision profile currently requires **loopback-only binding**, while
the alpha M5 gate requires two independently operated machines. Do not
relax binding restrictions automatically. The Core 8C + 8A +
Development Center owners must explicitly approve a separately isolated
private staging profile with a pinned certificate, bounded cap, safe
firewall route and nonproduction rollback. Until then, **real four-client
same-world QUIC loopback acceptance is not independent-host acceptance**.

## Live four-client Greyhaven-to-Blacksmith approach witness (child of #527)

Core Architect [#527](https://github.com/tehki/myaso/pull/527) verifies
**16/16** radius-18 spawn-to-rack approach routes against the pinned static
AABBs. This child then sends real QUIC input over the existing server
transport, no direct Rust simulator-position mutation:

1. Open four separate certificate-pinned QUIC sessions and verify
   server-owned immutable spawn baselines and their initial replicated rosters.
2. Move **all four players simultaneously** under independent QUIC futures
   in one authoritative server World. Give each player a separate static-safe
   diagonal corridor from its own spawn to its unique rack approach, with
   fractional checkpoints along that corridor. The Chief Architect's
   separate #527 matrix also verifies **16/16** fallback city waypoint routes.
   The live test does not march all four physical fighters into the same
   waypoint, because server fighter separation can move them out of position.
3. Require actual replicated positions near (3740,4088), (3780,4088),
   (3820,4088), (3860,4088); validate each path's continuous radius-18
   sweep against the pinned solids, not just final endpoints. The four
   physical sword *visuals* are still at y=4038 and are not picked up.
4. After initial arrivals, obtain a late authoritative four-fighter roster,
   at least 30 server ticks newer than the final session input ACK.
   A player can be knocked out of its approach by another fighter even
   after its first valid arrival. If that happens, correct its position using
   **its own ordinary QUIC movement commands**; never write or teleport a
   Rust Fighter from the test.
5. Maintain an independent client-style **delta-replication cache for each
   of the four QUIC sessions** while they move. An unchanged entity omitted
   from a later delta remains in the cache, but a removal explicitly clears
   it. Require four new server-specific post-correction input ACKs, then a
   sufficiently fresh authoritative snapshot for each observer. Each
   reconstructed client roster must place **all four peers** within 24
   world units of their distinct approach locations. This tests actual
   shared-world visibility, not four isolated local predictions.

The scoped tests also assert the client cache's unchanged-position and
removal handling. All evidence is obtained through the existing network
protocol, with no privileged test stream or current-time map authority.

Acceptance marker `ALPHA_8C_FOUR_QUIC_DISTINCT_RACK_ROUTES_PASS`
proves four *socket approaches* only. It does **not** prove physical sword
target pixels, click, pickup LOS/range, one-winner u64/u128 item ownership,
actual equipped MainHand, real browser user inputs or separate computers.
The loopback-only isolation remains in force. No live map/revision capability.
The concurrent four-client movement proof checks actual on-wire server
positions and per-connection replication deltas. It does not emulate
independent browser event loops or independent-host WebTransport.

## Real four-session QUIC disconnect and slot-authority regression

The isolated four_quic_players_reclaim_only_departed_greyhaven_slot_after_abrupt_leave
test runs a real loopback WebTransport server with the exact pinned
reviewed-static-collision mode, and opens four certificate-pinned QUIC
sessions at distinct immutable server spawn locations.

Before disconnect, player #1 walks more than 44 units from its spawn
using actual input packets. Its original respawn anchor must remain
reserved for this existing player, although visually empty. A fifth
connection is refused at full capacity. The test closes player #2's
actual QUIC transport, while preserving sessions #1, #3 and #4; the
server removes net ID #2 and frees its admission permit. A newly
admitted player receives a distinct new net ID #5 and ONLY #2's freed
anchor (4206,4160); player #1 keeps its moved position and #3/#4
remain at their original locations. The new reliable server baseline
must contain exactly {1,3,4,5}, with the departed #2 absent. Another
fifth connection is refused. Each of the four live sessions separately
receives a current server-generated and correctly addressed INPUT_ACK.

No test directly calls remove_player or add_player: admission and
cleanup occur in the original server connection lifecycle. This does
NOT prove persistent player identity recovery: the replacement is a
NEW network identity, with no authenticated account/inventory/gear
restore. It proves bounded World slot and admission ownership, not
independent-host M5 or persistent crash recovery. No public listener
or production settings are changed.

## Core 8C — three surviving clients observe real QUIC leave and rejoin

The additional test
three_live_quic_peers_receive_departed_tombstone_and_new_player
exercises the actual server wire delta lifecycle, not an isolated
in-memory World::remove_player unit call.

Four separate certificate-pinned loopback QUIC connections join the
same server. Each surviving client (#1, #3, #4) first observes and
**acknowledges** a real four-player authoritative roster containing
fighter #2. This is necessary: checking a client that never saw #2
cannot prove correct removal. Client #2 then closes its original real
QUIC connection. The original server terminates that session.

All **three** surviving players must receive an explicit replicated
SNAPSHOT_FIELD_REMOVED tombstone for exactly #2, with their own live
delta cache clearing its now-departed position. After a new fifth
connection is admitted into the vacated slot, its first reliable
baseline must show exactly network IDs {1,3,4,5}. Each of the three
**already connected** old players must then receive a positive server
position record identifying new net ID #5 at the original #2
Greyhaven spawn (4206,4160), and none may continue retaining #2.
Every survivor and newcomer must still exchange an individually
addressed, server-generated INPUT_ACK.

This verifies removal/arrival propagation through the **real shared
authoritative server** and independent QUIC per-client delta streams,
while the preceding child #532 case covers four concurrent approaches
and mutual visibility at the Blacksmith. It does not imply that #5 is
the same authenticated person or inherits #2's gear/account/inventory.
The entire experiment uses the existing loopback-only static-collision
profile; it does not create, bind or expose a separate public service,
and makes no 2-host browser or sword pickup claim.

## Core 8C — first real four-client shared-world PvP fist strike

The real-transport test
four_live_quic_players_share_one_authoritative_fist_hit
starts the existing isolated, loopback-only, static-review-enabled Rust
server and opens four separately pinned real WebTransport QUIC connections.
The existing Rust World owns all four fighter IDs, their initial positions
and every combat event. Each session primes datagram replication and
receives a correctly addressed authoritative input ACK.

Without any direct server World calls from the test, player #1 sends
normal movement samples until its server-replicated x coordinate reaches
about 4142 in the open Greyhaven spawn courtyard; player #2 is still at
(4206,4160). This puts the two fighters within the existing unarmed
light attack reach of 76 world units, but outside their radius-18 physical
collision separation. Players #3/#4 remain too far away to be hit.

Player #1 then sends the existing normal input packet with its **light
attack button set**, facing east and without a sword/gear override. The
unmodified server evaluates the hit and updates authoritative #2 vitals
from 100HP to 66HP (the existing 34HP light damage). **All four separately
connected clients must independently receive this exact 66HP server
snapshot**, not a local client prediction, mock Combat event or untrusted
input damage value. Each must retain its own QUIC session and receive an
individually addressed fresh gameplay ACK after the shared hit.

This proves one normal network-driven **unarmed** PvP hit in a four-user
single-server authoritative world. It does **not** prove equipped sword
combat, hit visual effects, user-facing real-browser mouse controls,
death/respawn, latency robustness, remote WAN host independence, inventory
persistence, server anti-cheat against arbitrary game clients, or the full
P0 multiplayer playable-alpha user journey. The feature remains OFF
outside explicitly enabled **loopback-only** static-geometry staging.

## Real four-client out-of-range fist MISS: negative control

The new network-only test
four_live_quic_players_see_real_out_of_range_fist_miss
is the **negative control** for the successful 34HP unarmed strike in
Core 8C #556. It launches one genuine disposable **loopback-only**
Rust/WebTransport server, four separate certificate-pinned QUIC
connections, verified server-owned Greyhaven spawn baselines, and four
independently acknowledged live input channels.

Unlike the hit test, the test sends its real player #1 light-attack
input **without approaching**. The nearest opponent is player #2 at
an **actual 96-unit spawn separation**; the existing unarmed attack
reaches only 76 units. The other two players are also 96+ units away.

Critically, all four individual QUIC observers must actually receive
the attacker's **server-authored AttackActive action state (wire=2)**,
so ignoring the attack cannot satisfy the test. For each client, the
test tracks *every* server-authored HP/vitals update and consumes
snapshots until at least **40 authoritative server ticks after the
server accepted the attack** (a full light windup + active + recovery
cycle). All four fighters must remain exactly **100HP** at each client.
The server also proves that all four sessions remain input-authorized
via current, individually addressed QUIC INPUT_ACKs afterward.

This distinguishes an accepted miss from a dropped input and adds a
genuine four-peer no-damage witness. The paired existing positive test
requires 100HP->66HP (34HP) after moving inside reach. Neither test
changes runtime combat decisions, packet formats, server timebase,
collision authority, client controllers, browser assertions or the
production listener. No equipped sword, physical click, LOS-complete
world, separate-host browser or persistent user identity is claimed.

## Core 8C — four real QUIC players observe server death and respawn

The test `four_real_quic_players_observe_kill_and_immutable_greyhaven_respawn`
is the next scoped server-authority proof after the unarmed positive and
negative range controls in Core #556/#561. Four real, independently pinned
loopback WebTransport connections join one actual disposable Rust server.
They receive server-issued distinct Greyhaven baseline spawns and activate
their original authenticated input/replication streams.

Fighter #1 approaches #2 ONLY through ordinary client movement INPUT packets.
Three independent button edges then trigger three genuine committed heavy
**unarmed** attacks using the current heavy-input wire bit, not any direct
Rust World method, test teleport, damage RPC or item/weapon override. The
existing server calculates 46HP per heavy hit, reducing target #2 from
**100HP to 54HP to 8HP and finally to 0HP**. The test waits for each
first/second hit to be observed with an actual heavy Combat action and
requires at least **40 more authoritative server ticks** before the next
attack, preserving recovery/commitment and avoiding auto-repeat.

The third hit is observed concurrently by **all four original QUIC peers**.
Each must receive a server-authored **0HP / Dead (wire action 8)** update
for #2 and explicitly ACK that snapshot sequence through its OWN ordinary
input packet; this is necessary because returning to Idle/100HP is identical
to the initial acknowledged baseline and may otherwise be omitted by delta
compression. Each independent stream must later observe **100HP / Idle**
and precise original spawn **(4206,4160)** for the same net ID #2, with
a minimum bounded gap of 60 authoritative server ticks from its observed
death to observed respawn. All four original player sessions must remain
alive and receive newly addressed INPUT_ACK packets after the respawn.

This is a real multiplayer network proof of one server kill + timer-owned
respawn within a single running process, **not** an equipped sword kill,
persistent account/gear recovery, inventory drop, client UI controls,
a browser-native two-host flight, complete map/LOS/epoch fencing, or recovery
from server crash. It neither changes Combat nor bypasses the default-OFF,
explicit loopback-only reviewed-static staging security boundary.

## Core 8C — all four original QUIC sessions receive the reliable kill feed

The child regression also verifies the actual server-authored **reliable
kill event stream** for the preceding three-heavy-hit death/respawn.
The original server exposes an existing length-prefixed binary
KILL_EVENT packet (wire type=4, exactly 16 bytes) on each authenticated
bidirectional QUIC reliable stream; this is separate from lossy datagram
combat snapshots. No new packet type, runtime fanout or client policy is
introduced.

After all four independently prove server-originated 0HP / Dead and
100HP / Idle respawn, the acceptance reader resumes each existing
session's original **unclosed reliable stream**. It reads bounded real
length-prefixed frames, verifies the protocol byte, refuses unknown or
invalid event frames, and tolerates correctly decoded type=2 background
reliable snapshots. All four original clients must each decode **exactly
the same first server kill-event sequence 0, killer ID 1, victim ID 2**,
rather than simply seeing a local death animation, or deriving a kill
announcement from a predicted HP value. The stream belongs to the
original live session and is never replaced by privileged World access.

This verifies one genuine server-originated kill-feed delivery to four
connected users in the private loopback world, in addition to already
tested live death/respawn replication. It is **not** a browser kill-feed
rendering test, a multi-kill ordering or reliability-under-loss proof,
account persistence guarantee, or an authorization to enable a wider
staging bind. The same original controls and production CI gates remain
mandatory.

## Nonclaims and release HOLD

This is **not** full geometry authority. World #509's 23 static AABBs omit
river, bridges, moving actors and dynamic doors. No trusted live
zone/worker-epoch/map-revision fence, same-tick Physics #494 complete
pickup LOS, Core 8B sword ownership, combat-hit LOS, or fully integrated
four *browsers* on two independent hosts has been established. Never
deploy this mode to a public server or advertise it as complete world
collision. The initial layout SHA is a content integrity proof, not an
authenticated current runtime version. Full protected quality (especially
unwaived M41 browser parry tell) is required before merge. No CI bypass,
production changes, merge, or rollout made by Core 8C.
