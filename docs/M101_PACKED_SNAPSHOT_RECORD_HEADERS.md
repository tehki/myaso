# M101 — Packed Snapshot Record Headers

## Objective

Reduce per-record snapshot overhead at the 512-player target by packing the net ID and six wire-mask flags into one two-byte header while preserving record order, field semantics, the 1100-byte datagram ceiling, and decode support for all prior snapshot encodings.

## Base

M100 exact green head `e68a24216b73205ab78fde2331969a42c4108e1b`, quality run `36037642951` PASS.

At 512 players M100 measured:

- average snapshot bytes: `489.1`;
- average records per snapshot: `63.70`;
- omission ratio: `0.365028`;
- average net-ID bytes: `111.367`;
- average mask bytes: `63.698`;
- mid-tier freshness deadline misses: `2534`.

The existing v3 format therefore spends about `175.1` bytes per average snapshot on record IDs plus masks alone.

## Encoding v4

M101 adds:

`SNAPSHOT_ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION = 4`

The packet header's existing encoding byte selects v4, so v0-v3 remain independently decodable.

Each v4 record begins with a little-endian 16-bit packed header:

- bits 0-9: inline net ID token;
- bits 10-15: six compact wire-mask flags.

The six mask bits represent:

1. position;
2. facing;
3. vitals;
4. action;
5. wide-position marker;
6. removed marker.

### Inline IDs

Net IDs `0..=1022` are encoded directly in the 10-bit token.

At the 512-player target all normal player IDs fit inline, so the net ID plus mask always costs exactly two bytes per record.

### Escaped IDs

Token `1023` is reserved as an escape.

For IDs `>= 1023` the packed two-byte header is followed by the existing canonical unsigned varint. The decoder rejects escape-form IDs below 1023 so every ID has one canonical v4 representation.

This preserves arbitrary `u32` net IDs without constraining future entity namespaces.

## Expected 512-player effect

For M100's average `63.70` records/snapshot:

- v3 average ID + mask bytes: `111.367 + 63.698 = 175.065`;
- v4 inline header cost for the same record set: about `63.70 * 2 = 127.40`;
- same-record-set savings: about `47.67 bytes/snapshot`, roughly `9.7%` of M100's `489.1` average snapshot size.

Because snapshot planning budgets records using the current encoding's exact per-record size, M101 can spend those saved bytes on additional due records before hitting the same 1100-byte datagram limit.

The primary expected improvement is therefore:

- lower omission ratio;
- fewer freshness deadline misses;
- more records admitted per constrained 512-player snapshot.

Average packet size may remain similar or even increase if the planner successfully fills previously unused budget with additional useful records.

## Ordering and semantics

M101 does not reorder records.

The planner's priority buckets, fairness rotation, byte-budget decisions, last-sent timestamps, ACK/history handling, and freshness accounting retain the same ordering rules. Only each selected record's encoded header size changes.

Position, facing, vitals, action, removal, and wide-position field encodings remain unchanged.

## Browser compatibility

The JavaScript snapshot codec adds symmetric v4 encode/decode support while retaining v0-v3 decoding.

The existing M4 legacy fixture remains a compatibility guard for older wire snapshots.

## Focused validation

Rust:

`packed_record_headers_roundtrip_inline_and_escaped_net_ids`

verifies:

- inline IDs in the 512-player range;
- escaped large IDs;
- packed mask round-trip;
- exact snapshot decode equality;
- v4 is smaller than v3 for a representative mixed record set.

Browser:

`packed snapshot record headers shrink 512-range IDs and preserve escaped IDs`

verifies the same mixed inline/escaped record set in JavaScript and requires the v4 packet to be smaller than v3.

All inherited Rust, JavaScript, snapshot, browser, FFA, reliable-delta, and 512-player capacity gates remain required.

## Unchanged

No global protocol version, packet type, snapshot header layout, record order, interest radii, planner priority, freshness thresholds, ACK/baseline/history semantics, combat, movement, input, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M101; M100 remains the exact green base.
