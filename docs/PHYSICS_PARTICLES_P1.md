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

## P3 follow-up — server collision and bounded elemental fields (2026-10-20)

**All P3 modules remain inactive and server-internal.** The purpose is to establish reviewable physics contracts without touching active combat timing, Magic & Items inventory, NPC paths, world manifests, snapshot formats or network input.

### Revision-pinned collider sweep

`server/src/elemental_collision.rs` implements `clip_radial_impulse` for a P1 `ProposedDisplacement` and a trusted `CollisionWindow` with explicit zone, nonzero revision and a completeness assertion from the server-owned manifest producer. It checks the target identity/zone/mobility, finite bounded geometry, full initial and destination coverage, and up to 64 authoritative static AABB barriers. A swept-circle against an inflated obstacle stops at the earliest contact with a 0.125-unit margin; inside-wall starts stay blocked. It cannot move a player, mutate coordinates or enable spells.

Missing, incomplete, mismatched, over-cap or stale geometry returns no resolution. In particular a client MUST NEVER be able to set `CollisionWindow.complete`, supply a revision, or choose the collider list. The current P3 calculation does **not** certify that the passed window genuinely corresponds to a live Greyhaven chunk; collision-manifest integration is a separate reviewed prerequisite. All collision response is a *proposal*, never a full physical dynamics solver. It intentionally does not slide along walls or cross realm boundaries.

### Server-owned elemental field ledger

`server/src/elemental_fields.rs` introduces `ElementalFieldLedger` keyed to a **strictly increasing trusted server tick**. Fields have nonzero IDs, zone IDs, finite positions, a maximum radius of 128 units, and a lifetime of at most 600 ticks (10 seconds at the current 60Hz authority rate). Each active field has one semantic `Element`. Hard limits: **128 fields globally in the isolated process** and **24 per zone**. Excess is rejected without replacing existing fields. Expiry occurs on `advance(tick)`; no background timer runs.

The server-internal, read-only `sample_at(zone, x, y)` computes overlap masks and a deterministic priority reaction:

| Overlap | Semantic reaction (no active gameplay effect) |
| --- | --- |
| Fire + Ice | Steam |
| Fire + Wind | Flare |
| Ice + Wind | Blizzard |
| Lightning + Arcane | ArcSurge |

These are **event classifications only**, not damage, fire spread, ice friction, lightning chaining or status application. Their actual gameplay semantics require Combat, Magic & Items, World, and Economics review. No persistent effects or ownership changes are implied.

The fixed 128-field cap is intentionally conservative and temporary; it is not proof that a giant realm can share one monolithic field registry. The production follow-up must shard/spatially index by authoritative zone/chunk and provide cost measurements for crowded scenes. Field IDs currently live in-process only; saving/loading and restart-safe uniqueness are NOT implemented.

### P3 acceptance requirements

- Unit tests: movement stops short of obstacles, diagonal no-tunneling, starting-overlap fail closed, border containment, mismatched zone/revision and over-cap denial, deterministic element combination and expiry, realm/zone caps and unchanged input state.
- Exact-head `quality` CI must pass Rust formatting/check/clippy/tests **and** real Chromium/Firefox combat acceptance. No reduction or skipping of existing M194/M144/other gates.
- Previous P2 [quality run #39463504399](https://github.com/tehki/myaso/actions/runs/39463504399) failed **M194 real guard-break block-only pressure**: a genuine third browser exchange parried rather than blocking. Physics changes are hard-disabled, and P3 does not touch that combat path. The Combat department must investigate independently; full PR stays red until authoritative CI is green.
- Do not merge or deploy the draft or expose P3 to client packets. Rollback remains dropping/reverting the isolated physics branch.

## P4 — server-selected semantic FX, interest filtering and replay protection (2026-10-20)

**Transport-agnostic proposal, not a protocol rollout.** `server/src/magic_fx_events.rs` defines an independent, pending server-owned `SemanticEffectBroker` for future spell visuals. It requires the trusted server to strictly advance an authoritative `u64` tick; `admit_trusted(tick, spec)` accepts only finite world coordinates, nonzero zone ID, nonzero visual intensity, and 1–120-tick lifetime. It requires a **separately verified authoritative cast or impact** before the caller may create an effect. The module deliberately has no caster identity verification, mana/reagents, spell activation, or socket call. Those belong to Magic & Items and Core & Multiplayer integration.

### Bounded authority-side work

| Contract | P4 initial limit |
| --- | ---: |
| Pending semantic FX per process | 256 |
| New semantic FX per authoritative tick | 12 |
| Pending FX per zone | 48 |
| Semantic FX returned per viewer poll | 16 |
| Viewer interest radius | 1500 world units |
| Max effect TTL | 120 server ticks |
| Wire encoding | 32 bytes/effect (fixed-size proposal) |

All caps fail closed: a full queue rejects new cosmetic events rather than evicting gameplay data. Expired events are pruned by `advance` without asynchronous work. `interest_snapshot(viewer, after_id, limit)` filters by a *trusted viewer zone and world position* **before** data would be serialized. Wrong-zone events, out-of-interest origins, invalid view geometry, stale IDs and oversized per-viewer batches are withheld. The caller must never derive `viewer.zone_id` or coordinates from an untrusted client payload. This is a bounded scan suitable as a P4 reference; **a 256-element queue is not an accepted region-scale architecture**. A future zone/chunk sharded interest-index and bandwidth measurements are mandatory.

### Explicit, unregistered binary contract

The optional `encode_magic_fx` emits exactly 32 bytes, distinct from existing packet IDs:

| Bytes (zero-based) | Field |
| --- | --- |
| 0–1 | ASCII `ME` marker |
| 2 | Magic FX version = 1 |
| 3 | Element kind (fire 0 / ice 1 / lightning 2 / wind 3 / arcane 4) |
| 4–7 | Server-owned zone ID `u32` little-endian |
| 8–11 | Monotonic event ID `u32` LE |
| 12–15 | Server authoritative tick modulo `2^32` (LE) |
| 16–19 | Server-selected deterministic visual seed `u32` LE |
| 20–23 | World X signed `i32` LE in quarter-units |
| 24–27 | World Y signed `i32` LE in quarter-units |
| 28 | Cosmetic intensity `u8` from 1 to 255 |
| 29 | Event TTL 1–120 server ticks |
| 30–31 | Reserved zeros, MUST reject nonzero |

P4 does **not** add an active `PACKET_TYPE`, alter any live snapshot encoding, send packets, register WebTransport handlers or modify gameplay network budgets. Transport sequencing, interest subscriptions, reliable/unreliable semantics, authorization, zone changes and protocol negotiation require a reviewed integration version.

### Browser-only defensive receiver

`src/browser/magic-effect-receiver.mjs` exports `decodeMagicEffectPacket` and `createMagicEffectReceiver(pool)`. The decoder enforces exact framing, supported elements, version, canonical reserved bytes and bounded values. The receiver validates **authoritatively obtained viewer zone/camera/server tick**, distance, TTL, +3-tick bounded future skew, event ID duplicate/replay rules (256-ID bounded memory) and explicit reset on reconnect/zone transition. Only then can it pass `{kind,x,y,seed,intensity}` into the existing budgeted P1 particle pool. It is not imported by `web/online-game.mjs`: production spells remain disabled. No new commands flow client-to-server. The receiver stores only transient, aggregate diagnostic counters; no persistence.

**Golden-vector tests:** `server/src/magic_fx_events.rs` and `tests/magic-effect-receiver.test.mjs` use the same fixed Rust/JavaScript 32-byte LE fixture; tests cover malformed packets, cross-zone hiding, expired and future packets, replay dedup, bounded visual bursts, per-viewer caps and reconnect resets. Browser test suite imports the JS tests via `tests/browser-runtime.test.mjs`.

### Remaining required milestones

1. Introduce an approved, authenticated Magic & Items cast authorization (caster, rune, mana, reagents, cooldown and spell semantics). Only accepted **server** actions may request events.
2. Integrate trusted zone/chunk interest indices with event output and a reviewed versioned server-to-client-only packet type. Never expose zone visibility from user-provided event coordinates.
3. Clarify multi-zone and reconnect event IDs, expiry clocks, reliable transport semantics and fixed limit enforcement per subscriber.
4. Benchmark p50/p95 CPU, bandwidth, worst-case crowded realms with up to 512 players per map and realistic multi-zone distribution. Measure dropped *cosmetic* events separately; no gameplay action can be dropped or delayed by VFX.
5. Keep all effects disabled on the live arena until cross-department sign-off, exact-head `quality` passing and coordinated production release.

P4 remains **DRAFT / UNMERGED / UNDEPLOYED**; the existing game is unaffected.

## P5 — bounded spatial interest and synthetic 512-viewer bench (2026-10-20)

The previously passing P4 implementation retained at most 256 server-side semantic effects but inspected the full queue for every interested viewer. P5 changes this query path **without** activating effects in the playable realm:

- `server/src/magic_fx_spatial.rs` stores only accepted semantic events in zone-keyed **512-unit grid buckets** (not pixels/particles). The broker maintains one matching queue for monotonic event IDs/expiry and a bucket index for viewer lookups. Zone admission counts are read from the index.
- Queries visit cells intersecting the trusted viewer's 0–1500-unit radius, at most 64 cells by a conservative fixed bound; they never visit another zone's buckets. Exact circular filtering still applies; this broadphase introduces no cross-cell false negatives, including at negative coordinates and precise boundaries.
- Nearby candidates are sorted by monotonic event ID before limiting to 16, preserving original P4 delivery/cursor order independent of grid walk order. Incorrect viewer geometry still fails closed *before* entering the index.
- Expiry and tick progression remove stale events from both index and original broker queue, reclaim empty cells and zone counters, and assert both collection counts remain equal.
- `interest_snapshot_with_stats` publishes aggregate `visited_cells`, `examined_events`, and `in_radius` counters. This is developer-side telemetry only, not a player event trace or analytics service.
- A protected deterministic unit test fills **240 semantic events across five zones** (48 each) and compares **512 synthetic viewers** against the previous linear implementation with exact event equality, ordering and eligibility. Includes expiry, negative-cell boundaries, cursor and overflow budgets.

### Optional performance exercise

`server/examples/magic_fx_interest_bench.rs` is an executable, opt-in benchmark (no network, credentials or deployment):

```sh
cargo run --locked --release --manifest-path server/Cargo.toml --example magic_fx_interest_bench
```

It builds 240 trusted synthetic semantic events across five zones, queries 512 virtual viewers for 32 rounds, checks every viewer result against a full-scan oracle, and reports `indexed_p95_us`, `linear_p95_us`, `candidate_events_read`, `full_scan_equivalent`, and `semantic_payload_bytes`. All figures are machine-dependent; **no throughput or speedup is asserted until the example has actually run and the environment/measurements are recorded**. It excludes actual network transport, clients, GPU/canvas effects, colliders, actor dynamics and 512 genuine connections. No flaky wall-clock CI success threshold is imposed.

### Limits / follow-up

P5 is a **reference spatial index only**: the broker still has a global max of 256 pending effects and 48 per zone. It is not a horizontally sharded multi-server world, not a scene collision broadphase, and not tested on thousands of live players. Before shipping, Core & Multiplayer must own authoritative zone identity, active shard boundaries, delivery lifecycle, per-subscriber throughput and observability; Graphics owns crowd-tier presentation; Magic & Items owns validated spell semantics. The existing active packet protocol is unchanged. No P5 runtime activation, merge or deployment is authorized.
