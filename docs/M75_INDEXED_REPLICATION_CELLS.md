# M75 - Indexed Replication Cells

## Objective

Stop duplicating full `WireEntity` values inside spatial replication cells while preserving interest-query ordering and snapshot semantics.

## Change

`ReplicationFrame` continues to keep one packed, authoritative `Vec<WireEntity>` sorted by network ID.

Spatial cells now store `usize` indexes into that packed state vector instead of storing copied `WireEntity` values.

During interest queries, each cell index resolves directly into the packed state vector before applying the existing far-radius predicate.

## Performance effect

Each fighter state now exists once inside the replication frame instead of being copied into both the packed identity index and a spatial-cell vector.

Spatial-cell payloads are reduced to compact indexes while preserving the same cell traversal and candidate ordering.

## Behavioral contract

Unchanged behavior:

- authoritative `net_id` lookup and state ordering;
- spatial cell assignment and traversal order;
- candidate count and visited-cell diagnostics;
- far-interest radius filtering;
- visible-state ordering returned by interest queries;
- snapshot planning, freshness tiers and byte budgets;
- wire bytes/version, reliable acknowledgement, combat, movement, input handling and persistence.

## Validation

The focused M75 regression reconstructs the legacy copied-cell query order from the packed state vector and verifies the indexed-cell implementation returns the same ordered `WireEntity` sequence.

It also verifies every stored cell index resolves to a state whose computed replication cell matches the map key and that indexes inside each cell remain in authoritative state order.

The inherited M10 512-player spatial equivalence test and full Rust/browser/FFA/input-loss/capacity suite remain required.

## Base / rollback

Base is M74 exact green head `a3c80d2948523c60af6f27074f3a789c4534a125`, quality run `35886113937` PASS.

Rollback is to close/discard the M75 branch/PR. M74 remains unchanged.
