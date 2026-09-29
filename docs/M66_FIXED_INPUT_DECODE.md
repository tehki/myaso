# M66 - Fixed Input Decode Storage

## Objective

Remove the remaining per-input-datagram sample allocation from the authoritative decode path while preserving protocol v1 bytes and all M63-M65 input-recovery semantics.

## Product / performance delta

M64 moved accepted ingress samples into a fixed three-slot batch, but `decode_input_packet` still created a heap-backed `Vec<InputSample>` for every received input datagram.

M66 stores decoded samples directly in a fixed inline array sized to the protocol maximum of three samples and exposes only the valid prefix through `InputPacket::samples()`.

This keeps the full receive path bounded by the existing protocol redundancy maximum without changing the wire format.

## Behavioral contract

- protocol version remains 1;
- input header remains 16 bytes;
- each input sample remains 6 bytes;
- accepted sample count remains 1..=3;
- sample order and decoded values are unchanged;
- M63 dedup/action recovery, M64 fixed accepted batch, and M65 recovered action context remain unchanged.

## Deterministic coverage

The M66 regression decodes both a one-sample packet and the full three-sample packet and verifies that `InputPacket::samples()` exposes exactly the valid decoded prefix.

The inherited authoritative Rust, browser, input-loss, and capacity gates remain required.

## Allocation boundary

After M66, neither decoded input samples nor accepted ingress samples require a per-datagram heap allocation. The ingress replay-history `HashSet` remains intentionally unchanged and bounded by the existing history window.

## Unchanged

No combat constants, simulation cadence, packet bytes, redundancy count, replay window, snapshot/reliable formats, browser prediction/interpolation, persistence, deployment, or runtime activation changes.

## Base / rollback

Base is M65 exact head `c9d2e6fa1ef9c338116763866b31682ca62e36b4`.

Rollback is to close/discard the M66 branch/PR. M65 remains unchanged.
