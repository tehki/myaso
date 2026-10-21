# Graphics 3C P0 — World #493 armory-render socket cross-branch verification

2026-10-21 | Moon Games First Playable Alpha | Graphics Environment & Atmosphere | **BLOCKED** for live integration

## P0 cross-department acceptance authority

The current mandatory [First Playable M1–M5 #480](https://github.com/tehki/myaso/issues/480) is one server-authoritative Greyhaven city, four distinct genuine human clients, four **real visible swords clicked directly**, server-owned/replicated inventory, and both unarmed and armed PvP. This check does **not** create or display such swords, turn on interactions, change World maps, or implement an authoritative item transaction. It is a narrow source/geometry compatibility check for the owner-approved [World P0 draft #493](https://github.com/tehki/myaso/pull/493).

**Pinned World #493 source exact commit:** `07060f981b8a1dac89184b621b6893dd970a08ae`. Existing 3C branch parent remains World [#336](https://github.com/tehki/myaso/pull/336); #493 is a separate draft and **not yet in the 3C tree or on main**. No new World data is copied or invented in Graphics.

## Reproducible verification (cross-branch; optional)

Check out the exact World #493 commit into a **different Git worktree** and preserve its detached source SHA. From the Graphics 3C checkout:

```bash
WORLD_ALPHA_EXPECTED_HEAD=07060f981b8a1dac89184b621b6893dd970a08ae \
node tools/art/verify_world493_graphics3c_armory_contract.mjs /absolute/path/to/world-493-worktree
```

The optional script (a) checks `git rev-parse HEAD` equals the exact World commit, (b) imports the **real** immutable World module `src/world/alpha-armory.mjs`, (c) compares source authored maps, (d) consumes four stable socket IDs rather than inventing world item IDs, (e) projects using the **real online-game** `projectArenaPoint()` at zoom 0.84, and (f) compares 3C deterministic ground samples and Blacksmith facade lamp position. Its JSON includes explicit `actualRenderedSwordPickTest:false` and `realMultiplayerPickupTest:false` — no false gameplay claim.

### Source geometry and projected separation

At a **QA-only** sample camera (3800,4050), canvas 1100×688 and real online zoom 0.84:

| World socket ID | World sword anchor | Walk-up point | Screen anchor |
|---|---|---|---|
| greyhaven-rack-1 | (3740,4038) | (3740,4088) | (499.6,333.92) |
| greyhaven-rack-2 | (3780,4038) | (3780,4088) | (533.2,333.92) |
| greyhaven-rack-3 | (3820,4038) | (3820,4088) | (566.8,333.92) |
| greyhaven-rack-4 | (3860,4038) | (3860,4088) | (600.4,333.92) |

Each neighboring anchor is **40 world units** apart, **33.6 on-screen pixels at 0.84 zoom**. All approaches are 50 world units farther south, or **42 pixels** in the same projected frame. All four fixture IDs remain distinct and have **no** `worldItemId`, `owner` or `clickShape` property in World #493. Only Core/Items can commit sword ownership and UI #496 can use actual final-frame sword art bounds to choose a pending click intent.

The 3C Blacksmith lamp fixture at approximately (3801,4007) lies **36.36–68.43 world units** away from each sword anchor center, outside a 22-unit center-neighborhood sanity check. A radius-16 world-sample neighborhood around anchors 1,3,4 contains zero 3C soil/grass/paver sample centers. **Socket 2 has one soil and one grass sample center** within 16 world units. Both are painted into the underlying tile layer; neither is an item, a hit region, or independently top-layered geometry. Actual sword silhouette/alpha visibility and precise W3C pointer picking **cannot** be approved until Graphics 3B and UI integrate the actual rendered sword art with server item IDs. If overlapping background grass distracts, 3C can clear just the World-approved rack foreground after art review without duplicating socket positions.

## Source ownership / integration boundaries

- **World 9 (#493):** immutable four rack *fixture* socket coordinates and approach locations, one outdoor zone, authoring path samples. No canonical item IDs or active server collision in the module.
- **Graphics 3C (#419):** deterministic cached cobblestones, sparse verges and **one** Blacksmith lamp. No swords baked permanently into static scenery and no client-side inventory state.
- **Graphics 3B / 3A:** real visible four-sword rack and equipped-hand/empty-fist animations, correct draw depth/occlusion.
- **UI #489/#496 + Combat:** native pointer and CSS/backing-canvas transform to target **actual painted sword pixels**, consume one intended click before LMB attack; preserve all other Combat controls.
- **Core/Items/Physics:** canonical item mapping, reach/LOS and transaction/receipt/replication across all four clients, death/recovery/dupe safety.

A passing cross-branch source contract is **TESTED only**, not INTEGRATION-READY or PLAYABLE. Keep #419 DRAFT, no World/Combat/protocol merge and no live item creation. Wait for exact-head protected CI, orchestrator-selected coherent World/Core/Items/Graphics branch and independent Chrome+Firefox four-player real world acceptance.
