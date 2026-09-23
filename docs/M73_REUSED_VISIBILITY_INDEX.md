# M73 - Reused Visibility Identity Index

## Objective

Remove per-snapshot tree-node allocation from baseline visibility/removal checks while preserving snapshot membership and removal semantics.

## Change

`SnapshotSession` now owns a reusable `Vec<u32>` visibility identity index.

After M72 fills the reusable interest-state scratch buffer, snapshot planning now:

- clears and refills the session-owned identity vector from visible network IDs;
- sorts the IDs in place;
- uses binary search when checking baseline entities for removal.

This replaces the previous per-snapshot `BTreeSet<u32>`, which allocated tree nodes as visible entities were inserted.

## Performance effect

At the 512-player target, visibility/removal planning now reuses one contiguous allocation per session rather than constructing a node-based set every snapshot. Capacity is retained between builds.

## Behavioral contract

Unchanged behavior:

- visible entity membership;
- out-of-interest and removed-entity records;
- spatial interest radius and diagnostics;
- freshness tiers, record priority and byte budgets;
- snapshot encoding / protocol version;
- combat, movement, input handling, persistence and reliable semantics.

## Validation

The M73 focused regression verifies that unsorted visible IDs are indexed in sorted order, repeated smaller queries retain vector capacity, and an empty query clears logical contents without releasing storage.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M72 exact green head `bba8af084877eaa7853a5301477a2346d43cd74c`, quality run `35877065177` PASS.

Rollback is to close/discard the M73 branch/PR. M72 remains unchanged.
