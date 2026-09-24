# M85 - Planner-Owned Last-Sent Updates

## Objective

Remove the redundant post-planning traversal that existed only to update per-client `last_sent_tick` state for records the planner had already admitted.

## Change

Before M85, snapshot planning selected the final record list, then `SnapshotSession::build_from_frame` walked that list again to:

- insert the current server tick for transmitted entity records;
- remove timestamps for transmitted removal records.

M85 performs those same updates inside the planner's existing admission loop, immediately after a record has passed the byte budget and been appended to the final record list.

The planner receives mutable access to the private `last_sent_tick` map. Candidate eligibility still reads the pre-build timestamps before admission starts, so cadence and priority decisions are unchanged.

## Performance effect

The authoritative build path no longer performs an additional O(selected-record-count) traversal solely for timestamp bookkeeping.

The remaining selected-record work is already required for:

- planning and budget admission;
- serialization;
- history retention.

## Behavioral contract

Unchanged:

- cadence eligibility and freshness ages;
- record priority and rotating bucket order;
- datagram-budget admission;
- omitted-record behavior;
- removal behavior;
- snapshot bytes/version and byte composition;
- ACK/baseline/history semantics;
- interest filtering;
- combat, movement, input handling and persistence.

Budget-omitted records are not marked as sent. A removal timestamp is deleted only when that removal record is actually admitted.

## Validation

The focused M85 regression verifies:

- with a byte budget that admits only the owner record, the owner timestamp advances to the current server tick;
- the budget-omitted second entity receives no timestamp update;
- an admitted removal record deletes its existing last-sent timestamp.

The inherited Rust, M64-M84, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M84 exact green head `8f956828f4ef9da930e387f81bc7af98da82fa5f`, quality run `35982767345` PASS.

Rollback is to close/discard the M85 branch/PR. M84 remains unchanged.
