// M147 candidate wire contract. NOT registered in PACKET_TYPE or the live
// transport. Core 8A must review the wire type, reliability and reconnect
// semantics before any real HIT receipt may be sent or consumed.
import { NETWORK } from "./constants.mjs";

export const HIT_RECEIPT_TYPE_PROPOSAL = 5;
export const HIT_RECEIPT_BYTES = 28;

function uint32(value, name, nonzero = false) {
  if (!Number.isInteger(value) || value < (nonzero ? 1 : 0) || value > 0xffffffff) {
    throw new RangeError(`${name} must be a ${nonzero ? "non-zero " : ""}uint32`);
  }
}

export function validateHitReceipt(value) {
  if (!value || typeof value !== "object") throw new TypeError("hit receipt must be an object");
  uint32(value.sequence, "sequence");
  uint32(value.serverTick, "serverTick");
  uint32(value.attacker, "attacker", true);
  uint32(value.target, "target", true);
  if (value.attacker === value.target) throw new RangeError("attacker and target must differ");
  if (!Number.isFinite(value.damage) || value.damage <= 0 || (!Number.isFinite(Math.fround(value.damage)) || Math.fround(value.damage) <= 0)) {
    throw new RangeError("damage must be a positive finite f32");
  }
  if (!Number.isFinite(value.targetHp) || value.targetHp < 0 || !Number.isFinite(Math.fround(value.targetHp))) {
    throw new RangeError("targetHp must be a nonnegative finite f32");
  }
  return value;
}

function dataView(packet) {
  if (packet instanceof DataView) return packet;
  if (packet instanceof ArrayBuffer) return new DataView(packet);
  if (ArrayBuffer.isView(packet)) return new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  throw new TypeError("packet must be an ArrayBuffer or typed view");
}

export function encodeHitReceipt(value) {
  const receipt = validateHitReceipt(value);
  const buffer = new ArrayBuffer(HIT_RECEIPT_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, NETWORK.protocolVersion);
  view.setUint8(1, HIT_RECEIPT_TYPE_PROPOSAL);
  view.setUint32(4, receipt.sequence, true);
  view.setUint32(8, receipt.serverTick, true);
  view.setUint32(12, receipt.attacker, true);
  view.setUint32(16, receipt.target, true);
  view.setFloat32(20, receipt.damage, true);
  view.setFloat32(24, receipt.targetHp, true);
  return buffer;
}

export function decodeHitReceipt(packet) {
  const view = dataView(packet);
  if (view.byteLength !== HIT_RECEIPT_BYTES) throw new RangeError("hit receipt must be 28 bytes");
  if (view.getUint8(0) !== NETWORK.protocolVersion) throw new Error("unsupported protocol version");
  if (view.getUint8(1) !== HIT_RECEIPT_TYPE_PROPOSAL) throw new Error("not a hit receipt");
  if (view.getUint16(2, true) !== 0) throw new Error("reserved hit receipt flags must be zero");
  return validateHitReceipt({
    sequence: view.getUint32(4, true),
    serverTick: view.getUint32(8, true),
    attacker: view.getUint32(12, true),
    target: view.getUint32(16, true),
    damage: view.getFloat32(20, true),
    targetHp: view.getFloat32(24, true),
  });
}
