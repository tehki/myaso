// Phase C1: wire contract only, NOT a live game transport or door activation.
// Client requests contain only a portal ID and anti-replay values. The server
// must derive authenticated fighter, source zone and safe destination itself.
import { NETWORK } from "./constants.mjs";

export const DOOR_WIRE = Object.freeze({
  manifestVersion: 1,
  requestType: 5,
  enteredType: 6,
  requestBytes: 12,
  enteredBytes: 24,
  coordinateScale: 4,
});

export const DOOR_PORTAL = Object.freeze({
  RED_LION_ENTER: 1,
  RED_LION_EXIT: 2,
});

export const DOOR_ZONE = Object.freeze({
  MOONVALE: 1,
  RED_LION_INN: 2,
});

function checkedU32(value, field, allowZero = true) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1) || value > 0xffffffff) {
    throw new RangeError(`${field} must be a uint32${allowZero ? "" : " > 0"}`);
  }
}
function checkedChoice(value, choices, field) {
  if (!Object.values(choices).includes(value)) throw new RangeError(`invalid ${field}`);
}
function asView(packet) {
  if (packet instanceof DataView) return packet;
  if (packet instanceof ArrayBuffer) return new DataView(packet);
  if (ArrayBuffer.isView(packet)) return new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  throw new TypeError("door packet must be a typed array or ArrayBuffer");
}
function validateHeader(view, type, byteCount) {
  if (view.byteLength !== byteCount) throw new RangeError("invalid door packet length");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("wrong door protocol version");
  if (view.getUint8(1) !== type) throw new Error("wrong door packet type");
  if (view.getUint8(2) !== DOOR_WIRE.manifestVersion) throw new Error("wrong map manifest version");
}

export function encodeDoorRequest({ portalId, requestNonce, expectedEpoch }) {
  checkedChoice(portalId, DOOR_PORTAL, "portal ID");
  checkedU32(requestNonce, "requestNonce");
  checkedU32(expectedEpoch, "expectedEpoch");
  const buffer = new ArrayBuffer(DOOR_WIRE.requestBytes);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, DOOR_WIRE.requestType);
  view.setUint8(2, DOOR_WIRE.manifestVersion);
  view.setUint8(3, portalId);
  view.setUint32(4, requestNonce, true);
  view.setUint32(8, expectedEpoch, true);
  return buffer;
}

export function decodeDoorRequest(packet) {
  const view = asView(packet);
  validateHeader(view, DOOR_WIRE.requestType, DOOR_WIRE.requestBytes);
  const portalId = view.getUint8(3);
  checkedChoice(portalId, DOOR_PORTAL, "portal ID");
  return {
    portalId,
    requestNonce: view.getUint32(4, true),
    expectedEpoch: view.getUint32(8, true),
  };
}

const bounds = Object.freeze({
  [DOOR_ZONE.MOONVALE]: Object.freeze({ width: 8192, height: 8192 }),
  [DOOR_ZONE.RED_LION_INN]: Object.freeze({ width: 780, height: 620 }),
});

function toCoordinate(value, limit, name) {
  if (!Number.isFinite(value) || value < 18 || value > limit - 18) {
    throw new RangeError(`invalid ${name} position`);
  }
  const fixed = Math.round(value * DOOR_WIRE.coordinateScale);
  if (fixed > 0xffff || fixed < 0) throw new RangeError(`invalid ${name} quantization`);
  return fixed;
}
function readCoordinate(view, index, limit, name) {
  const value = view.getUint16(index, true) / DOOR_WIRE.coordinateScale;
  toCoordinate(value, limit, name);
  return value;
}

// For tests / server-generated proof fixtures. Production browser code must
// NEVER produce a ZoneEntered acknowledgement or locally teleport from one.
export function encodeZoneEntered({ zoneId, requestNonce, fighterId, serverTick, spawnX, spawnY, zoneEpoch }) {
  checkedChoice(zoneId, DOOR_ZONE, "zone ID");
  checkedU32(requestNonce, "requestNonce");
  checkedU32(fighterId, "fighterId", false);
  checkedU32(serverTick, "serverTick");
  checkedU32(zoneEpoch, "zoneEpoch", false);
  const limit = bounds[zoneId];
  const x = toCoordinate(spawnX, limit.width, "x");
  const y = toCoordinate(spawnY, limit.height, "y");
  const buffer = new ArrayBuffer(DOOR_WIRE.enteredBytes);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, DOOR_WIRE.enteredType);
  view.setUint8(2, DOOR_WIRE.manifestVersion);
  view.setUint8(3, zoneId);
  view.setUint32(4, requestNonce, true);
  view.setUint32(8, fighterId, true);
  view.setUint32(12, serverTick, true);
  view.setUint16(16, x, true);
  view.setUint16(18, y, true);
  view.setUint32(20, zoneEpoch, true);
  return buffer;
}

export function decodeZoneEntered(packet) {
  const view = asView(packet);
  validateHeader(view, DOOR_WIRE.enteredType, DOOR_WIRE.enteredBytes);
  const zoneId = view.getUint8(3);
  checkedChoice(zoneId, DOOR_ZONE, "zone ID");
  const fighterId = view.getUint32(8, true), zoneEpoch = view.getUint32(20, true);
  checkedU32(fighterId, "fighterId", false);
  checkedU32(zoneEpoch, "zoneEpoch", false);
  return {
    zoneId,
    requestNonce: view.getUint32(4, true),
    fighterId,
    serverTick: view.getUint32(12, true),
    spawnX: readCoordinate(view, 16, bounds[zoneId].width, "x"),
    spawnY: readCoordinate(view, 18, bounds[zoneId].height, "y"),
    zoneEpoch,
  };
}
