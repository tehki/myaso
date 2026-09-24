# M86 - Recycle Acknowledged Snapshot History Records

## Objective

Reuse record-vector capacity from snapshot history entries that are consumed by ACK advancement, not only from entries evicted by the history-size limit.

## Change

Before M86, M79 could recycle a record buffer only when snapshot history overflowed its configured depth. In normal acknowledged traffic, `advance_acknowledged_state` removes the acknowledged history entry before the next plan, and that record vector was dropped.

M86 retains the largest available record-vector capacity from history entries consumed during ACK advancement and places it into the existing session-owned `recycled_records` slot.

The next snapshot planning pass already takes that slot as its output buffer, so the allocation can be reused immediately.

## Performance effect

Steady-state ACK traffic can now recycle record-vector allocation every acknowledged snapshot rather than waiting for history overflow.

No extra record traversal is added. The acknowledged records are still applied to the baseline first, then their vector allocation becomes reusable storage.

## Behavioral contract

Unchanged:

- ACK validity and baseline dependency checks;
- acknowledged-state contents;
- snapshot history ordering/depth;
- planner selection and record order;
- datagram budgets and byte composition;
- freshness and interest behavior;
- snapshot bytes/version;
- combat, movement, input handling and persistence.

Only vector ownership after ACK consumption changes.

## Validation

The focused M86 regression:

- builds a full snapshot and captures its history record allocation;
- ACKs that exact snapshot;
- changes the owner state so the next delta contains one record;
- verifies the next history entry reuses the exact pointer and capacity from the acknowledged snapshot;
- verifies the second snapshot remains a delta against the acknowledged sequence.

The inherited Rust, M64-M85, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M85 exact head `f784fc349f1caba380e54c7920568791c638ea29`. Its focused M85 gate and authoritative Rust/inherited hot-path gates were green when M86 was started; the long acceptance tail was still running.

Rollback is to close/discard the M86 branch/PR. M85 remains unchanged.
