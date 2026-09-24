import { NETWORK, PACKET_TYPE, SNAPSHOT_FLAG } from "./constants.mjs";

const HEADER_BYTES = 14;
const ENCODING_LEGACY_U32_IDS = 0;
const ENCODING_VARINT_IDS = 1;
const ENCODING_VARINT_IDS_U8_FACING = 2;
const ENCODING_VARINT_IDS_U8_FACING_U12_POSITION = 3;
const ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION = 4;
const ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION = 5;
const ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS = 6;
const CURRENT_ENCODING = ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS;
const FIELD_POSITION = 1 << 0;
const FIELD_FACING = 1 << 1;
const FIELD_VITALS = 1 << 2;
const FIELD_ACTION = 1 << 3;
const FIELD_WIDE_POSITION = 1 << 4;
const FIELD_REMOVED = 1 << 7;
const FULL_FIELDS = FIELD_POSITION | FIELD_FACING | FIELD_VITALS | FIELD_ACTION;
const PACKED_RECORD_NET_ID_BITS = 10;
const PACKED_RECORD_NET_ID_MASK = (1 << PACKED_RECORD_NET_ID_BITS) - 1;
const PACKED_RECORD_NET_ID_ESCAPE = PACKED_RECORD_NET_ID_MASK;
const PACKED_MASK_LOCAL_POSITION_FLAG = 1 << 5;
const COMPACT_ACTION_ESCAPE = 0xff;
const POSITION_ENCODING_NONE = 0;
const POSITION_ENCODING_EXACT = 1;
const POSITION_ENCODING_COMPACT = 2;
const POSITION_ENCODING_LOCAL = 3;

const ACTION_TO_CODE = new Map([
  ["idle", 0],
  ["attack_windup", 1],
  ["attack_active", 2],
  ["attack_recovery", 3],
  ["dodge", 4],
  ["dodge_recovery", 5],
  ["block", 6],
  ["stunned", 7],
  ["dead", 8],
]);
const CODE_TO_ACTION = [...ACTION_TO_CODE.entries()].reduce((result, [name, code]) => {
  result[code] = name;
  return result;
}, []);

export function quantizeEntity(entity) {
  assertNetId(entity.netId);
  return Object.freeze({
    netId: entity.netId >>> 0,
    x: quantizePosition(entity.x),
    y: quantizePosition(entity.y),
    facing: quantizeAngle(entity.facing ?? 0),
    hp: quantizeUnit(entity.hp ?? 100),
    guard: quantizeUnit(entity.guard ?? 100),
    action: encodeAction(entity.action ?? "idle"),
    flags: entity.flags ? entity.flags & 0xff : 0,
  });
}

export function buildWireStateMap(entities) {
  if (!Array.isArray(entities)) throw new TypeError("entities must be an array");
  const map = new Map();
  for (const entity of entities) {
    const state = typeof entity.action === "number" ? entity : quantizeEntity(entity);
    if (map.has(state.netId)) throw new Error(`duplicate netId ${state.netId}`);
    map.set(state.netId, state);
  }
  return map;
}

export function buildEntityDelta(state, before = null) {
  if (!before) return { ...state, mask: FULL_FIELDS };
  let mask = 0;
  if (state.x !== before.x || state.y !== before.y) mask |= FIELD_POSITION;
  if (state.facing !== before.facing) mask |= FIELD_FACING;
  if (state.hp !== before.hp || state.guard !== before.guard) mask |= FIELD_VITALS;
  if (state.action !== before.action || state.flags !== before.flags) mask |= FIELD_ACTION;
  return mask ? { ...state, mask } : null;
}

export function buildSnapshotDelta(currentEntities, baselineEntities = []) {
  const baseline = toStateMap(baselineEntities);
  const current = toStateMap(currentEntities);
  const records = [];

  for (const [netId, state] of current) {
    const record = buildEntityDelta(state, baseline.get(netId));
    if (record) records.push(record);
  }

  for (const netId of baseline.keys()) {
    if (!current.has(netId)) records.push({ netId, mask: FIELD_REMOVED });
  }
  return records;
}

export function encodeSnapshot({
  sequence,
  baselineSequence = 0xffff,
  serverTick,
  records,
  full = false,
  maxBytes = NETWORK.conservativeDatagramBytes,
  encoding = CURRENT_ENCODING,
}) {
  assertUint16(sequence, "sequence");
  assertUint16(baselineSequence, "baselineSequence");
  assertUint32(serverTick, "serverTick");
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  if (records.length > 0xffff) throw new RangeError("too many snapshot records");
  assertSnapshotEncoding(encoding);

  const totalBytes = HEADER_BYTES + snapshotRecordsBytes(records, encoding);
  if (maxBytes !== null && totalBytes > maxBytes) {
    throw new RangeError(`snapshot ${totalBytes} bytes exceeds datagram budget ${maxBytes}`);
  }

  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, PACKET_TYPE.SNAPSHOT);
  view.setUint8(2, full ? SNAPSHOT_FLAG.FULL : 0);
  view.setUint8(3, encoding);
  view.setUint16(4, sequence, true);
  view.setUint16(6, baselineSequence, true);
  view.setUint32(8, serverTick, true);
  view.setUint16(12, records.length, true);

  let offset = HEADER_BYTES;
  let previousPosition = null;
  for (const record of records) {
    assertNetId(record.netId);
    const mask = snapshotWireMask(record, encoding);
    const positionEncoding = positionWireEncoding(record, mask, encoding, previousPosition);
    if (usesPackedRecordHeader(encoding)) {
      offset = writePackedRecordHeader(
        view,
        offset,
        record.netId >>> 0,
        packedWireMaskCode(mask, encoding, positionEncoding),
      );
    } else {
      if (encoding === ENCODING_LEGACY_U32_IDS) {
        view.setUint32(offset, record.netId >>> 0, true);
        offset += 4;
      } else {
        offset = writeUint32Varint(view, offset, record.netId >>> 0);
      }
      view.setUint8(offset, mask);
      offset += 1;
    }
    if (mask & FIELD_REMOVED) continue;
    if (mask & FIELD_POSITION) {
      if (positionEncoding === POSITION_ENCODING_LOCAL) {
        offset = writeLocalCellPosition(view, offset, record.x, record.y, previousPosition);
      } else if (positionEncoding === POSITION_ENCODING_COMPACT) {
        offset = writeCompactPosition(view, offset, record.x, record.y);
      } else {
        view.setUint16(offset, record.x, true);
        view.setUint16(offset + 2, record.y, true);
        offset += 4;
      }
      previousPosition = decodedPositionForRecord(record, positionEncoding);
    }
    if (mask & FIELD_FACING) {
      if (usesCompactFacing(encoding)) {
        view.setUint8(offset, compactFacingU8(record.facing));
        offset += 1;
      } else {
        view.setUint16(offset, record.facing, true);
        offset += 2;
      }
    }
    if (mask & FIELD_VITALS) {
      view.setUint8(offset, record.hp);
      view.setUint8(offset + 1, record.guard);
      offset += 2;
    }
    if (mask & FIELD_ACTION) {
      if (usesCompactActionFlags(encoding)) {
        offset = writeCompactActionFlags(view, offset, record.action, record.flags ?? 0);
      } else {
        view.setUint8(offset, record.action);
        view.setUint8(offset + 1, record.flags ?? 0);
        offset += 2;
      }
    }
  }
  if (offset !== totalBytes) throw new Error("snapshot byte accounting mismatch");
  return buffer;
}

export function decodeSnapshot(buffer) {
  const view = asDataView(buffer);
  if (view.byteLength < HEADER_BYTES) throw new RangeError("snapshot packet is truncated");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== PACKET_TYPE.SNAPSHOT) throw new Error("not a snapshot packet");
  const encoding = view.getUint8(3);
  assertSnapshotEncoding(encoding);
  const count = view.getUint16(12, true);
  const records = [];
  let offset = HEADER_BYTES;
  let previousPosition = null;

  for (let index = 0; index < count; index += 1) {
    let netId;
    let mask;
    let localPosition = false;
    if (usesPackedRecordHeader(encoding)) {
      const decoded = readPackedRecordHeader(view, offset);
      netId = decoded.netId;
      offset = decoded.offset;
      const expanded = expandPackedWireMask(decoded.compactMask, encoding);
      mask = expanded.mask;
      localPosition = expanded.localPosition;
    } else {
      if (encoding === ENCODING_LEGACY_U32_IDS) {
        requireBytes(view, offset, 4);
        netId = view.getUint32(offset, true);
        offset += 4;
      } else {
        const decoded = readUint32Varint(view, offset);
        netId = decoded.value;
        offset = decoded.offset;
      }
      requireBytes(view, offset, 1);
      mask = view.getUint8(offset);
      offset += 1;
    }

    const record = { netId, mask };
    const widePosition = Boolean(mask & FIELD_WIDE_POSITION);
    if (widePosition && (!usesCompactPosition(encoding) || !(mask & FIELD_POSITION))) {
      throw new RangeError("invalid compact-position marker");
    }
    if (localPosition && (
      encoding !== ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
      || !(mask & FIELD_POSITION)
      || widePosition
      || (mask & FIELD_REMOVED)
    )) {
      throw new RangeError("invalid local-position marker");
    }

    if (!(mask & FIELD_REMOVED)) {
      if (mask & FIELD_POSITION) {
        if (localPosition) {
          if (!previousPosition) throw new RangeError("local snapshot position has no previous position");
          requireBytes(view, offset, 2);
          [record.x, record.y] = decodeLocalCellPosition(
            previousPosition,
            view.getUint8(offset),
            view.getUint8(offset + 1),
          );
          offset += 2;
        } else if (usesCompactPosition(encoding) && !widePosition) {
          requireBytes(view, offset, 3);
          const packed = view.getUint8(offset)
            | (view.getUint8(offset + 1) << 8)
            | (view.getUint8(offset + 2) << 16);
          record.x = (packed & 0x0fff) << 3;
          record.y = ((packed >>> 12) & 0x0fff) << 3;
          offset += 3;
        } else {
          requireBytes(view, offset, 4);
          record.x = view.getUint16(offset, true);
          record.y = view.getUint16(offset + 2, true);
          offset += 4;
        }
        previousPosition = [record.x, record.y];
      }
      if (mask & FIELD_FACING) {
        if (usesCompactFacing(encoding)) {
          requireBytes(view, offset, 1);
          record.facing = expandFacingU8(view.getUint8(offset));
          offset += 1;
        } else {
          requireBytes(view, offset, 2);
          record.facing = view.getUint16(offset, true);
          offset += 2;
        }
      }
      if (mask & FIELD_VITALS) {
        requireBytes(view, offset, 2);
        record.hp = view.getUint8(offset);
        record.guard = view.getUint8(offset + 1);
        offset += 2;
      }
      if (mask & FIELD_ACTION) {
        if (usesCompactActionFlags(encoding)) {
          const decoded = readCompactActionFlags(view, offset);
          record.action = decoded.action;
          record.flags = decoded.flags;
          offset = decoded.offset;
        } else {
          requireBytes(view, offset, 2);
          record.action = view.getUint8(offset);
          record.flags = view.getUint8(offset + 1);
          offset += 2;
        }
      }
    }
    records.push(record);
  }
  if (offset !== view.byteLength) throw new RangeError("snapshot packet contains trailing bytes");
  return {
    encoding,
    sequence: view.getUint16(4, true),
    baselineSequence: view.getUint16(6, true),
    serverTick: view.getUint32(8, true),
    full: Boolean(view.getUint8(2) & SNAPSHOT_FLAG.FULL),
    records,
  };
}

export function applySnapshotRecords(stateMap, records) {
  const next = new Map(stateMap);
  for (const record of records) {
    if (record.mask & FIELD_REMOVED) {
      next.delete(record.netId);
      continue;
    }
    const before = next.get(record.netId) ?? { netId: record.netId, x: 0, y: 0, facing: 0, hp: 100, guard: 100, action: 0, flags: 0 };
    next.set(record.netId, {
      ...before,
      ...(record.mask & FIELD_POSITION ? { x: record.x, y: record.y } : null),
      ...(record.mask & FIELD_FACING ? { facing: record.facing } : null),
      ...(record.mask & FIELD_VITALS ? { hp: record.hp, guard: record.guard } : null),
      ...(record.mask & FIELD_ACTION ? { action: record.action, flags: record.flags } : null),
    });
  }
  return next;
}

export function dequantizeEntity(state) {
  return {
    netId: state.netId,
    x: state.x / NETWORK.worldCoordinateScale,
    y: state.y / NETWORK.worldCoordinateScale,
    facing: (state.facing / 0xffff) * Math.PI * 2,
    hp: state.hp,
    guard: state.guard,
    action: CODE_TO_ACTION[state.action] ?? "unknown",
    flags: state.flags,
  };
}

export function snapshotRecordBytes(record, encoding = CURRENT_ENCODING) {
  assertSnapshotEncoding(encoding);
  return snapshotRecordBytesWithContext(record, encoding, null).bytes;
}

export const SNAPSHOT_ENCODINGS = Object.freeze({
  LEGACY_U32_IDS: ENCODING_LEGACY_U32_IDS,
  VARINT_IDS: ENCODING_VARINT_IDS,
  VARINT_IDS_U8_FACING: ENCODING_VARINT_IDS_U8_FACING,
  VARINT_IDS_U8_FACING_U12_POSITION: ENCODING_VARINT_IDS_U8_FACING_U12_POSITION,
  PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION: ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION,
  PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION: ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION,
  PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS: ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS,
  CURRENT: CURRENT_ENCODING,
});

export const SNAPSHOT_FIELDS = Object.freeze({
  POSITION: FIELD_POSITION,
  FACING: FIELD_FACING,
  VITALS: FIELD_VITALS,
  ACTION: FIELD_ACTION,
  WIDE_POSITION: FIELD_WIDE_POSITION,
  REMOVED: FIELD_REMOVED,
  FULL: FULL_FIELDS,
  HEADER_BYTES,
});

function toStateMap(entities) {
  const map = new Map();
  for (const entity of entities) {
    const state = isQuantized(entity) ? entity : quantizeEntity(entity);
    if (map.has(state.netId)) throw new Error(`duplicate netId ${state.netId}`);
    map.set(state.netId, state);
  }
  return map;
}

function isQuantized(entity) {
  return Number.isInteger(entity.x) && Number.isInteger(entity.y)
    && Number.isInteger(entity.facing) && Number.isInteger(entity.action);
}

function quantizePosition(value) {
  if (!Number.isFinite(value)) throw new TypeError("position must be finite");
  if (value < 0 || value > NETWORK.maxWorldCoordinate) {
    throw new RangeError(`position must be in [0, ${NETWORK.maxWorldCoordinate}]`);
  }
  return Math.round(value * NETWORK.worldCoordinateScale);
}

function quantizeAngle(value) {
  if (!Number.isFinite(value)) throw new TypeError("facing must be finite");
  const tau = Math.PI * 2;
  const normalized = ((value % tau) + tau) % tau;
  return Math.round((normalized / tau) * 0xffff) & 0xffff;
}

function quantizeUnit(value) {
  if (!Number.isFinite(value)) throw new TypeError("vital must be finite");
  return Math.round(Math.max(0, Math.min(100, value)));
}

function encodeAction(action) {
  const code = ACTION_TO_CODE.get(action);
  if (code === undefined) throw new RangeError(`unsupported action ${action}`);
  return code;
}

function snapshotNetIdBytes(netId, encoding) {
  assertNetId(netId);
  if (encoding === ENCODING_LEGACY_U32_IDS) return 4;
  return uint32VarintBytes(netId);
}

function snapshotRecordsBytes(records, encoding) {
  let bytes = 0;
  let previousPosition = null;
  for (const record of records) {
    const measured = snapshotRecordBytesWithContext(record, encoding, previousPosition);
    bytes += measured.bytes;
    previousPosition = measured.nextPosition;
  }
  return bytes;
}

function snapshotRecordBytesWithContext(record, encoding, previousPosition) {
  const mask = record.mask ?? FULL_FIELDS;
  let bytes;
  if (usesPackedRecordHeader(encoding)) {
    bytes = 2 + (record.netId >= PACKED_RECORD_NET_ID_ESCAPE ? uint32VarintBytes(record.netId) : 0);
  } else {
    bytes = snapshotNetIdBytes(record.netId, encoding) + 1;
  }
  if (mask & FIELD_REMOVED) {
    return { bytes, nextPosition: previousPosition };
  }

  const wireMask = snapshotWireMask(record, encoding);
  const positionEncoding = positionWireEncoding(record, wireMask, encoding, previousPosition);
  let nextPosition = previousPosition;
  if (mask & FIELD_POSITION) {
    bytes += positionBytesForEncoding(positionEncoding);
    nextPosition = decodedPositionForRecord(record, positionEncoding);
  }
  if (mask & FIELD_FACING) bytes += facingBytesForEncoding(encoding);
  if (mask & FIELD_VITALS) bytes += 2;
  if (mask & FIELD_ACTION) bytes += actionBytesForRecord(record, encoding);
  return { bytes, nextPosition };
}

function uint32VarintBytes(netId) {
  let value = netId >>> 0;
  let bytes = 1;
  while (value >= 0x80) {
    value >>>= 7;
    bytes += 1;
  }
  return bytes;
}

function writeUint32Varint(view, offset, value) {
  let nextValue = value >>> 0;
  do {
    let byte = nextValue & 0x7f;
    nextValue >>>= 7;
    if (nextValue !== 0) byte |= 0x80;
    view.setUint8(offset, byte);
    offset += 1;
  } while (nextValue !== 0);
  return offset;
}

function compactWireMask(mask) {
  return (mask & 0x0f) | (mask & FIELD_WIDE_POSITION) | ((mask & FIELD_REMOVED) >>> 2);
}

function expandCompactWireMask(mask) {
  return (mask & 0x0f) | (mask & (1 << 4)) | ((mask & (1 << 5)) << 2);
}

function packedWireMaskCode(mask, encoding, positionEncoding) {
  if (
    (encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
      || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS)
    && positionEncoding === POSITION_ENCODING_LOCAL
  ) {
    if (!(mask & FIELD_POSITION) || (mask & FIELD_WIDE_POSITION) || (mask & FIELD_REMOVED)) {
      throw new RangeError("invalid local-position record mask");
    }
    return PACKED_MASK_LOCAL_POSITION_FLAG | (mask & 0x0f);
  }
  return compactWireMask(mask);
}

function expandPackedWireMask(compactMask, encoding) {
  if (
    (encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
      || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS)
    && (compactMask & PACKED_MASK_LOCAL_POSITION_FLAG)
    && compactMask !== PACKED_MASK_LOCAL_POSITION_FLAG
  ) {
    if (!(compactMask & FIELD_POSITION) || (compactMask & FIELD_WIDE_POSITION)) {
      throw new RangeError("invalid local-position marker");
    }
    return { mask: compactMask & 0x0f, localPosition: true };
  }
  return { mask: expandCompactWireMask(compactMask), localPosition: false };
}

function writePackedRecordHeader(view, offset, netId, compactMask) {
  const inlineNetId = netId < PACKED_RECORD_NET_ID_ESCAPE ? netId : PACKED_RECORD_NET_ID_ESCAPE;
  const packed = inlineNetId | (compactMask << PACKED_RECORD_NET_ID_BITS);
  view.setUint16(offset, packed, true);
  offset += 2;
  if (inlineNetId === PACKED_RECORD_NET_ID_ESCAPE) {
    offset = writeUint32Varint(view, offset, netId);
  }
  return offset;
}

function readPackedRecordHeader(view, offset) {
  requireBytes(view, offset, 2);
  const packed = view.getUint16(offset, true);
  offset += 2;
  const inlineNetId = packed & PACKED_RECORD_NET_ID_MASK;
  const compactMask = packed >>> PACKED_RECORD_NET_ID_BITS;
  if (inlineNetId !== PACKED_RECORD_NET_ID_ESCAPE) {
    return { netId: inlineNetId, compactMask, offset };
  }
  const decoded = readUint32Varint(view, offset);
  if (decoded.value < PACKED_RECORD_NET_ID_ESCAPE) throw new RangeError("non-canonical packed snapshot netId");
  return { netId: decoded.value, compactMask, offset: decoded.offset };
}

function readUint32Varint(view, offset) {
  const start = offset;
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    requireBytes(view, offset, 1);
    const byte = view.getUint8(offset);
    offset += 1;
    if (index === 4 && (byte & 0xf0) !== 0) throw new RangeError("invalid snapshot varint");
    value = (value + ((byte & 0x7f) * (2 ** (index * 7)))) >>> 0;
    if ((byte & 0x80) === 0) {
      if (offset - start !== snapshotNetIdBytes(value, ENCODING_VARINT_IDS)) {
        throw new RangeError("non-canonical snapshot varint");
      }
      return { value, offset };
    }
  }
  throw new RangeError("invalid snapshot varint");
}

function assertSnapshotEncoding(encoding) {
  if (encoding !== ENCODING_LEGACY_U32_IDS
    && encoding !== ENCODING_VARINT_IDS
    && encoding !== ENCODING_VARINT_IDS_U8_FACING
    && encoding !== ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    && encoding !== ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION
    && encoding !== ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
    && encoding !== ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS) {
    throw new RangeError(`unsupported snapshot encoding ${encoding}`);
  }
}

function snapshotWireMask(record, encoding) {
  let mask = (record.mask ?? FULL_FIELDS) & ~FIELD_WIDE_POSITION;
  if (usesCompactPosition(encoding) && (mask & FIELD_POSITION) && !positionIsCompact(record.x, record.y)) {
    mask |= FIELD_WIDE_POSITION;
  }
  return mask;
}

function positionWireEncoding(record, mask, encoding, previousPosition) {
  if (!(mask & FIELD_POSITION)) return POSITION_ENCODING_NONE;
  if (!usesCompactPosition(encoding) || (mask & FIELD_WIDE_POSITION)) return POSITION_ENCODING_EXACT;
  if ((encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
      || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS)
    && previousPosition) {
    const current = compactPositionPair(record.x, record.y);
    if (samePositionCell(previousPosition, current)) return POSITION_ENCODING_LOCAL;
  }
  return POSITION_ENCODING_COMPACT;
}

function positionBytesForEncoding(positionEncoding) {
  if (positionEncoding === POSITION_ENCODING_NONE) return 0;
  if (positionEncoding === POSITION_ENCODING_LOCAL) return 2;
  if (positionEncoding === POSITION_ENCODING_COMPACT) return 3;
  return 4;
}

function positionBytesForRecord(record, encoding) {
  const mask = snapshotWireMask(record, encoding);
  return positionBytesForEncoding(positionWireEncoding(record, mask, encoding, null));
}

function positionIsCompact(x, y) {
  return x <= 0x7ffb && y <= 0x7ffb;
}

function compactPositionValue(value) {
  return (Math.floor((value + 4) / 8) & 0x0fff) << 3;
}

function compactPositionPair(x, y) {
  return [compactPositionValue(x), compactPositionValue(y)];
}

function decodedPositionForRecord(record, positionEncoding) {
  if (positionEncoding === POSITION_ENCODING_COMPACT || positionEncoding === POSITION_ENCODING_LOCAL) {
    return compactPositionPair(record.x, record.y);
  }
  if (positionEncoding === POSITION_ENCODING_EXACT) return [record.x, record.y];
  throw new RangeError("position record has no wire encoding");
}

function replicationCellWire() {
  return NETWORK.snapshotPositionCellSize * NETWORK.worldCoordinateScale;
}

function positionCell(position) {
  const cellWire = replicationCellWire();
  return [Math.floor(position[0] / cellWire), Math.floor(position[1] / cellWire)];
}

function samePositionCell(left, right) {
  const a = positionCell(left);
  const b = positionCell(right);
  return a[0] === b[0] && a[1] === b[1];
}

function writeCompactPosition(view, offset, x, y) {
  const packedX = Math.floor((x + 4) / 8);
  const packedY = Math.floor((y + 4) / 8);
  const packed = packedX | (packedY << 12);
  view.setUint8(offset, packed & 0xff);
  view.setUint8(offset + 1, (packed >>> 8) & 0xff);
  view.setUint8(offset + 2, (packed >>> 16) & 0xff);
  return offset + 3;
}

function writeLocalCellPosition(view, offset, x, y, previousPosition) {
  const current = compactPositionPair(x, y);
  if (!samePositionCell(previousPosition, current)) throw new RangeError("local snapshot position crossed cell");
  const cellWire = replicationCellWire();
  const [cellX, cellY] = positionCell(previousPosition);
  view.setUint8(offset, (current[0] - cellX * cellWire) / 8);
  view.setUint8(offset + 1, (current[1] - cellY * cellWire) / 8);
  return offset + 2;
}

function decodeLocalCellPosition(previousPosition, localX, localY) {
  const cellWire = replicationCellWire();
  const [cellX, cellY] = positionCell(previousPosition);
  return [
    cellX * cellWire + localX * 8,
    cellY * cellWire + localY * 8,
  ];
}

function usesCompactPosition(encoding) {
  return encoding === ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS;
}

function usesCompactFacing(encoding) {
  return encoding === ENCODING_VARINT_IDS_U8_FACING
    || encoding === ENCODING_VARINT_IDS_U8_FACING_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS;
}

function usesPackedRecordHeader(encoding) {
  return encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION
    || encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS;
}

function facingBytesForEncoding(encoding) {
  return usesCompactFacing(encoding) ? 1 : 2;
}

function usesCompactActionFlags(encoding) {
  return encoding === ENCODING_PACKED_U10_IDS_U6_MASK_U8_FACING_LOCAL_U12_POSITION_U4_ACTION_FLAGS;
}

function actionFlagsAreCompact(action, flags) {
  return action >= 0 && action <= 0x0f
    && flags >= 0 && flags <= 0x0f
    && (action !== 0x0f || flags !== 0x0f);
}

function actionBytesForRecord(record, encoding) {
  if (!usesCompactActionFlags(encoding)) return 2;
  const action = record.action ?? 0;
  const flags = record.flags ?? 0;
  return actionFlagsAreCompact(action, flags) ? 1 : 3;
}

function writeCompactActionFlags(view, offset, action, flags) {
  if (actionFlagsAreCompact(action, flags)) {
    view.setUint8(offset, action | (flags << 4));
    return offset + 1;
  }
  view.setUint8(offset, COMPACT_ACTION_ESCAPE);
  view.setUint8(offset + 1, action);
  view.setUint8(offset + 2, flags);
  return offset + 3;
}

function readCompactActionFlags(view, offset) {
  requireBytes(view, offset, 1);
  const packed = view.getUint8(offset);
  offset += 1;
  if (packed !== COMPACT_ACTION_ESCAPE) {
    return { action: packed & 0x0f, flags: packed >>> 4, offset };
  }
  requireBytes(view, offset, 2);
  const action = view.getUint8(offset);
  const flags = view.getUint8(offset + 1);
  offset += 2;
  if (actionFlagsAreCompact(action, flags)) {
    throw new RangeError("non-canonical compact snapshot action flags");
  }
  return { action, flags, offset };
}

function compactFacingU8(facing) {
  assertUint16(facing, "facing");
  return Math.min(0xff, Math.floor((facing + 128) / 257));
}

function expandFacingU8(facing) {
  return facing * 257;
}

function requireBytes(view, offset, count) {
  if (offset + count > view.byteLength) throw new RangeError("snapshot record is truncated");
}

function asDataView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (buffer instanceof ArrayBuffer) return new DataView(buffer);
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed array");
}

function assertNetId(value) {
  assertUint32(value, "netId");
}

function assertUint16(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new RangeError(`${name} must be a uint16`);
}

function assertUint32(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError(`${name} must be a uint32`);
}
