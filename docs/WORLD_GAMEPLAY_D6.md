# World & Gameplay D6 — Local Moonvale Field Survey

**Status:** preview-only exploration activity; stacked on D5 (which remains draft). No live systems, production movement, persistent inventory, economy, character progression or world resource entities were activated.

## Player experience

The offline authored Moonvale preview has eight fixed natural observation locations, placed near existing explorable roads and countryside rather than generated at runtime. While standing near a marked site, **F** inspects it and adds a **once-per-preview-session note** to a field notebook. Unvisited notes show geographic clues, while visited ones reveal the environmental observation. Rings show locally authored locations in view. The Red Lion interior has no survey sites.

| Site | Type | Region |
| --- | --- | --- |
| Roadside Herbs | botany | Greyhaven east road |
| Millfield Flax | botany | Old Mill western fields |
| River Reeds | botany | West bridge shore |
| Roadside Stone | geology | King's Road west |
| Watchpost Ore | geology | Fallen Watch south approach |
| Stonebrook Clay | geology | Stonebrook village approach |
| Hedgerow Berries | botany | Southern farms |
| Eastern Oak | forestry | Eastern woodland |

An observation **does not** harvest stock, create a lootable world item, add inventory, mint any currency, grant experience, reserve land or transfer maps. There is no blockchain/custody, no drops, no respawn timer, no market or property impact. This is intentionally an exploration/teaching slice, not a production gathering economy.

## Contract and ownership

- `src/world/field-survey.mjs` defines immutable `FIELD_SURVEY_MANIFEST_VERSION = 1` and eight unique stable IDs, each with one authored approach coordinate, category, clue and observation.
- `nearbyLocalFieldSite(mapId, x, y)` is a pure proximity query, returning the nearest site within **68 world units** with a valid 18-unit-radius collision position. Invalid/nonfinite/wrong-zone or blocked client positions return `null`. Ties use manifest order.
- `observeLocalFieldSite(notebook, mapId, x, y)` is **only** called on an explicit preview F keydown. It records each site once in an in-memory Set, and returns a descriptive read-only record, never a grant or transaction.
- `localFieldSurveyProgress` counts only manifest IDs, ignores forged IDs and returns a frozen presentation summary. Each preview session uses a separate notebook. Reload resets it; camera-reset **R** intentionally does not.
- `web/world-preview.html` adds survey control legend, a separate notebook UI, an inspection notification, and eight lightweight canvas markers. Visible markers are bounded, no dynamic map scans, no network IO; no production browser or server code changed.
- D6 owns the narrative/approach points. Economics owns future quota, tradeable-value/sinks and any Moon Coin future accounting; Magic & Items owns physical item grants, full-loot corpses and item persistence; Core & Multiplayer owns authenticated distance checks, resource node state, replay protection and authoritative zone/position; Graphics owns final world asset depiction; Physics owns actual gathering collisions/particles. D6 implements none of these.

## Tests and acceptance

- `node --test tests/world-field-survey.test.mjs` tests unique stable manifest IDs, fixed valid unobstructed approach coordinates, F-only idempotence, two independent notebooks, inclusive range, invalid input rejection, forged progress, absence of award payload and offline-only wiring.
- The preview inline module is syntax-checked from its HTML source, and `web/online-game.mjs`, `server/src/main.rs` and `server/src/simulation.rs` are checked for absence of D6 connectivity.
- `.github/workflows/ci.yml` includes an additive D6 validation step without removing any strict existing combat/authoritative networking acceptance.
- Browser smoke review: serve repo root; visit `/web/world-preview.html`; in Greyhaven walk toward the eastern road to find Roadside Herbs, inspect with **F**, see notebook counter 1/8; inspect again (no duplicate); enter Red Lion (no survey prompt), exit, and refresh (counter resets). Surveying other seven points follows authored road/bridge routes. The notebook is visual only and cannot be trusted for multiplayer progression.

## Performance/security boundaries

Eight site records are checked at most per frame for a nearby prompt, with no world-wide entity scan; the marker draw loop also traverses eight records and quickly culls distant sites. Each F press queries local collision and writes a single session Set entry; only on a new entry does it rebuild eight DOM journal rows. Real authoritative gathering requires zero-trust server-side position/tick/identity, bounded and transactional world node stock, anti-spam cooldowns, idempotent resource claims, geometry/line-of-sight rules, per-zone interest management, reliable item creation and audit, and cross-client acceptance at target realm capacity.

## Integration gates

This D6 PR stacks on D5 → D4 → D3 → D2 → D1 → authored world parent #336. Before merge, the central Development Center must repair existing strict M151/M144 parent browser-combat CI failures and run exact-head acceptance. New work remains a non-authoritative, optional offline preview. Department 9 does not merge or deploy directly.
