# World & Gameplay D14 — Linked Chronicle Threads (Offline Preview)

**Status:** isolated World & Gameplay draft stacked on D13 #431, D12 #425 and the earlier authoring/world-preview chain. No live networking, server changes, multiplayer movement, economy, inventory, item grants, NPC interaction, persistence or deployment.

## Player value

D13 adds six standalone historical inscriptions around Moonvale. D14 gives them a **cohesive narrative context** by connecting those six records into two purely descriptive story threads, each built around three already-authored walkable inscriptions.

| Thread | Read these existing chronicles | What becomes clear |
| --- | --- | --- |
| **Of Hearths and Bells** | Red Lion Charter, Greyhaven Market Bell, Stonebrook Mason's Promise | Communities made hospitality their common bond |
| **Wardens of the Road** | Old Millwright's Inscription, Bridge Warden's Mark, Fallen Watch Signal | Workers along separate roads cooperated against harsh weather |

On each D13 **F** inscription read, the existing **Roadside chronicles** journal now also updates a **Linked tales** section. The interface displays the number of records read in each thread, a clue toward the earliest remaining site and the existing thread overview. Once a player reads all three related sites, that thread's completed historical synthesis becomes readable.

**Read order is unrestricted:** a player can explore Stonebrook first, then Greyhaven. The thread correctly registers all already-read entries when the last is found. No additional interactions, travel checks or rewards are required.

## Ownership and implementation

- `src/world/chronicle-threads.mjs`: two immutable, stable-ID, three-site narrative manifests referencing **exactly the six D13** site IDs. Pure `localChronicleThreadSummaries(journal)` and `localChronicleThreadProgress(journal)` project data from the existing D13 in-memory `Set`; they do not mutate it. Forged journal entries have no effect. No complete resolution field is exposed by the summary API until all three visited IDs are present. Narrative strings themselves are shipped in a public client bundle, so this is a *presentation reveal*, not security or cryptography.
- `web/world-preview.html`: a modest **Linked tales** block inside the existing collapsible lore journal (no redesign). On F interaction, `refreshLoreJournal` now updates 2 read-only thread cards and a `0 / 2 complete` counter using `textContent`; no per-frame polling or extra world collision checks. Unread entries only reveal their existing D13 clues.
- `tests/world-chronicle-threads.test.mjs`: seven tests for exact one-to-one six-site coverage, deep immutability, clue-first/summary-only behavior, out-of-order reads, single-thread and double-thread completions, invalid/forged input handling, no reward fields, source syntax, no multiplayer/server wiring, and UI refresh scope.
- `.github/workflows/ci.yml`: new additive strict D14 gate with no inherited acceptance removal.

## Safety, limitations and test plan

Only the authorized offline client-side preview can display these story cards. Their "completion" means a **visual reading summary in the current tab**, not a quest, achievement, claim, collectible, persistent entitlement, player ownership, XP, loot, funds or token settlement. Reload resets the journal. No server-owned identity, live world changes, combat, physics, NPC dialog or economy dependencies are introduced.

```
node --check src/world/chronicle-threads.mjs
node --test tests/world-chronicle-threads.test.mjs tests/world-roadside-lore.test.mjs
# plus full JS suite and browser acceptance
```

Browser smoke: at the Red Lion spawn, expand **Roadside chronicles**. Two story threads should each show `0 / 3`, and `0 / 2 complete`. Press F to read the Red Lion Charter: **Of Hearths and Bells** becomes `1 / 3` and clues toward the Greyhaven Market Bell, without completing the linked tale or affecting the other thread. Repeated F stays at 1/3. Reload resets. Real browser visits to the other sites must be able to complete either tale regardless of reading order.

## Integration

Central Development Center owns merge and release. **D13 #431** exact-head quality must be checked before integration. **D12 #425** exact-head CI failed inherited strict **M205** (server-tick FFA punish), despite its local browser/Node acceptance. Other historical inherited Combat blockers (M151/M144/M171/M194) remain in earlier stack checks. Preserve all gates. Entire parent chain is open/unmerged and `main` has moved; rebase/retest through central integration before merge. D14 itself does not authorize any production deployment.
