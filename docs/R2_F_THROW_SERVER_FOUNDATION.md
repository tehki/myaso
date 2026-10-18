# R2 F Throw — Server Projectile Foundation

Status: server-side foundation only. F input, replication, real combat damage, weaponless attack denial and public gameplay are NOT wired.

Implements a bounded projectile state: 30-second disarm timer, 15-minute lifetime, swept world boundary and AABB/fighter collisions, and directional kick reflection with ownership transfer. Supports at most 256 active projectiles; no reflection lifetime extension.

Tests cover rearm, expiry, swept collision, reflection and invalid input.

To finish: authenticate real F, integrate into authoritative World and weaponless attacks, replicate flight/equip state, define solid obstacle geometry, complete Chrome/Firefox public PvP/latency acceptance and verify rollback.

Tracking: https://github.com/tehki/myaso/issues/316

## 18 October integration checkpoint

Real KeyF now sets a dedicated reserved-bit throw request in the unchanged
34-byte input header, replicated on three consecutive input packets. The
server accepts it only after authenticated player connection ingress and a
fresh input packet, and uses server-accepted fighter location/facing. A separate
server clock owns 30s rearm and 15m projectile collision/expiry; fighter World
transitions reject sword combat when disarmed and translate projectile fighter
hits to authoritative 34 HP combat events. Unit tests cover header encoding
and World damage/disarm. **Not playable or deployable:** this branch still needs
position/disarm snapshot replication to all clients, browser flight rendering,
solid in-map obstacles, and two-client native PvP reflection and WAN proof.

## Network render implementation (still draft)

The game server also sends a separate <=1100-byte bounded nearby thrown-weapon
snapshot every 50ms after realtime readiness, without changing the old fighter
snapshot or 34-byte input packet. Each packet carries up to 40 projectile
positions/angles/lifetimes, up to 24 nearby disarmed actors, and the viewer's
own millisecond rearm countdown. The browser validates sizes, ignores stale
server ticks, renders flying sword sprites, suppresses weapon-held sprites while
disarmed, and shows the rearm countdown. Existing unknown packet handlers remain
compatible because the packet uses its own type code 6.

**Next gate remains genuine Chrome+Firefox two-player throw/reflection/damage
proof** plus complete Rust Clippy/unit and old combat suites. No production
activation or merge until the stacked parent and this draft are green.
