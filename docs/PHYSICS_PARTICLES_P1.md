# P1 — Living Physics & Elemental Particles (inactive foundation)

## Status and ownership

This is an **independent, draft-only Physics & Particles workstream** for Moon Games / myaso.io. P1 is a foundation, **not activated gameplay**. Do not conflate it with Combat PR #351, NPC PR #353, Magic & Items PR #354, Graphics PR #350 or Sound PR #355. No merge, production deployment, spell casting, or server protocol changes are authorized by this slice.

Repository source, tests and design documentation are intentional `DURABLE_PROJECT_ARTIFACT` data. The JS pool is ephemeral in-memory cosmetic state, resettable with `clear()`; it does not log, serialize, store or transmit any world or player data.

## Architectural invariants

1. **Gameplay authority stays in Rust.** Knockback, damage, mana, reagents, loot, status, hit detection and world collisions cannot be inferred from local particle positions. No new client-command surface is introduced.
2. **No particle simulation on the server.** Future approved spell events will carry semantic effect kind, authoritative origin, tick and a server-chosen seed; the client independently expands visuals.
3. **Interest first.** Future replication uses zone and viewer-interest filtering before any event leaves the server. The provided client pool independently rejects offscreen events.
4. **No physics for distant idle props.** Persistent/lootable world entities are server records; only approved active entities may receive collision-authoritative movement, with sleeping/inactive entities cheaper.
5. **Deterministic seeds.** No Math.random usage, background jobs, timers or per-particle network packets.
6. **Graphics are optional.** Low, medium and high particle budgets change presentation only. Gameplay telegraphs and accessibility remain independently reliable.
7. **Collision must precede motion.** The server kernel only **proposes** a radial displacement; the integration must sweep it through trusted map/door colliders rather than teleporting through walls.

## Implemented in P1

### Inactive server radial impulse proposal

`server/src/elemental_physics.rs` defines an internal trusted `AuthoritativeImpulse` with five semantic elements (fire, ice, lightning, wind, arcane), target data and a pure `radial_impulse()`. The function validates finite, bounded geometry and matches zone ownership before returning a deterministic displacement proposal. Nonmobile entities, mismatched zones, invalid inputs and out-of-range targets get no displacement.

Maximum radius is 512 world units, maximum displacement 64 units, maximum target radius 128 units. Coincident locations use a stable seed/entity-ID cardinal fallback. This does **not** apply damage, write fighter/world state, move items, sweep obstacles, authenticate a caster or activate spells. Constants are protective interim bounds, not final balancing.

### Client cosmetic particle pool

`src/browser/magic-particle-pool.mjs` preallocates typed-array slots and offers:

- `emit({kind, x, y, seed, intensity}, {x, y, radius})`: validates event/view and spawns seeded particles only near the viewer. Invalid inputs fail closed.
- `advance(elapsedMs)`: advances visuals and expires particles after background tab pauses.
- `forEachVisible(view, draw)`: visits only visible active particles, passing world x/y, normalized remaining lifetime and semantic kind; does not own a renderer.
- `setQuality("low"|"medium"|"high")`: adjusts spawn limits and removes excess cosmetic particles immediately.
- `clear()` and `metrics()`: release/reset transient state and expose aggregated counts (no player/world payload).

| Preset | Max active | Spawn per effect |
| --- | ---: | ---: |
| low | 64 | 8 |
| medium | 192 | 16 |
| high | 384 | 32 |

Actual active maximum is min(preset, configured capacity). Incoming cosmetic work is dropped on saturation; never backpressured into gameplay. Pool uses bounded storage, no third-party dependencies and no canvas coupling. Particle lifetime and speed are **visual design defaults**, not spell tuning.

## Validation and acceptance

- `node --test tests/magic-particle-pool.test.mjs` for reproducibility, saturation, event validation, culling, quality scaling and lifetime expiry.
- `cd server && cargo fmt --check && cargo test --locked && cargo clippy --all-targets -- -D warnings` for the isolated Rust kernel and existing simulation.
- The protected repository `quality` CI, including real multi-browser gameplay regression, must pass on the **exact PR head** before merge.
- No approval to open the playable build, modify the server transport or deploy is implied.

## Follow-up integration milestones (not implemented)

1. Bind the JS pool to the existing arena Canvas renderer behind an off-by-default flag, proving visibility/camera transforms and cost under 512-player stress.
2. Define a versioned **server-to-client only** semantic magic effect packet with strict caps, zone interest filtering, event deduplication and sequence/tick expiry. Wire to authoritative validated casts (runes, reagent consumption, mana, cooldown).
3. Sweep the Rust impulse proposals through the NPC/Combat approved, revision-pinned, server-owned collision manifest; resolve one movement outcome per tick and verify walls, zones and player authority.
4. Build fire/ice/wind/lightning interaction rules as bounded server state cells, with hard caps and expiry. Avoid per-particle gameplay effects.
5. Prove frame time, network bytes, denial-of-service limits, reconnect behavior and consistent gameplay telegraphs on low graphics quality. Publish evidence before enabling in crowded realms.

## Rollback

The branch is isolated. Drop the P1 PR without a merge to revert all changes. If eventually merged but inactive, revert the P1 commit(s); no wire/schema migrations or runtime flags require coordinated rollback.
