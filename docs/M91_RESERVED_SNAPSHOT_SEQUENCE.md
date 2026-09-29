# M91 - Reserved Snapshot Sequence Sentinel

## Objective

Keep snapshot sequence `0xffff` exclusively reserved for the existing “no acknowledged snapshot / no baseline” protocol sentinel, including after long-session sequence wrap.

## Problem

The server previously advanced `SnapshotSession.next_sequence` with plain `u16::wrapping_add`. That eventually emitted sequence `65535`, even though the same value is already used throughout the protocol as the sentinel for:

- no acknowledged realtime snapshot;
- no snapshot baseline;
- initial client snapshot state;
- initial reliable merge state.

At the normal 20 Hz snapshot cadence, a long-lived connection can reach this wrap boundary. Emitting the reserved sentinel as a real snapshot can make the client treat a valid sequence as “no snapshot yet” and prevents the server from accepting it as an ACK baseline.

## Change

M91 centralizes session sequence allocation in `take_next_sequence`:

- valid emitted sequences remain `0..=65534`;
- after `65534`, the next emitted sequence is `0`;
- `65535` is skipped and remains sentinel-only;
- an unexpected internal `next_sequence == 65535` state is normalized to `0` before emission.

No wire width, packet layout, or sequence comparison function changes.

## Wrap semantics

The existing half-range sequence comparison remains valid because `0` is two modular steps newer than `65534`, which is safely within the 16-bit half range.

ACK/baseline chaining continues exactly:

`65534 -> 0 -> 1`

with baselines:

`0xffff -> 65534 -> 0`.

## Validation

The focused M91 regression:

1. seeds a session at sequence `65534`;
2. builds a full snapshot at `65534`;
3. ACKs it and builds the next delta at sequence `0`;
4. ACKs `0` and builds sequence `1`;
5. verifies baseline chaining remains valid and no emitted sequence equals `0xffff`.

The full Rust, inherited M64-M90, browser, FFA, input-loss and capacity suites remain required.

## Base / rollback

Base is M90 exact green head `32eacc0946688bab6b32951bba1f762615b6c7cd`, quality run `36008248132` PASS on unchanged-head rerun.

Rollback is to close/discard M91. M90 remains unchanged.
