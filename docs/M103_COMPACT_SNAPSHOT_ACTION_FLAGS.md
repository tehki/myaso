# M103 — Compact Snapshot Action Flags

## Objective

Reduce the remaining action/kill-flag payload cost in constrained snapshots without changing action codes, kill accounting, record ordering, or planner semantics.

## Base

M102 exact green head `f975a213de01f3f7b5c2167af459ba9b2965ef75`, quality run `36068768089` PASS.

At 512 players M102 measured:

- average snapshot bytes: `440.6`;
- average records/snapshot: `72.93`;
- omission ratio: `0.147510`;
- mid freshness deadline misses: `1527`;
- action bytes/snapshot: `38.082`.

The action field still consumes two bytes whenever present:

- one action code byte;
- one flags byte (currently kill count on the authoritative fighter state).

Normal game values are much smaller:

- action codes are `0..=8`;
- FFA kill flags are normally `0..=2` before match reset.

## Encoding v6

M103 adds:

`SNAPSHOT_ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS = 6`

V6 inherits M102's packed record header and local-cell position encoding unchanged.

Only the action payload changes.

### Common compact form

When both values fit four bits and the pair is not `(15, 15)`:

`packed = action | (flags << 4)`

The action payload costs one byte.

### Wide escape form

Byte `0xff` is reserved as the escape token.

Values that do not fit the compact form are encoded as:

1. `0xff`;
2. full `action: u8`;
3. full `flags: u8`.

This preserves the complete historical `u8/u8` field range.

The `(15, 15)` pair also uses the escape form because its compact representation would collide with the reserved marker.

### Canonical decoding

The decoder rejects escape-form values that could have been represented by the one-byte compact form. This preserves one canonical v6 representation for every action/flags pair.

## Exact planner budgeting

M103 updates the same composition helper used by snapshot planning and final serialization:

- compact action/flags record: 1 action byte;
- escaped action/flags record: 3 action bytes;
- encodings v0-v5: unchanged 2-byte action payload.

No optimistic estimate is used. The 1100-byte datagram admission decision remains exact.

## Expected 512-player effect

M102 used `38.082` action bytes/snapshot.

In the deterministic capacity workload nearly all emitted action/kill values are compactable, so the expected same-record-set savings are roughly half that field, about 19 bytes/snapshot.

As with M101/M102, those bytes can be reinvested by the planner into additional due records. The key acceptance signals are therefore:

- lower omission ratio;
- lower freshness deadline misses;
- more admitted records/snapshot;
- exact byte composition matching actual packet length.

## Focused validation

Rust:

`compact_action_flags_roundtrip_common_and_wide_values`

verifies:

- common compact action/flags pairs;
- a wide escaped pair;
- exact v6 decode equality;
- exact composition = wire length;
- v6 is smaller than v5 for a representative mixed record set;
- non-canonical escape rejection.

JavaScript:

`compact snapshot action flags shrink common values and preserve wide escapes`

verifies:

- public encoder/decoder round-trip;
- v6<v5 byte size for the same records;
- in-place browser hot-path decoding;
- wide-value preservation;
- non-canonical escape rejection in both public and in-place decoders.

M18 byte accounting is updated to require the common action pair to cost exactly one byte under the current encoding.

All inherited Rust, JavaScript, browser, FFA, reliable-delta and 512-player capacity gates remain required.

## Compatibility

Encodings v0-v5 remain independently decodable.

There is no global protocol-version change.

## Unchanged

No action codes, kill semantics, record masks, packet header layout, local-position behavior, interest radii, planner priority/order, freshness thresholds, ACK/baseline/history semantics, combat, movement, input, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M103; M102 remains the exact green base.
