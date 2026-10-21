# Moon Games Graphics 3B P0 — World #493 Blacksmith sword rack integration

21 October 2026 · **Source QA only; NO production gameplay, pickup or inventory.**

This follows the owner’s mandatory First Playable armory acceptance in https://github.com/tehki/myaso/issues/488. Graphics 3B draft https://github.com/tehki/myaso/pull/500 already supplies genuine Blender 5.2 Blacksmith rack and independently alpha-separated sword WebP art. World 9 authored the four rack sockets in draft https://github.com/tehki/myaso/pull/493 at exact head 07060f981b8a1dac89184b621b6893dd970a08ae.

## Original World authoring contract

World v1 armory "greyhaven-smith-open-front" has Blacksmith building id "smith", footprint (3710,3850), 182 by 162, map "moonvale-overworld" and a single outdoor open-front zone. Official authoring positions:

| Socket ID | World sword XY | World stand XY |
| --- | --- | --- |
| greyhaven-rack-1 | 3740,4038 | 3740,4088 |
| greyhaven-rack-2 | 3780,4038 | 3780,4088 |
| greyhaven-rack-3 | 3820,4038 | 3820,4088 |
| greyhaven-rack-4 | 3860,4038 | 3860,4088 |

These coordinates originate **only from the pinned World #493 source module**; they are not invented graphics socket locations, server-approved collision, item IDs, authoritative range/LOS or an authenticated Physics geometry window.

## Narrow graphics-side adapter

New module src/browser/armory-world493-visual-bridge.mjs exports createWorld493RackArtPlan. It requires an external World-authored armory/map, exact layout version and four named distinct sockets, separate Core/Items committed on-rack sword snapshot, and camera. Reject mismatched building/layout, unexpected portal, wrong zone, duplicate, malformed, crowded or displaced sockets. Derives art rack center (3800,4038) exclusively from the World-provided sources. Uses existing 3B createBlacksmithRackVisualPlan and real projectArenaPoint at zoom 0.84. **No committed world items gives zero visible swords.** It does not mint canonical IDs, equip, process combat or send TryPickup.

A source-head constant is merely the EXPECTED version; the adapter shape checks are not authentication. The native cross-branch browser harness separately verifies the actual git checkout HEAD and full SHA-256 of original World modules. Core/Items/Physics must still attest correct authoritative revision, zone, worker, geometry and item records.

**Outstanding ID interface mismatch:** Graphics #500 + UI alpha gesture #503 accept opaque strings up to 160 characters; the alternative rectangular #489 gate accepts only 64 ASCII characters. UI and Combat must select ONE actual gesture gate and Core/Items settle a single canonical wire format. Never truncate or invent item IDs.

## True native browser evidence, clearly source-only

The script tools/art/verify_armory_world493_browser.mjs imports the actual unchanged World #493 authored-map, armory and original World map Canvas renderer modules through a localhost allowlist. In native Chrome 154 and Firefox 153.4, the original World terrain/Blacksmith and 3B Blender rack/four individual sword sprites render at the four above coordinates, with six cached original World chunks. Both browsers click the real opaque pixel of sword 1, receive a visual-only candidate and reject a transparent pixel within that same sword's image bounds. Four genuine screenshots; zero page/network errors. Exact original JS module content SHA-256s saved in the report.

All item IDs in this isolated page are explicitly "ART-ONLY-NO-SERVER-..." fixture strings. No simulated click represents a server pickup, and no click suppresses live Combat. This test does not execute online-game.mjs, four-player sessions, player/world collision, server TryPickup, inventory, or true post-commit observer removal.

## P0 owner handoff

World #493/#502 + Core 8C/Physics #494 must confirm server-authoritative same-zone four rack stations, spawn-to-Blacksmith routes and fresh geometry window. Core 8B + Items 2B supply canonical world item IDs, committed on-rack presence, atomic equip/drop and replica ACK. UI #503 + Combat 4 own true sword-only pointer interaction and no accidental attack; Graphics 3A owns Silver Knight hand-held sword only after authoritative equip, Graphics 3C own lighting. Center #480/#360 owns exact-head CI, real four independent browser sessions, collision/Combat and production rollback.

Parent Graphics #500 protected full quality failed M194 repeated real guard-break block-only pressure while local graphics tests and browser fixture passed. Neither new nor parent PR may merge without fresh full CI, no test weakening.

**Status: IMPLEMENTED and standalone TESTED; not INTEGRATION-READY, INTEGRATED or PLAYABLE. All drafts remain unmerged, with no deployment.**
