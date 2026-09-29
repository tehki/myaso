# M100 — Reused Interest Visibility

## Objective

Remove the second far-interest distance pass used only to decide acknowledged-baseline removals by reusing the exact visibility result already produced by the 20 Hz interest query.

## Base

M99 exact green head `0b49d79bc19eb3f9e5f9b6c3091148d41516e914`, quality run `36036323144` PASS.

At 512 players M99 measured:

- replication batch p95: `21.439 ms`;
- average interest candidates checked: `295.56`;
- average visible entities: `273.22`;
- omission ratio: `0.365028`;
- authoritative tick p95: `0.224 ms`.

M99 removed the duplicate planner distance calculation for visible entities. A separate duplicate remained in baseline-removal planning: every acknowledged entity found in the current replication frame was distance-tested again solely to decide whether it was still visible.

## Change

M100 adds a reusable packed visibility bitset to `SnapshotPlannerScratch`.

During the existing interest query:

1. the bitset is resized only when the frame grows beyond its retained capacity;
2. retained words are cleared in place;
3. every accepted visible packed-state index sets one bit;
4. visible-state ordering and retained distance ordering remain unchanged.

Baseline-removal planning then keeps its existing ordered merge across acknowledged baseline IDs and the frame's sorted packed states, but replaces the second viewer-distance calculation with one bit lookup.

For a 512-entity frame, the bitset contains eight `u64` words (64 bytes of payload storage) per session.

## Semantic boundary

The interest query remains the sole authority for current visibility. M100 does not change:

- far-interest radius;
- M98 cell pruning;
- per-state circular visibility filtering;
- visible-state order;
- baseline removal order;
- snapshot record priority or budget behavior.

A baseline entity is removed when it is absent from the frame or its packed-state index is not marked by the same interest query that feeds snapshot planning.

The no-viewer path continues to remove the entire acknowledged baseline.

## Focused validation

### Inherited M78 regression

`linear_baseline_removals_match_binary_lookup_semantics` still derives the expected removal set from the previous distance-based lookup semantics. It now builds the query visibility bitset and verifies the bitset-driven linear removal pass produces exactly the same ordered removals, including missing entities and the no-viewer fallback.

### M100 regression

`baseline_removals_reuse_interest_visibility_bits` verifies:

1. every frame index bit exactly matches the established far-distance visibility predicate;
2. bitset-driven removals exactly match the prior distance-based reference;
3. entities absent from the frame are still removed;
4. the visibility bitset allocation pointer and capacity are reused on a repeated query.

All inherited Rust, snapshot, browser, FFA, reliable-delta and 512-player capacity gates remain required.

## Unchanged

No snapshot bytes/version, interest radius, cell geometry, planner cadence, freshness tiers, ACK/baseline/history semantics, record ordering, combat, movement, input, networking protocol, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M100; M99 remains the exact green base.
