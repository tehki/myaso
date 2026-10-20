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

## LW-1G — Grounded NPC-to-NPC local news (loopback-only)

**Aldric, Marta, Rowan, Elara and Tomas can now share a verified,
short-lived local report at an actual pilot NPC encounter.** If the combat
simulation reports a death in the existing authoritative `CombatEvent::Death`
path, a nearby NPC may **directly witness** that event. Once per simulated
second (60 ticks), a direct witness can tell another NPC if their server-timed
positions are within 105 world units **and** the straight conversation path
does not intersect a known pilot barrier. No browser/client chat packet can
inject a witnessed event, start social updates, name a news source, or modify
the supply ledger.

NPC dialogues distinguish the evidence levels: a direct witness says
**"I witnessed a fighter fall"**; a recipient says **"I heard from Aldric
... I did not witness it myself"** (the name is chosen from the immutable
trusted NPC roster); NPCs with neither firsthand nor secondhand evidence
say they have no verified news. Claims about bandits or a missing merchant
remain unverified even when a nearby fighter really died. There is **no**
player name, identity, killer/victim ID, dialogue transcript, procedural
rumor, AI provider, quest reward or persistent database behind this feature.

Only a **firsthand** witness can communicate an event; the NPC that hears
the report may not retransmit it as firsthand knowledge. If it later
genuinely witnesses another combat event, firsthand evidence overrides the
earlier rumor. Both firsthand and secondhand reports expire no later than
two minutes after the **original** world event. The fixed-size arrays
contain only event timestamps and one NPC roster identifier; nothing is
logged or persisted. Moving positions and obstacle avoidance come from the
same NPC server world tick as the previous pilot.

This is not production hearing, visibility, or full dialogue AI. Physical
Greyhaven LOS, obstructions, crowds and interiors remain dependent on the
separate authoritative world collision/door PRs. The experiment remains
off by default, loopback-only, combat-independent and unmerged.

## LW-1H — Evidence-based NPC acquaintances (loopback-only)

The five test NPCs now have a **bounded, server-owned record of confirmed
NPC-to-NPC meetings**. Every second, during the same authoritative social
update used for verified news, the server compares the five current pilot
positions. A meeting requires the two NPCs to be within 105 world units
and the authored pilot barrier check to show an unobstructed line between
them. There are only 10 unique NPC pairs: their records fit into a
fixed-size array, with no database, external AI inference or player identifiers.

A pair's first meeting records one encounter and a server tick.
Continuously standing together does **not** accrue more encounters:
the pair must first separate beyond 125 units and meet again. Counts cap
at eight to prevent inflation, and an acquaintance stops being reported
two minutes after the last confirmed meeting. All encounter state disappears
when the pilot server restarts. The NPC world does not collect the player
nickname, chat transcript, account identity, location history or any
player-to-player reputation.

The dialogue route is read-only. When asked `who have you met`,
`who do you know`, `friends` or `acquaintances`, NPCs report only the
**most recent actual NPC encounter** and the verified number of meetings;
otherwise they say no recent encounter is verified. They explicitly decline
to infer friendship, loyalty or trust from mere proximity. A self-declared
player nickname cannot fabricate an NPC acquaintance.

This is a small **social evidence substrate**, not autonomous psychology,
relationship scoring or roleplaying AI. It has no player rewards, emotion
system, economic effects or persistence. Future authoritative building
obstructions and zone membership must replace the pilot geometry before
any production social simulations. The feature remains behind the existing
loopback-only `MYASO_NPC_PILOT` flag and draft PR #353.

## LW-1I — Verified settlement work histories (loopback-only)

NPCs can now answer a player's **"what work was completed"**, **"latest task"**,
**"who has been working"**, and **"settlement progress"** questions with the
most recent **completed** task in the existing finite authoritative supply
ledger. The report names the NPC from its fixed server task mapping and includes
the operation's original ledger sequence and server tick. Its wording makes
clear that it is a **ledger-confirmed NPC task**, not something the speaker
personally witnessed, a player quest or a player reward.

Only successful supply mutations create task evidence. Supported completions:
Marta forges one nail bundle from an iron bar, Tomas delivers water to the
work yard, and Elara delivers a ration to the market stall. Merely **picking
up** supplies, simulated walking, or a chat request cannot produce completion
evidence. The query is read-only and cannot mutate any stock or event records.
If the ledger has no recent completion (within the last 120 simulated seconds),
the NPC truthfully reports no recently completed work. A bounded 12-event
action ring and finite starting resources ensure reporting stays cheap and
that no activity or resources are manufactured indefinitely.

This does not imply real NPC motivation, persistent occupations, player
jobs, market sales, object ownership, chat-based execution or trade. The
simulation still uses the loopback staging world and is disconnected from
real account identity, item entities, Moon Coin and production.

## LW-1J — Need-driven finite NPC work (loopback-only)

The pilot's forge/porter jobs are **actually selected from current
server-authoritative finite stocks** instead of blindly consuming all
inputs each repeating cycle. Explicit demo settlement targets are: four
water buckets at the yard, four food rations at the market and three
bundles of nails at the forge. Tomas collects and delivers water only
while water is needed; Elara handles provisions; Marta forges only while
nails are needed. Stocks already carried are reserved against the
appropriate collection target, and carrying/delivery has precedence so
unfinished cargo cannot disappear or be repeatedly collected.

The schedule still provides bounded opportunities to act (forge at
tick phase 300, pickup at 600, delivery at 1800 of a 2400-tick
cycle), but **every action now checks an independently derived
`WorkDecision` from server stocks at that authoritative tick**. Each
committed action retains the previous provenance-backed, 12-event
server ledger. Once all targets are fulfilled, everyone is idle:
the remaining *four* well buckets, *four* depot rations and *three*
iron bars are **not consumed**, and no replenishment or player-facing
items are created. Total resources remain conserved.

All players in the loopback pilot can ask `settlement needs`,
`what needs doing`, or `work priorities`. The answer is a ranked
read-only board of unmet work, including work currently carried en
route and resource shortages; alternatively they can ask a worker
`your next task` to learn its current validated intention. Neither
question creates, accepts or completes any work order. Contracts,
rewards, currencies, player inventory and real world-object ownership
remain unavailable. This is server-staged resource balancing, **not a
global player economy or fully autonomous NPC planning**.

Tests cover demand recomputation, carried-resource reservation,
never assigning NPC jobs outside authorized professions, changing
decisions at delivery boundaries, resource conservation, preserving
reserves after many cycles, deterministic idle state after all
goals, read-only queries, and existing supply packets. No combat
movement/physics, browser protocol, player position or production
configuration changes. True Greyhaven tasks will require the separate
authoritative World & Gameplay and Economics interfaces.

## LW-1K — Physical pilot-worksite interaction gate (localhost-only)

**Server-owned staging resource objects** now have explicit immutable site IDs,
worker/operation mappings and positions: well (Tomas, 340/255), work yard
(Tomas, 270/220), supply depot (Elara, 395/150), market (Elara, 315/110)
and forge (Marta, 210/65). These coordinates are *local Greyhaven pilot
fixtures*, not the real Greyhaven map or world item system.

Each NPC supply mutation first checks the server simulation's current
`NpcRoutines::position(actor, tick)` against the expected site, allowed
profession, exact operation and an eight-direction nav-validated staging
route. It requires a distance of ten units or less and an unobstructed
pilot line-of-sight. This is in addition to the existing server tick
schedule, finite demand targets, cargo reservation and conservation:
travel to the source (outward at phase 600), collect, travel back
(inward at phase 1800) and deliver; stationary Marta works at her
forge during phase 300. Failed validation **does not mutate stocks**,
create audit events or award player resources. Client-supplied coordinates
or claimed worksite IDs never reach the mutation path.

Five objects are exposed to the opt-in browser as **read-only worksite
markers** (reliable packet type 11, 34 bytes) with an exact static
site/actor/coordinate decoder. They are separately drawn as small teal
squares and labels, without adding combat colliders, player object
interactions, physics, live economy, terrain ownership, loot or new
datagrams. The packet's exact length, version, count, IDs, roles
and coordinates are validated before the client accepts it.

Unit tests enforce valid phase/site/worker associations and fail-closed
wrong worker, wrong operation, wrong worksite or wrong arrival phase;
the full Rust and JavaScript suites check all existing resource accounting
and protocol invariants. **Browser smoke has not been completed for this
head** because the authorized Serj Linux host's Chromium currently
exits with a SIGTRAP even for `--headless --dump-dom about:blank`.
Do not classify the live browser check as passed; GitHub exact-head
quality CI must provide the separate browser/transport gate.

Actual physical/NPC world-entity integration depends on the separate
World & Gameplay D2 authoritative server collider/door contract, and
on properly modeled server-side object entity ownership. Preview
collision art is not trusted as production physics. The pilot remains
off by default, strictly loopback-only, and unmerged.

## LW-1L — Server-only revision-pinned worksite lifecycle

The bounded pilot worksite registry now has a **revisioned server-owned
availability snapshot** separate from the visual fixed-position type-11
worksite listing. Each of five sites can be unavailable, such as a
closed well, inaccessible work yard, absent market stall or damaged forge.
A future *trusted Rust world-object authority* may adopt a complete
five-site manifest only when it names the Moonvale zone, uses known
version 1, and carries a strictly newer monotonic revision than the
last accepted one. Wrong-zone, unsupported-version, zero/stale or
replayed updates reject the whole change without touching any site.
No player packet, browser form, chat message or public endpoint can
issue an availability revision.

**NPC decisions and actual stock mutations now both require available
physical source/destination sites**: a worker does not pick up materials
if the intended delivery destination is unavailable, and cannot forge
at a closed forge. If a destination closes after an NPC has collected
cargo, the cargo remains in that NPC's conserved server stock slot:
there is no teleport, dropped accounting item, completed task ledger
event, or new pickup while carrying. Upon restoration via a strictly
newer approved manifest, the worker resumes delivery at its next
authorized server-clock arrival, still within the fixed site reach,
without replaying missed actions or consuming duplicate resources.
The read-only settlement-needs dialogue reports a blocked worksite,
rather than inventing a feasible job.

The bounded supply history now additionally associates each accepted
resource mutation with the **current worksite authority revision**,
creating a verifiable internal audit link between a valid site
configuration and the job it authorized. This does not alter the existing
22-byte supply wire protocol or entitle players to any money, items or
rewards. The localhost pilot starts with all five sites active and
there is **no live world-event producer for dynamic closures** yet:
outages and recovery are tested via direct, trusted Rust fixture calls
only. The browser's static worksite markers therefore still describe
the default all-active staging setup. Future server-authoritative
object updates would need their own validated replication/status flow
before being shown as dynamic interactive props.

Local tests cover stale and wrong-zone rejection, atomic rollback on
invalid versions, missing destinations preventing source pickup,
mid-transit closure preserving finite cargo, later revision recovery,
replayed phase refusal, forge outage/resumption, audit provenance,
and all previous world/transport invariants. The World & Gameplay
preview-only collision manifest is still not connected; no production
zone, combat collider, currency, inventory or loot state is modified.

## LW-1M — Reliable revisioned worksite-status snapshots (loopback-only)

The five immutable LW-1K worksite anchors (well, yard, depot, market,
forge) still arrive as pilot-only reliable packet type 11. LW-1M adds a
separate **12-byte reliable type-12 worksite availability snapshot**:
protocol/version 1, status schema 1, authoritative 32-bit revision,
five-bit active-site mask in the fixed site-ID order, and zero padding.
The Rust status producer serializes directly from the same
`WorksiteAuthority` whose availability rules govern stock mutation.
The JavaScript decoder rejects wrong size, type, protocol, schema,
reserved bits, unknown mask bits and zero revisions. No client action
or instruction is added: both packet types flow from server to browser
only.

Every loopback pilot connection first receives the immutable worksite
registry and its matching initial availability snapshot. Its server
connection records **the revision actually sent**, rather than reading
a newer value later; any change during connection setup is therefore
still eligible for the subsequent update. At most once per second,
after combat kill notices, reliable catch-up and NPC state/supply
frames have had priority, the server checks for a strictly newer
worksite revision. It tries to enqueue a small status frame on the
existing bounded reliable queue, retries changes after backpressure,
and never blocks combat simulation to push worksite status. There is
no recurring traffic when the revision is unchanged.

The localhost browser displays the accepted server revision, the
available count and which worksite(s) are closed, and marks unavailable
worksites in muted red. **Only newer revisions are rendered**; stale
and repeated status frames cannot visually reopen a closed worksite.
The display remains strictly informational, with no clickable
resource pickup or browser-owned collision behavior.

LW-1L server-side availability remains all-active by default. No live
world-event producer exists yet, so status changes are currently
provable through isolated trusted Rust fixture tests; this is **not**
an assertion that Greyhaven contains real closable buildings or
interactive player objects. Real-world zone/door/collider ownership
is still blocked on the World & Gameplay authoritative contract.
Rust and JS tests enforce the exact byte schema, read-only status
decoding, closed/reopened site masks and revision fencing. Full
Chromium/WebTransport verification must be separately established by
a working browser test environment and GitHub exact-head quality;
local Serj Chromium previously crashed before navigation.

## LW-1N — Opt-in server-clock worksite maintenance event demonstration

The pilot can now exercise its **real live worksite-status change path**
without accepting any commands from clients or mistaking browser preview
scenery for authoritative collision. Set **both**
`MYASO_NPC_PILOT=1 MYASO_NPC_MAINTENANCE=1` on a strictly loopback-bound
Rust server. Both flags default to disabled independently; maintenance
requires the loopback pilot and the server rejects malformed values or
attempted maintenance without the pilot (including public binds).

When explicitly enabled, a deterministic server-owned **staging event**
closes the work yard at authoritative world tick **900**
(roughly 15 seconds after startup) and reopens it at tick **2100**
(roughly 35 seconds after startup). This does **not** represent
real player destruction, a weather system, authored map interiors or
physical building damage. No client packet or chat prompt can change
the event schedule or authority state. The stage-only event is applied
from the existing sequential 60Hz Rust simulation clock and calls
exactly the same versioned Moonvale `WorksiteAuthority` as prior phases:
revision 1 (all available) to revision 2 (work yard unavailable), then
revision 3 (all available). The normal type-12 reliable status replication
observes and delivers newer states when its bounded queue has capacity.

The sequence deliberately exercises a **mid-delivery closure**.
Tomas collects one well bucket at tick 600; when the work yard closes,
he still owns the conserved carried water, cannot deliver at tick 1800
and cannot collect more. A newer authoritative revision reopens the
work yard at tick 2100, and the existing scheduled route delivers
the same bucket at tick 4200. All stock and the task ledger remain
conserved; no catch-up teleport, fake completion, duplicate payout or
extra fighter is created. Other independent workers may continue their
valid jobs while Tomas is blocked.

The fixture never overwrites a newer or independently modified
trusted worksite manifest: it adopts the close only while at the
default revision 1/all-active state and reopens only from its own
specific revision 2/yard-closed state. Replay, skipped/discontinuous
server ticks and any other source's version change prevent the
fixture from inventing an update. Ordinary NPC pilot runs with the
maintenance flag unset behave exactly as before.

Example local command:

```sh
MYASO_BIND=127.0.0.1:4433 MYASO_NPC_PILOT=1 MYASO_NPC_MAINTENANCE=1 \
  cargo run --locked --manifest-path server/Cargo.toml
```

The existing browser NPC panel should report **5/5 available, then
4/5 (work yard closed), then 5/5** as the server advances. Local Rust
tests verify exact live-world ticks, status byte snapshots, safe cargo,
stale/revision supersession, protected admission and eventual
delivery. Authentic browser/WebTransport proof still requires
a successful working headless Chromium acceptance environment;
the last standalone Serj Chromium had crashed independently of
game loading. Full protected exact-head CI remains mandatory.

This is **not** an integration with the still-open World & Gameplay
collision/door PRs, nor production server world entities or active
economics. Disable maintenance before any eventual realm deployment.

## LW-1O — Grounded NPC responses to server worksite changes

NPCs can now discuss the latest **verified server-owned worksite change**
through read-only dialogue. Try `worksite news`,
`what happened at the work yard`, `worksite status`,
`why is the yard closed`, `forge open` or `site closures`.
The speaker reads the very same `NpcSupplyWorld` and immutable five-site
registry that gate NPC supply transfers and produce reliable type-12 status.
Each reply always identifies the **current active worksite count and
authoritative revision**, and names any currently unavailable locations.

Only a **successfully adopted, changing** authoritative worksite manifest
records the latest worksite event. The event is a tiny bounded snapshot
(revision, original server tick, five-bit changed-site mask, five-bit
availability mask), not an open-ended memory, generated narrative, chat
history, or user-supplied claim. Rejected stale, wrong-zone and
unsupported-version updates cannot fabricate events. A revision-only
snapshot that changes no object availability cannot fabricate an outage.
When a real change is less than 120 simulated seconds old, NPCs can
report the specific sites that became available/unavailable, with the
original tick and revision. After expiry only the current live status
remains. The latest event is transient and replaces the prior event;
no persistent incident archive or player identity is created.

When the work yard is closed and Tomas is genuinely still carrying a
bucket, NPCs may also explain that he **retains the water until it can
be delivered**. That claim is read directly from the conserved stocks;
the NPC cannot give, drop, duplicate or sell the water. A reopening
changes the status and verified event, but never claims a player
repaired a building or knows *why* it was closed. Replies explicitly
identify the cause as unverified, without offering player contracts
or rewards.

This builds on LW-1N's **independently opt-in, localhost-only** maintenance
simulation: tick 900 records the work yard becoming unavailable,
tick 2100 records it becoming available again. The normal opt-out
pilot reports no prior changes. No new client-to-server packet type,
new world objects, combat colliders, map/door authority, currency,
persistence or production activation was introduced. The World &
Gameplay preview/collision/door branches remain separate.

Regression tests confirm the first closure and later reopening, event
TTL, exact provenance labels, unverified causes, multisite updates,
no-op revisions, rejected manifests, read-only NPC chat, and conserved
resources. Protected CI and real-browser verification remain the
required acceptance gates for PR #353.

## LW-1P — Task-aware NPC duty state and truthful work dialogue

The NPC pilot now derives **visible worker activity and direct
`what are you doing?` answers** from the same authoritative
`NpcSupplyWorld::decision` and conserved cargo that govern resource
pickup/delivery. Prior static activity labels could falsely describe
Marta forging after all nail demand was met, or Tomas carrying water
before he had any. This phase corrects the NPC *presentation and speech*,
not the movement mechanics.

At every low-priority server-owned type-8 NPC-state snapshot, the
normal 38-byte wire shape, NPC IDs, authoritative world tick and
collision-aware pilot route coordinates remain unchanged. Marta is now
reported as idle when she has no feasible forge job; moving workers
are reported idle **only when actually standing without an assignment**.
When they are visibly walking a staging route without an active
job, their movement indicator remains walking—the server must not
claim that a moving object is stationary. No combat actor, pathfinding
physics, collider, player input or high-frequency tick processing
was added.

The server's read-only dialogue context is also synchronized with
the current stock and availability revision. Elara only says she is
**carrying market provisions** if her server-owned carried food
inventory and destination justify a delivery. Tomas only says he is
**carrying water** if he actually holds it and the work yard can
receive it. During the opt-in maintenance closure, he instead reports
**holding water until the work yard can receive it**, and after
reopening reverts to the verified delivery description. Marta says
she is waiting for a feasible forge job when her demand is met or
her worksite is unavailable, rather than claiming to produce nails.
An idle moving porter can say they are **walking an unassigned
route**, acknowledging the pilot has not yet connected physical
movement decisions to the real world-task graph. Aldric and Rowan's
existing roles and firsthand combat-witness reports are unchanged.

The initial joined client and subsequent authoritative 60Hz-clock
snapshots use the same shared server stock state to compute duties;
the 38-byte protocol and client-side decoder need no changes.
Calculations are read-only and run with the existing one-second
NPC snapshot cadence. Chats read the same source and never
trigger movement, inventory changes, rewards, repairs or work
assignments.

Tests cover unloaded carrying claims, actual pickup, the mid-transit
maintenance outage, restoration, workers stopping once finite
demand is filled, unchanged packet positions and format,
real moving route labels, fixed NPC roles, and retained combat
witness provenance. This remains behind the existing loopback-only
`MYASO_NPC_PILOT` flag, with optional maintenance as a separate
flag; it does not make NPC markers physical multiplayer entities
or introduce autonomous planning, quests, persistence, money,
AI provider calls or World & Gameplay collisions.

## LW-1Q — One-hop NPC social news from verified worksite events

The NPC pilot now has **bounded, independent worksite-related social knowledge**
for each of the five fixed NPCs. This does not grant a global NPC news feed,
player memory, building damage, persistent social graph, gameplay authority,
or AI-generated facts. The source is the existing trusted
`NpcSupplyWorld::latest_worksite_event`, which exposes only the most recent
successfully accepted, availability-changing Moonvale site revision
(event tick, immutable revision, five-site changed mask and availability mask).
Rejected stale/cross-zone manifests, revision-only no-ops, player chat or
client packets cannot create a social event.

At the next deterministic 60-tick NPC social cadence, a relevant worksite
**operator** can receive an authoritative operational notice for a site
assigned to their profession. This is **not described as physically
witnessing building damage**: the cause remains unknown. For the opt-in
LW-1N closure at world tick 900, Tomas receives the first-hand server
notice that the work yard became unavailable (revision 2). He can
then pass that report to another NPC **only at a verified local meeting**
within 105 pilot units and with pilot-obstacle line of sight. In the
existing collision-aware staging routes, Rowan encounters Tomas near
world tick 1380 and can subsequently answer questions about the
work yard with an explicit **"heard from Tomas in person"** attribution.
At tick 2100 the work yard's authoritative reopening (revision 3)
supersedes the earlier report, and Rowan can learn the newer news
at another local meeting around tick 2520.

The social record is one fixed-size slot per NPC: original event tick,
source site ID, availability, current revision, learned tick and optional
first-hand NPC source ID. Only an **original assigned-site operator**
can share the verified notice; secondhand recipients may **not relay**
it on to other characters or claim to have directly witnessed the
event. Newer revisions invalidate old reports; even a previously
heard closure cannot survive a subsequent reopening revision. Memory
is transient, account-free, and expires after 120 simulated seconds.
Unknown/expired information prompts NPCs to state that they have no
verified personal report. Ordinary `worksite status` questions still
read current global server availability and should not be confused
with personally learned worksite news.

Players may ask `worksite rumors`, `heard about the work yard`,
`who told you about the yard` or `word from other NPCs`.
All answers read from authenticated server NPC knowledge only.
No client command, chat body or LLM can create a meeting, reopen a site,
award goods, fake provenance, cause a maintenance incident or alter an
NPC's position. The existing physical pilot line-of-sight blockers,
normal timed route, resource conservation and first-person combat
gossip remain distinct.

Regression tests assert actual Tomas–Rowan contacts, absence of
unwitnessed or line-of-sight-blocked news, replacement after reopening,
expiry, no cross-zone/player forgery, no secondhand retransmission,
deterministic fixed-roster attribution and unchanged Rust and JS
protocols. The simulation is still strictly localhost-only and is
opt-in via `MYASO_NPC_PILOT=1`, with deterministic maintenance
events separately gated by `MYASO_NPC_MAINTENANCE=1`.
World & Gameplay's real server colliders/doors and true physical NPC
actors are **not yet connected**; do not treat these miniature fixtures
as production Greyhaven.

## LW-1R — Guard patrol attention after a verified colleague warning

In the opt-in Greyhaven NPC pilot, **Rowan can now take a bounded work
decision in response to a colleague's information**. A report is a
*proposal to pay extra attention*, never authority to edit a world
object. First, Tomas must receive a genuine revisioned server notice
that his assigned work yard is unavailable. Only a real local encounter
and pilot line of sight can transmit that first-hand notice to Rowan,
as in LW-1Q. Then at a later legitimate 60-tick social update Rowan
independently verifies that the site is **still unavailable in
`NpcSupplyWorld` at the exact same worksite revision**, that his
current fixed pilot patrol position is within **80 world units** of
the reported site, and that the pilot line-of-sight to the site is
unobstructed. Only then does the server create a small one-entry
**priority watch assignment**: site ID, revision, trusted colleague's
fixed NPC ID, and original assignment tick.

The normal staging geometry creates a reproducible example: Tomas and
Rowan meet while the yard is closed around **server tick 1380**. Their
positions and the unobstructed sightline allow Rowan to put the yard on
his priority-watch list. A player can ask Rowan `patrol priority`,
`guard response`, or `what are you watching`, and he will say
he is paying priority attention to the site following Tomas's
face-to-face report. His answer explicitly says the server still
confirms closure, with the revision, and **does not claim he repaired
it or changed his route**. His `what are you doing` response also
reflects this assignment while it is valid.

When the authoritative yard status reopens at tick 2100, or a newer
server revision supersedes the evidence, Rowan's watch immediately
becomes invalid and is cleared on the next social update. A stale
notice, a closed-site claim when the server actually says open,
no verified face-to-face meeting, an out-of-range or blocked
patrol lookout, a disallowed NPC, an expired assignment, or player
chat cannot generate or sustain a guard decision. Guards do not
retell secondhand information as firsthand evidence.

The assignment affects only a tiny server-owned NPC duty/memory
record and its read-only dialogue. **It neither changes Rowan's
patrol path nor a physical actor's position**, and cannot mutate the
worksite status, source inventory, NPC supply ledger, player
inventory, economic balances, combat collision, access control or
navigation geometry. A real dynamic escort/investigation movement
must await World & Gameplay's authoritative collision and object
interfaces. The existing static pilot patrol continues to run.
All maintenance scenarios remain separately gated behind
`MYASO_NPC_PILOT=1` and
`MYASO_NPC_MAINTENANCE=1` on the loopback-only server.

Tests cover the real meeting and lookout, source attribution,
blocked/no-change server status, wrong-range site visits,
one-assignment-per-revision, exact revision invalidation after
reopening, player-chat nonauthority, and no extra resource or
combat changes. The existing reliable client packet types stay
unchanged; all player-facing queries are read-only.

## LW-1S — Optional reversible guard inspection detour (pilot geometry only)

Rowan now has a **real server-simulated movement proof** that he can
temporarily divert toward a reported worksite and return smoothly
without editing combat physics, player actors, terrain or production
navigation. This feature is behind a **third independent runtime gate**:
`MYASO_NPC_GUARD_DETOUR=1` is rejected unless the strictly
loopback-only `MYASO_NPC_PILOT=1` and the separately opted-in
`MYASO_NPC_MAINTENANCE=1` are both enabled. All three flags default
to off. Ordinary staging NPCs still follow their earlier fixed routes.

After the server-verified yard closure at tick 900, Tomas can report
to Rowan in person at around tick 1380. Rowan must first accept the
LW-1R priority watch from the same current authoritative worksite
revision and actual near-site, unobstructed lookout. Only then does
the pilot guard-detour controller generate a route from his **server
position at that meeting** to the immutable yard worksite. The
route is planned from the same bounded, server-owned *pilot*
`CollisionWindow` as the authored NPC obstacle navigation, and all
waypoints are checked for pilot-obstacle line-of-sight and exact grid
membership. Starting positions may be snapped by at most two pilot
units only when the joining segment is unobstructed; unsafe or
unreachable site positions reject the detour instead of teleporting.

The guard's authoritative pilot marker coordinates move along the
chosen immutable route over 600 simulation ticks. If the yard is
still closed, Rowan can pause for a bounded 300-tick lookout and then
return; if the *server* restores it at tick 2100, he **reverses the
same valid path**, rather than continuing toward an irrelevant
destination. An earlier valid restoration triggers an earlier
reversal from precisely the distance already traveled. On return,
Rowan resumes the original authored patrol from **the same baseline
position where he left it**, by pausing his own local patrol phase
clock during the detour. Other NPCs retain their original positions,
their jobs, and their finite conserved cargo.

The snapshot remains the exact same 38-byte reliable NPC marker frame
(type 8). During an opted-in detour the server sends Rowan's actual
staging position via the same one-second status cadence; the client
need not trust its own path planner. NPC social encounters, sight
observations, dialogue and combat-death witnesses use Rowan's
server-controlled *actual staging position* while detouring, not
his obsolete fixed schedule. The `guard response` correctly says
he is on a **pilot-only inspection detour** and explicitly never
claims to repair a site, affect a fighter or possess building access.
There is still no live map collision or dynamic production navigation:
World & Gameplay's authoritative collider/door contract remains
unmerged and **must not be replaced by the pilot test geometry**.

Regression tests validate protected startup admission; bounded
path planner rejection for blocked/out-of-bounds targets; safe
interpolated waypoints and no added colliders; Rowan's initial
meeting and actual detour; authenticated early site-reopening
canceling and reverse walking; late reopening; continuity on return;
unchanged locations of the other four NPCs; unchanged 38-byte
wire layout with a genuinely different Rowan coordinate;
no resource creation or task accounting mutation; and preservation
of disabled-by-default baseline behavior. Exact-head CI and
browser/WebTransport acceptance still gate merge.

## LW-1T — Server-tick-committed NPC movement and immediate revocation

The optional, three-flag localhost-only Rowan worksite detour
(`MYASO_NPC_PILOT=1`, `MYASO_NPC_MAINTENANCE=1`,
`MYASO_NPC_GUARD_DETOUR=1`) now **moves exclusively on accepted
consecutive authoritative 60Hz world ticks**. Its staged route
progress is stored in a small server-only guard state; a caller
asking for an arbitrary earlier or future NPC position can only
read the **last committed** detour position, never accelerate the
actor. Replayed, out-of-order or skipped movement ticks do not
advance the route or create duplicate movement. Standard NPC
movement continues unchanged when the detour flag is absent.

After each authoritative world step, the server first adopts any
scheduled NPC worksite revision, then advances the guard detour
**on that exact tick**, then calculates NPC social meetings and
worksite news from the newly committed NPC position. The combat
simulation still runs separately and before NPC processing.
A valid server revision that reopens the work yard now begins
Rowan's return path on the **exact revocation tick**, instead of
waiting for the next 60-tick social update (previously up to one
simulated second later). The last forward waypoint is retained
on the reversal tick, and the guard walks back one unit of
authorized progress on each subsequent world tick. Patrol phase
is paused for precisely the accepted detour duration, preserving
position continuity at the departure point.

This does **not** authorize navigation through an unmerged
production collider, door or building. Route generation still
uses the same fixed authored pilot obstacle window, with no
client-supplied geometry. All player combat, item, economic and
zone-ownership state are untouched; the existing 38-byte NPC
position wire format is unchanged.

Tests include a restored work yard at **tick 1501**, before the
next social update: Rowan reverses immediately at progress 120,
does not jump forward, returns to his departure at tick 1621,
and then resumes the original route smoothly. Separate tests
show that querying tick 60000, replaying a tick or requesting a
nonconsecutive tick cannot advance the server-only detour.
Full-cycle retirement, other NPC motion, finite supply conservation,
and default-off isolation continue to be checked.
