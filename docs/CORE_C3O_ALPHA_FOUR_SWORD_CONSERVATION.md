# Core 8B C3o — First Playable Alpha: four-sword ownership-conservation contract

**P0 owner acceptance:** [City → Armory → Armed & Unarmed PvP #480](https://github.com/tehki/myaso/issues/480).  
**Item ownership handoff:** [first physical sword #460](https://github.com/tehki/myaso/issues/460), [canonical identity gate #432](https://github.com/tehki/myaso/issues/432), [Core contract #405](https://github.com/tehki/myaso/issues/405).

**Status: isolated Rust journal acceptance only — IMPLEMENTED / TESTED, not integrated or playable.**

## Scope

This PR adds a **test-only** `server/src/alpha_armory_ownership_tests.rs`
to Core 8B's existing **C3e OS-exclusive journal**. It neither builds
another item ledger nor enables a weapon entity, rack renderer, new item
opcode, pickup network message or live inventory. Item identity and
location still come from the existing `ItemOwnershipLedger`,
`DurableItemJournal` and C3a/C3b/C3d safeguards.

The fixture simulates one candidate armory source with four separately
committed `ItemId(u128)` values, **201–204**, in the existing canonical
`ItemLocation::Ground` state. Its zone/coordinates are illustrative,
**not approved Greyhaven navigation/rack geometry**. Slot code 1 is a
**test-only placeholder**, NOT approval of the final MainHand enum or
legacy mapping. The current ledger does not store `ItemKind` at all:
calling these items 'swords' is the **scenario fixture**, not a
runtime-verified weapon kind.

## Contract acceptance added

- One initial server-authored four-item creation has a single
  `OwnershipTxnId` and one durable receipt. Characters have no
  initial gear; item count stays **four**, never eight.
- The first valid rack/ground→equipped `OwnershipOp::Move` commits.
  An identical transaction ID+payload retry returns the **same**
  immutable receipt without another journal write; reusing the ID
  with a different owner is rejected as `ConflictingReplay`.
- A competing second pickup from the already-spent rack location
  fails `ExpectedLocationMismatch` with **no** committed receipt
  and no changed owner.
- Four characters may each own one of the four distinct item IDs
  in a single ledger. No automatic starter sword is minted.
- The first character drops ID 201 to a world/ground location.
  A different character already wearing a sword **cannot equip**
  the same dropped ID into its occupied fixture slot. The item
  can instead enter that character's inventory, retaining the
  original item ID. This makes duplicate equipment states fail
  closed.
- After the journal writer is closed and reopened, all four
  identities/locations and exact historical receipts survive;
  replay does not remint an item or advance a new commit.
- A second test starts **two Rust threads** with independent item
  pickup intents and transaction IDs, concurrent at a barrier,
  serialized through the same exclusive journal handle; **one**
  commits, the other fails. There is one ID and one owner both
  before and after reopening the journal. This tests shared-journal
  integrity, **not independent browsers or workers**.
- Existing C3e tests additionally cover real child-process OS
  writer-lock contention and SIGKILL recovery. The fixture
  preserves all previous regressions.

## Exact-code local acceptance (Serj Linux, Rust 1.89)

```sh
cargo fmt --manifest-path server/Cargo.toml -- --check
cargo test --locked --manifest-path server/Cargo.toml --lib alpha_armory_ownership_tests
cargo test --locked --manifest-path server/Cargo.toml --lib
cargo clippy --locked --manifest-path server/Cargo.toml --lib -- -D warnings
```

On exact source SHA `35da3585e4ee376e56e0a753261661616c42035e`:
**2/2 focused tests PASS; 96/96 full library tests PASS;
2 existing subprocess helper entries intentionally ignored by the
lib harness and exercised by their parent tests; fmt and strict
Clippy PASS**.

**Full exact-head protected quality (Chrome, Firefox, Combat, JS)
must independently pass.** Do not weaken M205/M121/M156 or use
this local evidence as an integrated-alpha approval.

## Dependencies to become a real clickable sword

1. **Magic & Items 2B owns item/gameplay proposal**: select
   `ItemKind`, define supported equipment `MainHand` enum,
   keep one canonical `ItemId`, expose *one* transaction
   through this ledger or approved replacement, and never
   commit a competing MYWLD003 state writer.
2. **Core 8A owns wire/session**: authenticates current
   character, correlates `TryPickup(itemId,requestId)`,
   `Drop`, authoritative acceptance/rejection and observer
   replication. Never trust the browser's nominated character,
   position or authoritative gear.
3. **Core 8C + World own position/zone/rack authority**:
   Greyhaven smith x=3710/y=3850 is only a candidate. Freeze
   server-approved rack positions and valid collision/LOS/range;
   give a trusted zone/worker/epoch and exact world/item commit
   boundary. A successful local `flock` does NOT constitute
   distributed fencing on multiple world workers.
4. **Graphics + UI + Combat**: actual click ray/geometry
   targeting on the visible sword, LMB interaction priority,
   world pickup removal/observer sword-in-hand after ACK,
   unarmed vs equipped combat mode and correct native
   Chrome/Firefox verification. No client-side speculative
   pickup claim.
5. **Core 8B canonical migration**: resolve Magic prototype
   `u64` vs Core `u128` ID and `MainHand` slot, MYTX
   little-endian vs PostgreSQL big-endian keys at
   [#432](https://github.com/tehki/myaso/issues/432). The
   proposed C3f codec [#417](https://github.com/tehki/myaso/pull/417)
   is not approved and its protected CI was red; the local
   C3e writer #406 is not a live cross-worker item service.

A **real First Playable** requires four independent players and
browsers entering one server-authoritative Greyhaven world,
physically clicking rendered swords and observing exactly one
pickup/equip/drop result, fighting unarmed and with swords, and
surviving disconnect/respawn without remint/ghosts. No such
live demonstration is claimed in this PR.

**All changes draft/unmerged. No main merge, production deployment,
live inventory, Moon Coin or wallet operations.** Development Center
[#360](https://github.com/tehki/myaso/issues/360) alone sequences
integration and acceptance.
