# Graphics 3A P0 — stable last-accepted MainHand presentation (flicker correction)

**Status: EXPERIMENTAL / PREVIEW-ONLY / NOT INTEGRATED OR PLAYABLE.** Stacked on [Graphics 3A original revision guard #523](https://github.com/tehki/myaso/pull/523), which is stacked on original Silver held-sword source review #517. No source graphics are approved as production combat animations.

## Reproduced defect in previous guard

The previous `createSilverMainHandRevisionGuard().plan(...)` drew directly from the most recently *received* packet. It correctly rejected stale sword A after a later `MainHand:null`, but after:

1. accepted sword A at rev 10,
2. accepted empty MainHand at rev 11,
3. accepted a new sword **B** at rev 12,
4. received delayed sword A (rev 10) or delayed empty rev 11,

it returned `null` for the rejected packet **even though current rev12 still owned B**. That would blink the sword off for one render frame if connected to a real game. This is a presentation-only integrity issue; no item ownership is altered by this module.

## Scoped correction

The guard now retains an **immutable typed value copy** of the last accepted snapshot inside its bounded actor-keyed presentation cache. It adds:

- `ingest(trustedCoreSnapshot, actorKey)`: records only accepted monotonic authoritative-*shaped* equipment values, rejects older epochs/revisions/ticks, quarantines contradictory same-revision payloads.
- `planLatest({actorKind,actorKey,clip,frame,direction,anchors})`: renders **only the last accepted cached record**, never the new packet's `equipmentSnapshot` property. A stale rejected packet cannot remove B, restore A, or alter the snapshot ID. The original legacy `plan(...)` is preserved for isolated backwards compatibility but is **not** the recommended ingestion/render path.
- No accepted item or accepted newer empty hand → no sword. Conflicting same-revision record → hide sword until a larger valid revision arrives. Unknown actor, NPC, unsupported silver clip including jump/roll, invalid hand geometry → no sword. A pending click or forged document is never a pickup receipt.

The stored state is copied from strictly validated fields; subsequent mutation of a caller-owned JavaScript source object cannot secretly change the cached sword ID, revision or tick.

**Critical security boundary:** All test receipts, actor IDs, epoch values, and even `provenance:"core-items-committed-snapshot"` are plain JavaScript **synthetic fixtures** and cannot authenticate the server. Core 8A/8B must authenticate the source, actor/epoch, canonical u128 item, and deliver current replicated owner-only MainHand views from one fenced server item writer. No Core protocol is defined or activated here. No `web/online-game.mjs`, Combat, World/3B or client socket changes.

## Actual original-art browser evidence

Open `web/silver-mainhand-revision-review.html` in a local static HTTP server. The same original owner Silver Knight sprite atlas, authentic 3B Blender sword WebP and owner rig right-hand anchors are reused. In its eight-way neutral comparison choose:

- *Equip A*: original sword fixture A drawn.
- *Drop*: no sword.
- *Delayed A after drop*: still no sword.
- *Re-equip B*: B drawn.
- *Delayed A after B*: **B remains drawn without flicker**.
- *Delayed old drop after B*: **B remains drawn without flicker**.
- *Same-revision contradiction*: quarantined, sword hidden.
- *Old session after reconnect*: old packet cannot override latest accepted state.

Real native **Chrome 154.0.8037.99**: **40/40 synthetic histories ×8 directions =320 inspected original-art slots**, seven genuine screenshots, zero page/network errors.

Real native **Firefox 153.4.0**: **40/40 histories ×8=320**, seven genuine screenshots, zero errors.

Original source screenshots/reports:

| Test fixture | Chrome | Firefox |
| --- | --- | --- |
| Sword A accepted | [Image](revision_chrome_silver_idle_equip.png) | [Image](revision_firefox_silver_idle_equip.png) |
| Newer drop → unarmed | [Image](revision_chrome_silver_idle_drop.png) | [Image](revision_firefox_silver_idle_drop.png) |
| Delayed A after drop → unarmed | [Image](revision_chrome_silver_idle_late.png) | [Image](revision_firefox_silver_idle_late.png) |
| New sword B survives delayed old A | [Image](revision_chrome_silver_idle_lateAfterReEquip.png) | [Image](revision_firefox_silver_idle_lateAfterReEquip.png) |
| New sword B survives delayed old drop | [Image](revision_chrome_silver_idle_lateDropAfterReEquip.png) | [Image](revision_firefox_silver_idle_lateDropAfterReEquip.png) |
| Same-revision conflict → quarantine | [Image](revision_chrome_silver_idle_conflict.png) | [Image](revision_firefox_silver_idle_conflict.png) |
| Roll sprite without unapproved sword | [Image](revision_chrome_silver_roll_equip.png) | [Image](revision_firefox_silver_roll_equip.png) |

[Chrome JSON](revision_chrome.json) · [Firefox JSON](revision_firefox.json).

Separate `tests/silver-mainhand-revision-guard.test.mjs` now adds ID-sensitive stale-A/old-drop-after-B, immutable source-value and quarantine cases. The original sword art source and all original Silver atlas binaries remain byte-identical. Browser preview is NOT the real multiplayer game, lacks authenticated item writer, four independent machines, World collision and original Combat sword/fist authority.

## P0 integration handoff

Only after Core 8A/8B and Items 2B agree one canonical item writer, current vs historic receipt, actor key, monotonic revision and reconnect epoch, can a trusted decoder call `ingest` and Graphics call `planLatest` using the **same character identity** across all observers. The illustrated sword remains a P0 visual candidate in idle/walk/sprint only; jump and roll art placement was visually rejected and remains disabled. Human visual approval plus real Chrome/Firefox Greyhaven cross-machine four-player M1–M5 acceptance and exact-head protected CI still mandatory. Never merge independently of central Orchestrator [#360](https://github.com/tehki/myaso/issues/360)/[#480](https://github.com/tehki/myaso/issues/480)/[#488](https://github.com/tehki/myaso/issues/488).

**Classification: IMPLEMENTED + ISOLATED TESTED, EXPERIMENTAL / INTEGRATION BLOCKED.**
