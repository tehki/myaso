# World & Gameplay D7 — Session-Local Explorer's Expeditions

**Status:** draft offline authored-world preview feature. Stacked on D6 #389 → D5 #384 → D4 #380 → D3 #371 → D2 #366 → D1 #359 → World Foundation #336. No merges, live movement/portal activation or deployment by Department 9.

## Player experience

The preview now offers three short, ordered journeys through locations already authored into Moonvale. Pick a route in the **Explorer's expeditions** panel. The panel displays the current stage and a geographical clue. Complete landmarks by physically approaching them; complete natural-site steps by pressing **F** when nearby. Changing or restarting the selected route resets *only its local stage counter* (not the independent field notebook or discovery journal). Progress lives in a JavaScript object for the current preview session, resets on reload, and never authorizes anything in the game backend.

| Journey | Ordered milestones |
| --- | --- |
| Greyhaven Circuit | Red Lion → inspect Roadside Herbs → Greyhaven Market |
| Western Survey | Greyhaven Market → Old Mill → inspect Roadside Stone → inspect River Reeds |
| Fallen Watch | Red Lion → Fallen Watch ruins → inspect Watchpost Ore |

The existing D1 discoveries and D6 field notes are independent presentation achievements. A player who already recorded a D6 field note may still advance a selected expedition by inspecting the same site with **F**; no duplicate note appears. Likewise, a previously discovered landmark counts as a route visit only when the player is physically in range during the active stage. Visiting the last stage shows a simple completion message, **without items, XP, titles, money, Moon Coin, trade, property ownership or persistence**.

## Interfaces and safety

- `src/world/local-expeditions.mjs`: immutable versioned route manifest and local route-progress object with `chooseLocalExpedition`, `localExpeditionProgress` and `advanceLocalExpedition`. The latter accepts one event: ordinary nearby `visit` for a landmark or explicit `inspect` for a natural site. No reward, inventory or server event fields.
- All targets reference **existing** `MOONVALE_LANDMARKS` and `MOONVALE_FIELD_SITES` objects by stable ID. The location/map checks use the same D2 preview collision and authored approach geometry; invalid, blocked, remote and cross-map coordinates fail closed for the local UI.
- `web/world-preview.html`: accessible three-button expedition chooser, stage status, a single active hint and milestone notice. The route checker performs at most one known-site walkability and proximity calculation per frame. F-key stages run only upon an explicit non-repeated F keypress. DOM updates occur only on route changes or successful milestones.
- `tests/world-local-expeditions.test.mjs`: immutable referenced manifest, ordered/no-skip route progress, valid/invalid position and map cases, independent sessions, restarting routes, no economic payloads, inline module syntax and no online/server integration.
- `.github/workflows/ci.yml`: extra D7 quality gate; no existing combat, anti-cheat or Rust validation steps removed or bypassed.

The local state object is deliberately not an authoritative world or character record. The API's coordinates are caller-provided and thus **untrusted for multiplayer**. Core & Multiplayer must provide server-owned identity, zone, movement position and fixed-tick provenance before persisted quest progress is ever possible. Magic & Items, Economics, and Combat continue to own all loot, rewards and PvP outcomes.

## Review checks

```
node --test tests/world-local-expeditions.test.mjs tests/world-field-survey.test.mjs
node --check src/world/local-expeditions.mjs
# Quality runner also performs the full Node/Rust, browser and combat suites.
```

Manual/offline Chrome: serve repo root, open `/web/world-preview.html`. Select Greyhaven Circuit (Red Lion should record automatically near spawn), walk to Roadside Herbs and press F (2/3), walk toward Greyhaven Market (3/3). Repeated F near herbs must not double-credit. Switch to Western Survey to see a new ordered 0/4 journey, with independent field notebook maintained. Reload resets all local route choices. Enter Red Lion and try F; it must never progress an overworld survey stage.

## Known limitations and release gates

There is no minimap, GPS pathfinding, NPC escort, quest reward, persistent world action, multiplayer event subscription, resource harvesting, weather or economy transaction in D7. Landmarks are fixed authoring decisions, not dynamically spawned objects. The preview scene is not proof of 512 real concurrent players or two-client authoritative state.

World Foundation PR #336 remains blocked by inherited M151 browser combat acceptance; D4 #380 had a red M144 combat acceptance, D6 #389 a red M194 combat acceptance. Preserve strict combat checks and resolve with Combat/Development Center. This stacked work remains in draft until all exact-head and integration checks pass, followed by centralized merge/deployment only.
