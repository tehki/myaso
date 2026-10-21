# 🌕⚡️🚀 Graphics 3B — P0 Blacksmith armory rack and visible sword pixels

**2026-10-21. First Playable owner gate: #480 / #488. Status: source-asset IMPLEMENTED and isolated TESTED only. Not integrated or playable.**

This is an independent Graphics 3B draft from baseline main 6fa59b649112c272bcbc018b4a32bf963f9a5bba, not another optional Red Lion roof/decorative iteration.

## Blender source and separate click-safe art

The new source is a real editable Blender 5.2.2 scene at assets/environment/greyhaven/armory-p0/blacksmith_armory_p0_source.blend. tools/art/build_armory_p0_rack_blender.py constructs aged-oak four-socket rack geometry, iron hooks and rivets, and a separate three-dimensional hand-forged sword with taper, fuller, crossguard, leather grip and pommel. Cycles renders one rack 240x166 PNG and one sword 42x115 PNG, both transparent. tools/art/package_armory_p0_blender.py encodes each as lossless WebP and verifies pixel-identical alpha/RGBA roundtrip. JSON provenance includes source hashes, dimensions and alpha coverage.

The sword is NOT baked into the rack: each of four swords must be individually rendered and individually tested at its own visible alpha pixels, never an entire rack/counter/menu rectangle. Sword art represents an item only when server-authoritative on-rack item presence is supplied by the integration owner.

## Visual-only API owned by Graphics 3B

src/browser/armory-rack-visual.mjs exports two pure operations:

1. createBlacksmithRackVisualPlan: takes original World #336 named smith building (x=3710,y=3850,w=182,h=162), externally **World-approved** four rack sockets with distinct IDs/world coordinates/version/zone, and an externally committed Core/Items world-item array. It strictly rejects invalid/duplicate positions/items and renders only those actual passed world-present swords, preserving opaque string IDs and integer revision. Without items it renders zero swords. It uses the actual projectArenaPoint and zoom 0.84. It does NOT propose four authoritative rack locations, mint item IDs or change equipment.
2. hitTestVisibleSwordAlpha: checks per-sword actual decoded WebP alpha, not bounding box, rack or menu. It returns only the visual item-ID candidate, source pixel and revision. It NEVER suppresses attacks, invokes TryPickup, performs server range/LOS checks or claims a receipt. UI 10/Combat 4 own down/up/cancel/chording, Core 8A/8B/Items 2B own authority, World/Core 8C/Physics own locations and collision.

No production runtime files, World maps, authoritative packets, Combat tests or code paths are modified. The original Red Lion roof is untouched. All players are planned as **Silver Knights** in First Playable; NPC T1 is not assumed from an opponent's remote status.

## Native art QA — truthful boundaries

web/armory-p0-rack-review.html is an opt-in, clearly labeled **ART-ONLY** test. It uses four deliberately synthetic sockets and IDs labeled ART-DEMO-NO-SERVER to place four separate Blender swords over the rack, solely to test source alpha and visual composition. These synthetic coordinates are NEVER committed to a World manifest, and must NOT be interpreted as canonical player pickups.

The browser harness tools/art/verify_armory_p0_browser.mjs loads actual WebP pixels on real Chrome 154 / Firefox 153, hovers and clicks an opaque pixel on the first sword, and verifies a visual candidate exists; then clicks a transparent pixel *inside the sword image bounds* and verifies no candidate. It tests art-only hide/restore of one sword without any network request or attack. It captures four genuine browser screenshots and emits a machine-readable report with all release-validation flags false. This is NOT an actual game, UI pointer arbitration, item ownership or four independent authenticated clients.

## P0 cross-department dependencies and release gate

World 9 must freeze a walkable open-front shared-city Blacksmith approach with four immutable rack sockets and zone/geometry, proven reachable from four Core 8C spawns; must avoid unapproved local interiors, fake teleport and double-painted World placeholders. Items/Core must deliver unique canonical server item IDs, authoritative committed presence, atomic equip/transfer/drop/death/reconnect, immutable operation receipts and observer replication. UI/Combat must resolve a genuine sword click without accidentally firing the original release-to-strike LMB, maintaining roll, jump, parry, kick, heavy attacks and all protected tests. Graphics 3A must anchor acquired sword art in the Silver Knight hand ONLY on actual server equipment update. Physics owns server LOS/range; Graphics 3C owns consistent lights.

Final acceptance under #480/#488/#360 demands one same authoritative city, four independent humans, a real rendered clickable four-sword rack, accurate pick shape at moving camera, server-denied stale/through-wall attempts, one winner for duplicate click, all-client disappearance/equip, fists vs sword PvP, native Chrome and Firefox, measured performance, full exact-head CI and immutable rollout/rollback. This branch only provides the independently usable art and presentation candidate API.

**Readiness:** IMPLEMENTED source + isolated browser TESTED. INTEGRATION-READY **NO**, INTEGRATED **NO**, PLAYABLE **NO**. No merge, public service/production deployment or security/network changes.
