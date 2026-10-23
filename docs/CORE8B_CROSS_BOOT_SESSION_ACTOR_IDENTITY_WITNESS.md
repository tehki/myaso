# Core 8B — P0 original experimental session binding: cross-boot negative witness

**Owner boundary:** Core8B session identity / Core8A post-auth admission / Core8C same-lock
World owner + actor incarnation. **NO live session identity or public ingress created.**
This review-only test is a direct child of Core8 experimental #841 (which is itself
loopback-only, OFF by default, and not authorized as a production protocol).

## Observed source behavior and negative proof

`server/src/main.rs` initializes `SharedGame.next_player_id` and
`SharedGame.next_lease_epoch` to `1` with process-local `AtomicU32` / `AtomicU64`.
`server/src/simulation.rs` separately initializes process-global
`NEXT_GESTURE_WORLD_INSTANCE=1` and per-`World` `next_world_incarnation=1`.
The existing `SessionGestureWorldPath::from_admitted_world` stores exactly
`ServerActorBinding {player_id, lease_epoch, world_instance, incarnation}`.
This binding is correctly guarded while the *current* same-process World is
held under its lock, but these numeric components do **not** prove boot identity.

`prealpha_cross_boot_actor_identity` **runs two independent fresh OS Rust
processes**, each constructing the actual source `World` and actual
`SessionGestureWorldPath` with the first assigned fighter and local lease.
Both independently report `1:1:1:1`. This is a **reproducible reissuance of
identical numerical server-owned binding after restarting the process**,
not a demonstration that an old QUIC connection survives a restart, and not
proof a remote user can forge a packet/choose the actor. Genuine QUIC stream
transport remains session-local; this test does not open the network.

**Required P0 before declaring authenticated v2 in live Pre-Alpha:**

1. Generate one unpredictable CSPRNG boot incarnation on every new server boot
   and retain it in trusted server memory, never derive it from current time,
   PID, initial counters, client-supplied bytes, transport `stable_id`, or
   MYCH's non-cryptographic FNV checksum. Fail closed if CSPRNG unavailable.
2. Issue a fresh nonzero, checked/no-wrap admission lease generation and bind
   **boot incarnation + generation + current actual authorized QUIC seat**
   to each server actor. A bare connection or `player_id: u32` alone is not
   sufficient authentication. After crash/restart all prior ephemeral leases
   must fail regardless of reproduced local numbers.
3. Core8A supplies game-seat authorization and explicit post-auth
   `0x11`/`0x12` negotiation; Core8C must check the lease's current boot and
   session generation together with World/zone owner epoch and actor incarnation
   **inside the same mutation lock** that actually applies Combat intent.
   Reject old boot, expired session, stale RELEASE/ACK, foreign actor and
   World replacement; never claim transport ACK is actual HP damage.
4. The current #841 grants only loopback negotiated source0; KeyE source1,
   authenticated principal binding, public v2, full real 2–4-human-host
   acceptance and Main-exclusive cutover are NOT finished. Stable persistent
   CharacterId requires a separate trusted account and durable generation CAS
   before reconnect, as explained in 8B #835; no P1 inventory prerequisite
   for anonymous ephemeral Pre-Alpha.

This test intentionally does NOT mutate the original v1 arena/Combat timing,
reliable input packets, packets' lengths, WebTransport server, World, source
codec, CI gates, or code paths. A process-local uniqueness test is inadequate
for cross-boot authority; a deliberately fresh process pair catches the gap.
See Core #405, Department 8 #723, Main #360, Combat #696 and P0 #748.
