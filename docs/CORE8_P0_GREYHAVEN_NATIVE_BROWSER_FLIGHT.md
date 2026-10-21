# Core 8 P0 — Four genuine browsers joined to one Greyhaven authoritative server

**Department:** 8A Networking + 8C World Runtime; **integration parent:** [draft #560](https://github.com/tehki/myaso/pull/560). **Status:** opt-in test-only candidate, not a live playable city release.

## Precisely what this test adds

The existing M1 four-native-browser flight on parent #560 proves native Chrome/Firefox clients, authoritative scoreboard/identity, browser-origin keyboard movement, mutual replication, sudden Firefox process-group SIGKILL, ghost cleanup, new Firefox admission and peer-visible motion. However, that flight **starts the default arena server**, whereas Core 8C's separate four-QUIC routes/collisions test starts the explicitly staged Greyhaven world. These two proofs were not previously exercised together in four real browsers.

An explicit test-runner-only environment variable `MYASO_ALPHA_BROWSER_GREYHAVEN=reviewed-static-only` now selects existing Core 8C's already-reviewed **loopback-only** server environment: `MYASO_ALPHA_SPAWN=greyhaven`, `MYASO_ALPHA_STATIC_COLLISION=reviewed-static-only`, `MYASO_MAX_PLAYERS=4`, `MYASO_BIND=127.0.0.1:0` and zero synthetic players. The harness refuses any other nonempty value, refuses silent inheritance of those staging flags in its default flight, and requires the **real server's pre-bind startup evidence** explicitly announcing both Greyhaven and the reviewed static sweep.

On four independently running native W3C browsers (two Chrome + two Firefox), the test asserts server-origin initial replicated positions for all four **in each browser**:

| Identity | Server-owned spawn (world units) |
|---|---|
| Player #1 | (4110, 4160) |
| Player #2 | (4206, 4160) |
| Player #3 | (4110, 4256) |
| Player #4 | (4206, 4256) |

It preserves original genuine keyboard movement + all-peer replication and the sudden real Firefox browser process-group crash, and additionally requires the new real Firefox #5 to occupy **the released original player-2 Greyhaven spawn** (4206, 4160), not an invented client-selected location. The original baseline runner remains available unchanged **by default**, including its exact Combat-native flight assertions.

## CI

Additive `.github/workflows/core8-p0-native-greyhaven-browser.yml`: checks syntax/invalid-mode rejection, native WebDriver dependencies, builds the real server, launches the entire 4-browser flight in the explicitly isolated Greyhaven staging profile, and retains actual WebDriver PNGs if allowed. Does not touch `quality` or disable any existing Core/Combat/browser checks.

Success log: `ALPHA_8C_FOUR_NATIVE_GREYHAVEN_BROWSER_PASS`, emitted **only after** four server-selected browser-visible spawn proofs, Chrome/Firefox movement replication, abrupt browser crash/ghost cleanup and correct replacement-slot reuse.

## Limitations, mandatory next gates

- The staging server and four browsers all operate on one CI host through loopback; this does NOT prove two independent client machines or an approved third staging server.
- The current test opens the game's **existing isolated acceptance-scenario arena presentation**, which exposes verified on-wire fighter positions. It **does not** assert that the authored Greyhaven terrain/assets were drawn in each browser, nor that all four walked the entire way to Blacksmith on native controls. The Rust four-QUIC server test separately exercises the original Blacksmith approach routes. A future combined native rendered-city/approach test remains P0.
- Collision is only the explicitly reviewed static set of 23 AABBs, **not** authoritative river, bridge, doors, moving obstacles or current full completed-tick pickup LOS.
- No physical sword click, trusted canonical sword ID, active `TryPickup`, durable rack→MainHand ownership writer, committed observer replication, weapon/fists combat, death/drop or authenticated same-person reconnect. Core 8B, Items 2B, Physics 6, World 9, Graphics/UI and Combat must still complete those owner gates.
- No production TLS/binds/firewall, worker-zone/SQL, gameplay rule or release configuration changes. Do not independently merge into `main` or deploy. Central Main Orchestrator controls branch sequencing and rollback.

**Release readiness:** genuine native-client Greyhaven server admission test candidate, not First Playable Alpha.
