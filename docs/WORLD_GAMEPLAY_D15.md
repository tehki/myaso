# World & Gameplay D15 — Chronicle Clue Atlas (offline)

**Status:** draft, stacked on World & Gameplay D14 #438, all earlier World branches through #336. No independent merge or production deployment.

## Player experience

Moonvale's optional **M** sketch now helps explore the two D14 narrative threads. While the map is open, **at most two violet diamonds** identify the next unread authored lore point from **each unfinished thread**. These correspond exactly to the earliest unread D13 inscription shown by the existing *Linked tales* text. Reading an inscription with **F** changes the current journal Set, and the next visible sketch refresh shows the next unread clue for that thread. A completed thread contributes **no** pin. Read order is unrestricted.

The violet diamond and associated legend clearly indicate *story clue locations only*, **not a traversable route**. There is no straight-line path drawn toward a clue. The map's original roads, buildings, player (white), active expedition destination and certified milestone routes (amber), and sampled-clear rejoin hint (cyan) remain separate. A nearby story diamond is omitted within 24 world units of the player's current position, so it does not cover the white player dot. Closing M hides both new pins and their legend; there is no drawing cost while the sketch is hidden.

## Implementation

- `src/world/chronicle-atlas.mjs`: `localChronicleAtlasMarkers(journal)` uses only D14's fixed immutable thread manifests and D13's six authored walkable coordinates. It chooses the earliest unread site in each unfinished thread; it returns a frozen, maximum-two-record array with site ID, title and clue, but **no narrative passages, completed resolution, rewards, player entitlement or network data**. A non-Set journal results in no markers. Unknown forged IDs do not count.
- `drawLocalChronicleAtlas(ctx,mapId,x,y,journal,size)` renders up to two small violet diamonds at fixed map scale using balanced Canvas2D save/restore, only for finite world coordinates, valid map and a 128–512px sketch size. It returns the number actually painted for the UI legend; no A*, collision recheck, world-grid scan, gameplay input, movement or network path.
- `web/world-preview.html` draws the D15 overlay **only** after D8's existing optional M-map has painted, inside the same `250 ms` D8/D10/D11 refresh path; it then paints D12's cyan sampled rejoin on top if present. The violet legend is hidden if the map is closed or no eligible pin was drawn. No additional canvas, timer, style redesign or `fetch`.
- `tests/world-chronicle-atlas.test.mjs`: 7 dedicated tests covering exactly two manifest-derived clues, advancing either story, out-of-order/completed story suppression, malformed journal fail-closed, protected white player position, map bounds/scaling/canvas guards, browser HTML syntax and opt-in-only no-network wiring.
- `.github/workflows/ci.yml`: additive D15 gate, retaining all inherited strict Combat, server, networking, Rust and browser steps.

## Acceptance

```
node --check src/world/chronicle-atlas.mjs
node --test tests/world-chronicle-atlas.test.mjs tests/world-chronicle-threads.test.mjs
# Full existing tests + exact-head GitHub Actions quality
```

For real browser: open offline preview; press M from Greyhaven. Initial story journal is 0/6, the Red Lion clue overlaps the white player marker and is intentionally omitted, while the Old Mill clue is violet on the map. Press F at the Red Lion: journal becomes 1/6, *Of Hearths and Bells* points to Market Bell, and two violet clues should now appear. Closing M hides atlas and legend. Switching expeditions should not change story pins. Reload resets back to 0/6.

## Security and ownership

This is a **client-side visualization of authored fiction**; the public client bundle already contains site positions and story text. UI reveal is not encryption or a server discovery claim. The markers cannot authorize walking across an unbridged river, grant map travel, items, weapons, XP, persistent quests, properties, wallets or Moon Coin. Do not wire to the live multiplayer server without Core & Multiplayer authority over positions, zones, collisions and per-player discovery. Economics, Graphics, Combat and NPC departments retain their own domains.

Central Development Center is responsible for rebasing the old stacked branches against updated main, reviewing strict CI, merging and deploying. Historical inherited Combat failures M151/M144/M171/M194 and most recently D12 #425's strict M205 must not be bypassed. D13 #431 and D14 #438 exact-head CI should be separately verified before stack integration.
