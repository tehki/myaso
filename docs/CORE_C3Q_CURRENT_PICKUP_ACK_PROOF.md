# Core 8B C3q — no false sword pickup ACK from historical item receipts

**First Playable Alpha P0** · **DORMANT read-only proof**, not a gameplay
implementation. Parent stack: C3p [#499](https://github.com/tehki/myaso/pull/499)
→ C3o [#492](https://github.com/tehki/myaso/pull/492) →
C3e [#406](https://github.com/tehki/myaso/pull/406).
The owner requires four independently connected characters, physical
Blacksmith rack swords, click-to-pickup, live observer replication and
genuine fists-versus-sword combat [#480](https://github.com/tehki/myaso/issues/480),
[#460](https://github.com/tehki/myaso/issues/460).

## Specific P0 correctness gap

A committed `OwnershipTxnId` receipt by itself is **historical**: the same
sword may have been dropped, picked up again, or moved to a different
character after the original receipt. Reusing the old receipt to display
a *currently equipped* sword could send an incorrect `PickupAccepted`
or replay a stale owner/hand state.

The existing Core C3e journal already has the necessary *read-only*
primitives: `DurableItemJournal::verified_receipt`,
`last_mutation_sequence(item_id)`, and `location(item_id)`.

## New minimal contract

`server/src/alpha_pickup_ack_proof.rs` exports:

`current_committed_rack_pickup(journal, request_id, item_id,
from_ground, owner) -> Result<CommittedPickupView, PickupProofError>`

A positive view is possible only if:

1. `from_ground` is the **server-owned** `ItemLocation::Ground`;
   it must never be the browser's asserted rack coordinates.
2. The exact immutable `OwnershipOp::Move { item, from: Ground,
   to: Equipped(owner, MainHand=0) }` has a **durable verified receipt**
   keyed by the supplied nonzero operation/request ID. A missing
   receipt, conflicting replay, another owner, another target/item or
   uncommitted loser fails without an accepted view.
3. The committed receipt describes **exactly one** operation.
4. That same item still has `last_mutation_sequence == receipt.sequence`.
   **After any later drop, transfer or re-pickup the earlier receipt is
   historical, not current**, even when the item returns to the same
   equipped location (A→B→A / ABA).
5. The item's latest journal location is exactly
   `Equipped { character_id: owner, slot: 0 }`. Slot 0 maps to
   Magic & Items' checkpoint MainHand (requires #432 final approval).
6. The returned projection has **private fields** and exposes only
   `request_id`, `item_id`, `owner`, `location` and
   `journal_sequence` read-only accessors; no arbitrary accepted
   projection constructor or state mutator.

It performs **no journal mutation, writer acquisition, game-network
transmission or item minting**. The existing OS-exclusive C3e journal
must be the *single authoritative writer* during a proof, and a
live future ACK publisher must preserve snapshot/sequence consistency
with observer replication. A proof is **not a timeless permission**:
the world can advance after it is read. Use a fenced committed event/
outbox transaction or revalidate at publication time to prevent a
time-of-check/time-of-use (TOCTOU) stale ACK.

This is **not identity authentication**. 8A must resolve the current
logged-in character; 8C must verify authoritative item target, zone,
range/LOS, live worker epoch and world revision. The consumer must
never pass browser-specified `owner` or `from_ground` directly into
this function. C3e file locking is not a distributed authority on
multiple worker hosts; neither MYTX nor Magic MYWLD003 can be
simultaneous independent live owners of the same sword.

## Local acceptance

`cargo test --locked --manifest-path server/Cargo.toml --lib alpha_pickup_ack_proof`

Five focused cases (plus one separately invoked ignored subprocess helper):
- Missing committed receipt and non-ground source never produce ACK.
- Accepted exact `Ground → MainHand` yields request/item/owner/
  location/commit-sequence only while latest; same view after journal
  reopen, unaffected by unrelated sword transactions.
- Competing pickup loser, forged owner, conflicting operation ID
  or mismatched item cannot create a positive view.
- Committed old pickup → drop → pickup back to the *same exact*
  owner/hand proves **ABA-safe watermark rejection**, including
  after closing and reopening the journal. The fresh receipt
  alone gives a current view.
- **Real OS subprocess SIGKILL** after an already durable one-sword
  pickup commit but before any browser ACK, with an independent
  OS-held writer lock. A fresh journal process restores the exact
  original receipt and owner; same request replay changes nothing,
  a competing character's second click is rejected without receipt,
  and the second reopened writer still finds exactly four sword IDs.
  The helper uses an intentionally ignored test invoked by its parent
  through a separate OS process on Unix; it is not a mocked exception.

On the exact updated source head `2caf3c2820a402ea02986a1a0157b3326f2e7586`,
Serj Linux Rust 1.89: focused **5/5 PASS**, full server library
**109 PASS / 0 FAIL / 3 ignored subprocess helpers** (the new helper
is invoked by its Unix crash parent test), `cargo fmt --check` PASS,
and strict `cargo clippy --lib -- -D warnings` PASS. The previous
code head `e9c61c6` also passed its earlier 4 focused and 108 full lib tests.

**These are isolated Rust proofs**. They do not establish live
physical rack clicking, true browser-player authentication, real
four-player observer delivery, world/item database atomicity,
distributed worker fencing, equipment appearance, Combat M194 or
independent Chrome/Firefox gameplay. Mandatory full exact-head
protected quality must pass independently.

## Integration handoff and explicit blockers

- Core 8A owns authenticated `TryPickup(itemId, requestId)`,
  correlated `PickupAccepted/PickupRejected` and observer
  replication; the ACK must never precede the *one* canonical world+
  item commit and must carry its exact receipt/revision.
- Core 8C owns authoritative zone/range/LOS/epoch, world tick
  and atomic world/item outbox, including a single owner for each
  pickup and consistent observer revisions.
- Items 2B [#495](https://github.com/tehki/myaso/pull/495)
  implements *its own dormant* `u64` Loot/Magic joint
  ground→MainHand checkpoint commit. It **must not co-write** the
  same live sword as C3e. [#432](https://github.com/tehki/myaso/issues/432)
  must approve the typed mapping, item-kind/slot codes and one
  authoritative transaction/writer before wiring either prototype.
- Graphics/UI/World own server-validated clickable sword geometry
  and real Blacksmith rack; Combat owns correct fists/sword mode
  and the protected M194 parry-vs-guard failure.
- Orchestrator accepts integration only with exact-head protected
  Rust/JS/Chrome/Firefox checks, four independent browser clients,
  verified no false ACK/ghost sword, full M1–M5 sequence, package SHA
  and tested rollback.

No merge to `main`, production deployment, live inventory, coin
or wallet settlement authorized. Report via
[First Playable #480](https://github.com/tehki/myaso/issues/480),
[canonical contract #432](https://github.com/tehki/myaso/issues/432),
and [Development Center #360](https://github.com/tehki/myaso/issues/360).
