# M21 — Compact Snapshot Position

## Objective

Reduce the largest remaining realtime snapshot byte class without shrinking the game world or changing authoritative movement/combat semantics.

M20 measured position at 45.37% of 512-player realtime snapshot bytes. M21 therefore targets position before any further transport-side optimization.

## Wire encoding

Snapshot header encoding byte now supports:

- `0`: legacy fixed-width `u32` IDs + `u16` facing + `u16/u16` position.
- `1`: canonical varint IDs + `u16` facing + `u16/u16` position.
- `2`: canonical varint IDs + compact `u8` facing + `u16/u16` position.
- `3`: canonical varint IDs + compact `u8` facing + packed `u12/u12` position.

Encoding `3` is current. X and Y are packed into three bytes when both coordinates fit the compact envelope.
## Precision and fallback

Authoritative/server state remains unchanged. The existing wire quantization is quarter-world-unit `u16`; M21 rounds compact positions to the nearest 8 wire units, equivalent to 2 world units per compact step and at most 1 world unit of additional presentation error.

The default 8192×8192 arena remains inside the compact envelope for valid fighter centers.

For coordinates outside that envelope, the encoder sets `SNAPSHOT_FIELD_WIDE_POSITION` and transmits the original `u16/u16` position exactly. This preserves support for larger/custom worlds rather than clipping or reducing playable space.

Malformed wide-position markers fail closed. Historical encodings 0–2 remain decodable.

## Scope boundaries

M21 does not change authoritative movement, collision, combat, aim, block/parry, damage, respawn, interest selection, freshness policy, datagram budget, reliable catch-up policy, world dimensions, or production/runtime activation.

## Work-unit contract

- Risk: MODERATE.
- Base: exact-green M20 `d0c6a4f2c7046109931cd64d7b1d329586118300`.
- Validation: cross-language fixture, compact error bounds, wide fallback, malformed-marker rejection, focused JS/browser suites, then FULL CI.
- Rollback: discard/close M21; M20 remains unchanged.
- No merge, deployment, public bind, or production activation is part of this work unit.
