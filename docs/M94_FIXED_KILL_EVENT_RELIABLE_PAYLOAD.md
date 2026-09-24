# M94 — Fixed Kill-Event Reliable Payload

## Objective

Remove the temporary heap allocation created for every reliable kill-event enqueue while preserving the existing bounded writer queue and exact wire bytes.

## Base

M93 exact green head `1c0e13163fde2ac712aa3997e8af53972d07c7ce`, quality run `36021209876` PASS.

## Change

The reliable writer queue is generalized from `Vec<u8>` to a small payload enum:

- snapshot catch-up payloads remain owned `Vec<u8>` values exactly as before;
- kill events are queued as the fixed-size `KillEventPacket` struct;
- the writer encodes a kill event only after dequeue;
- encoded kill-event bytes are copied directly into the already-reused reliable framing buffer;
- the queue remains capacity 1 and retains the same reserve-before-build/backpressure semantics.

This removes the former `encode_kill_event(event).to_vec()` allocation from the kill-feed path.

## Behavioral contract

Unchanged:

- kill-event packet bytes and sequence/killer/victim fields;
- reliable stream length-prefix framing;
- queue capacity and backpressure behavior;
- kill-event cursor advancement and retry behavior;
- reliable snapshot payload ownership;
- snapshot protocol, combat scoring, match lifecycle, gameplay, persistence.

## Focused validation

The M94 regression:

1. creates a fixed `KillEventPacket` payload;
2. prepares it into a preallocated reliable frame buffer;
3. verifies the frame buffer allocation pointer and capacity are retained;
4. verifies the two-byte length prefix;
5. verifies the framed payload is byte-for-byte identical to `encode_kill_event`.

The generic reliable-queue regression continues to verify that a full queue does not invoke its payload builder.

## Rollback

Close/discard M94; M93 remains unchanged.
