# M102 — Local-Cell Snapshot Positions

## Objective

Reduce the dominant position-byte cost in dense snapshots while preserving the exact compact-position precision established by M21 and the exact 1100-byte planner budget.

## Base

M101 exact green head `f10e101555f1e5367b1b9636f5c8d40474cdb0cc`, quality run `36044841907` PASS.

At 512 players M101 measured:

- average snapshot bytes: `466.0`;
- average records per snapshot: `68.38`;
- omission ratio: `0.265398`;
- position bytes: `197.451` per average snapshot, `42.4%` of payload;
- mid freshness deadline misses: `1902`.

M101 made record identity compact enough that position became the clear next payload bottleneck.

## Encoding v5

M102 adds:

`SNAPSHOT_ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION = 5`

The existing packet encoding byte selects v5. Encodings v0-v4 remain independently decodable.

V5 keeps the M101 10-bit net-ID / 6-bit packed-header layout.

### Local-position marker

M101 uses packed mask code `0b100000` for a removal. Packed codes with that high bit plus normal field bits were previously never emitted.

M102 reuses those previously-invalid codes in v5 to signal:

> this record has a compact position encoded relative to the replication cell of the previous decoded position record.

The semantic record mask exposed by decoders remains unchanged.

## Position modes

A position record uses one of three existing/new modes:

1. exact u16 pair — 4 bytes, for wide positions;
2. compact absolute u12 pair — 3 bytes, unchanged from M21;
3. same-cell local position — 2 bytes, new in M102.

For local encoding:

- the current position is first quantized to the exact same M21 compact grid;
- the previous decoded position determines the 512-unit replication cell;
- the current compact x/y offsets inside that cell are each exactly 8 bits;
- one byte stores local x and one byte stores local y.

The 512-unit cell contains exactly 256 M21 compact steps per axis because:

- world coordinate scale = 4 wire units/world unit;
- cell size = 512 world units = 2048 wire units;
- M21 compact step = 8 wire units;
- 2048 / 8 = 256.

Therefore the local form preserves the same decoded coordinates as the existing 3-byte compact absolute form.

## Stateful context

The previous-position context advances only when a position-bearing record is actually encoded/admitted.

Records without positions do not reset it.

Removed records do not advance it.

A same-cell local record is used only when the current compact decoded position is in the same cell as the previous decoded position. Cross-cell records automatically fall back to 3-byte compact absolute encoding.

## Exact planner budgeting

M102 makes byte composition stateful as well.

For every candidate record, the planner computes size using the same previous-position context as the serializer.

If a candidate does not fit the datagram budget, its prospective position context is discarded.

If it is admitted, the context advances.

This preserves the M84 exact planned-byte-composition contract and prevents an omitted record from influencing later local-position sizing.

## Browser compatibility

Both browser decode paths support v5:

- `src/network/snapshot-codec.mjs` public codec;
- `src/browser/snapshot-store.mjs` in-place hot path.

The in-place hot path keeps only two previous wire-coordinate integers and reconstructs local positions directly into existing entity objects.

## Focused validation

Rust:

`local_cell_positions_preserve_compact_coordinates_and_exact_budgeting`

verifies:

- two compact positions in one cell use one fewer byte than v4;
- a non-position record does not break the context;
- a later cross-cell position falls back safely;
- decoded records are identical;
- planned composition total exactly equals actual wire length.

JavaScript:

`local-cell snapshot positions save a byte without changing compact coordinates`

verifies:

- v5 is one byte smaller than v4 for the same representative sequence;
- public decode returns identical records;
- the in-place browser hot path reconstructs exact expected world positions.

All inherited JavaScript, Rust, browser, FFA, reliable-delta, 512-player and capacity gates remain required.

## Unchanged

No global protocol version, packet header layout, M21 compact coordinate precision, world coordinate scale, replication cell size, planner priority/order, freshness thresholds, ACK/baseline/history semantics, combat, movement, input, persistence, deployment, or runtime activation changes.

## Rollback

Close/discard M102; M101 remains the exact green base.
