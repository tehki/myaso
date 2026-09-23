# M78 - Linear Baseline Removal Scan

## Objective

Remove repeated binary searches from acknowledged-baseline visibility removal planning while preserving removal ordering and interest semantics.

## Change

Snapshot planning previously iterated every acknowledged baseline network ID and called `ReplicationFrame::get`, performing one binary search into the packed state vector for each baseline entity.

M78 exploits two existing ordering guarantees:

- acknowledged baseline state is stored in a `BTreeMap<u32, WireEntity>`, so IDs are visited in ascending order;
- `ReplicationFrame.states` is packed in ascending authoritative `net_id` order.

The planner now advances one monotonic cursor through the packed state vector while scanning baseline IDs. Each current-frame state is considered at most once during the removal scan.

If the viewer is absent, all baseline entities are removed in the same ascending baseline order as before.

## Performance effect

Baseline-removal classification changes from repeated logarithmic packed-state lookups to one linear merge-style scan over baseline IDs and current packed state.

For dense acknowledged snapshots this reduces lookup work while adding no temporary allocation and preserving the existing removal bucket.

## Behavioral contract

Unchanged behavior:

- baseline IDs absent from the current frame emit removals;
- baseline IDs outside the far-interest radius emit removals;
- visible baseline IDs remain present;
- removal insertion order remains ascending baseline network ID order before existing bucket rotation;
- viewer-missing behavior removes the full baseline;
- snapshot priority/budget, freshness, bytes/version, ACK/baseline semantics, combat, movement, input handling and persistence.

## Validation

The focused M78 regression constructs a baseline containing:

- current visible entities;
- a current entity outside the far-interest radius;
- entities absent from the current frame.

It computes the expected removal IDs using the prior binary-lookup predicate and verifies the linear scan returns the exact same ordered removal set and count. It also verifies viewer-missing behavior removes the entire baseline in baseline order.

The inherited Rust, M64-M77, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M77 exact green head `a4f838ff38c599a1e44f7dbb14e9cdd0df646e4b`, quality run `35896550347` PASS.

Rollback is to close/discard the M78 branch/PR. M77 remains unchanged.
