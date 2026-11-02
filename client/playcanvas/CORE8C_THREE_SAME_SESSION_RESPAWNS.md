# Core 8C — Three genuine Rust World9 same-session respawns in PlayCanvas

**P0 Alpha Phase A · nonproduction loopback · source-only · RELEASE HOLD**

## What is and is not tested

This is a genuine original Rust 60 Hz World/QUIC/WebTransport test with PlayCanvas 2.23.3 running in actual Chromium WebGL2 browser pages. It is **not** a client combat or respawn implementation. The test's two authenticated browser roots use only the pre-existing original `connectAuthoritativeClient.sendInput` interface. Another separate original PlayCanvas actor-view browser has **no active input**, no processed-input ACK identity, no synthetic neutral heartbeat and no client-driven state changes. Everything shown is delivered in original server-issued snapshot records.

The operator launches the existing, locally built original Rust server binary explicitly via `MYASO_PLAYCANVAS_RUST_BIN`. The test clears inherited MYASO environment variables and starts its own isolated `127.0.0.1:0` QUIC `/game` server with fresh test-only certificate, `MYASO_WORLD9_GREYHAVEN_ALPHA=1`, four-seat cap. The server's existing gate controls the original 8192×8192 Greyhaven map, four spawn anchors, and reviewed Physics6 static collision shapes. The browser URL and presentation transform are NOT map-authority tokens. The server binary must be built from the same exact reviewed source head.

The test uses three separately authenticated original attacker connections (NetIDs **1, 4, 5**) admitted sequentially; the previous attacker root is explicitly closed and observed removed in the surviving active and passive browsers before a new attacker is admitted. The unchanged victim is original **NetID 2 on the SAME original QUIC connection throughout all three deaths and respawns**. A separate read-only spectator observes every original server-driven death/respawn at the exact same NetID.

## Actual independently executed local result

Tested initial combined source HEAD `faaeb8a8a1ea863b2b7e4061fc5f48b74f4ca013`, binary SHA-256 `4be6782769c118db9fc9175915b7babb5b213949549ad5bbe9b6dc075941475d`.

| Cycle | Attacker | Victim | Actual victim HP from original Rust | Death tick (active) | Respawn tick (active) | Read-only death tick | Read-only respawn tick | Read-only reliable snapshots |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | 1 | 2 | 100 → 66 → 32 → 0 → 100 | 969 | 1023 | 948 | 1068 | 5 |
| 2 | 4 | 2 | 100 → 66 → 32 → 0 → 100 | 1326 | 1380 | 1308 | 1428 | 11 |
| 3 | 5 | 2 | 100 → 66 → 32 → 0 → 100 | 1692 | 1746 | 1668 | 1788 | 17 |

Every spectator death snapshot showed `action=8` and `HP=0`; every later respawn showed `action=0`, `HP=100`, `x=4206, y=4160`, all on original server actor NetID 2. The observed death location around (4320–4322,4160) is server-generated knockback, not a client write. All nine hits were original Rust Light34, no fabricated damage or instantaneous resurrection. Spectator's `ownNetId` remained null, **zero** gameplay packets were sent from its actor-view client, and there were no new snapshot types.

Exact native marker: `CORE8C_THREE_GREYHAVEN_SAME_ROOT_RESPAWNS_PASS`. Original Serj test log: `/home/serj/Work/myaso-core8c-three-respawns-combined-20261102.log`, independently preserved. Test script is `scripts/core8c-greyhaven-three-respawns-native.mjs`.

## Run and release controls

From the PlayCanvas directory after independently compiling the exact candidate server:

```sh
MYASO_PLAYCANVAS_RUST_BIN=/absolute/path/to/reviewed/server/target/debug/myaso-server \
  npm run smoke:greyhaven:three-respawns
```

Use an isolated per-test `TMPDIR` on browser hosts if their shared temp quota is tight; do not clean or terminate unrelated tests. The test must fail rather than synthesize the required session identity, HP, death, actor join/removal or respawn. Preserve true first-RED logs. Original client and server are the only sources of authority; no production endpoint is used.

**Not qualified by this test:** two distinct physical hosts/WAN; Firefox's genuine same-session Combat; physical mouse/keyboard Light/Heavy timing, M140 and Space+LMB; Chat C1 focus; three respawns with a *single persistent attacker identity* (victim is persistent but attacker rejoined between cycles); client-verifiable world-incarnation or map/zone authorization token; rebuilt Red Lion/Blacksmith actual static geometry parity, river/dynamic obstacles. The original snapshot wire contains neither explicit map ID nor world-incarnation value. **Main0/Core8A/Combat4D integration and release HOLD remain mandatory.**

No protected-main merge, production change, public activation, protocol downgrade or authorization bypass.
