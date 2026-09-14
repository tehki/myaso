# M18 — Snapshot byte accounting

## Objective

Measure the saturated realtime snapshot budget before changing snapshot wire v1 or replication cadence.

M18 is instrumentation only. It does not change combat authority, AOI selection, scheduling, cadence, packet limits, reliable catch-up, or browser behavior.

## Accounting

Every `SnapshotBuild` reports exact encoded bytes for:

- fixed snapshot header;
- 4-byte entity/network identifiers;
- 1-byte field masks;
- position payloads;
- facing payloads;
- vitals payloads;
- action/flags payloads.

Removal records contribute only identifier + mask bytes.
The composition sum is required to equal the actual encoded snapshot length. A deterministic Rust integration test covers mixed full/delta/removal masks.

## Evidence

The existing M8 capacity probe keeps its established `M8_CAPACITY` output unchanged and emits an additional `M18_BYTE_COMPOSITION` JSON line for each 64/128/256/512-player scenario.

That line reports average bytes per snapshot and total wire share for each field class. The 512-player result is the decision input for the next wire optimization.

## Acceptance

- Rust fmt/check/clippy/tests pass;
- M18 exact-byte regression passes;
- all inherited browser, M15/M16/M17, capacity/load and governance gates remain green;
- 512-player byte composition is captured without changing omission, packet-size, tick, or replication-batch semantics.
