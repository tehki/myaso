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
Tests in `server/src/main.rs` prove the profile refuses public/private
LAN and wildcard listener hosts, missing spawn mode, overcap, synthetic
background or unknown string; all checks are pre-bind. Rust simulation
tests prove actual wall/gate/sweep/knockback/respawn behavior.

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
