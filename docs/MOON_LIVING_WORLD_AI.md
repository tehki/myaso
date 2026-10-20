# Moon Living World AI — myaso.io living NPCs (RFC v0.1)

**Status:** Proposed design, not an implemented or deployed feature.
**Location:** Fixed authored world, Greyhaven / Red Lion Street / Red Lion Tavern.
**Goal:** A persistent-feeling medieval society with conversational, autonomous NPCs whose grounded memories and server-validated actions evolve with the multiplayer world.

## Product promise

- Players converse with nearby NPCs in natural-language chat, reminiscent of Ultima Online. Calling an NPC by name or explicitly targeting them starts a conversation; the same local speech may be heard by other nearby characters.
- Each NPC has identity, personality, vocation, home/work site, daily routine, relationships, goals, current knowledge and beliefs, and an action budget.
- NPCs may *know* the player by display name, but must *identify* them by stable, verified player ID. Renames do not break memory and copied names never grant someone else's relationship history.
- NPC world interactions have real causal outcomes: travel, collect, craft, trade, guard, investigate, buy supplies, invite a player to help, and gossip about events actually in the world.
- World events and player interventions change NPC decisions and outcomes. A memory is factual provenance plus salience, not a free-form unbounded chat log.
- NPCs must not overshadow the skill-based combat loop or generate privileged state by merely saying it.

## Existing baseline and blockers (reviewed 2026-10-20)

- The Rust authoritative server advances combat at 60 Hz and owns movement/action/outcome authority (server/src/main.rs; server/src/simulation.rs).
- Browser game is Canvas-based; realtime state uses datagrams, and the reliable stream supports snapshots/kill events (web/online-game.mjs; web/network-transport.mjs).
- The R0 multiplayer alpha has transient connection-assigned player IDs, **no authenticated persistent accounts or user names**, no proximity chat, and no published world-interaction protocol (docs/R0_OPEN_TRUST_LAYER_MULTIPLAYER_ALPHA.md).
- Greyhaven/Red Lion are the first *art direction* location, not a completed authoritative online settlement. Door/world-object collision, interior transitions and server-authoritative object state remain prerequisites (docs/art/BLOOD_AND_IRON_ART_DIRECTION_RU.md).
- Coding-agent policy defaults content-bearing prompts/messages/responses to ephemeral deletion after use; durable personal conversational memory requires explicit retention-policy design/approval, not a quiet reuse of chat logs (CODING_AGENT_CONSTITUTION_v1.3.md).
- This RFC does **not** authorize a public bind, model-provider connection, user profiling, payment, production deploy, security-policy relaxation, or changes to existing PvP rules.

## Design invariants

1. **Authority:** Language models never mutate inventory, currency, HP, trades, positions, faction reputation or quest state directly. A deterministic server validates every requested action.
2. **No AI per frame:** 60 Hz combat loop stays independent. Ordinary NPC schedules/perception/planning tick on a lower-frequency bounded scheduler; dialogue/model calls are async and timeout/fallback safely.
3. **Truth grounding:** Dialogue receives small, permission-scoped authoritative world facts, recent witnessed events and explicitly retained personal NPC memory. Unwitnessed facts appear as rumors with sources and uncertainty.
4. **Identity:** Private relationship memory is keyed by verified stable account/guest principal ID, NOT player-supplied screen name or rotating combat net ID.
5. **Cost:** Hierarchical brains. Deterministic behavior trees and bounded utility scoring handle daily actions; models handle nuanced utterances and infrequent high-level plans. Explicit concurrency, token, latency and per-player quotas; no LLM in 60 Hz locks.
6. **Resilience:** NPC simulation continues with deterministic fallback when inference is unavailable. No replayed or duplicated trade, quest/reward or world-state transaction.
7. **Protection:** Players and NPC utterances are untrusted. They cannot give the model administrative instructions. Tool calls are enumerated, typed, bounded, proximity/ownership/availability-checked, and logged as metadata.
8. **Data boundaries:** User messages are ephemeral unless an approved policy explicitly permits a particular derived game-world memory. Players need clear notice and means to inspect/reset memories attached to their identity.
9. **World authored, not generated geometry:** AI changes world *state*, not arbitrary geometry, terrain or collision. New map assets/portals require reviewed content.
10. **Combat first:** No NPC capability may regress input latency, movement, parry/roll windows, snapshot bytes, positional interest management or alpha availability.

## Runtime architecture

**A. World State (Rust, authoritative):**
- NPC registry with immutable NPC IDs and spawn/home/work/route anchors on the authored map.
- Entity state: position, role, inventory/stock, health where applicable, job, schedule, faction, needs, resource rights, goal, task queue, version.
- Event journal with structured, typed game events (time, actor, region, witness scope, verified action ID, version). Deterministic reducers update known world state.
- Versioned durable storage and transactional command application with idempotency keys; snapshot/compaction and crash recovery. Design storage first; do not add synchronous writes to the combat thread.
- Spatial interest/visibility replication for nearby NPCs; no AI/voice payload in the lossy combat datagrams.

**B. NPC Behavior (Rust, lower-frequency):**
- Perception reads an authorized snapshot: nearby players/NPCs, objects, local weather/time, events and social knowledge.
- Schedules and utility-scored goals select routine work and reactions. Pathfinding stays within navmesh/passable authored collision and crowd constraints. Movement is authoritative.
- Opportunistic high-level planning may consult an LLM when a genuinely novel situation arises, capped and auditable. The planner proposes a structured intention, never raw executable code.

**C. Dialogue (reliable channel, async workers):**
- Player submits bounded UTF-8 text, target NPC ID and message nonce. Server validates session, target proximity, cooldown, content size and scene visibility.
- Persona + allowed world facts + short relevant relationship facts + last few ephemeral turns => model adapter. Model returns text and zero or more *proposed* typed intents.
- Server validates and applies intents via the deterministic action layer; dialogue text must describe the **result**, never claim an uncommitted action succeeded.
- Reliable packets use a separate versioned NPC/chat envelope, bounded queues and connection-scoped sequence numbers. Never reinterpret existing combat snapshot packets.
- Provider interface supports local inference (e.g., Wisdom when authorized), hosted inference or deterministic scripted fallback. No external inference endpoint or key is committed.

**D. Relationship & Knowledge Store:**
- Principal is authenticated/signed guest ID; display names are labels and histories, not a security key. A name-only alpha session can receive ephemeral memory *only* and cannot qualify as cross-session recognition.
- NPC-to-player memory keeps small verified facts: met, helped, traded, attacked, promise, debt, rapport, last seen, faction impact. Provenance, version and optional expiration belong to each fact.
- NPC-to-NPC rumors are separate non-authoritative beliefs with source and confidence; they can be false and corrected, but never grant loot/money/powers.
- Bounded per-NPC/per-player facts and opt-in/reviewable retention. No indiscriminate storage of full dialogue or provider prompts. A dedicated retention/consent design review precedes persistence.

## Allowed actions (phase-gated)

- Phase A: look_at, greet, speak, move_to_known_anchor, inspect_public_world_event, start_follow_with_consent, patrol_route.
- Phase B: gather from authorized resource node, place item in actual stock, buy/sell with checked inventory and server prices, deliver item, hire/request help.
- Phase C: offer templated contracts tied to real events; verify objective completion through deterministic event evidence; award only real stock/ledger-authorized rewards.
- Phase D: coordinate guards and merchants, repair existing structures, reputation/faction response and localized economic changes.
- Excluded until explicit design: free-form arbitrary item spawning, minting coin, changing player accounts/roles, deleting other players' structures, executing scripts, uncapped NPC combat spawns and off-map teleportation.

## First playable vertical slice: Greyhaven

Start with **five** distinct NPCs:
1. **Aldric the Innkeeper** — Red Lion, hears local news, remembers guests, tells witness-grounded rumors.
2. **Marta the Blacksmith** — smithy, work/rest cycle, can discuss actual stock and request supplies.
3. **Captain Rowan** — town watch, patrols the street, warns of known incidents and responds to assaults.
4. **Elara the Merchant** — travels between known trade posts, prices/supply constrained by server stock.
5. **Tomas the Laborer** — works at well/woodpile, assists scripted logistics and witnesses happenings.

Initial localized scenario: a merchant caravan misses its arrival. The server creates a missed-arrival fact; guards investigate, the innkeeper learns a rumor through NPC gossip, players ask questions, then the outcome changes what NPCs say. No generated loot, quest reward or robber incident unless the event engine actually recorded it.

### Player UX

- Enter opens chat and suspends movement/attack controls while focused. Escape closes it; existing combat controls are unaffected when chat is closed.
- Nearby dialogue is visible as a speech bubble and a bounded text log. NPC name, speaking/thinking indicator and current disposition are shown.
- Click/tap nearby NPC or address by name; only in-radius, visible NPCs reply. Long/model failures get a quick, in-character scripted response, not a frozen UI.
- Scope NPC private memories to the authorized player, not broadcast as gossip or replayed in public chat unless they are public world events.
- Start text-only. Optional voice and accessibility narration are separate performance/privacy milestones.

## Proposed development sequence

**LW-0 — contracts and identity:** authoritative NPC entity/ID and action contracts, reliable chat protocol spec, threat model, names/auth identity and retention decisions. Separate from combat v1 packets. Acceptance: no name impersonation, bounded malformed packet rejection, policy review.

**LW-1 — deterministic Greyhaven inhabitants:** feature-flagged, server-owned NPC entities, schedules, navigation, proximity presentation and scripted chat/fallback. Two browsers see consistent positions and public utterances. No model required; bot activities persist across restart after storage is accepted.

**LW-2 — grounded conversational intelligence:** asynchronous provider abstraction, prompt/output hardening, relevant short memory retrieval, budget limits, circuit breaker, test fixtures for unavailable model and malicious player utterances. First private/name-aware dialogue.

**LW-3 — verified world agency:** inventory/resource/trade guardrails, rumor/event propagation, deterministic contracts, local reputation; replay and rollback tests. Every action must have recorded idempotent evidence.

**LW-4 — living-world scale:** many concurrent NPCs, background offscreen time advancement, sim fidelity tiers, zone handoff, prioritization, distributed load tests, ongoing profiling and moderation.

## Non-negotiable acceptance gates

1. Existing combat suite, Rust formatting/clippy/tests, browsers and packaging remain green.
2. Two clients talking to Aldric cannot steal or corrupt each other's memory; changing display name preserves rightful identity; duplicate names confer no access.
3. NPCs can truthfully describe recorded event history and distinguish firsthand knowledge from rumor; no hallucinated completed action.
4. Trade/rewards cannot overspend, duplicate, race, or bypass proximity/ownership/stock checks even when model suggests them.
5. NPC idle routines continue during LLM outage; slow inference never stalls the authoritative simulation lock.
6. NPC actions survive clean restart, journal replay and crash-at-commit tests once durable data is enabled.
7. Prompt injection in player chat and in NPC gossip cannot invoke unlisted tools, leak private facts or bypass moderation.
8. Memory privacy, retention, inspection/deletion, capacity and provider boundaries are documented and explicitly reviewed.
9. Load tests measure tick latency, CPU, outbound bytes, model calls/minute and worst-case memory under the current small VPS constraints. Capacity is a measured result, not an assumption.
10. Feature flag off restores current alpha behavior without migration rollback hazards.

## Explicit decisions required before persistent/hosted activation

- Authoritative account identity versus device-bound signed guest identity, plus rename/transfer/recovery semantics.
- Policy-owned classification and exact retention for derived NPC memories; deletion/audit mechanics; informed notice and controls. Existing ephemeral-message rule remains in force unless the governing policy is revised through review.
- Inference host boundary (local Wisdom or separate model service), approved credentials/network path and monthly computational budget.
- Exact first settlement anchors and navigation/collision contract after Greyhaven authoritative map/portal integration.
- Moderation rules for free-form public and private NPC dialogue, including multilingual text.

This RFC creates **no runtime behavior** and should not be confused with an AI integration. Implement each stage in independently testable, gated PRs.
