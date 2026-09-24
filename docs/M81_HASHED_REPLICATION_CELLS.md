# M81 - Hashed Replication Cell Lookup

## Objective

Reduce spatial-interest lookup overhead by replacing ordered-tree lookup for replication cells with direct hash lookup, while preserving deterministic query traversal and output ordering.

## Change

`ReplicationFrame.cells` previously used:

```rust
BTreeMap<(i32, i32), Vec<usize>>
```

M81 changes only this private lookup container to:

```rust
HashMap<(i32, i32), Vec<usize>>
```

Interest-query ordering does not depend on map iteration. The query already visits coordinates deterministically using explicit nested `cell_y` / `cell_x` loops, performs an exact-key lookup for each coordinate, and then visits the stored state indexes in authoritative insertion order.

The packed authoritative `states` vector remains sorted by `net_id`.

## Performance effect

Each visited spatial cell no longer incurs ordered-tree traversal. Queries use direct hash lookup for the exact coordinate key while keeping the existing compact index vectors from M75.

This targets the repeated cell-lookup portion of every per-client interest query.

## Behavioral contract

Unchanged:

- explicit spatial cell traversal order;
- per-cell state-index order;
- candidate count and cells-visited diagnostics;
- far-radius filtering;
- visible-state ordering;
- packed authoritative state lookup by network ID;
- snapshot planning, bytes/version, ACK/baseline/history semantics;
- combat, movement, input handling and persistence.

No behavior relies on iteration order of the private cell map.

## Validation

The focused M81 regression reconstructs the prior ordered `BTreeMap` cell index from the same packed frame and executes the same explicit coordinate traversal. It verifies the hashed frame query returns exactly the same:

- visible state sequence;
- candidate count;
- cells-visited count.

The inherited Rust, M64-M80, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M80 exact green head `d06357478b2909667aeb7279d6575165ef70462c`, quality run `35911257799` PASS.

Rollback is to close/discard the M81 branch/PR. M80 remains unchanged.
