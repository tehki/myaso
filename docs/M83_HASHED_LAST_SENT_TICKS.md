# M83 - Hashed Snapshot Freshness Timestamps

## Objective

Reduce exact-key freshness lookup/update cost in the per-client snapshot hot path by replacing the ordered `last_sent_tick` map with a hash map.

## Change

`SnapshotSession.last_sent_tick` previously used:

```rust
BTreeMap<u32, u32>
```

M83 changes only this private freshness-timestamp store to:

```rust
HashMap<u32, u32>
```

The map is never iterated. Snapshot code uses it only for exact-key:

- `get(net_id)` during freshness and cadence planning;
- `insert(net_id, server_tick)` after a record is sent;
- `remove(net_id)` after a removal record is sent.

Ordered `acknowledged_state` remains a `BTreeMap` because baseline-removal ordering still relies on ascending network IDs.

## Performance effect

Per-visible-entity freshness lookup and per-sent-record timestamp maintenance no longer require ordered-tree traversal.

No additional allocation or wire-format work is introduced.

## Behavioral contract

Unchanged:

- freshness ages and cadence decisions;
- starvation handling;
- record priority and ordering;
- removal behavior;
- diagnostics;
- snapshot bytes/version;
- ACK/baseline/history semantics;
- interest traversal;
- combat, movement, input handling and persistence.

No behavior depends on iteration order of `last_sent_tick`.

## Validation

The focused M83 regression builds two freshness maps with identical key/value pairs inserted in opposite orders, then plans the same changed frame through independent scratch buffers. It verifies identical:

- final record sequence;
- omitted-due-to-budget count;
- interest candidate count;
- visible entity count;
- freshness diagnostics.

The inherited Rust, M64-M82, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M82 exact green head `b2472caba5a2bdb42333a70645ebf8f612a78288`, quality run `35972173433` PASS.

Rollback is to close/discard the M83 branch/PR. M82 remains unchanged.
