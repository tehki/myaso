# Core 8B C3h — SQL enforced equipment-slot uniqueness

This dormant safety increment is stacked directly on
[Core C3g PR #434](https://github.com/tehki/myaso/pull/434),
which itself depends on Core 8C C4d [#393](https://github.com/tehki/myaso/pull/393).
It addresses a discrepancy between Core C3a's in-memory ownership ledger and
the new single-item PostgreSQL transaction proof.

## Invariant and previous gap

The existing Rust item ownership ledger allows **at most one item per
(character ID, equipment slot)**. C3g stored a canonical, 26-byte C3f
location in `core_zone.item_state` and checked each item's expected
location and revision, but did not enforce uniqueness across **different
item IDs** or independent world-authority rows. Therefore two independent
workers could each commit different item IDs into the same character's
equipment slot without violating the item primary key.

## Enforced at the database index

`server/sql/003_atomic_item_world_mutations.sql` now adds a partial
unique expression index `core_zone.item_equipment_slot_unique` over the
17 bytes containing the canonical big-endian character ID and one-byte
equipment slot. It applies only to living, equipped items (location tag 2),
not ground items, inventory, or corpses.

- Two different items cannot occupy the same equipped slot, even when
  competing C4c world entities operate on different world rows.
- An illegal CREATE or MOVE raises a PostgreSQL uniqueness conflict
  (or returns no inserted row). The enclosing C3g/C4d transaction rolls
  back **both** item and world updates, receipts and outbox.
- Moving or destroying the old equipment holder frees its old index
  entry; the destroyed **item ID** remains a permanent tombstone.
- Competing independent SQL clients race for a single slot; only one
  winner can commit, even when item IDs and authority rows differ.
- The index uses exact bytes 1..17 in zero-based notation:
  C3f's location bytes [1..16] are the 128-bit character ID and byte
  [17] is the slot. PostgreSQL's `substring(location FROM 2 FOR 17)`
  is one-based and includes precisely that tuple.

The C3f location encoding remains a **proposed/version-gated DB format**
under [PR #417](https://github.com/tehki/myaso/pull/417). This index is not
a schema migration for production: it is included in the disposable C3g
prototype migration. Core 8C and the Development Center must review the
format and live migration strategy.

## Disposable PostgreSQL acceptance

The existing dedicated workflow `Core C3g atomic item + world PostgreSQL
acceptance` runs the expanded `verify_atomic_item_world_pg.py` against
PostgreSQL 16 and an ephemeral `myaso_c3g_test` primary. New scenarios:

- Initial equipped item succeeds, second item at identical
  (character ID, slot) fails with no phantom world event or receipt.
- A second slot can hold another item; attempting to move that item into
  the occupied slot fails without changing its original location/revision.
- Destruction frees the slot; a previously unsuccessful operation may retry
  and acquire it without reusing a destroyed item ID.
- Two distinct authoritative world entities race independent PostgreSQL
  clients with distinct item IDs for the **same** equipment slot. One
  item-world commit wins; the loser has no world revision or item receipts.
- All C3g's previous fencing, CAS, cross-domain idempotency, concurrent
  same-item allocation, outer rollback and SQL-client SIGKILL proofs stay
  active.

## Explicit limitations

This is **single-item DB integrity**, not player permission enforcement:
the SECURITY DEFINER function still lacks verified actor-to-character,
zone-to-item, loot, distance, and equip-rule admission. It can prevent
duplicate equipped slots but cannot make a forged actor legitimate.
An equipment swap of two items requires a future **multi-item atomic
transaction** and deterministic multi-row locking; the C3g single-item
procedure cannot perform a swap across two occupied slots. No character
death loot, trading, currency, Moon Coin, item provenance, multi-host
failover, outbox publishing, production migration, deployment, restart,
main merge or live gameplay activation is approved by this PR.

No protected combat/graphics/browser test gates may be modified.
