# M19 Compact Record Identity

## Objective

Reduce the dominant avoidable realtime snapshot cost measured by M18 without changing combat, AOI, replication priority, cadence, reliability semantics, or the 1100-byte datagram ceiling.

M18 measured 512-player realtime snapshots at 1097.1 bytes average, with 33.94% spent on 4-byte network IDs and another 8.48% on masks. Fixed record identity framing therefore consumed about 42.42% of the saturated packet.

## Wire contract

The transport protocol remains version 1. Snapshot header byte 3, previously reserved and always zero, now explicitly identifies the snapshot record-ID encoding:

- `0`: legacy little-endian `u32` network IDs;
- `1`: canonical unsigned `u32` varint network IDs;
- any other value fails closed.

Encoding `1` is the current production snapshot encoding. Legacy encoding `0` remains decodable and the historical M4 fixture remains unchanged.

Each compact record is encoded as:

`varint(net_id) + field_mask + unchanged field payload`

## Canonical varints

Compact IDs use the shortest valid unsigned representation and are bounded to `u32`:

- `0..127`: 1 byte;
- `128..16,383`: 2 bytes;
- larger IDs scale to at most 5 bytes;
- overlong/non-canonical forms fail closed;
- fifth-byte overflow fails closed;
- truncated records fail closed.

The current 1–512 map identity range therefore needs only 1–2 bytes per selected record instead of 4.

## Scheduling invariants

M19 does not sort or reorder records for compression. Absolute IDs are varint-encoded in the planner's existing priority order. This preserves owner/combat/near/background priority semantics while making each record's byte cost independently knowable before selection.

The planner uses the compact byte cost when deciding whether a record fits in the 1100-byte realtime packet. Recovered identity bytes are expected to become additional useful records, not unused packet slack.

## Acceptance evidence

M19 must preserve all inherited gates and additionally prove:

- Rust and browser codecs agree on one shared compact fixture;
- legacy encoding `0` still decodes unchanged;
- uint32 varint boundaries round-trip exactly;
- unknown, non-canonical, overflowing, and truncated encodings fail closed;
- allocation-minimized browser snapshot application supports both encodings;
- 512-occupant Chrome and Firefox flights remain green;
- reliable delta/full-checkpoint convergence remains green;
- realtime packets remain at or below 1100 bytes;
- 512-player records per snapshot increase and omission falls materially versus M18's 93.09 records and 64.0520% omission;
- combat/near freshness is not weakened;
- 60 Hz tick and 20 Hz replication-batch targets remain green.

M19 does not merge, deploy, bind publicly, or activate production runtime state.

## Inherited M15 fixture adaptation

Compact IDs reduce realtime record cost enough that the historical 192-player M15 fixture no longer forces a mid-tier deadline miss. M19 therefore makes the loopback-only near-pressure count configurable and runs M15 at 256 synthetic players with 220 in the near tier. Production scheduling and reliable-trigger thresholds are unchanged; M16/M17 retain their prior geometry.
