# M74 - Reused Snapshot Planner Buckets

## Objective

Remove repeated priority-bucket allocations from per-client authoritative snapshot planning without changing record selection, ordering, freshness, or wire semantics.

## Change

`SnapshotSession` now owns the nine `Vec<PlannedRecord>` priority buckets used by the snapshot planner.

Before each build, the planner clears the existing buckets in place and refills them. Bucket processing now iterates by mutable reference instead of consuming the vectors, so their capacities remain available for the next snapshot.

## Performance effect

Previously every client snapshot started from nine fresh empty vectors. Dense snapshots could repeatedly allocate bucket storage as records were classified.

M74 retains those capacities per session after first growth, removing that recurring allocation path while preserving the existing planner algorithm.

## Behavioral contract

Unchanged behavior:

- bucket classification and priority order;
- combat / near deadline ordering;
- rotating bucket offsets for non-deadline tiers;
- byte-budget admission and omission accounting;
- freshness diagnostics;
- snapshot records, bytes, sequence and protocol version;
- spatial interest, reliable acknowledgement, combat, movement, input handling and persistence.

## Validation

The focused M74 unit regression builds the same dense frame twice through one `SnapshotSession`, captures all nine bucket capacities after the first build, and verifies:

- at least one planner bucket allocated storage;
- all bucket capacities are unchanged on the second build;
- record count, byte composition and freshness diagnostics remain identical.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M73 exact green head `015e8ed36862370c717c2888301912ba2eed5215`, quality run `35879567357` PASS.

Rollback is to close/discard the M74 branch/PR. M73 remains unchanged.
