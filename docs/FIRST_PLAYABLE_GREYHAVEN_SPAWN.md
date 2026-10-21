# First Playable Alpha — optional server-owned Greyhaven spawn fixture (Core 8C)

**P0, staging-only, OFF by default.** Branches directly from the current
`main` baseline, independent of dormant C4a–C4h PostgreSQL, C2 identity,
multi-zone handoffs, physical items or experimental World implementation.
Main Development Center [#480](https://github.com/tehki/myaso/issues/480)
coordinates adoption, acceptance, staging and rollback.

## Why this small change exists

`server/src/simulation.rs` already has a single shared authoritative 8192²
`World` running 60 Hz; however, default `World::add_player` places
connection-scoped players near the world origin. World Department's authored
Moonvale map (draft [#336](https://github.com/tehki/myaso/pull/336), iterated
under [#478](https://github.com/tehki/myaso/pull/478)) positions the public
Greyhaven test area around **(4110, 4160)**. Without deliberate admission
alignment, the browser can render that map while server players spawn far away
from it. This is a testable **shared-world spawn-contract mismatch**, not
evidence of bad networking.

## Operator-controlled configuration (NO default behavior change)

| Setting | Result |
| --- | --- |
| `MYASO_ALPHA_SPAWN` unset | Existing `World::add_player` default, unchanged |
| `MYASO_ALPHA_SPAWN=greyhaven` AND `MYASO_MAX_PLAYERS=2..4` | 2–4 real players admitted at server-controlled public-area slots |
| Unknown spawn value, missing explicit 2–4 cap, or synthetic background players | Startup rejected with an error |
| `MYASO_ALPHA_SPAWN=greyhaven` on a public/unspecified `MYASO_BIND` (`0.0.0.0`, `::`, public IP) | Rejected **before WebTransport binds**; require an explicit private LAN or loopback IP |

The staging slots, in priority order, are `(4110,4160)`,
`(4206,4160)`, `(4110,4256)`, `(4206,4256)`. Each is 96 units
apart. On reconnect a new server-issued fighter ID receives the first
unoccupied safe slot, not an arbitrary coordinate based on a monotonic
connection counter. A candidate within 44 units of any current server
fighter **or any still-connected fighter's immutable respawn anchor**
fails closed; an existing fighter cannot walk away and accidentally give
its future respawn position to a new player. Slots are freed only after
authoritative player removal/disconnect. Admission rejects if no safe
slot is available.

These four coordinates have been checked with the **original** authored
`isAuthoredPreviewWalkable("moonvale-overworld", x, y, 18)` in exact World
D19 head `59a5a45a4b2ccca8f3dd53f8f8289aff8f4df92d`: all four
returned `true`. **That is a local/preview geometry check only**,
not authoritative obstacle validation.

## Scope boundaries and governance

- Does **not** modify `World` combat or movement logic, hit/roll/parry
  timings, input/ACK/snapshot protocol, Rust zone permissions, client geometry,
  persistent login or crash recovery. Existing default tests remain unchanged.
- Does **not** enable `zone.rs` B1 portals, per-zone replication/collision,
  Red Lion transitions, or world item/currency systems. All clients still use
  one server-controlled shared `World` and server-assigned fighter identities.
- Does **not** read map/spawn coordinates from any client packet, localStorage,
  query string or browser-controlled manifest.
- No real multiplayer collision for Greyhaven walls, buildings, river,
  bridges or indoor tavern furniture exists as part of this change.
  **Do not claim the authored World is collision-valid/playable merely
  because the spawn location aligns with its preview.**
- Operator must explicitly opt in on an isolated reviewed staging server,
  with exact-SHA binaries and two real browsers on independent hosts.
  Do not touch production network rules or deploy without the coordinator's
  separate GO. Rollback is simply removing `MYASO_ALPHA_SPAWN` and
  restarting the *approved staging instance* using its pinned build.
- If the World-owned authored spawn or collision geometry changes,
  revalidate both the four fixed slots and their diameter clearance;
  do not silently move the server spawn to match a client preview.

## Acceptance obligations before integration

1. Exact-head Rust format, Clippy/unit/integration and full native
   Chrome/Firefox Combat CI remain strict; none may be skipped to merge.
2. Unit tests verify default unchanged, unknown config rejected, strict
   2–4 real-player cap, 4 distinct server-side positions, disconnect/rejoin
   free-slot reuse, preservation of reserved spawn after owner movement,
   private-only listener check before socket bind, duplicate/zero ID rejection
   and slot congestion denial.
3. Independently operated two-host WebTransport Chrome and Firefox join
   the exact pinned staging process with the explicit flag and 2–4 cap.
   Server-assigned IDs must move/fight, die, respawn, disconnect and rejoin
   without ghosts or teleport divergence. Browser preview collision is
   NOT a substitute for actual server obstacle acceptance.
4. World/Core agree the **one-area** authoritative obstacle/spawn contract;
   until a server-side collision adapter passes shared authority tests,
   classify the authored town as a visual preview only.
5. Development Center controls PR sequencing, staging release and rollback;
   no automatic merge to main, no production restart or server credential
   distribution.

**Readiness: IMPLEMENTED, awaiting isolated exact-head quality and
independent-machine integration evidence. Not automatically INTEGRATION-READY,
INTEGRATED or PLAYABLE.**
