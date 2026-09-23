# M80 - Inline Snapshot Byte Composition

## Objective

Eliminate one full traversal of the final snapshot record list by folding byte-composition accounting into the serializer's existing sizing pass.

## Change

Before M80, the current snapshot build path:

1. planned the final `Vec<SnapshotRecord>`;
2. serialized it, where the encoder first scanned all records to compute exact output size;
3. scanned the same records again through `snapshot_byte_composition` to populate diagnostics.

M80 changes the private encoder to return both:

- the encoded bytes; and
- the `SnapshotByteComposition` computed during the existing sizing pass.

The public `encode_snapshot` and `encode_snapshot_current` APIs still return only `Vec<u8>` and preserve their signatures.

## Performance effect

The authoritative build path no longer performs a separate post-encode byte-composition traversal of the final record list.

The serializer still performs the same exact-size prepass required to reserve the output buffer, then performs the same encoding pass. No extra allocation is introduced.

## Behavioral contract

Unchanged:

- snapshot bytes and current encoding version;
- record order and masks;
- compact/wide position decisions;
- facing, vitals and action encoding;
- datagram-budget assertion;
- ACK/baseline and history semantics;
- byte-composition diagnostic values;
- freshness, interest, combat, movement, input handling and persistence.

## Validation

The focused M80 regression builds a mixed record set containing:

- a full compact-position record;
- a wide-position delta with compact facing/action;
- a removal record with a multi-byte varint network ID.

It verifies:

- inline composition equals the existing standalone `snapshot_byte_composition` result;
- composition total equals encoded byte length;
- public current-encoder bytes are byte-for-byte identical to the inline-composition path;
- the resulting snapshot decodes with unchanged sequence, baseline, tick, full/delta flag and record count.

The inherited Rust, M64-M79, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M79 exact green head `517ecf7f9ee2c43bb7c193cc5ca77878be4f2089`, quality run `35908867326` PASS.

Rollback is to close/discard the M80 branch/PR. M79 remains unchanged.
