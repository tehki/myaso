# 🌕⚡️🚀 Graphics 3B P0 — original consolidated World #521 browser acceptance

21 October 2026 · Moon Games First Playable #480 / physical four-sword armory #488. **DRAFT and NOT merged, deployed, server-authoritative or playable**.

## Purpose and exact dependencies

Previous original Blender rack/sword sources in Graphics PR #500, World #493 authoring, Graphics #508/#512/#514/#524 and the completed-frame painter #529 had only been cross-branch tested against standalone World #493. World Department 9 now has a central integration candidate draft #521 (exact head 3178b9aad8757ceb3594ff04b9e3099dced6b729), which combines the original four socket IDs, the opt-in Red Lion placeholder replacement, 23-solid authoritative-import candidate JSON and four protected World quality gates. This new QA uses the ACTUAL source of that combined World draft, not an assumed copy.

Independent sparse Git checkout pins World #521 exact head. Native browsers import its untouched original alpha-armory.mjs, authored-maps.mjs, authored-world-renderer.mjs and building-presentation.mjs, and the strict run checks their actual SHA256 content. The old original World #493 armory module is byte-identical to #521. The actual World 23-solid source and JSON are independently SHA-pinned in the report (this does NOT assert a Core-trusted server geometry snapshot). Original UI #503 exact head 8d500d8ddeb4058f15dbc704bf78d685d1ca31ef and all source WebPs/Graphics planner hashes are independently pinned. World/client/UI/Combat/Items/Physics/Blender originals are not modified.

World P0 authoring slots: (3740,4038), (3780,4038), (3820,4038), (3860,4038); original per-slot approach y4088. Source-only rack art center (3800,4038). These art positions and socket IDs are NOT canonical item identity, proximity/LOS permission or a server-completed pickup.

## Native original-source Chrome and Firefox proof

Genuine Chrome 154.0.8037.99 and Firefox 153.4.0 render the original consolidated World #521 Blacksmith tiles, source Blender 3B rack and four separate sword WebPs through the Graphics #529 completed-frame painter, with untouched UI #503 gesture classifier. At desktop and CSS 390px/DPR2, each of the FOUR swords selects its own independent visual item: eight individual authentic pointer gestures per browser plus two previous source-alpha intents. Actual Blender source mask six sword-pair overlaps zero. The source alpha-transparent click is rejected; drag off/revision change/visual removal cancels; no false Combat fallback on a reserved sword. UI adversarial forged alpha, wrong source pixel and stale last-painted frame checks remain intact. All test IDs are deliberately ART-ONLY-NO-SERVER and no genuine network or Combat handler is invoked.

A new World #521 presentation regression uses actual Canvas pixels to verify: optional replacement of Red Lion does visibly alter its own viewport (nonzero changed pixel count), but is forbidden for Blacksmith (smith), and enabling Red Lion replacement leaves Blacksmith viewport pixels byte-for-byte unchanged (zero pixel changes). This tests preservation of 3B rack composition under the combined World source. It does not approve actor/roof occlusion, collision, portals or World server authority.

Real evidence: assets/environment/greyhaven/armory-p0/world521-review/armory_p0_world521_ui503_native_report.json, four genuine Chrome/Firefox normal + high-DPI screenshots, tests/armory-p0-world521-consolidation.test.mjs, and reproducible tool tools/art/verify_armory_world493_ui503.mjs with P0_WORLD_SOURCE_HEAD explicitly set to the exact World #521 SHA. The original World #493 mode remains separately supported, and any unknown source head is rejected.

## Owners and strict release HOLD

Graphics 3B owns Canvas presentation and only 0..4 observed original sword sprites; UI/Combat must approve a single real gesture handler in the actual game; World/Physics/Core8C must certify complete same-zone current trusted collision/LOS; Core8B/Items2B must agree ONE durable canonical item writer and u128/legacy u64 ID conversion, MainHand slot, world-centimeter encoding, epoch/receipt/observer updates; Core8A authenticates TryPickup reliable opcodes; Graphics3A verifies Silver Knight MainHand art (jump/roll still visually gated). Four actual independent client City→Armory→physical sword pickup→fists/sword PvP→reconnect is NOT demonstrated. This QA does not change web/online-game.mjs or install any live game server item records.

Source World #521 protected quality #39594149409 completed successfully. Original 3B #508/#512/#524 protected CI success is historical head-specific evidence; parent #514 protected M143 failed. Our Graphics #529 full run #39598018686 and the new PR full run must be individually checked, no waived tests. Only Main Development/Deployment Orchestrator controls merging and release.

**Readiness: IMPLEMENTED QA / isolated TESTED / INTEGRATION-READY BLOCKED / NOT INTEGRATED / NOT PLAYABLE.**
