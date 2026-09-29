# M72 - Reused Interest Query Scratch

## Objective

Remove a repeated per-client allocation from authoritative snapshot planning while preserving interest selection and snapshot wire behavior.

## Change

`SnapshotSession` now owns a reusable `Vec<WireEntity>` scratch buffer for spatial-interest results.

`ReplicationFrame::query_interest_into` fills caller-provided storage and clears it before each query. The existing allocating `query_interest` API remains available and delegates to the same implementation, preserving public behavior.

The production snapshot planner now reuses the session-owned buffer instead of allocating a fresh visible-state vector for every snapshot build.

## Performance effect

For active sessions, interest-query storage grows only when a larger visible set is first encountered, then reuses that capacity on subsequent snapshots. This removes one recurring vector allocation/growth path per client snapshot.

## Behavioral contract

Unchanged behavior:

- spatial-cell traversal and far-interest radius;
- candidate / cell diagnostics;
- visible entity membership and ordering;
- freshness tiers, record prioritization and byte budgets;
- snapshot bytes, protocol version and reliable semantics;
- combat, movement, input handling and persistence.

## Validation

The M72 regression compares the reusable query path with the existing allocating query over a 512-player frame, verifies identical states and diagnostics, proves capacity is retained across repeated queries, and verifies a missing viewer clears the scratch buffer without releasing capacity.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M71 exact green head `bf930cf47644c8f303d9cbb5fa78b2f53c161f23`, quality run `35870056891` unchanged exact-head rerun PASS.

Rollback is to close/discard the M72 branch/PR. M71 remains unchanged.
