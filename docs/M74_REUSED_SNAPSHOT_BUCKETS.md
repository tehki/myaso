# M74 - Reused Snapshot Planning Buckets

## Objective

Remove repeated priority-bucket vector allocation from per-client snapshot planning while preserving record ordering, freshness, and byte-budget behavior.

## Change

Snapshot planning now owns its transient state through a reusable `SnapshotPlanScratch`:

- the M72 interest-state buffer remains reusable;
- all nine `PlannedRecord` priority buckets are retained per session;
- each snapshot clears bucket lengths before planning but preserves allocated capacity;
- bucket sorting, rotation, record selection, and output order are unchanged.

Previously, all nine bucket vectors were created fresh for every snapshot and allocated again as records were pushed.

## Performance effect

After a session reaches its normal visible/due-set sizes, snapshot planning reuses the bucket backing storage instead of repeatedly allocating priority vectors. This removes another recurring per-client allocation path from dense 60 Hz replication work.

## Behavioral contract

Unchanged behavior:

- M73 allocation-free baseline visibility/removal checks;
- spatial interest membership and diagnostics;
- freshness tiers and starvation rules;
- deadline ordering and rotating bucket offsets;
- snapshot record ordering, byte budgets and wire encoding;
- combat, movement, input, reliable protocol and persistence.

## Validation

The M74 focused regression reserves and populates multiple planning buckets, clears them through the production scratch reset, verifies logical contents are empty while capacities are retained, and proves subsequent pushes reuse the same capacities.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M73 exact green head `015e8ed36862370c717c2888301912ba2eed5215`, quality run `35879567357` PASS.

Rollback is to close/discard the M74 branch/PR. M73 remains unchanged.
