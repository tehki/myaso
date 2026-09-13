import { NETWORK, PACKET_TYPE, SNAPSHOT_FLAG } from "../network/constants.mjs";

const HEADER_BYTES = 14;
const RECORD_BASE_BYTES = 5;
const FIELD_POSITION = 1 << 0;
const FIELD_FACING = 1 << 1;
const FIELD_VITALS = 1 << 2;
const FIELD_ACTION = 1 << 3;
const FIELD_REMOVED = 1 << 7;
const TAU = Math.PI * 2;

export function createSnapshotApplyResult() {
  return {
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
    requireBytes(view, offset, RECORD_BASE_BYTES);
    const netId = view.getUint32(offset, true);
    const mask = view.getUint8(offset + 4);
    offset += RECORD_BASE_BYTES;
    staleIds?.delete(netId);

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
      requireBytes(view, offset, 4);
      entity.x = view.getUint16(offset, true) / NETWORK.worldCoordinateScale;
      entity.y = view.getUint16(offset + 2, true) / NETWORK.worldCoordinateScale;
      offset += 4;
    }
    if (mask & FIELD_FACING) {
      requireBytes(view, offset, 2);
      entity.facing = (view.getUint16(offset, true) / 0xffff) * TAU;
      offset += 2;
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

function requireBytes(view, offset, count) {
  if (offset + count > view.byteLength) throw new RangeError("snapshot record is truncated");
}

function asDataView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (buffer instanceof ArrayBuffer) return new DataView(buffer);
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed array");
}
