# myaso.io World & Buildings v1.0 — fixed geography, linked interiors

## Decisions
- **One fixed overworld** with persistent coordinates and recognizable roads,
  cities, villages, river, gates and building footprints.
- **Separate authored interiors** whose playable floor plans may be larger than
  external building footprints, inspired by Little Big Adventure.
- **Public interiors eventually share one server-authoritative zone**: entering
  the same inn with two players must place both in the same map, not two copies.
  Private houses / instances are future optional extensions.
- No per-session procedural location placement, random map seed or floating door.
  Authored placement is defined in `src/world/authored-maps.mjs`.

## Phase A implemented in this PR
- Authoritative world coordinate system remains **8192 x 8192**; named city
  **Greyhaven**, villages Briarford / Stonebrook, rivers, fields, roads,
  gates, bridges and ~15 designer-placed buildings.
- The Red Lion Inn has an **exterior 250 x 170** and a much larger, separate
  **780 x 620 interior**; a reciprocal pair of named portals links them.
- Static scenery rendered in viewport-aligned **512px cached chunks** with
  LRU cap 24 and a maximum of 3 new tile canvases per frame.
- `web/world-preview.html`: WASD / arrows to walk, **E** near the door to
  enter/exit, mouse wheel zoom, R reset. You can use `?room=tavern` to
  inspect interior directly. The local preview's transfer is **not multiplayer**.
- Main authoritative multiplayer can opt into **exterior visuals only** via
  `&world=1`. Any `scenario=...` acceptance URL keeps the previous baseline
  graphics. No world collision, teleport, snapshot or game server changes.
- Separate self-contained HTML prepared in the Windows machine Downloads:
  `C:\Users\ilyav\Downloads\myaso-world-buildings-v10.html`. That file
  is a local deliverable, not a game-server asset in the commit.

## Required Phase B — genuine multiplayer zone transfer (NOT implemented)
1. Share one versioned authored world/door manifest between browser and Rust
   server. Server owns door radii, destinations and spawn anchors; do not trust
   the browser's destination or `previewPortalDestination` helper.
2. Add a **server-authorized door request**, validated for player existence,
   matching current zone, proximity, active combat state, cooldown and safe
   spawn; reject forged, stale, impossible or rapid repeated requests.
3. Make entity visibility, combat collision/hits, replication and FFA match
   accounting explicitly **zone-scoped**, with atomic transitions and resets
   of incompatible interpolation/prediction history.
4. Send a reliable, versioned zone-enter acknowledgement, with the target map ID
   and authoritative spawn. Prefetch map images; show a short door loading fade
   only after server acceptance. No client-side teleport for live gameplay.
5. Verify **two independent clients in the same public tavern**, one client
   outside sees neither interior player nor combat effects, repeated exit/enter
   restores the correct overworld coordinates, and kill/respawn cannot cross
   zones. Test disconnect/reconnect and input packets in flight.
6. Add bounded server collision maps for external walls, furniture, interior
   walls and door thresholds; retain player radius and existing combat timings.
7. Run full Chrome + Firefox acceptance plus capacity tests. No deployment
   without server protocol version and rollback/migration procedures.

## Phase C — art and game richness
Detailed authored stone roads, house roofs, interior tile art, multi-floor
stairs, doors, sound and footprint decals. Art must remain below sprites to
preserve combat readability; map editor tooling may export this manifest.

## Rollback and governance
- Remove `&world=1` to revert visuals.
- The fixed world **supersedes** Ground v1.0 procedural geography PR #333;
  keep the former shadow/cache learnings only where compatible.
- This PR is independent of knights PR #326 and M325 strict browser timing PR
  #330. No merge on red required `quality`. Merge is **not deployment**.
