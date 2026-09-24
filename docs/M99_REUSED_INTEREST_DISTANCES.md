# M99 — Reused Interest Distances

## Objective

Remove duplicate per-visible-entity distance calculations from the 20 Hz snapshot planner by carrying the squared distances already computed by the interest query into reusable planner scratch.

## Base

M98 exact green head `0f7402b211271dd93ede0a99f8503c1a5a3f9c47`, quality run `36032334497` PASS.

M98 reduced the 512-player average candidate count from `332.63` to `295.56` and replication batch p95 from `22.986 ms` to `21.916 ms`, while leaving average visible entities at `273.22`. The remaining planner still recomputed `interest_distance_sq` for each of those visible entities immediately after the interest query had already computed it.

## Change

- add reusable `interest_distances_sq: Vec<f32>` storage to `SnapshotPlannerScratch`;
- let the internal interest-query path optionally retain each accepted entity's already-computed squared distance alongside the existing visible-state vector;
- keep public interest-query behavior unchanged;
- have `plan_records` iterate visible states and retained distances in lockstep instead of recomputing viewer-to-state distance;
- clear both reusable vectors together when the viewer is unavailable.

The distance value continues to feed the same cadence and freshness-tier functions. No thresholds or classifications change.

## Allocation behavior

The new distance vector is planner scratch. It is cleared and reused between snapshots, matching the existing reusable visible-state and bucket storage rather than allocating a per-snapshot result structure.

## Focused validation

`interest_query_carries_distances_in_visible_state_order` verifies that:

1. the distance-carrying internal query returns the exact same visible-state sequence as the public query;
2. candidate and cell diagnostics are unchanged;
3. there is exactly one retained distance per visible state;
4. each retained value exactly equals the established `interest_distance_sq` calculation for the corresponding state.

All inherited snapshot, browser, FFA, reliable-delta, and capacity gates remain required.

## Unchanged

No interest radii, cell geometry, visibility ordering, snapshot bytes/version, planner cadence, freshness tiers, ACK/baseline/history semantics, combat, movement, input, networking protocol, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M99; M98 remains the exact green base.
