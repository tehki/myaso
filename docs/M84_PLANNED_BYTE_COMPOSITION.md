# M84 - Planned Snapshot Byte Composition

## Objective

Remove the serializer's redundant sizing/composition pass from the authoritative snapshot build path by carrying exact byte composition out of planning.

## Change

Snapshot planning already evaluates every selected record against the datagram budget. Before M84, that budget pass computed each record's encoded byte size, but the serializer later scanned the complete selected record list again to reconstruct exact byte composition before allocating the output buffer.

M84 makes planning retain that exact composition while records are admitted to the final snapshot.

The authoritative build path then passes the planned composition directly into the current serializer. Public encoder APIs remain unchanged and still compute their own sizing when called independently.

## Performance effect

For authoritative snapshots, the final selected record list is no longer rescanned solely to determine output size/composition before encoding.

The remaining record passes are:

- planner selection/budgeting, which was already required;
- serialization, which writes the bytes.

No wire-format change or extra allocation is introduced.

## Behavioral contract

Unchanged:

- datagram-budget admission decisions;
- byte-composition diagnostic values;
- exact encoded snapshot bytes/version;
- record order and masks;
- compact/wide position and facing encoding;
- ACK/baseline/history semantics;
- freshness, priority and interest behavior;
- combat, movement, input handling and persistence.

Public `encode_snapshot` and `encode_snapshot_current` signatures and behavior remain unchanged.

## Validation

The focused M84 regression plans a multi-entity snapshot and verifies:

- planned byte composition exactly equals standalone `snapshot_byte_composition`;
- planned composition total equals encoded byte length;
- encoding with precomputed planned composition is byte-for-byte identical to the public current encoder.

The inherited Rust, M64-M83, browser, FFA, input-loss and 512-player capacity suites remain required.

## Base / rollback

Base is M83 exact green head `9e281ce70e9ab152b21c282ec74267206b6ac3ef`, quality run `35980143296` PASS.

Rollback is to close/discard the M84 branch/PR. M83 remains unchanged.
