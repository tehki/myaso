# Moon Games Graphics 3C — P2.9 First Playable Blacksmith approach

**Project:** myaso.io / Moon Games | **Priority:** P0 First Playable M1–M5 | **Department:** Graphics 3C Environment & Atmosphere | **Classification:** BLOCKED, not integrated

**Current owner acceptance authority:** [P0 #480](https://github.com/tehki/myaso/issues/480) supersedes earlier unarmed-only alpha scope. Four independent human players in ONE server-owned Greyhaven zone must click four distinct physical rack swords and have authoritative armed/unarmed PvP. [Sword pointer boundary #488](https://github.com/tehki/myaso/issues/488); [single item acceptance #460](https://github.com/tehki/myaso/issues/460). A decorative Blacksmith screenshot is NOT implementation of pickup, melee or equipment.

## P0 existing scene verified

World parent [#336](https://github.com/tehki/myaso/pull/336), exact head `260a7b85a33b7a51663a70af8d410e0d33e0e236`, defines Blacksmith `id:smith`, authored x=3710, y=3850, width=182, height=162. The currently unmerged map has **no smith entrance/portal, no canonical four-sword rack sockets, no items with server-owned IDs and no server-verified walkable floor** at this site. Thus the available preview does **not** meet M2; World/Core/Items must approve a reachable single-zone open-front rack layout or actual shared server-authoritative interior first.

Graphics 3C remains read-only to authored map/world items and provides deterministic city ground/lanterns. The tested renderer uses the existing World 512-unit Canvas tile cache and paints these static details **behind** future player/item layers, not as a source of authoritative world items.

## Authentic Chrome visual approach

Reproduction: two independent localhost checkouts, unchanged World #336 and Graphics 3C branch; real Chrome 154, 1280x900 viewport, native keyboard events with original World `/web/world-preview.html` page, actual `A` (~2380ms) then `W` (~420ms). World baseline ends (3809,4050), Graphics 3C (3813,4050), a few units apart due to variable real RAF timing. The browser reports HTTP 200 and **zero page JavaScript errors** for both. The screenshot files and raw HUD-position report are in `assets/environment/greyhaven/3c-p29-armory-review/`, including side-by-side `blacksmith_approach_before_after.png`.

No test clicked an alleged sword, because **no real rack swords exist at this site**. The legacy offline-preview drawKnight icon looks weapon-like in this view, but it is not proof of a committed inventory/equip state. No actual online multiplayer, pointer pickup, item receipt, server collision, LOS, PvP, reconnect, actor animation or Firefox visual budget was measured. **M1–M5 remain BLOCKED.**

## Graphics 3C P0 source-owned acceptance and interface

Three new Node tests in `tests/graphics3c-alpha-armory-approach.test.mjs` confirm the existing Blacksmith identifier/geometry, no 3C terrain sample centers in the building footprint, deterministic original light fixture and immutable map data. This does NOT ratify the Blacksmith geometry as production-locked; any owner-approved World change must update the dependent graphics/tests through the central contract.

**Next handoff, no invented sockets:** World 9 establishes accessible armory floor/counter path and four **authoritatively declared** world-space sword sockets; 3B supplies actual original rack and sword art, 3A character hand/unarmed animations. Graphics 3C integrates a static visual layer **behind** the rack/equipment rendering and validates no grass, shadows or lantern occlude precise sword art or screen-space pick bounds. UI #489 resolves the click only on actually rendered sword geometry; Combat keeps other LMB controls; Core/Items authoritatively owns canonical item ID, pickup/race/replication, drop and rejection. One committed item must vanish from all rack views and only appear in hand after server commit. Graphics 3C is **not** an item authority and must not mint weapons in background tile texture.

**Rollout:** Draft [Graphics PR #419](https://github.com/tehki/myaso/pull/419) remains stacked on unmerged World #336. Previous P0 exact-head [quality #39534675929](https://github.com/tehki/myaso/actions/runs/39534675929) succeeded before these new QA commits. The new exact-head protected quality is mandatory. No merge, main activation, client teleport, payment system, or claim of PLAYABLE without central orchestrator release GO.
