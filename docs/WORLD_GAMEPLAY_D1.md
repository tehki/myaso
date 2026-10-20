# World & Gameplay D1 — audited Moonvale discovery slice

Status: **preview-only, stacked for review**. Department 9 does not authorize production, merging, inventory rewards or zone transfers.

## Evidence baseline (2026-10-20)

- `main` observed at `7c5fe9b08e86254cff9e05ae07c1d0d572cb7879`.
- `server/src/simulation.rs`: Rust authoritative combat/movement World, 60 Hz, baseline 8192 × 8192 coordinates. The initial live gameplay is still an arena, not a persisted sandbox geography.
- `server/src/zone.rs`: B1 server-owned Moonvale and Red Lion map identities / guarded door authorization. Module explicitly dormant relative to production connection, snapshot and combat paths.
- `web/online-game.mjs`: online fighter/camera rendering, network prediction and reconciliation. Avoid modifying performance-critical client code for the first content milestone.
- `web/game.mjs`: local sparring and combat sandbox; distinct from the authored-world walking preview.
- `src/world/authored-maps.mjs`, `src/browser/authored-world-renderer.mjs`, `web/world-preview.html` are added in **open PR #336**, not merged into current `main`. PR #336 contains a fixed designer-authored 8192 × 8192 Moonvale, Greyhaven and surrounding roads, two villages, Red Lion Inn interior and a bounded tile-cached visual preview.
- PR #340 is dormant two-World simulation/atomic transfer work; PR #341 is dormant door wire/ACK and replay-guard work. Neither claims real transport activation. World & Gameplay must not mutate those authority protocols independently.
- Active surrounding systems include NPCs #353, inventory/loot #354, art #350, sound #355, physics #357 and economics #358. Their contracts and merges are separately reviewed.

**Current limitations:** No production persistence of world modifications or player discovery; no live collision-authoritative structures/portals; no authoritative resource spawning/harvesting; no property, quests or profession ledger. Do not imply visuals confer collision, public interiors, ownership or a multiplayer reward.

## D1 scope — something to discover, not merely scenery

Build a local, low-cost explorer's journal in the existing authored Moonvale walking preview. Four fixed discoveries follow an intelligible walk from Greyhaven to the western road and the northern frontier:

1. The Red Lion — familiar starting landmark.
2. Greyhaven Market — an immediate local destination.
3. The Old Mill — a reason to follow the west road.
4. The Fallen Watch — a longer northern journey with a memorable ruin.

The manifest uses stable versioned IDs and explicit authored proximity circles. Journal clues point players to geography without putting markers on a minimap. Each site is recorded only once per visitor's **current preview session**. Visiting sites never creates items, XP, money, magic, teleport permissions, server messages or claims. Reloading the preview clears the local session; it is not durable world progression. No network assumptions are introduced.

The geometry contract reuses `MAP_IDS.overworld` and `getAuthoredMap` from #336. Discovery points are near existing authored path/building scenery and within the map's safe coordinate range. The local browser owns only presentation; the server must validate any eventual persisted credit.

## Interfaces owned by neighboring teams

| Dependency | World & Gameplay contract | Owning department |
| --- | --- | --- |
| Geography | Stable landmark ID, map ID, x/y, radius, version; preserve authored map placement | Graphics / World & Buildings |
| Persistence | In future, authenticated fighter identity, authoritative zone/position, single-credit transaction and manifest migration | Core & Multiplayer |
| Items | Reward item types and physical drops exclusively through authoritative item APIs; none in D1 | Magic & Items |
| Resources | Node type/region/respawn quotas, idempotent server harvest requests | Economics, Magic & Items, Physics |
| NPCs | NPC route/spawn points and bounded environmental signals; no direct NPC state mutation in D1 | AI & NPCs |
| Combat | No damage, knockback, movement or PvP-rule changes | Combat |
| Visuals/audio | Preview journal only, no combat particle/sound asset pipeline touched | Graphics / Sound |

## Roadmap / incremental release gates

1. **D1 — local journal** (this stacked PR): deterministic, visit-once landmark discovery in the authored preview, zero simulation/transport effects, automated tests, manual walking proof.
2. **D2 — single living neighborhood**: after #336 lands and CI passes, align one small playable Greyhaven/West Road region with collision-safe paths, verified spawn and authored landmarks. Integrate the presentation only behind an explicit preview gate until server state is ready.
3. **D3 — server-backed exploration**: Core design review first. Versioned discovery manifest with server-only distance/zone validation, persisted per authenticated character with atomic once-only credit and reconnect/restart tests. No currency/reward until item/economy contracts are signed.
4. **D4 — first gathering activity**: one geographically constrained server-owned node type; bounded stock, cooldown, idempotent requests and physical item grant via Items. Economy signs off regen and sinks.
5. **D5 — risk-reward expedition**: connect a wilderness ruin to an AI encounter, full-loot drop contracts, safe return path and regional hazard; two-player browser proof.
6. **D6 — professions and presence**: incremental crafting inputs/consumption, ownership placement validation, guild/faction state after Core/Economics transactional contracts. Only later add bounded living-world events and seasonality.

Do not expand the map or introduce new procedural terrain until the neighborhood passes playable acceptance.

## D1 acceptance

Automated (`node --test tests/world-landmark-discovery.test.mjs`):
- Manifest version and unique stable IDs.
- Finite coordinates, bounded proximity radii and inside overworld bounds.
- Deterministic one-time discovery, replay idempotence, boundary inclusion and stable manifest order.
- Unknown map / tavern / out-of-bounds / NaN / infinity fail closed.
- Independent local journals, no fabricated-ID progress and zero item/reward payload.

Playable review:
- Serve the repository at the root and visit `/web/world-preview.html` from the D1 branch.
- Walk from Greyhaven's Red Lion to the market; discover each once and check journal title, progress and clue reveal.
- Follow the western road to the mill, or the northern road to the old watch ruin; counter increases only upon physical arrival.
- Leave/revisit the same landmark, and enter/exit the local Red Lion preview: no duplicated credit. Refresh resets progress.
- Combat/online play and all production zone APIs remain unchanged. This preview cannot prove multiplayer persistence.

Performance:
- Four fixed candidate distance-squared comparisons per preview render tick, no map/entity scans and no per-frame journal DOM mutation.
- On change only, rebuild at most four journal entries. No allocations by the discovery scanner when nothing new is found beyond its empty return array.
- Existing authored renderer keeps its 512-unit cached tiles, 24-tile cap and 3 new canvases/frame. Do not infer 512-player performance from a local DOM test.
- Follow-up server milestone must benchmark inactive-zone budget, replicated entity count, authoritative frame time, memory and multiple-concurrent visitor correctness.

## Integration blockers

- **Stack base:** open PR #336, on branch `feat/world-buildings-authored-v10`. D1 must not merge independently of that dependency. Rebase/retarget to `main` only after central review and #336 integration; rerun exact-head checks.
- PR #340 / #341: genuine server-owned map transfer and snapshots are still not live. D1 cannot award discovery credit inside production maps.
- Manual browser exploration evidence and full required GitHub `quality` are distinct checks. Reviewers must not equate JS unit green with a shipped world.

## Rollback

Do not load the D1 preview module; the current live server and multiplayer browser code are unchanged. No persistent migration or economic data exists to roll back.
