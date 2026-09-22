# M64 - Fixed Input Ingress Batch

## Objective

Remove an avoidable heap allocation from the authoritative 60 Hz input-ingress hot path.

Each protocol-v1 input datagram can carry at most three samples. Before M64, `InputIngressWindow::ingest()` created a new `Vec<InputSample>` for every decoded input packet even though the accepted batch can never exceed `INPUT_REDUNDANCY_MAX == 3`.

At the 512-player engineering target and 60 input packets per second, the server can process up to 30,720 player input datagrams per second before transport loss/rejection. M64 keeps this bounded three-sample batch inline instead of allocating a variable-length container for every ingress call.

This is a hot-path allocation reduction, not a capacity claim.

## Implementation

M64 introduces `AcceptedInputBatch`:

- inline storage: `[InputSample; INPUT_REDUNDANCY_MAX]`;
- explicit current length;
- slice/iterator/last/is-empty accessors used by existing callers;
- in-place oldest-to-newest sorting over only the accepted prefix.

`InputIngressWindow::ingest()` now returns this fixed batch.

The M63 action-edge recovery path consumes `accepted.as_slice()`, so its semantics are unchanged:

- newest movement/facing/block state wins;
- newest accepted one-shot attack/dodge edge is recovered;
- ingress deduplication remains the replay boundary.

The M8 transport probe continues using `accepted.last()` and therefore validates compatibility with the capacity/load tooling.

## Deterministic coverage

The M64 Rust regression proves that a normal three-sample packet:

- returns exactly three accepted entries;
- keeps the established chronological order `998, 999, 1000`;
- exposes a fixed batch whose accepted slice is bounded by `INPUT_REDUNDANCY_MAX`.

Inherited ingress deduplication/reordering tests remain unchanged.

## Performance boundary

M64 removes the per-call `Vec` used only for the accepted sample batch.

It does not change:

- the existing ingress `HashSet` replay window;
- packet decoding;
- the three-sample redundancy limit;
- packet size;
- sorting semantics;
- action coalescing;
- acknowledgement semantics.

No new dependency is introduced.

## Unchanged behavior

M64 does not change:

- protocol version 1;
- 34-byte three-sample input datagrams;
- 60 Hz authoritative simulation or input cadence;
- attack, dodge, block/parry, movement, guard, damage, death, respawn, or scoring;
- snapshot/reliable replication;
- interest management;
- persistence;
- deployment/runtime configuration.

## Base / rollback

Base is frozen M63 exact head `405f1c74cc22613188361b6f63cc730ecca2f83b`, validated by quality #259 / run `35672097737` FULL PASS.

Rollback is to close/discard the M64 branch/PR. M63 remains unchanged.
