# M76 - In-Place Snapshot ACK History Advancement

## Objective

Remove a temporary `VecDeque` allocation from the per-client snapshot acknowledgement path while preserving reliable baseline advancement semantics.

## Change

`SnapshotSession::advance_acknowledged_state` no longer uses `VecDeque::split_off` to isolate the acknowledged history entry and then append newer entries back.

Instead it advances the existing history deque in place:

1. discard entries older than the acknowledged sequence with `pop_front`;
2. remove the acknowledged entry itself with `pop_front`;
3. leave all newer history entries in the original deque and original allocation.

The acknowledged record set is applied exactly as before.

## Performance effect

Accepted snapshot acknowledgements no longer create a temporary history deque or move newer history entries into a second container. The session retains the existing `VecDeque` capacity across acknowledgement advancement.

## Behavioral contract

Unchanged behavior:

- unknown/stale sequence handling;
- repeated acknowledgement of the current sequence;
- baseline dependency validation for delta snapshots;
- application of full and delta records;
- preservation of snapshots newer than the acknowledged entry;
- history limits and sequence wrap behavior;
- snapshot bytes/version, planner behavior, interest, combat, movement, input handling and persistence.

## Validation

The focused M76 regression builds three history entries, acknowledges the middle entry, and verifies:

- the older entry is discarded;
- the acknowledged sequence becomes authoritative;
- its records populate acknowledged state;
- the newer entry remains queued;
- the original history-deque capacity is retained;
- repeating the same acknowledgement is idempotent and preserves history/capacity.

The inherited Rust, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M75 exact green head `158483ce0364e3fc8611e3c3eee89a5a45860cf8`, quality run `35888244457` PASS.

Rollback is to close/discard the M76 branch/PR. M75 remains unchanged.
