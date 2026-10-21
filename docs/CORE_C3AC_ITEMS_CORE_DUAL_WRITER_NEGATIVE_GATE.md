# Core 8B C3ac — Actual Items+Core V2 durable dual-writer negative gate

**Moon Games P0 / FIRST PLAYABLE — DRAFT only.** Two-parent integration candidate: Core [#621](https://github.com/tehki/myaso/pull/621) `2bd9558dd708af28578a05062d20760481e18a30` plus Items2B [#622](https://github.com/tehki/myaso/pull/622) `525ea9f3eefa034b89af663ac479c3f75c59094b`. Single textual merge conflict `server/src/lib.rs` resolved by the union of Core+Items unique declarations, keeping common modules registered only once. Core/Items production source files and existing CI definitions unchanged, except the additive cross-domain Rust test in `alpha_armory_ownership_tests.rs`. **No runtime handoff, live writer switch, action handler, migration or deployment.**

## Executed genuine-source witness

- Create **four actual physical Items-domain swords** with `LootAuthority::grant` and `drop_backpack`, each on Greyhaven's existing four original rack points (3740,3780,3820,3860; y4038). Derive each `ground_entity_id:u64` and its different actual `item_id:u64` from the real current Items ground projection—not invented test IDs.
- Register all eight physical source IDs in a **collision-checked typed Core legacy-to-u128 namespace**. The synthetic fixture uses proposed ZoneId(1) and rational x100 world→centimeter coordinate mapping *only for the test*; the World/8C authoritative zone/origin transform still requires approval.
- Initialize Core `DurableItemJournal` with four canonical physical items as Ground. Independently project all four exact rack swords via `read_proposed_current_four_rack_items` and match each back to its actual Items IDs. **This is migration/preflight evidence, not a production atomic handoff.**
- Deliberately simulate the **forbidden dual-writer** sequence: Core writer independently commits the first sword Ground→player1 MainHand as a **real fsynced MYTX V2 record**, including the exact physical ground-entity and socket, proposed actor/session/world metadata and pre-mutation revision. Core's canonical rack projection becomes 3/4 and historical V2 observer source has one exact event.
- Without any shared fence, original Items authority still claims the same first ground sword is available. Items independently allows player2 to take the same physical ground entity into a different Backpack; both ledgers are internally valid and contradictory.
- Quiesce/park the actual four Items inventories behind Items-specific verified leases, save the real Items checkpoint **outside** the Core canonical journal folder, close both writers, then reopen each from durable bytes. Core still says player1 MainHand, recovers the exact V2 transaction/envelope receipt and event; Items still says player2 Backpack **for the mapped same physical sword**. This survives process restart. Core V2 metadata+receipt+recoverable event **alone** does not fence Items' independent writer.

## Interpretation and release gate

This deliberately unsafe scenario **MUST remain a negative test only**. Neither `MYTX` nor `MYASOL03` may independently commit LIVE ownership for the same sword. A read-only migration of one bounded quiescent Items checkpoint, even with collision-checked namespace and anti-ABA within Core, does not establish source freshness, anti-rollback, transaction transfer or global epoch fencing. `MYASOL03` is replayable; its checksum is not a signature.

A production selection remains the Main Orchestrator's decision:
- Choose **one** globally epoch-fenced canonical writer (Core journal adapted to production with Items ownership truly quiesced, or Items writer enhanced to implement Core V2 receipt semantics while Core stops committing). Do not run both.
- Bind authoritative Core8A character/session + Core8C completed tick/zone/epoch/map + Items current physical ground entity and canonical ID + Physics complete same-tick reach and dynamic LOS *inside the same committed writer*.
- Ensure owner mutation, exact authenticated request receipt and replayable observer/outbox in one durable lineage, then deliver/ACK real native 4-player browser updates and prove no duplicates during retries, SIGKILL, death, drop, transfer or reconnect.

**Local evidence:** Full two-owner combined server Rust library 238 PASS / 4 intentionally ignored subprocess helpers, focused double-writer V2 split-brain counterexample PASS. Strict all-target Clippy with warnings-as-errors, cargo fmt check and exact-head GitHub full protected quality are mandatory before this draft is qualified. Parent Core #621 [quality #39642299160](https://github.com/tehki/myaso/actions/runs/39642299160) FAILED unrelated Combat M156 third-party roll knockdown punish; no waiver.

**NO production adoption; Main [#360](https://github.com/tehki/myaso/issues/360) controls merge/deploy.**
