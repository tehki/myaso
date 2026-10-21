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
