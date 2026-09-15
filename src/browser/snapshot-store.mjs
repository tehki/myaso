import { NETWORK, PACKET_TYPE, SNAPSHOT_FLAG } from "../network/constants.mjs";

const HEADER_BYTES = 14;
const ENCODING_LEGACY_U32_IDS = 0;
const ENCODING_VARINT_IDS = 1;
const ENCODING_VARINT_IDS_U8_FACING = 2;
const ENCODING_VARINT_IDS_U8_FACING_U12_POSITION = 3;
const FIELD_POSITION = 1 << 0;
const FIELD_FACING = 1 << 1;
const FIELD_VITALS = 1 << 2;
const FIELD_ACTION = 1 << 3;
const FIELD_WIDE_POSITION = 1 << 4;
const FIELD_REMOVED = 1 << 7;
const TAU = Math.PI * 2;

export function createSnapshotApplyResult() {
  return {
    encoding: ENCODING_LEGACY_U32_IDS,
    sequence: 0,
    baselineSequence: 0xffff,
    serverTick: 0,
    full: false,
    records: 0,
    created: 0,
    updated: 0,
    removed: 0,
  };
}

export function applySnapshotPacketInPlace(stateMap, packet, result = createSnapshotApplyResult()) {
  if (!(stateMap instanceof Map)) throw new TypeError("stateMap must be a Map");
  const view = asDataView(packet);
  if (view.byteLength < HEADER_BYTES) throw new RangeError("snapshot packet is truncated");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== PACKET_TYPE.SNAPSHOT) throw new Error("not a snapshot packet");

  result.encoding = view.getUint8(3);
  assertSnapshotEncoding(result.encoding);
  result.sequence = view.getUint16(4, true);
  result.baselineSequence = view.getUint16(6, true);
  result.serverTick = view.getUint32(8, true);
  result.full = Boolean(view.getUint8(2) & SNAPSHOT_FLAG.FULL);
  result.records = view.getUint16(12, true);
  result.created = 0;
  result.updated = 0;
  result.removed = 0;

  const staleIds = result.full ? new Set(stateMap.keys()) : null;
  let offset = HEADER_BYTES;

  for (let index = 0; index < result.records; index += 1) {
    let netId;
    if (result.encoding === ENCODING_LEGACY_U32_IDS) {
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
    staleIds?.delete(netId);
    const widePosition = Boolean(mask & FIELD_WIDE_POSITION);
    if (widePosition && (result.encoding !== ENCODING_VARINT_IDS_U8_FACING_U12_POSITION || !(mask & FIELD_POSITION))) throw new RangeError("invalid compact-position marker");

    if (mask & FIELD_REMOVED) {
      if (stateMap.delete(netId)) result.removed += 1;
      continue;
    }

    let entity = stateMap.get(netId);
    if (!entity) {
      entity = {
        netId,
        x: 0,
        y: 0,
        facing: 0,
        hp: 100,
        guard: 100,
        action: 0,
        flags: 0,
        serverTick: result.serverTick,
      };
      stateMap.set(netId, entity);
      result.created += 1;
    } else {
      result.updated += 1;
    }

    if (mask & FIELD_POSITION) {
      if (result.encoding === ENCODING_VARINT_IDS_U8_FACING_U12_POSITION && !widePosition) {
        requireBytes(view, offset, 3);
        const packed = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
        entity.x = ((packed & 0x0fff) << 3) / NETWORK.worldCoordinateScale;
        entity.y = (((packed >>> 12) & 0x0fff) << 3) / NETWORK.worldCoordinateScale;
        offset += 3;
      } else {
        requireBytes(view, offset, 4); entity.x = view.getUint16(offset, true) / NETWORK.worldCoordinateScale; entity.y = view.getUint16(offset + 2, true) / NETWORK.worldCoordinateScale; offset += 4;
      }
    }
    if (mask & FIELD_FACING) {
      if (result.encoding === ENCODING_VARINT_IDS_U8_FACING || result.encoding === ENCODING_VARINT_IDS_U8_FACING_U12_POSITION) {
        requireBytes(view, offset, 1);
        entity.facing = (view.getUint8(offset) / 0xff) * TAU;
        offset += 1;
      } else {
        requireBytes(view, offset, 2);
        entity.facing = (view.getUint16(offset, true) / 0xffff) * TAU;
        offset += 2;
      }
    }
    if (mask & FIELD_VITALS) {
      requireBytes(view, offset, 2);
      entity.hp = view.getUint8(offset);
      entity.guard = view.getUint8(offset + 1);
      offset += 2;
    }
    if (mask & FIELD_ACTION) {
      requireBytes(view, offset, 2);
      entity.action = view.getUint8(offset);
      entity.flags = view.getUint8(offset + 1);
      offset += 2;
    }
    entity.serverTick = result.serverTick;
  }

  if (offset !== view.byteLength) throw new RangeError("snapshot packet contains trailing bytes");

  if (staleIds) {
    for (const netId of staleIds) {
      if (stateMap.delete(netId)) result.removed += 1;
    }
  }

  return result;
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
      if (offset - start !== uint32VarintBytes(value)) {
        throw new RangeError("non-canonical snapshot varint");
      }
      return { value, offset };
    }
  }
  throw new RangeError("invalid snapshot varint");
}

function uint32VarintBytes(value) {
  let nextValue = value >>> 0;
  let bytes = 1;
  while (nextValue >= 0x80) {
    nextValue >>>= 7;
    bytes += 1;
  }
  return bytes;
}

function assertSnapshotEncoding(encoding) {
  if (encoding !== ENCODING_LEGACY_U32_IDS
    && encoding !== ENCODING_VARINT_IDS
    && encoding !== ENCODING_VARINT_IDS_U8_FACING
    && encoding !== ENCODING_VARINT_IDS_U8_FACING_U12_POSITION) {
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
