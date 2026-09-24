# M87 - Preallocated Replication Cell Index

## Objective

Avoid growth reallocations in the replication-cell hash index while constructing each authoritative replication frame.

## Change

`ReplicationFrame::from_fighters` already knows the exact fighter count before it starts packing authoritative states and assigning them to spatial cells.

Before M87:

- the packed `states` vector was preallocated to the fighter count;
- the private `cells` `HashMap` started empty and grew as spatial cells were inserted.

M87 preallocates the cell hash table with the same known fighter count. The number of occupied spatial cells can never exceed the number of fighters, so this is a safe upper bound that prevents hash-table growth during construction.

## Performance effect

Authoritative replication frames are rebuilt repeatedly during runtime. Pre-sizing the cell index removes capacity-growth work from that frame-build path.

This changes allocation strategy only. It does not change hash lookup, explicit coordinate traversal, per-cell state-index order, or packed authoritative state order.

## Behavioral contract

Unchanged:

- fighter/state ordering;
- spatial cell assignment;
- interest traversal order;
- candidate and cells-visited diagnostics;
- snapshot planning and priorities;
- snapshot bytes/version and datagram budgets;
- ACK/baseline/history behavior;
- freshness;
- combat, movement, input handling and persistence.

## Validation

The focused M87 regression builds a 64-fighter frame and verifies:

- every fighter is present in packed authoritative state;
- the private cell index has capacity for at least the known fighter upper bound immediately after construction.

The inherited M81 ordered-vs-hashed traversal regression continues to verify exact interest-query states and diagnostics.

The full Rust, M64-M86, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M86 exact green head `5f7ef0bf3b35da0f71b68d8a16c20917b189e2fc`, quality run `35989646410` PASS on the unchanged-head rerun.

Rollback is to close/discard M87. M86 remains unchanged.
