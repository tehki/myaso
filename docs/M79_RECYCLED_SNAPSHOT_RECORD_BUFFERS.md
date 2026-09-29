# M79 - Recycled Snapshot Record Buffers

## Objective

Stop repeatedly allocating and dropping the final `Vec<SnapshotRecord>` used by snapshot history once a session reaches steady-state history depth.

## Change

Each `SnapshotHistoryEntry` owns the exact records needed to reconstruct an acknowledged baseline. Before M79, every planned snapshot created a fresh record vector, while the oldest history entry was dropped after the new entry was stored.

M79 adds one session-owned recycled record buffer:

- planning takes the previously recycled vector and clears it while retaining capacity;
- the planned records are encoded and moved into history exactly as before;
- when history exceeds its configured limit, the evicted entry's record vector becomes the recycled buffer for the next snapshot.

The first history window still allocates normally. Once eviction begins, record-vector capacity circulates from evicted history entries into new snapshots instead of being dropped and reallocated.

## Performance effect

For established sessions at bounded history depth, the final snapshot record vector can reuse prior capacity across builds. This targets allocator churn in the per-client snapshot hot path without changing priority buckets or history contents.

## Behavioral contract

Unchanged:

- snapshot record selection and ordering;
- encoded snapshot bytes/version;
- history depth and sequence retention;
- ACK/baseline reconstruction;
- freshness, priority and budget accounting;
- interest selection/removals;
- combat, movement, input handling and persistence.

The recycled vector is not authoritative state. It is only spare capacity from a history entry that was already being evicted.

## Validation

The focused M79 regression uses a history limit of two, fills the history, triggers eviction, captures the evicted record vector's allocation, then builds another equivalent snapshot. It verifies:

- history depth remains bounded at two;
- record count and byte composition stay identical;
- the newest history entry uses the exact recycled allocation without capacity growth;
- the next evicted entry becomes the new recycled buffer.

The inherited Rust, M64-M78, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M78 exact green head `b2724bcec670026c87e4359360927de974f99a76`, quality run `35899044729` unchanged-head rerun PASS.

Rollback is to close/discard the M79 branch/PR. M78 remains unchanged.
