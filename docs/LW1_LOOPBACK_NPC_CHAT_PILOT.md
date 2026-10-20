# LW-1 — Loopback NPC Conversation Pilot

Status: **implemented in draft PR #353; not merged, deployed, or AI-backed**.
The pilot is independent of the normal alpha. It is off by default, and the server **refuses to enable it on a non-loopback bind**.

## Local test

Start the Rust server with a development certificate and pilot activated:

```sh
MYASO_NPC_PILOT=1 cargo run --locked --manifest-path server/Cargo.toml
```

In another terminal at the repository root:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/web/?server=https://localhost:4433/game&cert=<SHA256_HASH>`, where `<SHA256_HASH>` is the hex-encoded short-lived development certificate hash printed by the server (without punctuation). The browser pins this fingerprint using its existing authoritative client. Enable game audio only by user gesture; nothing changes sound behavior.

When the server provides the NPC roster, five named **staging markers** appear near the initial combat spawn and a chat panel appears below the arena. Press **Enter** with the arena focused, or click the chat input. Select an NPC and type a short single-line message. All requests run on a reliable stream; the server validates the session's current alive state and its actual world-space distance to the selected NPC (180 units).

Try `hello`, `my name is Rose`, `remember me`, `news`, `trade` and `quest`. Names and acquaintance persist **only for the current connection**. The behavior is scripted, not an external model: NPCs do not invent rewards, merchants, crimes or world facts. There is no text-to-item or world-mutation path.

To disable the feature, unset `MYASO_NPC_PILOT` or set it to `0`. Starting with `MYASO_BIND=0.0.0.0:4433 MYASO_NPC_PILOT=1` fails closed even with an otherwise valid TLS certificate.

## Runtime limits

- Staging map markers **are not** collidable fighter entities, persistent relationships or completed Greyhaven art. Their coordinates follow bounded server-timed routes, but they do not use navmeshes or collision.
- Requests: max **240 UTF-8 bytes**, one line, strict framing and version checks. Packet request type 5, NPC answer type 6, NPC roster type 7; the existing protocol version (1) and combat packet types (1–4) are unchanged. Reliable frames are length-prefixed with a u16 LE count.
- Responses are point-to-point and bounded; the server enforces per-connection cooldown (850ms) and can fail its reader on malformed framing. The session-local NPC reader uses a separate async task and never waits for a model or storage inside the 60 Hz world tick.
- NPC memory is a small in-process per-connection acquaintance set and optional self-declared *cosmetic* nickname. It is never a verified user name or cross-session identity and cannot authorize purchases, rewards or private information disclosure.
- The browser shows up to 12 recent lines during the active chat session using `textContent`. The server writes no chat bodies, prompts or nicknames to logs or persistent storage. The UI state disappears when the tab/session ends.
- The full, persistent living-world architecture remains the roadmap in `docs/MOON_LIVING_WORLD_AI.md`; LW-0 identity/consent, collidable world objects/navigation, real economy integration, persistent event/relationship storage, and AI provider are still separate future tasks.

## Test expectations and nonclaims

- `node --test tests/networking.test.mjs tests/m6-browser-authority.test.mjs tests/browser-runtime.test.mjs`
- `cargo fmt --all --manifest-path server/Cargo.toml -- --check`
- `cargo check --locked --manifest-path server/Cargo.toml`
- `cargo clippy --locked --manifest-path server/Cargo.toml --all-targets -- -D warnings`
- `cargo test --locked --manifest-path server/Cargo.toml`
- Full protected GitHub `quality` and authentic browser acceptance before merging.

Nothing in this pilot indicates that hosted inference, durable player memory, NPC travel, inventories, quests, voice, free-for-all loot or live Greyhaven state is present. Do not deploy this experimental path to the shared production VPS.

## LW-1B — Deterministic routines and verified witnesses (loopback-only)

The same pilot also supports an **accelerated 40-second staging schedule**. Rowan,
Elara and Tomas traverse short **server-authoritative marker routes** between
authored anchors; Aldric and Marta stay at their workplaces and alternate
between work/rest labels. These are **not** navmesh or collidable NPC actors:
they cannot block players, fight, open doors, trade or manipulate objects.

The authoritative Rust world tick computes marker positions. Once per second,
the server offers a bounded, 38-byte reliable NPC-state frame (**type 8**,
version 1, server tick + five {id, x, y, activity} records). Browser markers
and occupation labels update from this state; stale/out-of-order updates,
duplicate IDs, bad coordinates or activity codes are rejected. Actual chat
proximity is checked against the *current server position*, not the older
browser marker. NPC-state packets are best-effort and are enqueued **after**
combat kill notifications and reliable snapshot recovery. Combat packets,
reliable snapshots, input timings and the combat simulation remain unchanged.

A simulated NPC may remember **only** a nearby **server-recorded real
CombatEvent::Death**, within a bounded 235-unit witness radius. If asked about
news, a witness may say it saw a fighter fall; an NPC that did not witness
the event says it has no verified news. Neither one invents a named killer,
victim, caravan incident, reward or quest. Witness knowledge is an in-memory
server-side timestamp with a **two-minute TTL**, lost on restart; no player
chat transcripts or actor IDs are persisted. It is not NPC gossip or durable
memory.

As before, the feature must be explicitly activated on loopback, and the
production default stays off. No AI inference provider is contacted. This
pilot has no player-executable world-action capabilities; future abilities need separate
server validation and audited account/retention policies.

## LW-1C — Deterministic local NPC supply ledger (loopback-only)

The pilot now includes a finite **shared, server-owned** micro-world supply model.
There is no player inventory, currency, loot, persistence, off-world trade, resource
respawn, procedural quest, NPC collision or client-authorized mutation.

Initial stock is intentionally authored for the staging test:
- **8 water buckets** at the well; Tomas picks up at route tick 600 and
  delivers to the work yard when he returns at tick 1800.
- **8 rations** at the depot; Elara picks up and delivers to the market stall
  on the same out-and-back schedule.
- **6 iron bars** at the forge; Marta converts one iron bar into one unit of
  finished nails at her work-shift tick 300, up to the existing finite supply.

All updates are performed by the trusted 60 Hz Rust world clock, and only after
the correct NPC task milestone. There is no refill. Every transfer preserves
the total supply in each resource group (water 8; provisions 8; iron+nails 6).
An accidental repeated tick or a discontinuity does not duplicate inventory.
A bounded 12-entry **nonpersonal, session-local** action ledger records tick,
event sequence, NPC actor and operation. Neither client messages nor an LLM
have a write path to the stock model.

The server broadcasts a strict **22-byte NPC-supply packet (type 9)** on the
existing reliable stream at low priority, after combat kill notifications,
snapshot catchup and NPC position updates. It contains an authoritative
server tick, global event sequence, eight fixed-order resource counts,
and the last actor/operation code. The browser validates exact length,
header, resource conservation and provenance, then renders the observed counts
in the NPC panel. A late packet cannot overwrite a newer world snapshot.

Ask Marta about **iron**, Elara about **rations**, Tomas about **water**, or
Aldric about **supplies**; each reads actual current shared server stocks.
Asking an NPC to give resources, trade with a player or invent new stock has
**no effect** on the ledger. This is a small verified, observable NPC world
interaction, not a playable economy.

The next integration boundary remains a physically navigable Greyhaven world,
actual resource objects, stable verified player identities and separately
permissioned/transactional player interaction. These are intentionally not
claimed by LW-1C.

## LW-1D — Obstacle-aware test navigation (loopback-only)

The three moving staging NPCs now follow a **bounded deterministic grid path**
instead of walking straight through barriers. Rowan walks around a barricade,
Elara around a market stall and Tomas around a supply crate. The server owns
three explicitly authored **pilot geometry** rectangles (packet type 10,
4-byte header + three 8-byte rectangles). NPC positions are still authoritative
and continue to use packet type 8; speech range and supply actions use the
same server world tick as before.

The pathfinder builds three shortest-path routes **once per process**, using
a small, finite grid with eight neighboring cells and deterministic tie
breaking. Traversal rejects blocked cells, prevents diagonal corner cutting
and reserves eight world units of personal space around rectangles.
The forward leg uses equal-distance interpolation, reverses along the same
safe path and has predictable shift/rest windows. Missing or inconsistent
routes fail closed to each NPC's staging start position.

The browser renders the pilot barriers as **dashed translucent overlays**
and moving NPC markers. These blockers are **NPC-navigation-only**:
player combat colliders, arena movement, attack reach, physics and existing
map/zone transport **are not modified**. The test barriers must be replaced
with approved, server-authoritative Greyhaven map-manifest colliders before
claiming real building/door navigation or making NPCs collidable.

New Rust cases verify that each route reaches its authored waypoint,
the naive straight line would hit a blocker, all sampled movement stays
outside expanded obstacle rectangles, diagonal paths cannot cut through
corners, and pilot geometry uses the separate bounded packet type 10.
The browser decoder validates rectangle count, dimensions and in-bounds
coordinates before showing a barrier.
## LW-1E — Bounded authoritative collider input contract

Phase A of World & Buildings ([PR #336](https://github.com/tehki/myaso/pull/336)) carries *visual-only* building footprints. Phase B2 / C1 are in separate active PRs; they are **not** active map/door collision authority in this NPC branch. Therefore no building scenery is treated as a server-verified wall or used to authorize NPC or player passage.

The NPC pilot now routes through one reusable Rust pathfinding implementation: `server/src/npc_collision_contract.rs`. It accepts only an explicitly **server-owned collision input** (there is no client/network entry point), validates the source zone, format version 1, nonzero revision, exact finite local grid bounds, rectangle dimensions and maximum blockers, and returns either a deterministic obstacle-avoiding path or a typed error. Grid spacing is 5 world units, clearance 8 units, up to 48 blockers and up to 101×101 cells per local window. An unavailable/invalid start or destination, blocked endpoints, fully divided passage, wrong zone or unsupported revision fail closed. Diagonal path corners must have two orthogonally free neighbors.

The map-aware constructor `CollisionWindow::from_server_collision_manifest(ZoneId, version, revision, bounds, blockers)` is **not yet called by live gameplay**. Its future caller must be the approved authoritative **Rust world/door collision pipeline**, not browser-authored display data. The prototype navigation reuses the same implementation through an explicit `NavigationSpace::Pilot` input for three existing **nonphysical** test barriers. Precomputed pilot routes retain previous positions and animations; no world hot-path Dijkstra execution, combat collision or actor mutations were added.

Tested: Rust contracts for version/zone, nonzero revision, local map windows at real 4k Moonvale coordinates, finite resource bounds, invalid blockers, blocked endpoints, total obstruction, and diagonal corner-cut resistance. The pilot’s original route/obstacle tests still use the same planner. There are no new protocol packet types or JS dependencies in LW-1E.

**Next boundary:** obtain a separately versioned, approved, map-to-Rust **collision** manifest from the World & Buildings integration stream, with doors/portals and occupancy metadata. Bind NPC states and physical interactions to the correct zone, then replan only on server-authorized geometry revisions. Until then, all in-game NPC geometry remains **staging-only**, off by default and loopback-only.

## LW-1F — Revision-pinned NPC movement (future server-world handoff)

The new `RevisionedRoute` is a separate, **not-yet-activated** Rust world-agent
controller ready for a trusted world/zone server to own. A caller must first
construct a validated `CollisionWindow` from the server-approved zone collision
revision and plan a path. The route records the originating zone, collision
revision, exact current grid cell, and goal. It does not accept browser movement,
teleport requests, position overrides, or visual-only building footprints.

- Server tick advancement accepts **at most one five-unit waypoint per six
  authoritative ticks**. Duplicate and stale ticks are ignored; delayed ticks
  never fast-forward the NPC or skip grid path nodes.
- The caller must supply the **same zone and revision** that authorized the
  path on every advance; stale or wrong-zone collision inputs cannot move it.
- A trusted *newer* collision revision replans from the NPC's current location.
  Replaying a revision, using a lower revision, or crossing map IDs is rejected.
- If the new geometry blocks the current position, target or all paths between
  them, the old path is **discarded and the NPC halts**. It cannot resume through
  the obsolete collision map. A later newer, traversable revision can recover
  movement without teleporting, granting items, or changing player state.

These properties have focused Rust tests for monotonic server ticks, no
duplicate movement, wrong-zone/stale revision, complete new-wall obstruction,
recovery from a newer collision revision, and successful repathing around
changed geometry. **The active LW-1D demonstration still follows its original,
static three NPC pilot routes**; this movement controller intentionally remains
unspawned until server-owned Greyhaven map collision and cross-zone ownership
arrive from their independent PR streams. No live combat physics or browser
protocol changes were made.
