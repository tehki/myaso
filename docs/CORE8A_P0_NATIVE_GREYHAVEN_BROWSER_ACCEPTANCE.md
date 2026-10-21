# Core 8A P0 — FOUR genuine Chrome/Firefox browsers in server-authoritative Greyhaven

**DRAFT / staging-only native acceptance — not a game release.** Stacked directly on the protected-green cross-department Core 8A + Core 8C integration [#560](https://github.com/tehki/myaso/pull/560), exact parent `bd5848ea44e1159beea8237d47a57bc4d86a1b85`, itself combining the approved source candidates #536/#525/#507/#491/#391 and #549/#532. Main Orchestrator alone owns production merges.

## Missing acceptance closed by this child

The combined parent correctly exercised (a) four genuine Chrome/Firefox browsers on a localhost *generic arena* and (b) four separate real Rust QUIC clients in Greyhaven, but **not four genuine browsers simultaneously receiving the reviewed Greyhaven server-owned spawn positions**. This opt-in runner binds the existing real Rust server to `127.0.0.1:0` with `MYASO_MAX_PLAYERS=4`, `MYASO_ALPHA_SPAWN=greyhaven`, `MYASO_ALPHA_STATIC_COLLISION=reviewed-static-only`, background/synthetic players zero. It asserts the Rust server actually acknowledged Greyhaven/static staging flags and each actual browser sees the exact authenticated server positions:

| Server-assigned player | Reviewed initial x/y |
| --- | --- |
| #1 | 4110, 4160 |
| #2 | 4206, 4160 |
| #3 | 4110, 4256 |
| #4 | 4206, 4256 |

One Chrome player moves **west**, away from the other occupied/respawn anchor; genuine Firefox #4 moves east. The other three genuine browsers each must observe authoritative player movement with current ticks. The runner then **SIGKILLs Firefox #2's OS process group**, proves all three surviving browsers drop the ghost within 38 seconds, starts a **fresh real Firefox process** #5 and requires all four genuine clients to see #5 at the **exact freed Greyhaven #2 spawn (4206,4160)**, and verifies new player #5 movement in each survivor. Existing original legacy/non-Greyhaven scenario remains default when the opt-in flag is absent; an invalid flag value fails closed. No fake fighter state, client-dictated position, relaxed Combat timing or synthetic WebTransport clients.

Dedicated `.github/workflows/core8-p0-native-greyhaven-browsers.yml` builds the exact Rust server, verifies original Core8C geometry, runs the real Chrome/Firefox native test with explicit opt-in and captures screenshots. It does not open nonloopback ingress. This is separate from main protected `quality` and combined #560 acceptance.

## Strict limitations

The real browser game page runs existing source-proven acceptance scenario `uijumpffaprimary`, which supplies read-only authoritative fighter snapshots. It does **NOT** enable or prove the *rendered authored Greyhaven environment* (the client disables fixed-world view when a scenario is set). Therefore this qualifies the **server-owned Greyhaven world coordinates and static collision + native browser replication**, **not** visually rendered city art, real Blacksmith sword rack pixels, click-to-pickup, sword item IDs, canonical inventory/ownership, fist/sword PvP, death/recovery persistence, independent client hosts, high latency, or production.

In particular, opt-in static collision only covers **23 currently approved pinned static obstacles**; dynamic solids/river/revisions remain incomplete. Two-machine flight #536/#557 still needs authorized third private staging server, drivers and UDP path; no firewall/VPN/bind policy changes authorized.

## Evidence requirements

Require **green exact-head focused real-browser workflow** and **unchanged full protected quality** before integration. Browser screenshots support render presence for the generic acceptance game only; no manufactured Greyhaven art evidence. The test emits explicit `ALPHA_P0_FOUR_NATIVE_GREYHAVEN_SPAWN_PASS` and `ALPHA_P0_FOUR_NATIVE_GREYHAVEN_REJOIN_PASS` markers ONLY on authenticated acceptance, plus the inherited four-player movement/ghost-cleanup evidence. Always inspect the exact logs and real server banner. No deployment, merge, server activation or route changes were performed by creating this test.
