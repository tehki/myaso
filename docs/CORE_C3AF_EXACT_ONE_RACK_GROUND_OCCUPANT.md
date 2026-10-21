# Core 8B C3af — exactly one canonical ground occupant at each reviewed rack socket

**Moon Games First Playable Alpha P0, dormant / offline review only.** Direct stacked child of [Core C3ae #650](https://github.com/tehki/myaso/pull/650). Nothing in this change authenticates a packet, grants equipment, authorizes pickup, rewrites the Items checkpoint, creates an independent owner or activates a second ledger.

## Defect closed

The prior offline cross-domain reconciliation checked that each of the *four expected canonical physical swords* remained at its typed Ground zone/coordinates in the existing exclusive local Core MYTX journal. The generic Core ownership ledger correctly allows arbitrary multiple `ItemId` records to have an identical `ItemLocation::Ground`. Therefore a **fifth canonical ground item** (another sword, reagent, potion, club or unknown kind) could occupy the exact same physical rack socket and still produce a deceptively valid four-sword review. The generic Core ledger has no item-kind field: choosing only the known ID is unsafe.

## Minimal additive implementation

- `ItemOwnershipLedger::ground_occupants_at(ground)`: read-only full scan of canonical live items at exactly one typed Ground location. Returns zero for non-Ground. Does not mutate/allocate/create/write; intentionally O(number of items) for **offline** rack acceptance, not a per-tick gameplay loop.
- `DurableItemJournal::checked_unique_ground_membership(item,expected)`: first validates canonical item revision, Ground coordinates, local watermark, poison state with existing `checked_ground_membership`, then denies an otherwise present item unless **exactly one** canonical item occupies that coordinate. Uses only the SAME local journal ledger; error is explicit `InvalidRecord("ambiguous physical rack ground occupancy")`. Existing ordinary journal membership behavior and V1/V2 mutation format remain unchanged.
- C3ae `review_offline_rack_against_existing_core` and `recheck_original_offline_core_rack_match` use the uniqueness helper for every one of the four slots. A fifth item anywhere else is fine. An overlapping ground item of **any** kind fails the **entire** offline four-rack review. No new live observer, packet or writer.

## Executed negative

Real Items physical swords were granted/dropped/parked and checkpointed; a local Core fixture imported all four canonical typed physical items using the existing tested collision-checked preflight. Initial exact four-rack review PASS. A **fifth distinct canonical item** was legitimately committed into the same journal and Ground coordinate as the first authored socket; the generic item's ordinary membership still says present and a previous four-rack mapping could incorrectly pass. C3af correctly aborts the entire offline review, **including after exclusive journal close/reopen**. Moving the fifth item elsewhere permits a new 4/4 review, but the earlier pinned watermark/head remains invalid (no ABA). The actual local journal retains five items, no counterfeit destruction or hidden replication.

**Evidence:** 5 module-focused tests PASS, **243 Rust library tests PASS with four intentional subprocess helper ignores**, strict all-target Clippy `-D warnings` PASS on Serj Linux Rust1.89. Exact-head protected CI required separately.

## Remaining HARD STOP

This proves exclusivity of Ground coordinate against **the opened local Core journal only**, not a globally unique physical World/8C ground entity and current Items source. The Items snapshot can be replayed; a separately active MYASOL03 writer can still commit the same sword to another owner even while MYTX persists an exact V2 receipt/observer event. World coordinate mapping is synthetic/proposed; 8A auth, 8C signed completed tick/epoch/zone, complete dynamic Physics LOS/reach, distributed exclusive writer and four native browser item ACKs are **not** integrated. Main [#360](https://github.com/tehki/myaso/issues/360) retains one-writer architecture and merge/deployment authority. **No central merge, migration, production activation or deployment.**
