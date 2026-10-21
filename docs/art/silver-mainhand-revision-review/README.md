# Graphics 3A — First Playable MainHand revision visibility review

**EXPERIMENTAL / VISUAL HOLD / NOT INTEGRATED.** Child of [3A MainHand art draft #517](https://github.com/tehki/myaso/pull/517), whose exact-head protected [quality #39588058544](https://github.com/tehki/myaso/actions/runs/39588058544) completed **SUCCESS**. This review child requires its own quality check.

## Implemented

`src/browser/silver-mainhand-revision-guard.mjs` implements an **isolated render-only monotonic equipment snapshot guard**. It consumes caller-supplied, Core-shaped snapshots with actor key, authenticated *looking* session epoch, item snapshot revision, server tick and either `MainHand:null` or a fully typed equipped sword record. It rejects an older equip arriving after a newer drop, a stale session generation or older tick, unknown/pending records and item-owner mismatches. Conflicting MainHand content at an identical revision quarantines that revision until a higher one arrives. The cache is bounded without evicting old revision history (which could let a delayed sword resurrect). It cannot grant/move/equip an item, affect Combat, or authorize pickup; neither Core, server, networking nor `web/online-game.mjs` changes.

**Security boundary:** The literal `provenance:"core-items-committed-snapshot"` label and session epoch are **fakeable** in JS. Nothing in this PR authenticates them. Real integration MUST consume a trusted decoded **Core 8A/8B** actor-bound u128 item current-state record and use Core-defined monotonic epoch/revision semantics. The guard is a conservative review prototype, **NOT a new wire/authority protocol**.

The parent [#517](https://github.com/tehki/myaso/pull/517) source-art preview uses the first-party owner Silver Knight original WebP atlases + real Graphics 3B Blender 42×115 sword. Its Blender RightHand anchors are approximate; idle/walk/sprint art is not approved, and the sword overlay remains **disabled in jump and roll** after visual inspection found a floating blade. This child preserves that hold.

## Real source-art browser QA, not a real server

Open `web/silver-mainhand-revision-review.html` on a local HTTP server from the repo root. It shows all eight authentic Knight directions and allows selection of six *synthetic* packet histories (equip A, drop, delayed old A, new B, same-revision contradiction, old session after reconnect) and five real Silver source clips. The test actor and item IDs are expressly **ART-ONLY fixtures**, not genuine accounts or canonical items.

Both browsers validated **30/30 scenarios × 8 directions = 240 visual outcomes each** with zero HTTP/page errors, original WebP art and real screenshots:

| Scenario | Chrome 154 | Firefox 153.4 |
| --- | --- | --- |
| Synthetic committed sword | [Screenshot](revision_chrome_silver_idle_equip.png) | [Screenshot](revision_firefox_silver_idle_equip.png) |
| Newer drop → unarmed | [Screenshot](revision_chrome_silver_idle_drop.png) | [Screenshot](revision_firefox_silver_idle_drop.png) |
| Late old equip rejected → unarmed | [Screenshot](revision_chrome_silver_idle_late.png) | [Screenshot](revision_firefox_silver_idle_late.png) |
| Same-revision item contradiction | [Screenshot](revision_chrome_silver_idle_conflict.png) | [Screenshot](revision_firefox_silver_idle_conflict.png) |
| Roll attachment stays disabled | [Screenshot](revision_chrome_silver_roll_equip.png) | [Screenshot](revision_firefox_silver_roll_equip.png) |

[Chrome JSON report](revision_chrome.json) · [Firefox JSON report](revision_firefox.json).

Focused `node --test tests/silver-mainhand-revision-guard.test.mjs` has **8/8 PASS**, covering stale revisions, drops, ABA/reconnect epoch, conflicting same-revision data, bounded cache and mutations. Broader Knight/MainHand source tests remain mandatory.

## Next Core/Orchestrator gates

Core 8B and Items 2B must deliver one canonical u128 ownership writer + durable ACK/current snapshot, Core 8A authenticated character binding and separate session epoch, World 9/Graphics 3B genuine physical rack swords, UI/Combat a single LMB alpha hit, and real server-owned equip/drop/transfer/death/reconnect replication. 3A must update Silver art only after trusted equipment state; review/approve hand/occlusion for sword attacks, rolls and jump in *actual* Greyhaven. A browser script with fake snapshots is **not** live equipment or playable multiplayer acceptance.

**Status: IMPLEMENTED / ISOLATED TESTED / NOT INTEGRATION-READY, NOT INTEGRATED OR PLAYABLE. No merge or deployment.** Coordinate through [Graphics #344](https://github.com/tehki/myaso/issues/344), [Development Center #360](https://github.com/tehki/myaso/issues/360), [First Playable #480](https://github.com/tehki/myaso/issues/480), [Armory #488](https://github.com/tehki/myaso/issues/488).
