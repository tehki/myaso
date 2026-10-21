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
The original first-death test's delta-baseline update also now
**requires an actual server INPUT_ACK** for every per-client Dead
snapshot acknowledgment, with the source server tick. The input
channel uses datagrams, so an unconfirmed baseline-update packet can
be lost even though the server continues running. The ACK and the
100HP/Idle respawn snapshot must now be observed on the **same**
per-client QUIC datagram reader, in either arrival order. The previous
separate blocking ACK waiter could consume and silently discard the
only fresh respawn delta while searching for its ACK: that made the
test intermittently time out despite server success. This replacement
reader independently records both facts before returning. Missing a
real ACK or a genuine respawn must still fail. No timeout, damage,
HP, action or original-spawn assertion was lowered.
The negative-control test preserves the button-down edge until all four
observers have confirmed actual server AttackActive; only then does it
release the button. This is essential because sending the release
immediately after the input ACK can cause the server to coalesce both
samples in a single tick and never execute the attempted attack. An
unexecuted attack must not be counted as a valid out-of-range miss;
the original AttackActive and zero-damage gates stay mandatory.

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

## Core 8C — late joiner cannot inherit historic reliable kill-feed events

The additional acceptance in the same real QUIC kill/respawn test enforces
**join-time event history isolation**, not just fanout to contemporaneous
players. Original player #2 dies and respawns after legitimate unarmed
heavy inputs. Each of the original four authenticated QUIC clients
reads the same server-generated reliable kill event (seq 0, killer #1,
victim #2) on its actual original reliable stream, plus the expected
Dead/100HP server snapshots and continued post-respawn input ACKs.

Then #2 closes its original QUIC connection. All three survivors must
each observe the actual wire SNAPSHOT_FIELD_REMOVED tombstone for #2,
proving the server has ended that identity. Physical spawn ownership is
also separately protected: the surviving killer is still initially
within the Greyhaven staging minimum **44-world-unit** admission radius
of #2's now-free anchor. The server must **not** place a replacement
inside an existing fighter; the acceptance drives killer #1 west through
normal gameplay input until its own server snapshot confirms the spawn
is clear. It never alters or teleports a server Fighter directly.

A fresh certificate-pinned QUIC session is then admitted as **new
net ID #5**. Its first real reliable full server roster must contain
**exactly {1,3,4,5}**, with #5 at #2's now-vacant immutable Greyhaven
spawn **(4206,4160)** and no old #2. After #5's normal gameplay
baseline ACK, its authentic server snapshot stream must advance at
least **60 authoritative server ticks**, never showing old ghost #2.
In parallel, the acceptance reads the newcomer's original new
reliable stream for a bounded **1.25-second evidence window**. Ordinary
decoded reliable type-2 catch-up frames are permitted; a type-4
kill event from *before #5's join* is forbidden. This verifies that
the current server's per-session kill-event cursor starts at the
current history boundary, rather than replaying another person's
pre-join fight into the newcomer's kill feed.

This is a bounded live server-wire join-history check, not a guarantee
against arbitrarily delayed delivery under all networking conditions,
not persistent identity restoration, not sword ownership, and not
browser-rendered notifications. It retains the explicit default-OFF
loopback-only reviewed-static staging profile without any server-side
logic, protocol, release control or production exposure changes.

## Core 8C — new live kill delivery after late join (no silent feed)

The child acceptance extends the preceding kill-feed join-history
isolation with a **positive post-join delivery control**. Merely not
receiving a historical event can be a false success if the newcomer has
a broken or silent reliable stream. After event sequence 0 was delivered
to all original four sessions (killer #1, victim #2), departed #2 is
removed, a previously occupied spawn is physically cleared using
ordinary movement, and a genuine fresh client joins as #5, its
authenticated reliable stream is checked for 1.25 seconds to reject
old event zero. Its live snapshot stream separately advances at least
60 authoritative ticks with the correct new roster {1,3,4,5}.

The original attacker #1 then approaches newcomer #5 via ordinary
client movement until the real server confirms a close east-facing
melee position. This is required because heavy-attack knockback can
push opponents beyond range if the attacker stays at its spawn after
the previous 44-unit admission-clearance step. There is **no teleport
or range/collision exemption**. The original server accepts three
separately committed unarmed heavy attack input edges on the new
fighter, and server snapshots confirm **100 -> 54 -> 8 -> 0 HP**
with >=40 server ticks of genuine recovery between committed blows.
All four **current** QUIC observers (#1, #3, #4, #5) must independently
see **0HP / Dead** for net ID #5. Each authenticated original
bidirectional reliable stream must independently deliver the same
**next** 16-byte binary kill event, with sequence **1**, killer **1**
and victim **5**. Any duplicate sequence 0, missing stream, wrong
victim, wrong sender or absent server-owned death makes the test fail.

This provides a true real-transport paired claim: a brand-new player's
stream does not replay kill sequence 0 from before joining, yet does
receive the subsequent legitimate kill sequence 1 that occurred
after joining, along with the same new kill viewed by every survivor.
It does not claim browser kill-feed rendering, adversarial packet-loss
testing, equipped swords, item grants, persistent identity recovery,
or a two-physical-host browser run. The server remains a disposable
loopback-only explicitly opted-in reviewed-static fixture. No runtime
Combat, reliable-stream implementation or release gate was changed.

## Core 8C — second authenticated kill completes a fresh joiner's respawn cycle

The child of #586 extends its existing real-server **second** kill
test beyond the new reliable KillEvent sequence 1. Four current,
separately pinned WebTransport sessions (#1,#3,#4 and newcomer #5)
already prove that historical sequence 0 was never replayed to the
newcomer, but that genuine server-authored next event sequence 1
(killer #1, victim #5) reached all four on their *own* original
reliable streams after three committed heavy-fist hits (victim #5
HP 100→54→8→0).

New: each original QUIC session returns its real **Dead snapshot sequence**
from its own datagram stream, sends an ordinary input acknowledging
that actual death frame, and keeps receiving authoritative snapshots
until server-calculated **100HP + Idle** at the *exact* immutable
Greyhaven respawn **(4206,4160)** for net ID #5, no sooner than 60
authoritative simulation ticks after death. The four independent
old/new clients must each observe the respawn. They must also each
send their **own latest actual respawn snapshot sequence and server
tick ACK** and obtain their correctly scoped post-respawn INPUT_ACK
on the existing session, without reconnecting, changing identity, or
receiving a synthetic resurrection.

The test uncovered a genuine staging physical-collision interaction:
attacker #1 can be standing only 32 world units from #5's respawn
anchor after a heavy melee kill, and the real server will physically
separate the newly spawned player. Before testing the precise
unoccupied immutable anchor, the test moves #1 west through ordinary
client INPUT to a genuinely server-observed clearance of at least
44 world units. It does NOT disable physical collision, change the
server's respawn logic, accept an incorrect respawn coordinate, or
privilege the test to modify Rust fighters. Periodically repeated
SNAPSHOT_FIELD_REMOVED tombstones for already-left player #2 are
accepted as real delta-replication metadata, while a **live** record
for that retired net ID at the newer death/respawn ticks fails the test.

This demonstrates a complete second kill → sequenced reliable fanout
→ timed respawn → four independent postrespawn ACK sequence. It does
NOT imply persistent authenticated account recovery, saved gear,
multi-host native browser acceptance, genuine clicked sword ownership,
or complete World/Physics map authority. The staging server remains
a disposable 127.0.0.1 certificate-pinned instance with the original
default-OFF reviewed-static collision opt-in and original gates intact.

## Core 8C — real QUIC dead-player movement and attack input fence

The test-only child of #598 adds a deliberate **invalid gameplay
action while Dead** to the same exact four-session second-kill sequence.
The fresh net ID #5 was killed by three authentic heavy-fist hits,
and all four current players independently saw 0HP / Dead and the
reliable new event sequence 1. The test performs the attempted action promptly after the real kill
notification, before the server's ordinary 75-tick respawn timer.

Before #5's genuine server-timed respawn, **its OWN still-authorized
QUIC connection** sends one ordinary, syntactically valid gameplay
INPUT packet carrying both eastward movement and the existing heavy
attack button. It contains the *actual observed Dead snapshot sequence
and authoritative server tick* as ACKs, not fabricated server state.
The real server returns an individually addressed input ACK for the
request. However, the server must continue to treat the entity as
0HP / Dead and ignore gameplay control: after the genuine Dead
snapshot is ACKed as the replica baseline, its network delta stream
must show **no position update, no HP restoration, and no transition
to an attack/action state** for at least **12 additional independent
authoritative server ticks** before the ordinary respawn timer fires.
This checks server execution and replication, not a client-side
disabled button or mere dropped input. The test releases the held
commands while still Dead using current authenticated ACK values.
The surviving killer then clears the original spawn's 44-unit physical
admission/separation radius via normal gameplay movement.

All four players must subsequently see #5's original server-authored
100HP / Idle / exact spawn (4206,4160) no sooner than 60 ticks after
death, and all four retain their live authenticated post-respawn
input ACK flow. This is intentionally scoped to a genuine,
well-formed, authenticated Dead-state input. It does not test
arbitrary malformed datagrams, account takeover, inventory, real
browser controls or remote two-host staging. Only the Rust QUIC test
and evidence documentation change, never runtime Combat or the
production transport.

## Core 8C — newly respawned client regains real movement authority

The test-only child of #609 adds the **positive** half of an actual
networked life-cycle control fence. The parent already verified that
defeated net ID #5 sends a syntactically correct heavy-attack plus
east-movement command on its own authenticated real QUIC stream,
receives a genuine server INPUT_ACK, but cannot attack or move
for at least 12 additional authoritative ticks while still Dead.

After all **four** distinct current users (#1,#3,#4,#5) independently
observe #5's server-timed original-anchor **100HP / Idle** respawn at
(4206,4160), and all four send and receive their own current
server-tick/snapshot ACKs, the exact same resurrected player #5
submits a **new, normal eastward gameplay movement input** carrying its
real respawn snapshot ACK sequence and server tick. The server
individually acknowledges that new input. All four independently
connected real QUIC peers must decode **newly replicated authoritative
#5 positions at x >= 4230**, y approximately 4160, after their
individually witnessed respawn ticks. Their authentic position deltas
must still have #5 alive at 100HP; no client-side movement prediction
or Rust World mutation can satisfy the four peer witnesses. The
newly revived fighter then sends neutral movement release with the
**actual last observed movement snapshot sequence and server tick**,
and receives the server's own input ACK without stale-baseline warning.

This is the paired behavior expected for playability: valid gameplay
commands are inert **while Dead** and start working again **after
the server-controlled respawn** on the original authenticated session.
It does not demonstrate a real browser keypress or UI animation,
equipped swords, account persistence, full authored obstacle physics,
or multiple remote hosts. The server executable, authoritative
movement logic, Combat damage, snapshot protocol, original CI gates
and default-off/loopback-only collision staging settings are unchanged.

## Core 8C — restored actual unarmed Combat authority after respawn

The test-only child of the four-peer postrespawn movement proof verifies
that a defeated user's server-authoritative **attack authority**, not
merely movement, returns after the timed respawn on the **same original
authenticated QUIC session**. This matters because previous acceptance
deliberately sent a syntactically correct heavy-attack and movement input
from the 0HP/Dead net ID #5; the real server individually ACKed it but
proved that neither action nor position could execute while Dead.

The existing four live certificate-pinned QUIC sessions (#1,#3,#4,#5)
first independently prove #5 has returned to 100HP/Idle at original
Greyhaven anchor (4206,4160), and each observes genuine server movement
to x >= 4230 at 100HP, with all input acknowledgments bound to actual
server tick and snapshot sequences. Only **after** the same revived
actor #5 has released movement and the server ACKed that release does
its client send a new, ordinarily framed **heavy-attack** INPUT packet.
Its original server snapshot sequence and tick are included, and the
existing input sample uses the standard heavy-attack button bit and
a quantized **west** facing angle (32768/65535 turns), aiming at
surviving fighter #1 near x4116. The two untouched spectators #3/#4
are outside that authorized attack's west-facing arc.

The real Rust server (not the test) accepts that request as net ID #5,
executes the original heavy attack and calculates exactly 46 HP of
unarmed damage to fighter #1: **100HP -> 54HP**. All four original
independent live QUIC snapshot streams must each actually witness
both server-authored committed heavy-action state for net ID #5
(action wire 9/10/11) and the same 54HP vitals delta for net ID #1
after their own postrespawn observations; they must also refuse any
unexpected HP loss to fighters #3, #4 or #5. The attacking user
releases its heavy button only **after all four independent committed
attack and damage witnesses succeed**, avoiding a false unexecuted
attack from coalesced opposite inputs. The release receives its own
correctly addressed real input ACK.

This creates an end-to-end **Dead gameplay rejected → timed server
respawn → movement restored → heavy Combat restored** witness for
the same actual QUIC identity, with four independent replicated
damage observations. The test does not change combat, damage values,
physics, protocol, client UIs, game equipment, account persistence,
or default-OFF / loopback-only staging network configuration. It
does NOT claim physical clicked swords or a multi-host browser playtest.

## Core 8C — dead fighter cannot damage a real in-range opponent

This child extends the genuine four-QUIC Dead-state input test with a
**directionally valid forbidden hit**. Previous dead-input proof
required that fighter #5 never enter attack state or move before its
server-controlled respawn. An east-facing heavy attack on empty space,
however, could not by itself prove that the server suppressed potential
damage to another player.

The existing same-session scenario already has original fighter #1
alive and physically near defeated net ID #5: #1 previously approached
#5 through ordinary gameplay movement to engage within the server's
unchanged **130-unit heavy reach**. All four real certificate-pinned
QUIC sessions (#1,#3,#4 and the defeated fighter #5) observe #5's
genuine **0HP / Dead**, and all four receive server-authored reliable
kill event sequence 1. While still Dead, #5 sends an ordinary,
well-formed **heavy+east-movement** INPUT packet using its authentic
Dead snapshot ACK sequence and server tick, but sets normal quantized
facing to **west / PI** — directly toward living #1. The server
acknowledges the packet as a valid transport input.

All four independently connected observer streams must then decode
authoritative snapshots for at least **28 additional server ticks**
after the real death and fail if any server VITALS update reduces
fighter #1's **100 HP**, if defeated #5 gains HP prematurely, or if
#5 transitions to a non-Dead action. #5's own stream additionally
requires **no server-authored position delta** while Dead; other
spectators are permitted to receive repeated old position fields from
unacknowledged delta baselines, not mistakenly interpreted as new
movement. This is a meaningful real melee-range negative control:
a wrongly executed west-facing heavy strike would be capable of
damaging nearby #1 after its original 320ms windup. The proof requires
the real world to keep advancing; packet acceptance alone cannot pass.

The same test then releases #5's attempted action, moves living #1
clear of the respawn anchor by normal INPUT, confirms the exact
server-timed **100HP / Idle** respawn with all four current sessions,
then has revived #5 walk east and perform a fresh valid west-facing
heavy strike. **All four** subsequently observe the actual committed
heavy attack by #5 and #1's server-owned **100→54HP** result. Thus
the paired checks show a real in-range attack is harmless while Dead,
but causes the unchanged **46HP** damage after actual respawn,
without changing runtime Combat, network protocol, or staging bind.

The test is still only a loopback real-QUIC network acceptance;
it does not validate real native-browser controls on two hosts,
persistent accounts, equipped swords, or full dynamic World/Physics.

## Core 8C — predeath QUIC attack replay must not execute after respawn

This test-only descendant of the four-peer genuine in-range Dead-state
damage fence adds a **real network-ingress replay regression**: a client
that was legitimately admitted and then defeated must not be able to
resurrect an attack recorded *while Dead* by replaying the exact old
datagram after its server-controlled respawn.

During its genuine second death, original net ID #5 submits a normal,
authenticated, west-facing heavy-attack plus eastward movement INPUT
with its actual Dead snapshot and authoritative server tick ACK. The
server individually acknowledges that valid transport packet. All four
current independently certificate-pinned QUIC clients verify that the
attack cannot hurt nearby living fighter #1 (100HP) and #5 remains Dead.

After real timed respawn (100HP/Idle at exactly 4206,4160), all four
sessions see #5 resume normal movement at x>=4230 and all four still
receive server input ACKs. The *identical saved original INPUT bytes*
(previous sequence, sample tick, facing and buttons, not a newly minted
action) are then sent again over the *same* authenticated #5 QUIC
connection. The test intentionally does not expect a new input ACK
for replayed/deduplicated input. Each of the four original independent
network clients must observe **28 more authoritative simulation ticks**
after postrespawn movement without a new committed heavy action for #5,
without damage to fighter #1 (remains 100HP), and with #5 remaining
alive at 100HP. A dropped/no-snapshot shortcut cannot satisfy the
real server tick progression check; one unexpected committed heavy
or #1 HP delta fails the test.

Finally the original #5 connection sends a **fresh** valid west-facing
heavy attack with a new sample tick and genuine latest server
acknowledgment. All four independent clients must then witness the
existing server's committed heavy-action state and exactly 46HP
damage to #1 (100→54HP), preserving the positive proof that normal
postrespawn combat was not accidentally disabled. This pair proves
duplicate/replayed Dead-phase inputs do not become live actions,
while fresh valid postrespawn inputs still work. It does not claim
cryptographic per-packet freshness, multi-host replay resistance,
persistent account recovery, physical swords or browser input controls.
No runtime Combat or transport code, packet format, CI rules, staging
listener, physics or authentication configuration is changed.

## Core 8C — stale Dead-phase input cannot hide in a newer QUIC packet envelope

The test-only child of the original byte-identical stale-input replay
regression adds a **distinct sample-level freshness boundary**, after
the same player's honest server-controlled 100HP/Idle respawn. The
original #5 Dead-phase ordinary input asked for an in-range,
WEST-facing heavy fist and EAST movement (sample tick **70850**),
was individually ACKed by the real server, and was correctly denied
while Dead. All four actual certificate-pinned QUIC peers already
prove that resending those identical datagram bytes after respawn
causes no attack or damage to living #1 over 28 live server ticks.

A stronger *new packet envelope* is then constructed on the SAME
authenticated #5 connection. The packet's input sequence is **new**
(73900 modulo u16) and its header client tick advances to **70900**,
with the latest observed real server ACK tick/sequence. Its normal
single input sample has tick_delta **50**, which must still decode to
the identical original **70850 sample tick**, preserving the same
west-facing heavy button and eastward movement. The integration test
explicitly decodes its own packet through the **actual Rust wire
decoder** and refuses accidental changes to that sample's age,
facing, move intent or attack button.

Once this newly wrapped but previously accepted Dead-phase sample is
sent, all four currently connected real QUIC clients must witness
**28 additional authoritative server ticks** without a fresh heavy
action for #5, without HP loss to in-range #1 (remains 100), and with
#5 still alive at 100. This tests the existing ingress window's
**sample-tick deduplication** rather than merely its packet-sequence
field. The test does not falsely require a gameplay INPUT_ACK for
the already-seen duplicate sample. The genuine, later postrespawn
heavy INPUT with a **new sample tick** must still execute on the same
session and all four peers must independently observe unchanged
46HP damage to #1 (100→54HP).

The earlier original death→respawn acceptance also now tolerates the
genuinely unreliable QUIC datagram transport: its **single snapshot
receiver** maintains the actual observed Dead snapshot sequence and
server tick and, until the authoritative respawn is observed, may
retransmit neutral baseline acknowledgments at bounded 250ms
intervals using new gameplay input ticks. It requires a server
INPUT_ACK matching **one of those actually issued acknowledgments**,
plus the server's actual 100HP/Idle and original immutable spawn,
without extending the original overall six-second deadline or
running a competing ACK reader that can swallow the respawn delta.
A missed ACK or missing respawn still fails the original assertion.

This is a scoped same-session original-sample-tick replay check,
**not** proof against a malicious actor inventing an entirely new
sample tick, account/session hijack, cryptographic anti-replay,
network-loss resilience across arbitrary WAN paths, or a completed
two-machine browser flight. No production ingress, Combat,
identity, reliable writer, wire format, collision, physics,
listen-address or CI release gate changes.

## Core 8C — real 30-second QUIC stale-lease expiration and slot reuse

This child adds a genuine Rust/WebTransport server-process test on
127.0.0.1 (four-player cap, certificate-pinned TLS and explicitly
opted-in Greyhaven 23-solid static preview). This extends Core8A's
unit-level input freshness lease fix with **actual network** evidence.

Four original independent sessions receive genuine reliable full
identity/spawn snapshots. Three spectators (#1,#3,#4) each must
observe and acknowledge #2's original position; for later joiners
#3 and #4 this is already in their reliable FULL baseline, not an
unnecessary second delta for a stationary actor. Fighter #2 sends
one valid accepted neutral tick 90002 with an actual input ACK.
Its SAME still-established QUIC connection then repeatedly sends
valid binary packets with ever-changing packet sequence numbers
but the same *already consumed* client gameplay tick **90002**
and identical buttons/motion. **No new accepted gameplay input**
should renew that unchanged server-owned 30-second fighter lease.

Meanwhile all three active spectators submit fresh real neutral
gameplay input ticks every ~210 milliseconds. Each independently
drains the real network datagram stream at a rate exceeding the
server's snapshot cadence and MUST observe a genuine server-issued
SNAPSHOT_FIELD_REMOVED record for the expired #2. Passing requires
at least 60 transmitted stale packets, at least 26 seconds elapsed,
a packet transmitted within two seconds of actual expiry and all
three removal tombstones within a strict 39-second deadline.

The client deliberately never calls QUIC close for #2. The unchanged
server must remove #2 when its *fresh-input inactivity lease* expires,
even though transport continues. A new fifth certificate-pinned
QUIC session must be admitted with server-owned identity **#5**,
an exact four-member reliable full roster **{1,3,4,5}**,
and #2's original vacated anchor **(4206,4160)**. The *original #2 QUIC connection itself* must terminate with the
server-issued **application close code 0x12** and reason
\`client input inactivity\`, not a client-initiated close,
socket disappearance or only a replicated tombstone. New #5 must
receive its own correctly addressed real INPUT_ACK for fresh input
after admission. All three surviving original sessions must likewise
demonstrate separately addressed fresh INPUT_ACKs even after #5
replaces #2.

Initial genuine proof: **135 stale packets** sent over ~30.53 seconds,
all three tombstones independently recorded at server ticks 1812–1821,
and new #5 correctly admitted. This is strictly an authorized
single-loopback-server acceptance, NOT multi-host browser testing,
durable subject identity, arbitrary loss testing, or proof against
new genuinely fresh malicious input ticks. No production server,
protocol, Combat, timer, network policy, or collision map is altered.

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
