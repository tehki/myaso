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

## P2 follow-up — Inactive projected renderer and local-only visual lab (2026-10-20)

P2 extends the **same unmerged draft** with `src/browser/magic-particle-renderer.mjs`: five shape/color languages (fire ember, ice diamond, lightning shard, wind arc, arcane ring), world-coordinate camera projection matching `projectArenaPoint`, zoom scaling, exact viewport rejection and a pooled no-GC draw path. The renderer creates no gameplay/world state.

`web/online-game.mjs` imports the pool and drawing adapter, but `PHYSICS_PARTICLES_ENABLED = false` is a hard-coded, fail-closed gate. No query parameter, click, untrusted event, spell command, reliable packet or server mutation can enable it. If eventually enabled by reviewed source code, rendering occurs after arena zoom restore and before vitals/threat HUD; backgrounding clears transient particles. **There is currently no event source connected to the combat client.**

`web/physics-particles-preview.html` and `web/physics-particles-preview.mjs` provide an explicitly **non-playable, offline-only visual lab** for designers. Local pointer presses create ephemeral cosmetic events, buttons switch the five visual styles and a quality selector exercises budget scaling. This lab has no network calls, account access, spell activation, hit detection or authority. It is not linked from the game's main page. Reviewers may start the normal repository-local HTTP server and open `/web/physics-particles-preview.html` to inspect it without entering the playable build.

`tests/magic-particle-renderer.test.mjs` verifies exact alignment with existing camera projection, distinct shapes, frame context restoration on error, malformed visual culling, fail-closed viewport rejection and a stress fixture of 512 attempted cosmetic effects bounded to 64 active low-quality particles. These tests are included in existing protected `browser-runtime.test.mjs`, without editing CI workflow policy.

**Validation remains outstanding on the final exact PR head:** protected `quality` (including Rust fmt/check/clippy/tests and real browser acceptance). No deployment, PR merge, production enablement or playable build launch in this milestone.

### After P2

The next review boundary is a strictly versioned *server-to-client-only* semantic effect event envelope, interest gating, replay/expiry tests and magic authoritative caster validation. Do not turn visual events into trusted hit/collision data, and do not merge with unmerged Magic & Items or NPC geometry implementations without a separate integration pass.
