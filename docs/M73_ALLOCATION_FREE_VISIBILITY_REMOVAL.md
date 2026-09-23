# M73 - Allocation-Free Baseline Visibility Removal

## Objective

Remove the remaining per-snapshot visibility-membership tree allocation from authoritative snapshot planning without changing interest or removal semantics.

## Change

Snapshot planning no longer builds a temporary `BTreeSet<u32>` containing every currently visible network ID.

When checking acknowledged baseline entities for removal, the planner now resolves each baseline ID through the M71 packed replication-frame binary lookup and applies the same authoritative far-radius predicate used by spatial interest selection.

The M72 reusable interest-state buffer remains unchanged and continues to drive delta planning.

## Performance effect

The planner no longer allocates one ordered-set node per visible entity on every client snapshot. At dense 512-player loads this removes another repeated per-client tree-allocation path from snapshot construction.

The replacement performs logarithmic packed-frame lookup for each acknowledged baseline entity and a constant-time distance check, with no temporary visibility membership container.

## Behavioral contract

Unchanged behavior:

- entities outside the far-interest radius emit removal records;
- entities absent from the current frame emit removal records;
- visible entity selection and ordering;
- spatial candidate diagnostics;
- freshness tiers, record priorities and byte budgets;
- snapshot bytes/version and reliable acknowledgement semantics;
- combat, movement, input handling and persistence.

## Validation

The M73 regression establishes an acknowledged visible entity, moves that entity beyond the authoritative far-interest radius in the next frame, and verifies the next snapshot emits the expected removal record.

The existing M10 512-player spatial-query equivalence test continues to prove the spatial query and direct far-radius predicate select the same visibility set.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M72 exact green head `bba8af084877eaa7853a5301477a2346d43cd74c`, quality run `35877065177` PASS.

Rollback is to close/discard the M73 branch/PR. M72 remains unchanged.
