# Core 8C — PlayCanvas and the original Rust Greyhaven World

**Source-only / isolated loopback / READ-ONLY / RELEASE HOLD.** This is the Core 8C handoff for Main0 #1151 and Core8C #1154. It does not authorize deployment, a public endpoint, new QUIC protocol, gameplay inputs or a change to the live original Rust server.

## Exact source scope

- PlayCanvas parent: Main0 Draft #1152 at `a3146e942970e5b80dc9b200385cb993f0879105`, directly based on canonical P0 `88c4733c90199ab3cabf7bc85ebb58d2f8760c58`.
- Independently launched Rust source: Core8C Greyhaven Draft #1150 at `7af45b1b748f8d0d77fae8443a7bf148ea628ba4`, on the original 60 Hz Rust World.
- Rust executable from this reviewed source: SHA-256 `bba52a2594e475b2a0b8c568c613a5a1f78ef3761906c460353be96fe08a8525` as captured in isolated native execution. This is **not a production binary**.
- No edits to `web/`, `server/`, packet layouts, identity/lease code, Combat, Chat C1, or protected `main`.

## Independently established map authority — **NOT** from PlayCanvas

The original Rust server was launched as a separate nonproduction process with an ephemeral `MYASO_BIND=127.0.0.1:0`, `MYASO_MAX_PLAYERS=2`, no synthetic flight actors, and the **server-owned** `MYASO_WORLD9_GREYHAVEN_ALPHA=1` flag. The native harness builds the exact requested Rust SHA, checks geometry manifest parity, records its binary SHA-256, PID, server-generated loopback port and ephemeral test certificate SHA-256, and supplies that pin to Vite's existing `?rust=1` dev-only bridge. It never connects to production, passes a map parameter to Rust, or invents a map handshake.

The same Rust server flag enables **both** World9's authoritative free-spawn admission and Physics6's `World::enable_greyhaven_static_collisions()` before accepting players. Failure to enable the reviewed static solids fails startup. Operator-side launch identity plus the known source is therefore scoped evidence for the isolated test server's Greyhaven mode. It is **not** a browser-verifiable or cryptographically server-signed Greyhaven map/zone token; current wire snapshots have **none**. Neither 8192² bounds, coordinates near Greyhaven, a URL query string, nor render transforms establish map authority.

World9 has four original Rust spawn anchors: (4110,4160), (4206,4160), (4110,4256), (4206,4256). The source-owned actor radius is 18. The original World reserves each actor's spawn across death/respawn and Core8C rejects a new admission overlapping another live fighter or an invalid World size. Rust source-generated geometry includes **23 known** static building/wall AABBs, layout `moonvale-greyhaven-v10-solids-v1`, SHA256 `9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43`. It is incomplete: river, dynamic doors/actors and future rebuilt building footprints are NOT covered.

PlayCanvas projection is presentation only: `((x-4140)*0.025, 0, (y-4105)*0.025)`. The exact origin (4140,4105) comes from the authored World9 map city center. The original packet codec, authoritative snapshot store, WebTransport session, and read-only actor layer remain unchanged.

## Real native Chromium ↔ PlayCanvas ↔ original Rust evidence

Captured from the isolated original Rust test process at the exact source above:
- The **first** Chrome PlayCanvas client connected over actual WebTransport, rendered Rust-assigned **NetID #1**, position **(4110,4160)**, server HP 100, facing 0. No client player identity was fabricated (`ownNetId=null`).
- When a **second** Chrome PlayCanvas client joined, its initial full reliable snapshot contained original Rust **NetIDs #1 and #2**, positions **(4110,4160)** and **(4206,4160)**, HP 100 each. Both actual PlayCanvas WebGL2 browser sessions booted and had original QUIC transport.
- **Genuine first-RED / BLOCKER:** the first client's view stayed at its old reliable snapshot (observed tick 242, one actor) while the second client's initial snapshot advanced to tick 538 (two actors). Both individually reported `connected`, but continuous same-World replication was **not** proven. Local forensic log: `/home/serj/Work/myaso-core8c-playcanvas-native3.log`. This failure must remain strict and repeatable; do not relabel it PASS.

**Root cause verified in the original Rust source, not guessed from PlayCanvas:** `server/src/main.rs` begins a QUIC connection with `realtime_ready=false`, sends one initial reliable baseline, and only switches to periodic realtime snapshots when `advance_snapshot_ack` observes the matching baseline sequence from an accepted original input packet. The PlayCanvas adapter correctly calls **no `sendInput`**; consequently, an idle read-only connection does not enable ongoing realtime snapshots. Sending synthetic/neutral gameplay samples to bypass this would violate the current read-only requirement. Core8A/Main0 must separately approve a safe original-server read-only snapshot bootstrap/resync mechanism before this acceptance can pass. Do not silently change the wire protocol.

## Death, same-session respawn and reconnection: independent scope

The original Rust World on the same donor source **does** pass its pre-existing Rust tests `death_is_temporary_and_respawns_at_the_spawn_point`, `original_world_death_respawn_stales_old_held_lmb_lease`, and `genuine_combat_death_and_respawn_revoke_prior_actor_session_authority` (filtered all-target Rust run, exit 0). Rust `simulation.rs` reserves `spawn_x/y`, restores HP/guard/stamina in `respawn_fighter` after authoritative death timer, and mints a fresh `world_incarnation`. These are original Rust **domain** proofs, not live PlayCanvas respawns.

The read-only PlayCanvas view has a **canonical codec regression fixture** for original full snapshots showing Alive → Dead → Alive under the *same NetID* and a genuine authoritative removal followed by a *different NetID* join, with no local resurrection, local health allocation, teleport or fabricated movement. That fixture proves projection behavior, **not** actual network lifecycle. Current snapshot records do not carry `world_incarnation`; PlayCanvas cannot independently attest same-session incarnation. The original client only learns its own player NetID from a processed input ACK, which this read-only test deliberately does not send.

Full original Rust two-physical-host gameplay, real PlayCanvas three-respawn lifecycle, actual client-removal propagation, Combat Light34/Heavy46 HIT/HP, Chat C1, active-current-map dynamic geometry and reconnect/lease fencing are **not qualified** by this bridge.

## Reproduce the strict nonproduction test

With the isolated original Rust Greyhaven #1150 donor source available, from `client/playcanvas/` run:

```sh
npm ci
npm test
MYASO_CORE8C_GREYHAVEN_SRC=/path/to/isolated-greyhaven-rust-source \
MYASO_CORE8C_EXPECTED_SHA=7af45b1b748f8d0d77fae8443a7bf148ea628ba4 \
npm run smoke:rust-world:core8c
```

The opt-in native script builds only that Rust source, checks the 23-solid parity, starts an isolated loopback Rust QUIC process and local Vite, captures server-generated certificate pin (never a production pin), connects real Chrome W3C sessions, tests actual server actors/positions and attempts ongoing snapshots, deletion and rejoin **without any gameplay input**. It writes `.artifacts/core8c-rust-readonly/core8c-original-rust-first-red.json` upon a two-seat failure and cleans up its own processes. The native command is **expected to fail strictly** until the original read-only snapshot bootstrap is separately resolved.

**Verdict:** original Rust/PlayCanvas initial reliable snapshot and isolated Greyhaven **operator-side** map authority **PASS_SCOPED**. Continuous read-only replication / same-session PlayCanvas respawn **BLOCKED**; public multiplayer/Combat/Chat **HOLD**. No source merge, deployment, public activation or gate waiver.


## Independent follow-up — Core8A passive reliable-snapshot trial (2026-11-01)

**Scope warning:** The first-RED and default-server HOLD above remain historically valid for published Greyhaven #1150. Core8A is independently reviewing a minimal original-server reliable snapshot change. To test it without taking ownership of 8A's server lane, Core8C created **one LOCAL, unpushed, isolated** test commit `d7456a0c0df3a033bab2bf6e0587cea45e288bfd` on exact #1150, with only the same existing `server/src/main.rs` bounded reliable catchup condition extended to `!realtime_ready || should_enqueue_reliable_catchup(...)`. The 60-tick reliable cooldown, existing frame codec, game lease and original WebTransport remain unchanged. **No Main0 signoff is implied.** Original trial executable SHA-256: `3ea902c44348d6610f0b773f6af800596197aa32ef5b0fa19a1e7f0c1f5b8b76`.

### Two genuine INPUT-FREE PlayCanvas browsers — PASS_SCOPED on local trial only

Core8C reran the committed strict `scripts/core8c-rust-readonly-live.mjs` against the isolated trial binary and its own short-lived loopback development cert:

| Event | Original Rust / PlayCanvas observation |
|---|---|
| First PlayCanvas browser | actor #1 (4110,4160), HP100, reliable tick223, 1 snapshot |
| Second PlayCanvas browser | #1 (4110,4160) and #2 (4206,4160); HP100; snapshot tick499 |
| First viewer after peer joined | BOTH actors, 6 genuine snapshots at server tick525 |
| Peer root closes | remaining viewer sees only #1, 8 genuine snapshots at tick645 |
| New separate root enters | newly server-issued #3 at (4206,4160) and original #1; remaining viewer has 13 snapshots at tick945 |

Both actual PlayCanvas Chromium WebGL2 instances used the parent bridge, **`ownNetId=null` and zero `sendInput`**. Positions, tick, HP, membership and removal came from the original Rust reliable stream. Test evidence is retained locally at `/home/serj/Work/myaso-core8c-passive-greyhaven-real-readonly-retry-20261101.log`, `client/playcanvas/.artifacts/core8c-rust-readonly/core8c-readonly-live.json` and an actual browser PNG (SHA256 `5482bb6abb2fa9de2fb9ccbb1510e73a330e8ad3ba728f356491d40d2633849f`).

The first provisional passive run reached both actors but failed the removal gate when the test destroyed a ChromeDriver window without explicitly closing its QUIC root first. The harness now calls existing read-only `devRustSession.close()`, asserts the transport closed, then deletes the WebDriver session. That is faithful client retirement, not a simulated actor removal or softened acceptance. Original first-RED logs remain retained.

### Genuine SAME-SESSION combat death and read-only resurrection — PASS_SCOPED on local trial

An additional independent **temporary, non-committed test driver**, derived from Core8A's existing `authoritative-quic-smoke.mjs`, exercised **two real PlayCanvas Chromium browser sessions** using the original authenticated `connectAuthoritativeClient.sendInput` test API. It did **not** modify `web/`, `server/`, actor positions, combat state or client-side HP. This is an *active authentic-input control*, separate from the input-free spectator.

Server-owned target **NetID #2** took three actual Light34 HITs: `100 → 66 → 32 → 0 HP`, then original `World::respawn_fighter` restored `100 HP` at the original `(4206,4160)` spawn on the **same authenticated QUIC root/NetID**. No new actor was minted for this death/respawn. Its real browser-observed server ticks were 891, 933, 975 (damage) and 1023 (respawn). This is live original-World death/respawn, **not** an independent two-physical-host or physical mouse-timing qualification.

**Crucially, the genuine input-free PlayCanvas spectator independently observed both death and resurrection** over the original reliable snapshot stream, without sending any gameplay packets or fabricated ACK:

| Passive original Rust snapshot | Death | Later respawn |
|---|---:|---:|
| NetID | 2 | 2 |
| HP | 0 | 100 |
| Action code | 8 (Dead) | 0 (Idle) |
| X,Y | (4322,4160) | (4206,4160) |
| Original server tick | 954 | 1074 |

The spectator reached five reliable snapshots and still had `ownNetId=null`. Both the active target and passive actor view kept the same server-owned NetID #2 across this life transition. The **world-incarnation epoch is not exposed on the existing snapshot wire**, so client-side epoch attestation remains unavailable even though original Rust tests establish a fresh server-side incarnation. Captured native marker `CORE8C_PASSIVE_RUST_WORLD9_RESPAWN_PASS` and active marker `CORE8C_REAL_RUST_WORLD9_RESPAWN_PASS` in the local, immutable-in-this-run `/home/serj/Work/myaso-core8c-greyhaven-passive-death-respawn-native-20261101.log`.

### Acceptance boundary / release

- PASS_SCOPED: independent original Rust Greyhaven map operator gate, two real input-free PlayCanvas viewers' continuous reliable snapshots, live actor join/removal/rejoin, and same-NetID death/respawn observed from the server in both active and passive browser paths.
- NOT QUALIFIED: a **published** Core8A+World9 exact-source combination with protected CI and independent 8A/4D signoff; Firefox parity; multi-physical-host WebTransport; map/zone signed token or incarnation on client wire; three same-session death cycles; Combat4D physical timing/M140/Firefox Space+LMB; Chat C1; full Greyhaven river/dynamic collision or editor geometry signoff.
- Main0/#1151 and Core8A/#1153/#1155 own review, publication and integration of the server-side reliable catchup. This PR changes only isolated PlayCanvas test/docs, never `server/` or `web/`.

**Current conclusion:** local trial verifies continuous genuine read-only Greyhaven and one real respawn, but **RELEASE HOLD** remains until Core8A source review, exact-head CI and full original gameplay qualification.
