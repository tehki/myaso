# M88 - Reused Replication Frame Storage

## Objective

Avoid rebuilding the authoritative replication frame into a fresh heap allocation when no connection still holds the previous frame.

## Change

M88 adds an in-place `ReplicationFrame::refresh_from_fighters` path that:

- updates the frame tick;
- clears and reuses packed authoritative state storage;
- clears and reuses the replication-cell hash table allocation;
- grows either container only when the current fighter population exceeds retained capacity;
- rebuilds the same ordered state and spatial-cell index semantics as `from_fighters`.

`GameState::refresh_replication_frame` now uses `Arc::get_mut`:

- when the frame is uniquely owned, it refreshes the existing allocation in place;
- when any connection still holds an `Arc` clone, it preserves that immutable snapshot and falls back to allocating a new frame exactly as before.

## Safety / isolation

The fast path cannot mutate a frame observed by an active connection because `Arc::get_mut` succeeds only for unique ownership. Shared frames retain their original tick and state until their readers release them.

This preserves the existing snapshot-isolation boundary while removing frame-allocation churn in uncontended refreshes.

## Behavioral contract

Unchanged:

- fighter/state ordering;
- replication-cell assignment and traversal order;
- interest-query diagnostics;
- snapshot planning, priorities, bytes and protocol version;
- ACK/baseline/history and freshness semantics;
- combat, movement, input, kill feed, persistence and match lifecycle.

## Validation

The focused M88 regression proves both branches:

1. a uniquely owned frame keeps the same `Arc` allocation across refresh;
2. a shared frame forces allocate-and-swap, and the held snapshot retains its old tick/state;
3. after the reader is dropped, the new unique frame is reused again.

The full Rust, inherited M64-M87, browser, FFA, input-loss and capacity suites remain required.

## Base / rollback

Base is M87 exact green head `5a11c58b363f206f214d4b852909fee759a11b6e`, quality run `35992386730`, final bounded unchanged-head job `107615147095` PASS.

Rollback is to close/discard M88. M87 remains unchanged.
