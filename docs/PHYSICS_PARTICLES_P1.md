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

## P6 — explicit multi-zone FX shards and cosmetic delivery budget planner (2026-10-20)

P6 adds an **inactive server-side reference planner** `server/src/magic_fx_delivery.rs`. It is not wired to WebTransport, input processing, authenticated casting or existing snapshots, so no playable mechanics change.

### Fixed safe limits (payload bytes only)

| Bound | P6 setting |
| --- | ---: |
| Pre-registered server-owned zone shards per process | 16 |
| Pending FX per shard | 256 (P4) |
| New FX per shard/tick | 12 (P4) |
| Pending FX per single zone | 48 (P4) |
| Returned cosmetic packets per viewer/tick | 6 |
| Cosmetic payload per viewer/tick | 192 bytes |
| Cosmetic payload per zone/tick | 4096 bytes |
| Global cosmetic payload per process/tick | 16,384 bytes |

Every shard owns an independent P4 `SemanticEffectBroker` and P5 spatial index. Zone IDs must be explicitly registered by the trusted server and are never inferred from client messages. Hub ticks are strictly monotonic. New shards begin on the hub's current tick; they cannot resurrect expired events. Zone-local event IDs may repeat *across different zones*; the event envelope already identifies its owning zone and the browser receiver resets dedup state on an authorized zone transition.

`FxDeliverySession` is an **in-memory per-connection state holder**, not a new login or auth system. It stores authenticated net ID (supplied by trusted Core code), currently authorized zone ID, monotonic zone-local delivery cursor and last poll tick. Only Core may call `reset_authorized_zone()` on a verified portal/reconnect. A mismatch between session and server-trusted viewer zone, invalid viewer coordinates/radii, an unregistered zone or repeated polling in the same tick fails closed before any budget is consumed.

`ShardedMagicFxHub::plan_delivery()` returns encoded packets **to its server caller, without sending them**. The planner caps the returned work by minimum remaining global/zone/viewer cosmetic bytes, delegates proximity queries to the P5 grid, preserves event order, and moves the cursor only for encoded effects. If the quota is exhausted, it returns an empty visual batch; this must never block movement, damage, input ACKs or snapshots. Counters include only fixed 32-byte semantic *payload*; WebTransport, datagram framing, cryptography, retransmissions and network congestion are not estimated.

**Saturation/fairness limitation:** this planner is explicitly order-dependent. Core must use rotated or fair session scheduling before ever connecting it to a 512-player realm; a fixed poll order can starve tail viewers. The sample benchmark rotates its polling start as a **test technique**, but the runtime has no fairness policy yet and is not production-ready.

### Reproducible acceptance (synthetic only)

- Unit tests cover independent zone budgets/IDs, cross-zone rejections, zone transitions and reconnect resets, no replay in one tick, expiry, shard creation limits and strict server ticks.
- A 512-viewer/4-zone test asserts global, zone and per-viewer byte caps, immutable source zone in each 32-byte packet and tick budget reset.
- An eight-zone saturation test separately proves the process-wide 16 KiB cap even when per-zone budgets would allow more.
- Optional benchmark:
  ```sh
  cargo run --locked --release --manifest-path server/Cargo.toml --example magic_fx_delivery_bench
  ```
  It runs 512 **synthetic** per-connection cursors across eight registered zone shards over 16 authority ticks, rotates poll order, verifies zone IDs and byte caps, and prints measured planner-call p95, semantic payload and count of nonempty polls. **It does not create 512 actual connections or measure browser FPS/real network latency**. The benchmark has to be executed and its output recorded before making speed claims.

### Outstanding production dependencies

Core & Multiplayer must provide authenticated viewer identity, zone ownership, fair subscription/order, server tick and bandwidth scheduling. Magic & Items owns rune/mana/reagent/cooldown validation; World supplies trusted collision geometry and zone manifests; Graphics handles client visual quality and accessibility. Multi-process ownership, persistent shard lifecycle, cross-shard transfers, reconnect epochs, true sequencing/ACKs, live transport prioritization, metrics and end-to-end 512 real-client load validation remain outstanding.

No P6 activation, merge or deployment is authorized.

## P7 — deterministic fair cosmetic scheduling under crowd pressure (2026-10-20)

P6 correctly isolated per-zone and global **cosmetic-only** byte quotas, but sequentially polling viewers with up to six FX packets each allowed early viewers to use the entire budget. P7 adds an **inactive server-internal** `ShardedMagicFxHub::schedule_fair_tick` method to coordinate an entire authenticated viewer slice. It does **not** register packet types or send WebTransport data.

### Fairness contract

- Input: a bounded array of up to **1024** `FxDeliverySession` values and an equal-length parallel array of **Core-derived authoritative** `ViewerInterest` values for the hub's exact current server tick. The caller is responsible for authentication, authoritative world position and list membership. This method does NOT authenticate players.
- Preflight checks every pair and rejects duplicate net IDs, zero IDs, invalid coordinates/radius, mismatched zone ownership, unknown zones, repeated same-tick polling, oversized batches, unequal lengths or stale server ticks **before debit of any FX byte quota**. The method never accepts network packets from the browser.
- It orders sessions by **oldest last successful cosmetic delivery**, with stable authenticated net ID as the deterministic tie breaker. It returns **at most one 32-byte semantic FX packet per viewer per scheduling round**, rather than allowing the earliest viewers to consume six immediately.
- Sessions receiving no packet because a zone/global cosmetic cap is saturated remain older and gain priority on the next tick; successful sessions are marked with that server tick. Forgotten/disconnected IDs are pruned from the bounded priority state each scheduling pass.
- Effects preserve all P4/P5 semantic validation: zone, interest radius, expiry, ordered event IDs, no per-particle replication, and transient session cursor. This is **best-effort** priority, not reliable packet delivery, guaranteed fairness for viewers without valid nearby effects, or an always-on backend scheduler. A short-lived visual event can expire before a viewer's turn; that is acceptable for purely optional VFX, never gameplay telegraphs.
- Output is an in-memory `FairFxDispatch` containing packet batches and server-owned session IDs for a future authenticated Core transport integration, plus aggregate `considered_sessions`, `served_sessions` and **payload-only** byte counts. No networking is performed.
- The older single-session `plan_delivery` API remains available for isolated testing, but **must not be mixed with `schedule_fair_tick` for the same sessions within a tick**. Fairness guarantees are specific to the coordinated batch API.

### Regression evidence and scenarios

`server/src/magic_fx_fair_tests.rs` is registered in protected Rust tests and exercises:

- **512 virtual viewers across 4 zones:** one FX packet each (16,384 payload bytes in total), no zone over 4096 bytes.
- **512 virtual viewers in 1 fully saturated zone:** 128 served/tick, with all 512 obtaining one effect over four ticks; no repeated service while eligible viewers remain unserved.
- **1024 virtual viewers across 8 zones:** global 16,384-byte quota serves 512 viewers per tick; the next tick serves the previously unserved 512, assuming all effects remain active.
- Input-order invariance, duplicate IDs, forged zones, invalid viewer coordinates and atomic batch preflight, strict tick and batch capacity, and harmless cosmetic-only quota exhaustion.

This tests **synthetic scheduler data** and tight deterministic invariants, not 1024 real clients, 512-player browser FPS, network congestion, GPU performance, packet loss, or production QoS. Before enabling any server-to-client effect channel, the Core & Multiplayer department must integrate the scheduler with authenticated connection registries and actual transport priority, perform real connection/perf soak, test login/portal transitions, protect combat/gameplay messages, and review bandwidth including framing and encryption overhead.

**All P7 APIs are inactive / draft / unmerged / undeployed.**

## P8 — authenticated-connection handoff boundary and backpressure-first FX admission (2026-10-20)

P8 adds `server/src/magic_fx_handoff.rs`, a **pure, inactive Core-facing API**. It consumes P7's planned cosmetic batches but has no WebTransport sender, no real player admission and no integration with the authoritative game tick. The active `server/src/main.rs` and existing wire protocol are unchanged.

### Connection generation and routing

- `TrustedFxHandoff::register_trusted(connection_id, authenticated_net_id, zone_id)` is **only** intended for Core after an already-authenticated server connection has been admitted, with all identifiers from server-owned state. The registry rejects duplicate connection IDs, duplicate net IDs, zero IDs and more than 1024 registered FX sessions.
- Each registration receives a **server-minted monotonic `FxRoute { connection_id, generation }`**. A trusted zone transfer issues a new generation and resets P7's zone-local event cursor. An authorized disconnect removes the registration. A reused connection ID therefore receives a different generation; `route_current` rejects previously planned batches. A generation is never sourced from an incoming player payload.
- This does **not** create a new authentication system, login protocol or cryptographic token. The future Core runtime must check the route generation **again immediately before writing to a socket**; an asynchronous stale batch cannot be handed to a new player. The FX planner cannot validate real transport identity on its own.

### Fail-closed traffic priority

- Core supplies `TrustedFxViewer { route, view, gate }`, where `view` is the authoritative zone/position and `FxQueueGate` is server-owned transport state: whether gameplay/snapshot traffic is pending, whether the cosmetic writer is backpressured, and whether the cosmetic queue has a free slot.
- **Any gameplay backlog, backpressured writer or zero cosmetic queue space means zero cosmetic work for that session.** That viewer's FX cursor does not move and no FX payload budget is consumed.
- `plan_trusted_tick` validates **all** supplied active views first (current route generation, unique connection identity, matching authoritative zone, valid geometry and bounded batch length). Invalid views fail before any cosmetic bytes are planned. The hub's strict tick and P7 fair preflight continue to apply.
- Only eligible sessions are copied into the fair scheduler, and results are translated back to the active `FxRoute` for Core routing. The returned `FxHandoffPlan` stores aggregate registered/eligible/suppressed counts and **payload-only** byte totals; it performs no enqueue, socket write, instrumentation export or gameplay mutation.
- The P6 global/zone/viewer caps remain in effect. The P8 gate adds an additional *pre-admission* layer to avoid useless visual work when game state delivery has priority. It is not a complete QUIC congestion controller and does not reserve real datagram capacity.

### Deterministic regression cases

Rust module tests cover route invalidation on server-approved zone transfer, socket ID recycling and disconnect, immutable authentication ownership, rejection of malformed/view-forged batches, and 512 synthetic FX connections with a 64-session gameplay backlog. Results assert no route leak and that backpressured viewers get priority once they become eligible.

Optional standalone benchmark, without any real connections:

```sh
cargo run --locked --release --manifest-path server/Cargo.toml --example magic_fx_handoff_bench
```

This uses 512 **synthetic** registered sessions in four zones over 16 authoritative ticks; it adds deterministic gameplay-pending/writer-backpressure states and a trusted mid-run zone transfer. It reports p95 **whole-handoff round** time, budgeted cosmetic payload, suppressed polls and stale-route rejections. No speed, 512 real-client capacity, packet-loss, browser FPS, energy budget, or gameplay latency claim is justified until actual execution and a separate end-to-end network experiment.

### Unmet release requirements

The Core & Multiplayer department must provide: an already-authenticated registration API tied to its live connection lifecycle; actual authoritative viewer positions and approved zone transfers; **hard game-message priority** in the WebTransport outgoing queue; independent bounded cosmetic buffer, queue-slot accounting and backpressure; last-moment `route_current` validation; version negotiation for the separate P4 `ME` effect contract; server-side no-spoof/no-leak tests; and real connected-player load measurements (throughput, p95/p99 input latency, dropped visual events, render FPS, network overhead). Actual mixed gameplay + magic stress and device-tier accessibility signoff with Combat/Graphics/Magic/World remain gates.

**P8 is intentionally passive: no active FX transport or gameplay spell behavior is enabled. PR stays draft, unmerged, undeployed.**

## P9 — real loopback WebTransport semantic FX/browser acceptance (2026-10-20)

P9 adds the **first intentionally separate real network smoke fixture** for the Physics stream, while keeping the production game unchanged. Its scope is precisely a loopback QUIC/WebTransport handshake, actual browser-received 32-byte FX datagrams and test-only gameplay-style marker traffic, and browser-measured PI/PO ping RTT. It is **not** an active magic feature or a 512-connected-player load result.

### Isolated and opt-in by construction

- `server/examples/magic_fx_loopback.rs` always binds `127.0.0.1:0`, issues an ephemeral self-signed test identity and only accepts WebTransport requests on `/physics-fx-lab`. The experiment does not use the live arena's `/game` endpoint, does not change `server/src/main.rs`, does not authenticate real players or accept client spell commands, and does not depend on production secrets.
- Each accepted *test* connection receives a server-assigned identity, a fixed zone/position and 115 monotonic 30 ms fixture ticks. The server sends a compact test-only `GP` marker datagram before optional P4 `ME` FX. `PI`/ `PO` are only ephemeral four-byte ping sequence echoes for real browser RTT measurement, **not gameplay inputs**. The isolated session uses existing P6–P8 budgets, fair scheduling and gameplay-first gate; every 7th tick intentionally suppresses optional FX after sending its test gameplay marker. FX begins at fixture tick 31 to give a baseline ping measurement without FX.
- `web/physics-fx-real-flight.html` is an unlinked, non-playable browser laboratory page. It uses the actual WebTransport browser API with the throwaway certificate's exact SHA-256, decodes genuine incoming P4 `ME` bytes via the existing JS decoder, passes validated visual events to the P1 capped particle pool, counts gameplay-style marker arrivals and measures ping RTT. It does **not** import the live arena, create actual combat actions, or activate any server-side spell.
- `scripts/physics_fx_real_browser_flight.mjs` opens a test-only loopback HTTP file server serving an explicit three-file allowlist, starts the Rust sidecar, and runs separate **headless Chrome and Firefox WebDriver sessions**. It fails acceptance unless each browser receives at least 50 test gameplay markers, 12 exact 32-byte semantic FX, 8 ping replies and zero malformed FX packets. The script prints browser ping p95, gameplay-marker gap p95, cosmetic payload bytes and receipt counts.
- `.github/workflows/ci.yml` includes a dedicated **Validate P9 real loopback semantic FX WebTransport** step after the unchanged protected Rust checks and before existing combat browser qualifications. No existing acceptance or Combat gate is skipped or weakened.

### Measurements and truthful limitations

The PI/PO RTT and browser marker gaps are measured from genuine QUIC/WebTransport datagrams **within one CI host's loopback interface**, not an independent WAN. A simulated `GP` marker is **not** an actual combat snapshot and cannot prove that the real game's input-to-hit latency remains unaffected. Browser page tracks cosmetic particle creation, but does **not** render a production GPU scene or measure gameplay FPS. No network throughput, 512 genuine concurrent sessions, sustained connection churn, real packet-loss behavior or real-world latency claims are made.

A useful command after the Rust toolchain and Chrome/Firefox WebDriver are installed:

```sh
node scripts/physics_fx_real_browser_flight.mjs
```

The earliest exact-head P9 CI run, its step-level outcomes, and per-browser JSON printed in that run are the source of truth. **Only claim an actual real-browser pass or numeric p95 after the step succeeds and its logs have been inspected.**

### Future sign-off

Core & Multiplayer still owns actual `/game` transport scheduling, authenticated registration, player zone authority, reconnection generation validation, real gameplay ACK/latency, QUIC congestion discipline and multi-host acceptance. Magic & Items owns spellcasting authority; Graphics owns GPU/canvas FPS and visual accessibility. This separate sidecar cannot be substituted for those integrations. The production FX gate remains disabled, PR draft, unmerged and undeployed.

## P10 — real concurrent WebTransport crowd, shared FX quota (2026-10-21)

P9 proved a **single** real WebTransport browser/sidecar session in Chrome and Firefox. It did not prove that its cosmetic byte budget applied across sessions: each P9 test connection had its own in-memory hub. P10 introduces a deliberately isolated **shared-process** concurrency flight to close that acceptance gap. It is still an engineering test, not live magic or the production game transport.

- `server/examples/magic_fx_crowd_loopback.rs` always binds an ephemeral UDP port on `127.0.0.1`, issues a throwaway certificate, and accepts only `/physics-fx-crowd`. The fixture accepts a bounded command-line count **2–64**, default **16**; it makes no calls to active game or combat state. Each real QUIC handshake runs in its own task, preserving the P9 Firefox interoperability fix. A barrier waits for exactly the configured number of **accepted real sessions** before starting 115 shared 30ms test ticks.
- Critically, **one `ShardedMagicFxHub`, one P8 `TrustedFxHandoff`, one fixed test zone and one 30ms server tick** govern *all* sessions. The hub's 4096-byte per-zone/tick and 16,384-byte per-process/tick semantic quotas are asserted on every planning round, not duplicated per connection. The fixture also honors the one-visual-event/viewer/round P7 scheduler.
- Each accepted client has a server-assigned fixture connection ID, an immutable fixed-zone trusted test viewer and a dedicated QUIC `PI` → `PO` ping echo reader. Every tick first sends a six-byte `GP` **gameplay-style test marker** to every connection, then conditionally plans cosmetic FX from the shared hub. A periodic artificial gameplay-pending flag suppresses FX without suppressing `GP`; no actual snapshots, movement, hits or spellcasting are exercised.
- `web/physics-fx-crowd-flight.html` creates **16 genuine simultaneous browser WebTransport connections** to the fixture in its acceptance configuration. Every connection has its own receiver, low-quality particle pool and ping measurements. It fails if *any* session is missing at least 55 markers, 12 received FX packets, five ping replies, creates no particles, sees malformed effects or lacks finite browser-side p95 marker-gap / RTT measurements. Results retain per-session diagnostics, not merely an average that can hide a starved player.
- `scripts/physics_fx_crowd_browser_flight.mjs` starts a **fresh** loopback server for Chrome and then Firefox (16 concurrent connections per run), using the repository's W3C WebDriver conventions. It asserts the real session count and each-browser minimum evidence, prints `P10_REAL_CROWD_BROWSER` / `P10_REAL_CROWD_SUMMARY` JSON, and tears down the sidecar. `quality` adds a dedicated protected **P10 concurrent real WebTransport FX crowd** step after P9 and before all unchanged Combat browser qualifications.

Reproduction on a runner with Rust, Chrome/Firefox and drivers:

```sh
node scripts/physics_fx_crowd_browser_flight.mjs
```

**What P10 can prove if the step is green:** 16 real simultaneous WebTransport sessions in Chrome and separately 16 in Firefox, against a single local host, test datagrams received across all sessions and bounded shared **semantic payload** budgeting. This is **not** 32 simultaneously connected cross-browser sessions (browsers run sequentially), not 512 actual players, not a second independent network, not real game input-to-damage latency, not on-wire/encrypted byte totals, and not sustained live FPS/GPU performance. Timing measurements are loopback and runner-specific, not service-level objectives. The previous synthetic 512/1024-viewer fairness tests remain separate Rust tests, not evidence of real connections.

Before activating FX inside live `/game` transport, Core & Multiplayer must own the real authenticated connection table, per-client gameplay priority, actual network queue reservation/drop policy and real load/latency tests. Combat, Magic & Items, World, Graphics and Deployment must sign off. The P10 fixture does not modify `server/src/main.rs` or `web/online-game.mjs`, and PR #357 remains draft/unmerged/undeployed.

## P11 — real authoritative game ACK baseline and FX co-host contention (2026-10-21)

P11 introduces **two separate real WebTransport networks on one CI host** under a controlled, loopback-only test. It does not route magic FX into the live `/game` socket and does not alter production player/network protocol. The goal is to measure *real authoritative gameplay traffic* (game server-processed input ACKs, snapshots, render frames) with and without independently running **16 real cosmetic FX connections** on the same host.

### Dedicated acceptance

- In `web/flight.mjs` (existing protected browser flight; test-only), record each genuine locally submitted `client.sendInput(tick)` timestamp with the browser's monotonic clock. When `onProcessedAck(ack)` fires from a **real decoded authoritative INPUT_ACK**, match its `ack.processedClientTick` to the exact recorded send timestamp and collect the elapsed time. Report `processedInputAckMs.p50/p95/p99/max/count` and unmatched buffered sample count. This is **client-send → server-processed-ACK observed RTT**, NOT physical hit confirmation, visual latency or server CPU processing duration. Missing ACK/tick mapping is not invented or counted as zero; no user inputs are modified.
- `scripts/browser_flight_runner.mjs` emits optional `P11_REAL_GAME_BROWSER_STARTED` evidence only under `MYASO_P11_OVERLAP_TRACE=1`. Its existing real Chrome/Firefox flight, input/snapshot/ACK and FPS budgets remain intact. Live code does not see this marker.
- P10's existing isolated loopback crowd fixture supports an optional, bounded longer duration (`P10_LAB_TICKS=115..350` and browser `P10_WINDOW_MS=4200..10500`) without changing P10's standard test duration or acceptance thresholds. P11 uses 270 30ms ticks and an 8.4s browser observation window so actual application traffic can overlap.
- `scripts/physics_fx_authoritative_overlap.mjs` first runs the unchanged actual `myaso-server` WebTransport `/game` browser flight **without** FX sidecar load as a baseline, then launches the P10 16-real-connection cosmetic sidecar and starts a second real-game flight as soon as 16 QUIC sessions have been accepted. It requires both Chrome and Firefox baseline and loaded flights to pass original snapshot, input, ACK and frame qualification; at least five matched genuine ACK timing samples; and both browser's FX crowd flight to pass every peer's packet/RTT validation.
- The coordinator correlates real process log timestamps: `P10_REAL_CONNECTIONS_ACCEPTED 16` to `P10_REAL_CROWD_SUMMARY` and `P11_REAL_GAME_BROWSER_STARTED` to `P11_GAME_LOADED`. It fails closed unless each browser has at least 500ms proven simultaneous **actual** game browser and FX crowd activity. Logs `P11_REAL_GAME_FX_OVERLAP_SUMMARY` JSON with baseline/loaded p95 processed ACK, frame p95, deltas, actual intersection duration and real FX connection counts.
- Protected `quality` adds `Validate P11 real game input ACK under concurrent FX host load` after P9/P10 and before all existing Combat acceptance. No Combat gates, FX feature flags, production endpoints or client input protocols are bypassed.

### Important limitations and future gates

The real `/game` connection and the 16 lab FX `/physics-fx-crowd` connections are on **different loopback ports and different processes**. This measures CI host CPU/network stack/browser contention while genuine authoritative gameplay ACKs, snapshots and animation frames are flowing, **not** actual in-game QoS when effects share a WebTransport datagram channel, server tick scheduling, congested public WAN, input-to-hit latency, or 512 genuine concurrent game players. Measured baseline/loaded p95 differences are *descriptive and CI-run-specific*; they are not a performance SLO. Existing strict frame/snapshot/ACK qualification still applies and must pass. Avoid performance claims until actual JSON evidence from exact-head CI is available.

Before FX protocol activation, Core & Multiplayer must implement and test a shared authenticated transport queue that prioritizes real game snapshots/ACKs, independently caps optional FX and drops cosmetic overload, revalidates P8 generations at enqueue, and performs genuine multi-host/per-client 512-player validation. Graphics owns actual gameplay FPS/accessibility, Combat owns hit confirmation, Magic & Items owns spellcast semantics. P11 is isolated, draft, unmerged and undeployed.

## P12 — gameplay-first *shared-transport contract*, not live activation (2026-10-21)

P11 measured genuine `/game` input-to-processed-ACK RTT while a **separate** 16-WebTransport-connection FX sidecar stressed the same CI host. Exact-head [CI #39502000297](https://github.com/tehki/myaso/actions/runs/39502000297) passed its Physics P9/P10/P11 gates, but the **full workflow failed** later on unchanged protected Combat `M205 repeated M201 server-tick FFA punish proof`, where an expected guard-break instead resolved as a parry. There is no Physics live-feature activation, and the Combat failure is not bypassed.

Recorded P11 sample p95 values, from that exact run (browser test-only /game network, distinct FX sidecar):
- Chrome baseline input-to-ACK **75.1 ms**, loaded **28.5 ms**; p95 frame interval **16.7 ms** baseline and loaded; observed FX/game overlap **6,225 ms**.
- Firefox baseline input-to-ACK **51 ms**, loaded **60 ms**; p95 frame interval **17.1 ms** baseline, **17.32 ms** loaded; overlap **3,977 ms**.
- Both browsers had **16 actual concurrent loopback FX sessions** in their respective isolated sidecar runs; the maximum per-connection P10 FX ping RTT p95 was **4 ms**, with 107,008 semantic payload bytes reported per browser. The input ACK deltas are descriptive single-run results; no claim that FX improves Chrome latency or that a WAN, true hit-confirmation or production QoS is proven.

P12 adds `server/src/magic_fx_shared_transport.rs`, a **pure passive output planner** that models the missing Core-owned boundary between authoritative gameplay traffic and optional P8 FX output. It is linked into the Rust library for unit tests only, **not called by the active game server**.

### Inactive API and ownership

- Core supplies pre-encoded, already-authoritative `CoreGameplayDatagram { route, bytes }`, where `route` is a current P8 server-minted connection generation and payload is the unchanged gameplay datagram. This API does *not* parse, rewrite or derive input ACKs, snapshots, hits, collisions, health, inventory, combat commands or player identities. It rejects a zero-length, oversized (greater than `CONSERVATIVE_DATAGRAM_BYTES`), stale-route or unbudgeted gameplay datagram with an explicit error **before returning a dispatch plan**. Callers must retain gameplay datagrams and handle socket enqueue errors; none are silently dropped.
- Core also supplies `CoreWriterCapacity` for each trusted current connection: datagram slots remaining, known gameplay backlog outside the current slice and writer backpressure. At most **1024** writers and **1024** gameplay datagrams enter one planner call. Duplicate writer keys fail closed; per-route gameplay slots are **reserved before any FX** is considered.
- The planner returns borrowed `SharedDispatchDatagram` references, **always authoritatively ordered** as original-gameplay-slice-order first and optional FX later; there is no network write, buffer allocation of gameplay payloads or post-failure mutation. The active transport's Core owner must provide send/connection-lifecycle synchronization and revalidate the generation *at the last socket enqueue*, not just at planning.
- Cosmetic entries from P8 are checked again against the current generation and `TrustedFxHandoff::authorized_zone()`, `ME` header/version and trusted zone. Wrong-zone/malformed/stale FX are **discarded only as optional visuals**, never admitted as new client commands. A server-owned gameplay backlog, backpressured writer or exhausted slot suppresses further FX. Defense-in-depth FX caps remain **16 KiB/process/tick, 4 KiB/zone/tick and 192 bytes/viewer/tick**, independent from gameplay bytes.
- P8 may have advanced a cosmetic-only cursor when planning, so dropped FX are not retransmitted; these packets must never carry mandatory hit/block/damage telegraphs. True reliable/cross-client gameplay state continues to use Core/Combat's existing authoritative channel.
- The return values distinguish `gameplay_payload_bytes`, `cosmetic_payload_bytes`, cosmetic drops and stale-route drops. The 32-byte FX limit is **semantic payload only**, not full QUIC framing or actual network capacity.

### Acceptance and remaining production gates

P12's protected Rust unit tests assert gameplay before all FX in input order, byte-for-byte ACK/snapshot preservation, atomic failure on gameplay writer saturation or stale route, gameplay-backlog FX suppression, zone-transfer/socket-reuse stale-FX drops, malformed cross-zone event rejection and an overload case with 1024 current routes across four zones respecting the global 16-KiB quota. No existing R1/Combat/HTTP3/browser gate was weakened.

**This is a Core integration design and deterministic unit-test implementation, not a live shared-WebTransport sender.** The blocker before real activation is a jointly reviewed, authenticated /game transport-side queue implementation with actual queue reservation and deadline priority, P8 generation checks at send time, in-band receiver version negotiation, real Combat ACK/hit-confirmation acceptance during FX saturation, true WAN/multi-host validation, and staged/rollback-safe deployment. Even with green P12 unit tests, the cross-department PR remains draft until all separate Combat checks pass and Core approves that bridge.

## P13 — genuine same-connection gameplay-first FX dispatch (loopback-only; 2026-10-21)

The [P12 exact-head run #39504288092](https://github.com/tehki/myaso/actions/runs/39504288092) completed **successfully** through Rust, P9/P10/P11 WebTransport, and the entire existing protected Combat suite. P13 expands acceptance beyond offline shared-dispatch unit tests, but **does not modify or activate the production `/game` sender**.

P13 deliberately reuses the isolated `server/examples/magic_fx_crowd_loopback.rs` on ephemeral `127.0.0.1:0` and its existing `/physics-fx-crowd` lab endpoint. Setting `P13_SHARED_DISPATCH=1` activates a **test-only** path; leaving it unset preserves the P10/P11 fixture behavior. On each 30ms lab tick:

- The server constructs 16 trusted fixture `CoreGameplayDatagram` values (the existing six-byte **`GP` marker**, *not* an authoritative snapshot or combat ACK) and one authenticated writer-capacity record per connected test session.
- The ordinary P8 FX broker builds eligible semantic magic batches for the same connections. The **real P12 `plan_shared_dispatch`** then reserves all 16 gameplay marker slots before admitting any optional semantic effects, with a single shared zone/process visual byte quota. Every fifth tick it artificially restricts each writer to **one** datagram slot. All 16 gameplay test markers are preserved; optional magic FX has no slot and must be **dropped**. All other ticks may use two slots/connection. This is bounded synthetic writer pressure, not observed network congestion.
- The sidecar checks that all planned gameplay datagrams precede FX, validates generation again at the final test-socket enqueue, and sends the chosen `GP` and `ME` bytes over the **same actual WebTransport QUIC connection** to each browser, not separate socket types. P8's generation, position, zone and FX validation remain authoritative.
- It prints `P13_SHARED_DISPATCH_SUMMARY` with 16 genuine accepted connections, 115 server ticks, **1,840 gameplay test datagrams**, visual datagrams actually selected, optional FX rejected by writer slots, and 23 artificial congestion ticks. Any unexpected gameplay slot shortage is an explicit Rust error; P13 never transforms it into a gameplay drop.
- The existing Chrome and Firefox P10 browser harness is reused, with **16 simultaneous browser WebTransport sessions per browser**. Under P13 opt-in it rejects missing/invalid sidecar proof, even one missing real gameplay marker, missing FX delivery, malformed event packets or absence of artificial FX drops. Browsers run **sequentially**, so no cross-browser concurrent-player claim is made.
- `quality` includes `Validate P13 real shared-connection gameplay-first FX dispatch` after P10, before P11 and all existing Combat gates. No earlier tests are weakened or skipped.

Reproduction:

```sh
P13_SHARED_DISPATCH=1 node scripts/physics_fx_crowd_browser_flight.mjs
```

**Evidence limitations:** This tests the real P12 prioritization plan through a real lab QUIC sender and browser receiver, but carries only synthetic gameplay-like markers, not real `/game` snapshots, authoritative processed-input ACKs, damage/block outcomes or magic casting. It does NOT prove actual production transport queue reservation, congestion fairness, real network packet ordering, WAN reliability, input-to-hit responsiveness, 512 genuine clients, or renderer FPS. The physical QUIC implementation can reorder/drop unreliable datagrams; P13's strict all-marker-received criterion is a *loopback test*, not a production guarantee. Correct integration still requires Core & Multiplayer ownership of the live `/game` writer/handshake, reliable gameplay queuing, per-connection generation checks at send time, and real cross-host multiplayer acceptance. P13 and the whole Physics branch remain draft, unmerged, undeployed, with magic disabled in the real game.

## P14 — send-time route validation and lossless gameplay ownership (2026-10-21)

P13's [full exact-head CI #39508709066](https://github.com/tehki/myaso/actions/runs/39508709066) proved the isolated P12 shared-dispatch planner through genuine loopback QUIC and both browser engines, but the active `/game` sender remains unchanged. P14 closes a separate contract gap: P12 only planned datagrams and could not express what to do if a socket changed generation or refused a gameplay datagram **during the actual writer loop**.

New **inactive** `server/src/magic_fx_shared_writer.rs` adds `try_write_shared`, an ownership-preserving synchronous seam. It accepts a P12 `SharedDispatchPlan`, a Core-owned current-route check callback, and a Core-owned try-send callback. This module never opens a socket, edits player data or enables live magic.

- Before invoking **either callback**, it validates packet order, payload length and the plan's reported gameplay/cosmetic message and byte counts. A malformed public plan yields an explicit `InvalidPlan` without a single write.
- Every authoritative gameplay datagram is attempted **in original order**, with its P8 generation checked immediately before the call to Core's send function. Any stale route or failed send **stops the entire dispatch**, skips all optional FX, and reports `next_unsent_gameplay_index`. Core retains its original gameplay buffers and decides how to retry or tear down the session. Already accepted gameplay is *not* automatically replayed.
- When all gameplay was accepted by the local writer, FX datagrams may be attempted. Each optional packet's route generation is checked again; stale FX are discarded. If an FX send fails, only that visual packet is discarded and later cosmetics may continue. Counters distinguish accepted gameplay, accepted FX, stale FX and rejected FX. A successful local QUIC enqueue **does not guarantee remote delivery**.
- A `route_current` check followed by sending bytes is not transactionally atomic across real connection teardown; Core must serialize the check/enqueue with its authenticated session lifecycle. This callback contract is not an implementation of reliable gameplay delivery or true QUIC congestion control.

The protected Rust unit tests exercise gameplay-first packet order, byte preservation, failure at the **second** gameplay datagram with precise replay cursor, expired route before the first gameplay send, a simulated zone/reconnection boundary between gameplay and cosmetic sends, best-effort FX writer pressure, and a deliberately fabricated malformed public dispatch plan. The tests cannot claim actual network transport guarantees.

Additionally, P13's **opt-in loopback-only** `P13_SHARED_DISPATCH=1` flow now invokes the real P14 `try_write_shared` against the genuine 16-connection/browser WebTransport sender. It asserts every one of the 16 test gameplay markers was accepted each tick, and every P12-admitted FX packet was accepted by the local loopback sender without gameplay failure. P9, standard P10, P11, all protected Combat and other prior acceptance gates remain unchanged.

**Still NOT connected to live `server/src/main.rs`:** authentication, gameplay datagram retention/queues, writer synchronization, actual reliable recovery and real /game WebTransport QoS belong to Core & Multiplayer. Cross-host loss/congestion soak and Combat/Graphics/World/Magic sign-off are still required before merge/activation. P14 remains draft, unmerged and undeployed, with no production magic or gameplay behavior changed.

## P15 — Core-owned guarded enqueue seam (2026-10-21)

P14's two-callback writer contract separated `route_current` from the subsequent QUIC enqueue, leaving a time-of-check/time-of-use race if a production connection could be replaced between the operations. P15 adds a *single-operation* API, **not** production wiring.

- `server/src/magic_fx_shared_writer.rs` now exports `CoreAuthenticatedWriter::enqueue_if_current(FxRoute, &[u8]) -> Result<(), CoreGuardedEnqueueError<E>>` with typed `StaleGeneration` and `WriterRejected(E)` outcomes. Physics calls this via `try_write_core_guarded`, which delegates P14's same strict dispatch-plan preflight, gameplay-first ordering, exact first-unsent-gameplay index, and cosmetic-only dropping semantics. The single method is the **minimum necessary abstraction** for Core 8A to implement generation fencing and writer acceptance under one real session-lifecycle critical section. A trait signature alone cannot guarantee atomicity; Core must prove its locking semantics.
- Unit regressions inject a generation change immediately after the first accepted gameplay enqueue, a generation change after all gameplay but before optional FX, gameplay queue rejection after one accepted packet, cosmetic-only writer rejection, and a malformed public plan rejected before invoking the Core writer. The tests explicitly distinguish already accepted gameplay from the first still-unsent gameplay index and classify stale cosmetic drops separately from writer-pressure drops. No old gameplay is implicitly retried or rerouted after a reconnect.
- The isolated `server/examples/magic_fx_crowd_loopback.rs` has a strictly opt-in **P15_CORE_GUARD=1** mode, which requires `P13_SHARED_DISPATCH=1`. The only user-facing endpoint remains the throwaway ephemeral localhost `/physics-fx-crowd` lab, and the test-side `LabCoreWriter` simulates one owned connection lookup+generation check+QUIC enqueue per call. The fixture is single-threaded with respect to its own connection-map mutation; this is *not* evidence of production multi-thread teardown/enqueue atomicity.
- The existing Chrome/Firefox WebDriver flight runs **16 real simultaneous test QUIC sessions per browser**, with server-side `P15_CORE_GUARD_SUMMARY` proof and strict all-115-gameplay-markers/per-connection receipt checks. The protected `Validate P15 guarded Core writer on real shared WebTransport` step is **additional**: existing P9, P10, P13, P11, Rust, and full Combat quality gates stay unchanged.
- The optional local command is `P13_SHARED_DISPATCH=1 P15_CORE_GUARD=1 node scripts/physics_fx_crowd_browser_flight.mjs`, requiring the pinned Rust toolchain and both browser drivers.

### Responsibility and limitations

P15 has been handed to the canonical Core coordination track, [8A/8B/8C issue #405](https://github.com/tehki/myaso/issues/405#issuecomment-6303490059): 8A owns real WebTransport connection authentication, owner lifecycle and writer; 8B owns durable character ID/session fencing; 8C owns authoritative zone/worker epoch. Physics route generations/ephemeral `net_id` remain **noncanonical test models**, never an alternate live authentication protocol. A Core implementation must serialize authorization/generation checks with real writer teardown and immediately fail closed if stale. A return of `Ok` only means **local QUIC enqueue**, not remote reception; snapshots/hit-ACK recovery remains gameplay-owned. Real WAN/multi-host churn, 512 actual players, actual combat latency/packet-loss tests, client protocol negotiation, graphics performance and staged rollback gates are still required. PR #357 remains draft/unmerged/undeployed, with no modifications to live `server/src/main.rs` or spellcasting. Do not claim green P15 until exact-head CI and both real browsers actually pass.
