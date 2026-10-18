# R2 F Throw — Server Projectile Foundation

Status: server-side foundation only. F input, replication, real combat damage, weaponless attack denial and public gameplay are NOT wired.

Implements a bounded projectile state: 30-second disarm timer, 15-minute lifetime, swept world boundary and AABB/fighter collisions, and directional kick reflection with ownership transfer. Supports at most 256 active projectiles; no reflection lifetime extension.

Tests cover rearm, expiry, swept collision, reflection and invalid input.

To finish: authenticate real F, integrate into authoritative World and weaponless attacks, replicate flight/equip state, define solid obstacle geometry, complete Chrome/Firefox public PvP/latency acceptance and verify rollback.

Tracking: https://github.com/tehki/myaso/issues/316
