import { NETWORK, PACKET_TYPE, SNAPSHOT_FLAG } from "./constants.mjs";

const HEADER_BYTES = 14;
const ENCODING_LEGACY_U32_IDS = 0;
const ENCODING_VARINT_IDS = 1;
const CURRENT_ENCODING = ENCODING_VARINT_IDS;
const FIELD_POSITION = 1 << 0;
const FIELD_FACING = 1 << 1;
const FIELD_VITALS = 1 << 2;
const FIELD_ACTION = 1 << 3;
const FIELD_REMOVED = 1 << 7;
const FULL_FIELDS = FIELD_POSITION | FIELD_FACING | FIELD_VITALS | FIELD_ACTION;

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

  const totalBytes = HEADER_BYTES + records.reduce((sum, record) => sum + snapshotRecordBytes(record, encoding), 0);
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
  for (const record of records) {
    assertNetId(record.netId);
    const mask = record.mask ?? FULL_FIELDS;
    if (encoding === ENCODING_LEGACY_U32_IDS) {
      view.setUint32(offset, record.netId >>> 0, true);
      offset += 4;
    } else {
      offset = writeUint32Varint(view, offset, record.netId >>> 0);
    }
    view.setUint8(offset, mask);
    offset += 1;
    if (mask & FIELD_REMOVED) continue;
    if (mask & FIELD_POSITION) {
      view.setUint16(offset, record.x, true);
      view.setUint16(offset + 2, record.y, true);
      offset += 4;
    }
    if (mask & FIELD_FACING) {
      view.setUint16(offset, record.facing, true);
      offset += 2;
    }
    if (mask & FIELD_VITALS) {
      view.setUint8(offset, record.hp);
      view.setUint8(offset + 1, record.guard);
      offset += 2;
    }
    if (mask & FIELD_ACTION) {
      view.setUint8(offset, record.action);
      view.setUint8(offset + 1, record.flags ?? 0);
      offset += 2;
    }
  }
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
  for (let index = 0; index < count; index += 1) {
    let netId;
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
    const mask = view.getUint8(offset);
    offset += 1;
    const record = { netId, mask };
    if (!(mask & FIELD_REMOVED)) {
      if (mask & FIELD_POSITION) {
        requireBytes(view, offset, 4);
        record.x = view.getUint16(offset, true);
        record.y = view.getUint16(offset + 2, true);
        offset += 4;
      }
      if (mask & FIELD_FACING) {
        requireBytes(view, offset, 2);
        record.facing = view.getUint16(offset, true);
        offset += 2;
      }
      if (mask & FIELD_VITALS) {
        requireBytes(view, offset, 2);
        record.hp = view.getUint8(offset);
        record.guard = view.getUint8(offset + 1);
        offset += 2;
      }
      if (mask & FIELD_ACTION) {
        requireBytes(view, offset, 2);
        record.action = view.getUint8(offset);
        record.flags = view.getUint8(offset + 1);
        offset += 2;
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
  const mask = record.mask ?? FULL_FIELDS;
  let bytes = snapshotNetIdBytes(record.netId, encoding) + 1;
  if (mask & FIELD_REMOVED) return bytes;
  if (mask & FIELD_POSITION) bytes += 4;
  if (mask & FIELD_FACING) bytes += 2;
  if (mask & FIELD_VITALS) bytes += 2;
  if (mask & FIELD_ACTION) bytes += 2;
  return bytes;
}

export const SNAPSHOT_ENCODINGS = Object.freeze({
  LEGACY_U32_IDS: ENCODING_LEGACY_U32_IDS,
  VARINT_IDS: ENCODING_VARINT_IDS,
  CURRENT: CURRENT_ENCODING,
});

export const SNAPSHOT_FIELDS = Object.freeze({
  POSITION: FIELD_POSITION,
  FACING: FIELD_FACING,
  VITALS: FIELD_VITALS,
  ACTION: FIELD_ACTION,
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
  if (encoding !== ENCODING_LEGACY_U32_IDS && encoding !== ENCODING_VARINT_IDS) {
    throw new RangeError(`unsupported snapshot encoding ${encoding}`);
  }
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
