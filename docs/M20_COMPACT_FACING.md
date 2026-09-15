# M20 Compact Facing

## Objective

Recover realtime snapshot budget after M19 compact record IDs without spending the remaining replication CPU headroom on a more complex position codec.

M19 made position the largest byte class at 512 players (~40.57%) and facing the next largest (~20.86%). M20 targets facing first because it can be reduced from 16 bits to 8 bits with a bounded angular error and no combat-authority change.

## Wire contract

The transport protocol remains version 1. Snapshot header byte 3 now supports three explicit encodings:

- `0`: legacy fixed-width `u32` network IDs + `u16` facing;
- `1`: canonical varint network IDs + `u16` facing (M19 compatibility);
- `2`: canonical varint network IDs + compact `u8` facing (current production encoding).

All position, vitals, action/flags, masks, sequence, baseline, full/delta, reliable/realtime, and 1100-byte realtime datagram semantics remain unchanged.

## Facing representation

Internal authoritative state remains a `u16` quantized angle. Encoding `2` maps that value to the nearest of 256 evenly spaced wire values and expands it back to `u16` on decode.

- wire size: 1 byte instead of 2 when the facing field is present;
- maximum `u16` quantization error: 128 units;
- maximum angular error: about 0.71 degrees;
- endpoints remain exact: `0 -> 0`, `65535 -> 255 -> 65535`.

## Compatibility and safety

Rust, generic browser decode, and the allocation-minimized in-place browser decoder accept encodings `0`, `1`, and `2`, and reject unknown encodings.

The M4 legacy fixture remains byte-for-byte unchanged. The M19 compact-ID fixture remains decodable, and the JavaScript encoder can still emit encoding `1` explicitly for compatibility evidence.

M20 changes only snapshot transport precision. Server-authoritative movement, aim, block/parry checks, attacks, damage, and simulation continue using authoritative server state rather than the compact snapshot angle.

## Acceptance evidence

M20 must preserve every inherited gate and additionally prove:

- one shared Rust/browser encoding-2 fixture;
- exact current-encoding byte accounting;
- M19 encoding-1 compatibility;
- compact-facing round trips stay within the 128-unit half-step bound;
- browser hot-path decoding expands encoding-2 facing correctly;
- 512-player combat/near freshness deadline misses remain zero;
- records per realtime snapshot improve and omission falls versus M19;
- replication-batch p95 remains below the 50 ms 20 Hz budget;
- Chrome/Firefox 512-occupant and reliable-delta flights remain green.

## Work-unit contract

- Risk: MODERATE — explicit snapshot encoding extension with bounded lossy presentation-state compression.
- Base: exact-green M19 head `dac8f1003310c7ebdccb85d12aae7a3012725a97`.
- Validation: focused codec/accounting checks first, then FULL CI on the final head.
- Rollback: close/discard M20; M19 remains unchanged.
- Merge, deployment, public bind, and production runtime activation are not part of this work unit.

## Flight-harness adjustment

M20 can keep synthetic 256-player background pressure within the realtime freshness deadline even when some due records are still omitted by the 1100-byte datagram budget. For loopback flight runs only, the existing non-zero synthetic reliable-write delay therefore also permits an omitted record to trigger the reliable catch-up path. Non-loopback runtime cannot enable that delay, so production scheduling continues to require an actual background freshness deadline miss.
