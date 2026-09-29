# M90 - Reused Reliable Frame Buffer

## Objective

Remove one heap allocation from every reliable-stream write while preserving the exact two-byte length prefix and payload bytes.

## Change

The connection already owns one reliable writer task. M90 gives that writer one reusable framing buffer:

- the initial reliable baseline allocates/populates the buffer;
- the same buffer moves into the reliable writer task;
- every later reliable payload clears and repopulates that allocation;
- capacity grows only when a larger payload requires it;
- the existing 65,535-byte payload limit remains fail-closed.

The payload queue and snapshot/kill-event payload ownership are unchanged. Only the temporary stream-framing allocation is reused.

## Behavioral contract

Unchanged:

- reliable frame wire format: little-endian u16 payload length followed by payload bytes;
- maximum reliable payload size;
- reliable queue/backpressure behavior;
- snapshot and kill-event payload construction;
- reliable checkpoint cadence;
- realtime datagrams and input acknowledgements;
- gameplay, replication interest, ACK/baseline/history and persistence.

## Validation

Focused M90 regressions verify:

1. exact length-prefix and payload bytes;
2. a smaller second frame reuses the first frame allocation pointer and capacity;
3. an oversized payload remains rejected without emitting a frame.

The full Rust, inherited M64-M89, browser, FFA, input-loss and capacity suites remain required.

## Base / rollback

Base is M89 exact green head `ad3de37a2ba8c554a8347b5955c5eb706be4c49a`, quality run `35999433189` PASS.

Rollback is to close/discard M90. M89 remains unchanged.
