# Core 8 P0 — Four simultaneous Greyhaven QUIC movers

**Purpose:** Extend First Playable Alpha M1 server-authoritative acceptance from
four concurrent *admitted* QUIC clients to four clients **actually moving at
the same time**, observed through the real server's replicated snapshots.

**Branch dependency:** Core 8C [#520](https://github.com/tehki/myaso/pull/520)
(server-opted-in Greyhaven + fixed swept collision) →
Core Chief Architect [#527](https://github.com/tehki/myaso/pull/527)
(16 spawn-to-Blacksmith approaches, pinned static sightlines) → this
test-only acceptance child. No gameplay code is changed.

## Real transport acceptance

`server/tests/alpha_greyhaven_spawn_quic.rs` adds the
`four_real_quic_players_concurrently_move_under_static_collision` test.

It launches the actual Cargo-built game server with:

- **127.0.0.1 only**, a randomly assigned port and a pinned short-lived
  development TLS certificate — never a production or public endpoint.
- **Exactly 4 real players** (`MYASO_MAX_PLAYERS=4`), server-assigned
  `player_id=1..4`, server-owned Greyhaven spawn anchors.
- Reviewed fixed/static AABB sweep collision **opted in**; no assertion that
  river, portals, dynamic actors or all Greyhaven geometry is complete.

Four **independent WebTransport/QUIC connections** each open a genuine
bidirectional game stream and receive an authoritative full baseline. Each
baseline must contain all previously admitted player IDs, with the exact
server-owned spawn coordinates. All four then submit their **own normal
wire-v1 input datagram** requesting westward movement, before any movement
observer starts awaiting a result.

Four concurrently polled independent snapshot streams must verify:

- The corresponding authoritative entity moves at least 85 units west.
- No unjustified Y-axis displacement exceeds 12 units.
- The movement is bounded and backed by multiple real replicated samples.
- Each connection submits a regular zero-motion input to end the hold.
- No client can supply arbitrary coordinates, switch world/zone ownership
  or override server collision from this test.

**Representative local Rust 1.89 evidence (Serj Linux):**
`ALPHA_8C_FOUR_CONCURRENT_REAL_QUIC_MOVE_PASS clients=4
static_preview=on same_authoritative_server=yes`.
In the first test, all four moved west by 86 units; a later full-suite run
found approximately 90–94 units. Both are expected as actual server
snapshot timing varies. Do not hardcode those values into gameplay.

**Verified locally:** the new focused test PASS; full
`alpha_greyhaven_spawn_quic` integration suite **5/5 PASS**, plus
`cargo fmt --check`, strict `cargo clippy --all-targets -- -D warnings`
and Git whitespace clean. New exact-head focused GitHub Actions and full
protected quality are required, and any failed mandatory Combat step keeps
this branch in draft.

## Explicit nonclaims / release blockers

- Independent QUIC **connections on one loopback host** are not four
  separately operated machines or four actual Chrome/Firefox browsers.
- This test does not measure WAN loss/jitter/RTT, render synchronized player
  animation, complete combat, death, respawn, sword pickup, or ownership.
- Each client verifies **its own** server-replicated displacement; the
  initial baselines show peers present, but this does not prove
  continuous *peer-to-peer visual* visibility during motion.
- The 16 geometrically permitted World/Blacksmith routes and negative
  through-wall static rays in #527 are source/test fixtures, **not**
  demonstrated four-player actual routes or an authoritative pickup
  permission.
- Static collision is **loopback-only** as an intentional P0 safety
  restriction. Do not widen to private, wildcard or public binds without
  Development Center/network-owner approval and explicit staged release
  requirements.
- Actual Blacksmith pickup still needs authoritative actor/item ID,
  agreed distance/LOS, current zone/worker epoch, exclusive durable item
  commit, observer replication and correlated ACK.
- Parent #527's full protected quality failed genuine **M158 simultaneous
  FFA knockdown arbitration**; preserve the failure and resolve with Combat.
  A green focused QUIC test does not override the protected gate.

**Owners:** 8A owns transport, 8C world/collision/replication,
Combat controls and damage/death semantics, World authored solids,
Items/8B physical swords and exclusive ownership; Main Development &
Deployment Orchestrator #360 owns integration and deployment.

**Readiness:** IMPLEMENTED + TESTED (four simultaneous loopback QUIC
movers), **not** INTEGRATION-READY, INTEGRATED or PLAYABLE.
