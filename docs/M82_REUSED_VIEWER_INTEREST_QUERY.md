# M82 - Reused Viewer Interest Query

## Objective

Remove a redundant authoritative-state lookup from each snapshot interest query by reusing the viewer state that snapshot planning has already resolved.

## Change

Before M82, `plan_records` performed:

1. `frame.get(viewer_net_id)` to obtain the viewer for distance/freshness planning; then
2. `query_interest_into(viewer_net_id, ...)`, which performed the same packed-state binary lookup again.

M82 keeps the public `query_interest_into(viewer_net_id, ...)` API unchanged, but adds a private helper that accepts an already-resolved `WireEntity` viewer.

The authoritative planner now performs one viewer lookup and passes that viewer directly into the interest query.

## Performance effect

Each per-client snapshot plan removes one redundant binary search over the packed authoritative state vector.

No allocation, traversal-order, or wire-format changes are introduced.

## Behavioral contract

Unchanged:

- public `query_interest` and `query_interest_into` behavior;
- missing-viewer behavior, including clearing caller output storage;
- spatial cell traversal order;
- candidate and cells-visited diagnostics;
- far-radius filtering and visible-state ordering;
- freshness and priority planning;
- snapshot bytes/version;
- ACK/baseline/history semantics;
- combat, movement, input handling and persistence.

## Validation

The focused M82 regression compares the already-resolved-viewer helper against the public lookup path and verifies identical:

- visible-state sequence;
- candidate count;
- cells-visited count.

It also verifies a missing viewer still returns `None` and clears pre-existing caller output.

The inherited Rust, M64-M81, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M81 exact green head `54486c4f16d8d97e63be6cbb2de3028f329ce203`, quality run `35945206008` PASS.

Rollback is to close/discard the M82 branch/PR. M81 remains unchanged.
