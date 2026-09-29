# M89 - Recycled Replication Cell Buckets

## Objective

Retain the per-cell `Vec<usize>` allocations used by the authoritative replication-cell index across in-place frame refreshes.

## Change

M88 reuses the outer `ReplicationFrame`, packed state vector, and `HashMap` allocation when the frame is uniquely owned. Before M89, refreshing still called `cells.clear()`, which dropped every per-cell index vector and forced those small vectors to allocate again as occupied cells were rebuilt.

M89 adds a frame-owned recycled cell-bucket pool:

- active cell entries are drained from the hash map;
- each index vector is cleared while retaining capacity;
- cleared buckets are stored in the recycle pool;
- rebuilding an occupied cell first reuses a recycled bucket;
- the hash map itself still contains only cells occupied by the current frame.

This preserves exact map semantics while removing repeated per-cell vector allocation churn.

## Behavioral contract

Unchanged:

- packed fighter/state ordering;
- occupied-cell keys in the current frame;
- per-cell state-index ordering;
- explicit interest traversal order;
- candidate and cells-visited diagnostics;
- snapshot planning, bytes, budgets, freshness, ACK/baseline/history;
- combat, movement, input, FFA, persistence and match lifecycle.

## Validation

The focused M89 regression:

1. builds eight fighters in one replication cell;
2. captures that cell bucket's allocation pointer and capacity;
3. refreshes the frame in place with identical authoritative fighters;
4. verifies the same bucket allocation is reused;
5. verifies the recycle pool is consumed;
6. verifies interest-query state order and diagnostics are unchanged.

The full Rust, inherited M64-M88, browser, FFA, input-loss and capacity suites remain required.

## Base / rollback

Base is M88 exact green head `db9ccd666f82d0b7fedd7574eb917cf84015519a`, quality run `35997068863` PASS.

Rollback is to close/discard M89. M88 remains unchanged.
