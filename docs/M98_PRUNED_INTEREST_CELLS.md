# M98 — Pruned Interest Cells

## Objective

Reduce 20 Hz per-client replication work at high player counts by avoiding cell hash lookups and candidate scans for spatial-index cells that cannot intersect the existing circular far-interest radius.

## Base

M97 canonical exact green head `771be350679f7eed0dd976ad02d5f928b175c33c`, quality run `36027972873` PASS.

## Capacity motivation

The latest green 512-player probe reported:

- authoritative simulation tick p95: `0.239 ms`;
- replication batch p95: `23.610 ms`;
- average interest candidates checked per snapshot: `332.63`;
- candidate scan ratio: `0.649677`;
- snapshot omission ratio: `0.365028`.

The measured bottleneck is therefore replication planning/interest work rather than the 60 Hz simulation loop.

With the current 512-unit cell size and 2600-unit far radius, the query visits a deterministic 13×13 coordinate square (169 cells) around each viewer. A conservative cell-AABB/circle test keeps only cells whose closest possible wire-coordinate point could still lie inside the far-interest circle.

Across viewer offsets inside a cell, the geometry keeps roughly 101–106 of those 169 cells, allowing about 37–40% of cell hash lookups to be skipped before any bucket traversal.

## Change

For each coordinate in the existing deterministic cell loop:

1. increment the existing `cells_visited` diagnostic exactly as before;
2. compute the minimum X/Y wire-coordinate distance from the viewer to that cell's inclusive AABB;
3. reject the cell when that minimum squared distance is already greater than the squared far-interest radius;
4. otherwise perform the existing `HashMap` lookup and per-state circular distance check.

The per-state circular filter remains authoritative. The new cell test is only a conservative broad phase and cannot make a square cell itself count as visible.

## Ordering and diagnostics

Unchanged:

- cell coordinate traversal order;
- per-cell packed-state index order;
- final visible-state order;
- `cells_visited` semantics;
- far-interest radius and exact per-state distance check.

Changed intentionally:

- `candidates_checked` now excludes entities stored in cells that cannot geometrically intersect the far-interest circle, because those entities are no longer individually tested.

## Focused validation

`pruned_interest_cells_preserve_visibility_and_reduce_candidates` builds a frame containing:

- the viewer;
- visible nearby and far-edge entities;
- multiple entities in square-corner cells that are inside the old 13×13 scan window but wholly outside the far-interest circle.

It reconstructs the old unpruned square traversal and verifies:

1. exact visible-state sequence is unchanged;
2. `cells_visited` is unchanged;
3. `candidates_checked` is strictly lower;
4. a legitimate far-edge entity remains visible;
5. corner-cell entities remain excluded.

The inherited ordered/hashed cell-equivalence and all snapshot/browser/capacity gates remain required.

## Unchanged

No interest radius, cell size, snapshot bytes/version, planner priority, freshness cadence, ACK/baseline/history semantics, combat, movement, input, networking protocol, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M98; canonical M97 remains unchanged.
